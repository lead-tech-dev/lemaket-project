
import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from '../src/reports/reports.controller';
import { ReportsService } from '../src/reports/reports.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { CreateReportDto } from '../src/reports/dto/create-report.dto';
import { ReportStatus } from '../src/common/enums/report-status.enum';
import { UpdateReportDto } from '../src/reports/dto/update-report.dto';
import { UserRole } from '../src/common/enums/user-role.enum';
import { AdminService } from '../src/admin/admin.service';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReportsService;
  let adminService: AdminService;

  const mockReportsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn().mockResolvedValue({ id: '1', status: ReportStatus.RESOLVED }),
  };

  const mockAdminService = {
    recordLog: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: mockReportsService,
        },
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReportsController>(ReportsController);
    service = module.get<ReportsService>(ReportsService);
    adminService = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call reportsService.create with the correct parameters', async () => {
      const createReportDto: CreateReportDto = {
        listingId: '1',
        reason: 'Test Reason',
      };
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      await controller.create(createReportDto, user);
      expect(service.create).toHaveBeenCalledWith(createReportDto, user);
    });
  });

  describe('findAll', () => {
    it('should call reportsService.findAll with the correct parameters', async () => {
      const query = { status: 'PENDING' } as any;
      await controller.findAll(query);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('update', () => {
    it('should call reportsService.update with the correct parameters', async () => {
      const id = '1';
      const updateReportDto: UpdateReportDto = { status: ReportStatus.RESOLVED };
      const actor = { id: 'actor', email: 'admin@example.com', role: UserRole.ADMIN };
      await controller.update(id, updateReportDto, actor);
      expect(service.update).toHaveBeenCalledWith(id, updateReportDto);
      expect(adminService.recordLog).toHaveBeenCalled();
    });
  });
});
