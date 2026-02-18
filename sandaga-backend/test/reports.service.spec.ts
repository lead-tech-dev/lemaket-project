
import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from '../src/reports/reports.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Report } from '../src/reports/report.entity';
import { Repository } from 'typeorm';
import { ListingsService } from '../src/listings/listings.service';
import { CreateReportDto } from '../src/reports/dto/create-report.dto';
import { Listing } from '../src/listings/listing.entity';
import { NotFoundException } from '@nestjs/common';

describe('ReportsService', () => {
  let service: ReportsService;
  let repository: Repository<Report>;
  let listingsService: ListingsService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockListingsService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(Report),
          useValue: mockRepository,
        },
        {
          provide: ListingsService,
          useValue: mockListingsService,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    repository = module.get<Repository<Report>>(getRepositoryToken(Report));
    listingsService = module.get<ListingsService>(ListingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new report', async () => {
      const createReportDto: CreateReportDto = {
        listingId: '1',
        reason: 'Test Reason',
      };
      const listing = new Listing();
      listing.id = '1';
      const report = new Report();

      mockListingsService.findOne.mockResolvedValue(listing);
      mockRepository.create.mockReturnValue(report);
      mockRepository.save.mockResolvedValue(report);

      const result = await service.create(createReportDto);

      expect(result).toEqual(report);
      expect(mockListingsService.findOne).toHaveBeenCalledWith('1');
      expect(mockRepository.create).toHaveBeenCalledWith(expect.any(Object));
      expect(mockRepository.save).toHaveBeenCalledWith(report);
    });
  });

  describe('findOne', () => {
    it('should return a report if found', async () => {
      const report = new Report();
      mockRepository.findOne.mockResolvedValue(report);

      const result = await service.findOne('1');

      expect(result).toEqual(report);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' }, relations: { listing: true, reporter: true } });
    });

    it('should throw a NotFoundException if report is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(
        new NotFoundException('Report not found.'),
      );
    });
  });
});
