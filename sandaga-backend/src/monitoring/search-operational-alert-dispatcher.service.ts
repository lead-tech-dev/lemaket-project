import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request } from 'https';
import { URL } from 'url';
import { SearchOperationalAlertsService, SearchOperationalStatus } from './search-operational-alerts.service';
import { SearchOperationalAlertSettingsService } from './search-operational-alert-settings.service';

type AlertDispatchChannel = 'webhook' | 'email';

type AlertDispatchChannelResult = {
  channel: AlertDispatchChannel;
  sent: boolean;
  reason?: string;
};

export type SearchAlertDispatchResult = {
  status: SearchOperationalStatus['status'];
  generatedAt: string;
  dispatched: boolean;
  suppressed: boolean;
  cooldownSeconds: number;
  fingerprint: string | null;
  channels: AlertDispatchChannelResult[];
  message: string;
};

@Injectable()
export class SearchOperationalAlertDispatcherService {
  private readonly logger = new Logger(SearchOperationalAlertDispatcherService.name);
  private lastFingerprint: string | null = null;
  private lastDispatchedAtMs = 0;

  constructor(
    private readonly searchOperationalAlerts: SearchOperationalAlertsService,
    private readonly settingsService: SearchOperationalAlertSettingsService,
    private readonly configService: ConfigService
  ) {}

  async dispatch(force = false): Promise<SearchAlertDispatchResult> {
    const settings = await this.settingsService.getSettings();
    const enabled = settings.dispatchEnabled;
    const cooldownSeconds = settings.dispatchCooldownSeconds;
    const status = await this.searchOperationalAlerts.getStatus();
    const message = this.buildMessage(status);
    const fingerprint = status.status === 'ok' ? null : this.buildFingerprint(status);

    if (!enabled) {
      return {
        status: status.status,
        generatedAt: status.generatedAt,
        dispatched: false,
        suppressed: false,
        cooldownSeconds,
        fingerprint,
        channels: [],
        message: 'Dispatch désactivé (SEARCH_ALERT_DISPATCH_ENABLED=false).'
      };
    }

    if (status.status === 'ok') {
      this.lastFingerprint = null;
      this.lastDispatchedAtMs = 0;
      return {
        status: status.status,
        generatedAt: status.generatedAt,
        dispatched: false,
        suppressed: false,
        cooldownSeconds,
        fingerprint: null,
        channels: [],
        message: 'Aucune alerte active.'
      };
    }

    if (!force && this.isSuppressed(fingerprint, cooldownSeconds)) {
      return {
        status: status.status,
        generatedAt: status.generatedAt,
        dispatched: false,
        suppressed: true,
        cooldownSeconds,
        fingerprint,
        channels: [],
        message: 'Alerte supprimée par cooldown.'
      };
    }

    const channels = await this.dispatchToChannels(status, message);
    const dispatched = channels.some(channel => channel.sent);
    if (dispatched && fingerprint) {
      this.lastFingerprint = fingerprint;
      this.lastDispatchedAtMs = Date.now();
    }

    return {
      status: status.status,
      generatedAt: status.generatedAt,
      dispatched,
      suppressed: false,
      cooldownSeconds,
      fingerprint,
      channels,
      message
    };
  }

  private isSuppressed(fingerprint: string | null, cooldownSeconds: number): boolean {
    if (!fingerprint || !this.lastFingerprint || this.lastFingerprint !== fingerprint) {
      return false;
    }
    if (cooldownSeconds <= 0) {
      return false;
    }
    return Date.now() - this.lastDispatchedAtMs < cooldownSeconds * 1000;
  }

