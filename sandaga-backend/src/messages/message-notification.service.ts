import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { request } from 'https';
import { URL } from 'url';
import { URLSearchParams } from 'url';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { User } from '../users/user.entity';
import { MessageNotificationLog } from './message-notification-log.entity';

type PreferredContactChannel = 'email' | 'sms' | 'phone' | 'whatsapp' | 'in_app';

type NotificationContext = {
  recipient: User;
  sender: User;
  conversation: Conversation;
  message: Message;
};

@Injectable()
export class MessageNotificationService {
  private readonly logger = new Logger(MessageNotificationService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(MessageNotificationLog)
    private readonly logsRepository: Repository<MessageNotificationLog>
  ) {}

  async notifyNewMessage(context: NotificationContext): Promise<void> {
    const { recipient, sender, conversation, message } = context;
    const settings = (recipient.settings ?? {}) as Record<string, unknown>;
    const preferred = this.normalizeChannels(
      settings.preferredContactChannels,
      recipient.isPro
    );

    const emailEnabled =
      typeof settings.emailAlerts === 'boolean' ? settings.emailAlerts : true;
    const smsEnabled =
      typeof settings.importantSmsNotifications === 'boolean'
        ? settings.importantSmsNotifications
        : false;

    const baseUrl =
      this.configService.get<string>('APP_PUBLIC_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:5173';
    const conversationLink = `${baseUrl.replace(/\/$/, '')}/dashboard/messages/${conversation.id}`;
    const senderName = `${sender.firstName ?? ''} ${sender.lastName ?? ''}`.trim() || 'OMAKET';
    const listingTitle = conversation.listing?.title ?? 'votre annonce';

    const messagePreview = message.content?.trim()
      ? message.content.trim().slice(0, 300)
      : 'Vous avez reçu une nouvelle pièce jointe.';
    const body = [
      `Bonjour ${recipient.firstName ?? ''},`,
      '',
      `Nouveau message de ${senderName} au sujet de "${listingTitle}".`,
      messagePreview,
      '',
      `Voir la conversation: ${conversationLink}`
    ].filter(Boolean).join('\n');

    const tasks: Promise<void>[] = [];

    if (preferred.includes('email') && emailEnabled && recipient.email) {
      tasks.push(
        this.dispatchAndLog({
          channel: 'email',
          provider: 'sendgrid',
          destination: recipient.email,
          conversation,
          message,
          recipient,
          send: () =>
            this.sendEmail(
              recipient.email as string,
              `Nouveau message · ${listingTitle}`,
              body
            )
        })
      );
    }

    if (preferred.includes('sms') && smsEnabled && recipient.phoneNumber) {
      tasks.push(
        this.dispatchAndLog({
          channel: 'sms',
          provider: 'twilio',
          destination: recipient.phoneNumber,
          conversation,
          message,
          recipient,
          send: () => this.sendSms(recipient.phoneNumber as string, body)
        })
      );
    }

    if (preferred.includes('whatsapp') && smsEnabled && recipient.phoneNumber) {
      tasks.push(
        this.dispatchAndLog({
          channel: 'whatsapp',
          provider: 'twilio',
          destination: recipient.phoneNumber,
          conversation,
          message,
          recipient,
          send: () => this.sendWhatsApp(recipient.phoneNumber as string, body)
        })
      );
    }

    await Promise.allSettled(tasks);
  }

  private normalizeChannels(
    value: unknown,
    allowWhatsapp: boolean
  ): PreferredContactChannel[] {
    if (!Array.isArray(value)) {
      return ['in_app'];
    }
    const cleaned = value
      .map(channel => String(channel).toLowerCase())
      .filter(channel =>
        ['email', 'sms', 'phone', 'whatsapp', 'in_app'].includes(channel)
      )
      .filter(channel => allowWhatsapp || channel !== 'whatsapp') as PreferredContactChannel[];
    if (!cleaned.includes('in_app')) {
      cleaned.push('in_app');
    }
    return Array.from(new Set(cleaned));
  }

  private async sendSms(to: string, body: string): Promise<DeliveryAttemptResult> {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.configService.get<string>('TWILIO_FROM_SMS');
    if (!accountSid || !authToken || !from) {
      this.logger.warn('Twilio SMS config missing, skipping SMS.');
      return { status: 'skipped', error: 'missing twilio sms config' };
    }

    const url = new URL(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    );
    const payload = new URLSearchParams({
      From: from,
      To: to,
      Body: body
    }).toString();

    return this.postForm(url, payload, accountSid, authToken, 'twilio sms');
  }

  private async sendWhatsApp(to: string, body: string): Promise<DeliveryAttemptResult> {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.configService.get<string>('TWILIO_FROM_WHATSAPP');
    if (!accountSid || !authToken || !from) {
      this.logger.warn('Twilio WhatsApp config missing, skipping WhatsApp.');
      return { status: 'skipped', error: 'missing twilio whatsapp config' };
    }

    const url = new URL(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    );
    const payload = new URLSearchParams({
      From: from,
      To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
      Body: body
    }).toString();

    return this.postForm(url, payload, accountSid, authToken, 'twilio whatsapp');
  }

  private async sendEmail(
    to: string,
    subject: string,
    body: string
  ): Promise<DeliveryAttemptResult> {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    const fromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL');
    if (!apiKey || !fromEmail) {
      this.logger.warn('SendGrid config missing, skipping email.');
      return { status: 'skipped', error: 'missing sendgrid config' };
    }

    const payload = JSON.stringify({
      personalizations: [{ to: [{ email: to }], subject }],
      from: { email: fromEmail },
      content: [{ type: 'text/plain', value: body }]
    });

    return this.postJson(
      new URL('https://api.sendgrid.com/v3/mail/send'),
      payload,
      { Authorization: `Bearer ${apiKey}` },
      'sendgrid'
    );
  }

  private postForm(
    url: URL,
    payload: string,
    accountSid: string,
    authToken: string,
    label: string
  ): Promise<DeliveryAttemptResult> {
    return this.postRequest(
      url,
      payload,
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`
      },
      label
    );
  }

  private postJson(
    url: URL,
    payload: string,
    extraHeaders: Record<string, string>,
    label: string
  ): Promise<DeliveryAttemptResult> {
    return this.postRequest(
      url,
      payload,
      {
        'Content-Type': 'application/json',
        ...extraHeaders
      },
      label
    );
  }

  private postRequest(
    url: URL,
    payload: string,
    headers: Record<string, string>,
    label: string
  ): Promise<DeliveryAttemptResult> {
    return new Promise((resolve) => {
      const req = request(
        {
          method: 'POST',
          hostname: url.hostname,
          path: url.pathname + url.search,
          headers: {
            ...headers,
            'Content-Length': Buffer.byteLength(payload)
          }
        },
        res => {
          const status = res.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            this.logger.warn(`${label} failed with status ${status}`);
            res.resume();
            resolve({ status: 'failed', error: `status ${status}` });
            return;
          }
          res.resume();
          resolve({ status: 'sent' });
        }
      );

      req.on('error', err => {
        this.logger.warn(`${label} request failed: ${err.message}`);
        resolve({ status: 'failed', error: err.message });
      });

      req.write(payload);
      req.end();
    });
  }

  private async dispatchAndLog(payload: {
    channel: PreferredContactChannel;
    provider: string;
    destination: string;
    recipient: User;
    conversation: Conversation;
    message: Message;
    send: () => Promise<DeliveryAttemptResult>;
  }): Promise<void> {
    const result = await payload.send();
    await this.logsRepository.save(
      this.logsRepository.create({
        messageId: payload.message.id,
        conversationId: payload.conversation.id,
        recipientId: payload.recipient.id,
        channel: payload.channel,
        provider: payload.provider,
        destination: payload.destination,
        status: result.status,
        error: result.error ?? null
      })
    );
  }
}

type DeliveryAttemptResult = {
  status: 'sent' | 'failed' | 'skipped';
  error?: string;
};
