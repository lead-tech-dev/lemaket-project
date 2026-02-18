import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ListingsService } from '../listings/listings.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ReportStatus } from '../common/enums/report-status.enum';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { ListReportsDto } from './dto/list-reports.dto';
import { User } from '../users/user.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportsRepository: Repository<Report>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly listingsService: ListingsService
  ) {}

  async create(dto: CreateReportDto, reporter?: AuthUser): Promise<Report> {
    if (!dto.listingId && !dto.reportedUserId) {
      throw new BadRequestException('Listing ou utilisateur requis.');
    }

    const listing = dto.listingId ? await this.listingsService.findOne(dto.listingId) : null;
    const reportedUser = dto.reportedUserId
      ? await this.usersRepository.findOne({ where: { id: dto.reportedUserId, isActive: true } })
      : null;

    if (dto.reportedUserId && !reportedUser) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const report = this.reportsRepository.create({
      listing: listing ?? undefined,
      listingId: listing?.id ?? null,
      reportedUser,
      reportedUserId: reportedUser?.id ?? null,
      reason: dto.reason,
      details: dto.details,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      reporterId: reporter?.id
    });

    if (dto.status) {
      report.status = dto.status;
    }

    return this.reportsRepository.save(report);
  }

  async findAll(query: ListReportsDto): Promise<PaginatedResult<Report>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = query.status ? { status: query.status } : {};

    const [data, total] = await this.reportsRepository.findAndCount({
      where,
      relations: {
        listing: { owner: true },
        reporter: true,
        reportedUser: true
      },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit
    });

    return {
      data,
      total,
      page,
      limit
    };
  }

  async findOne(id: string): Promise<Report> {
    const report = await this.reportsRepository.findOne({
      where: { id },
      relations: { listing: true, reporter: true, reportedUser: true }
    });

    if (!report) {
      throw new NotFoundException('Report not found.');
    }

    return report;
  }

  async update(id: string, dto: UpdateReportDto): Promise<Report> {
    const report = await this.findOne(id);
    Object.assign(report, dto);

    if (dto.status) {
      if (dto.status === ReportStatus.RESOLVED) {
        report.resolvedAt = new Date();
      } else {
        report.resolvedAt = null;
      }
    }

    return this.reportsRepository.save(report);
  }
}