  private async dispatchToChannels(
    status: SearchOperationalStatus,
    message: string
  ): Promise<AlertDispatchChannelResult[]> {
    const channels: AlertDispatchChannelResult[] = [];

    const webhookUrl = this.configService.get<string>('SEARCH_ALERT_WEBHOOK_URL')?.trim();
    if (webhookUrl) {
      const sent = await this.sendWebhook(webhookUrl, status, message);
      channels.push({
        channel: 'webhook',
        sent,
        reason: sent ? undefined : 'Webhook échoué'
      });
    }

    const emailRecipients = this.parseRecipients(
      this.configService.get<string>('SEARCH_ALERT_EMAIL_TO') ?? ''
    );
    if (emailRecipients.length > 0) {
      const sent = await this.sendEmail(emailRecipients, status, message);
      channels.push({
        channel: 'email',
        sent,
        reason: sent ? undefined : 'Email échoué ou configuration absente'
      });
    }

    if (channels.length === 0) {
      this.logger.warn('No external channel configured for search operational alerts.');
    }

    return channels;
  }

  private buildFingerprint(status: SearchOperationalStatus): string {
    const conciseAlerts = status.alerts.map(alert => ({
      severity: alert.severity,
      component: alert.component,
      metric: alert.metric,
      value: alert.value
    }));
    return JSON.stringify({
      status: status.status,
      alerts: conciseAlerts
    });
  }

  private buildMessage(status: SearchOperationalStatus): string {
    const lines: string[] = [];
    lines.push(`Search status: ${status.status.toUpperCase()}`);
    lines.push(`Generated at: ${status.generatedAt}`);
    lines.push(
      `Window: ${status.snapshot.windowSeconds}s | listings(withSearch): ${status.snapshot.listings.withSearch.total} | suggestions: ${status.snapshot.suggestions.total}`
    );
    if (status.alerts.length > 0) {
      lines.push('Alerts:');
      for (const alert of status.alerts) {
        lines.push(
          `- [${alert.severity}] ${alert.component}.${alert.metric}=${alert.value} (threshold=${alert.threshold})`
        );
      }
    }
    if (status.notes.length > 0) {
      lines.push('Notes:');
      for (const note of status.notes) {
        lines.push(`- ${note}`);
      }
    }
    return lines.join('\n');
  }

  private async sendWebhook(
    webhookUrl: string,
    status: SearchOperationalStatus,
    message: string
  ): Promise<boolean> {
    try {
      const payload = JSON.stringify({
        source: 'lemaket-search-monitoring',
        status: status.status,
        generatedAt: status.generatedAt,
        alerts: status.alerts,
        notes: status.notes,
        snapshot: status.snapshot,
        message
      });
      return await this.postJson(
        new URL(webhookUrl),
        payload,
        {},
        'search-alert-webhook'
      );
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`search-alert-webhook invalid URL or request failed: ${messageText}`);
      return false;
    }
  }

  private async sendEmail(
    recipients: string[],
    status: SearchOperationalStatus,
    message: string
  ): Promise<boolean> {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    const fromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL');
    if (!apiKey || !fromEmail) {
      this.logger.warn('SendGrid config missing for search operational email alerts.');
      return false;
    }

    const subject = `[LEMAKET][SEARCH][${status.status.toUpperCase()}] ${status.alerts.length} alerte(s)`;
    const payload = JSON.stringify({
      personalizations: [{ to: recipients.map(email => ({ email })), subject }],
      from: { email: fromEmail },
      content: [{ type: 'text/plain', value: message }]
    });

    return this.postJson(
      new URL('https://api.sendgrid.com/v3/mail/send'),
      payload,
      { Authorization: `Bearer ${apiKey}` },
      'search-alert-email'
    );
  }

  private postJson(
    url: URL,
    payload: string,
    extraHeaders: Record<string, string>,
    label: string
  ): Promise<boolean> {
    return new Promise(resolve => {
      const req = request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            ...extraHeaders
          }
        },
        response => {
          response.on('data', () => undefined);
          response.on('end', () => {
            const ok = Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 300);
            if (!ok) {
              this.logger.warn(`${label} failed with status ${response.statusCode ?? 'unknown'}`);
            }
            resolve(ok);
          });
        }
      );

      req.on('error', error => {
        this.logger.warn(`${label} request error: ${error.message}`);
        resolve(false);
      });

      req.write(payload);
      req.end();
    });
  }

  private parseRecipients(input: string): string[] {
    return input
      .split(',')
      .map(value => value.trim())
      .filter(value => value.length > 0);
  }

}
