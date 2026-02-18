import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Workbook } from 'exceljs';
import { User } from '../users/user.entity';
import { Category } from '../categories/category.entity';
import { Report } from '../reports/report.entity';
import { AdminLog } from './admin-log.entity';
import { Listing } from '../listings/listing.entity';
import { AuditScope } from './dto/audit-query.dto';
import { ExportFormat } from './dto/export-request.dto';

type ExportJobStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface ExportJobState {
  id: string;
  scope: AuditScope;
  format: ExportFormat;
  status: ExportJobStatus;
  created_at: Date;
  updatedAt: Date;
  total: number;
  processed: number;
  progress: number;
  filename?: string;
  error?: string;
}

type ExportPayload = {
  buffer: Buffer;
  mime: string;
};

const MAX_EXPORT_ROWS = 2000;

@Injectable()
export class AdminExportService {
  private readonly jobs = new Map<string, ExportJobState>();
  private readonly files = new Map<string, ExportPayload>();

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Report)
    private readonly reportsRepository: Repository<Report>,
    @InjectRepository(AdminLog)
    private readonly logsRepository: Repository<AdminLog>,
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>
  ) {}

  startExport(scope: AuditScope, format: ExportFormat): ExportJobState {
    const job: ExportJobState = {
      id: randomUUID(),
      scope,
      format,
      status: 'pending',
      created_at: new Date(),
      updatedAt: new Date(),
      total: 0,
      processed: 0,
      progress: 0
    };

    this.jobs.set(job.id, job);
    void this.runExport(job.id);
    return job;
  }

  getJob(jobId: string): ExportJobState {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException('Export job not found.');
    }
    return job;
  }

  getJobFile(jobId: string): { buffer: Buffer; mime: string; filename: string } {
    const job = this.getJob(jobId);
    if (job.status !== 'completed' || !job.filename) {
      throw new BadRequestException('Export is not ready for download.');
    }

    const payload = this.files.get(jobId);
    if (!payload) {
      throw new NotFoundException('Export payload unavailable.');
    }

    return { ...payload, filename: job.filename };
  }

  private async runExport(jobId: string) {
    const job = this.getJob(jobId);
    job.status = 'in_progress';
    job.updatedAt = new Date();

    try {
      const { headers, rows } = await this.collectData(job.scope);
      job.total = rows.length;
      job.processed = 0;
      job.progress = rows.length === 0 ? 1 : 0;

      const chunkSize = Math.max(1, Math.ceil((rows.length || 1) / 10));
      const processedRows: string[][] = [];

      for (let index = 0; index < rows.length; index += 1) {
        processedRows.push(rows[index]);
        job.processed = index + 1;
        job.progress = job.total ? job.processed / job.total : 1;
        job.updatedAt = new Date();

        if ((index + 1) % chunkSize === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      const filename = `${job.scope}-${new Date()
        .toISOString()
        .replace(/[:.]/g, '-')}.${job.format}`;
      let buffer: Buffer;
      let mime: string;

      if (job.format === ExportFormat.CSV) {
        buffer = Buffer.from(this.createCsv(headers, processedRows), 'utf8');
        mime = 'text/csv';
      } else {
        const workbook = new Workbook();
        const worksheet = workbook.addWorksheet('Export');
        worksheet.addRow(headers);
        processedRows.forEach(row => worksheet.addRow(row));
        const excelBuffer = await workbook.xlsx.writeBuffer();
        buffer = Buffer.from(excelBuffer);
        mime =
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }

      job.status = 'completed';
      job.progress = 1;
      job.filename = filename;
      job.updatedAt = new Date();

      this.files.set(job.id, { buffer, mime });
    } catch (error) {
      job.status = 'failed';
      job.error =
        error instanceof Error ? error.message : 'Une erreur est survenue.';
      job.updatedAt = new Date();
    }
  }

  private async collectData(scope: AuditScope): Promise<{
    headers: string[];
    rows: string[][];
  }> {
    switch (scope) {
      case AuditScope.USERS: {
        const users = await this.usersRepository.find({
          order: { created_at: 'DESC' },
          take: MAX_EXPORT_ROWS
        });
        const headers = ['ID', 'Nom', 'Email', 'Rôle', 'Actif', 'Créé le'];
        const rows = users.map(user => [
          user.id,
          `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
          user.email,
          user.role,
          user.isActive ? 'Oui' : 'Non',
          user.created_at?.toISOString() ?? ''
        ]);
        return { headers, rows };
      }
      case AuditScope.CATEGORIES: {
        const categories = await this.categoriesRepository.find({
          order: { position: 'ASC', name: 'ASC' },
          take: MAX_EXPORT_ROWS
        });
        const headers = [
          'ID',
          'Nom',
          'Slug',
          'Active',
          'Position',
          'Nombre annonces'
        ];
        const rows = await Promise.all(
          categories.map(async category => {
            const listingCount = await this.listingsRepository.count({
              where: { category: { id: category.id } }
            });
            return [
              category.id,
              category.name,
              category.slug,
              category.isActive ? 'Oui' : 'Non',
              category.position?.toString() ?? '0',
              listingCount.toString()
            ];
          })
        );
        return { headers, rows };
      }
      case AuditScope.REPORTS: {
        const reports = await this.reportsRepository.find({
          relations: { listing: true, reporter: true },
          order: { created_at: 'DESC' },
          take: MAX_EXPORT_ROWS
        });
        const headers = [
          'ID',
          'Annonce',
          'Raison',
          'Statut',
          'Signalé par',
          'Créé le'
        ];
        const rows = reports.map(report => [
          report.id,
          report.listing?.title ?? report.listingId,
          report.reason,
          report.status,
          report.reporter?.email ?? report.contactEmail ?? 'Anonyme',
          report.created_at?.toISOString() ?? ''
        ]);
        return { headers, rows };
      }
      case AuditScope.LOGS: {
        const logs = await this.logsRepository.find({
          order: { created_at: 'DESC' },
          take: MAX_EXPORT_ROWS
        });
        const headers = [
          'ID',
          'Action',
          'Détails',
          'Utilisateur',
          'Rôle',
          'Adresse IP',
          'Créé le'
        ];
        const rows = logs.map(log => [
          log.id,
          log.action,
          log.details ?? '',
          log.actorName ?? 'Système',
          log.actorRole ?? '',
          log.ipAddress ?? '',
          log.created_at?.toISOString() ?? ''
        ]);
        return { headers, rows };
      }
      case AuditScope.COMPANY_VERIFICATIONS: {
        const users = await this.usersRepository.find({
          where: { isPro: true },
          order: { companyVerificationSubmittedAt: 'DESC' },
          take: MAX_EXPORT_ROWS
        });
        const headers = [
          'ID',
          'Entreprise',
          'Email',
          'RCCM',
          'NIU',
          'Ville',
          'Statut',
          'Soumis le',
          'Revu le'
        ];
        const rows = users.map(user => [
          user.id,
          user.companyName ?? '',
          user.email,
          user.companyRccm ?? '',
          user.companyNiu ?? '',
          user.companyCity ?? '',
          user.companyVerificationStatus ?? '',
          user.companyVerificationSubmittedAt?.toISOString() ?? '',
          user.companyVerificationReviewedAt?.toISOString() ?? ''
        ]);
        return { headers, rows };
      }
      case AuditScope.COURIER_VERIFICATIONS: {
        const users = await this.usersRepository
          .createQueryBuilder('user')
          .where("user.settings ->> 'isCourier' = 'true'")
          .orderBy('"user"."courierVerificationSubmittedAt"', 'DESC')
          .take(MAX_EXPORT_ROWS)
          .getMany();
        const headers = [
          'ID',
          'Nom',
          'Email',
          'Localisation',
          'Statut',
          'Soumis le',
          'Revu le'
        ];
        const rows = users.map(user => [
          user.id,
          `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
          user.email,
          user.location ?? '',
          user.courierVerificationStatus ?? '',
          user.courierVerificationSubmittedAt?.toISOString() ?? '',
          user.courierVerificationReviewedAt?.toISOString() ?? ''
        ]);
        return { headers, rows };
      }
      case AuditScope.PROMOTIONS:
      case AuditScope.LISTINGS: {
        // These scopes reuse logs exports for simplicity.
        const logs = await this.logsRepository.find({
          where: { action: Like(`${scope}.%`) },
          order: { created_at: 'DESC' },
          take: MAX_EXPORT_ROWS
        });
        const headers = [
          'ID',
          'Action',
          'Détails',
          'Utilisateur',
          'Rôle',
          'Adresse IP',
          'Créé le'
        ];
        const rows = logs.map(log => [
          log.id,
          log.action,
          log.details ?? '',
          log.actorName ?? 'Système',
          log.actorRole ?? '',
          log.ipAddress ?? '',
          log.created_at?.toISOString() ?? ''
        ]);
        return { headers, rows };
      }
      default:
        throw new BadRequestException(`Unsupported export scope: ${scope}`);
    }
  }

  private createCsv(headers: string[], rows: string[][]): string {
    const escape = (value: string) => {
      const normalized = value ?? '';
      const needsQuotes = /[",;\n]/.test(normalized);
      const safe = normalized.replace(/"/g, '""');
      return needsQuotes ? `"${safe}"` : safe;
    };

    const csvRows = [
      headers.map(header => escape(header)),
      ...rows.map(row => row.map(cell => escape(String(cell ?? ''))))
    ];

    return csvRows.map(row => row.join(';')).join('\n');
  }
}
