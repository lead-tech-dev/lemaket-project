
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { UserRole } from '../src/common/enums/user-role.enum';
import { UpdateProfileDto } from '../src/users/dto/update-profile.dto';
import { UpdateSettingsDto } from '../src/users/dto/update-settings.dto';
import { ChangePasswordDto } from '../src/users/dto/change-password.dto';
import { UpdateUserDto } from '../src/users/dto/update-user.dto';
import { AdminService } from '../src/admin/admin.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;
  let adminService: AdminService;

  const mockUsersService = {
    findOne: jest.fn(),
    updateProfile: jest.fn(),
    updateSettings: jest.fn(),
    changePassword: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn().mockResolvedValue({ id: '1', email: 'user@example.com' }),
    setProStatus: jest.fn().mockResolvedValue({ id: '1', email: 'user@example.com' }),
    remove: jest.fn(),
  };

  const mockAdminService = {
    recordLog: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
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

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
    adminService = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMe', () => {
    it('should call usersService.findOne with the correct user id', async () => {
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      await controller.getMe(user);
      expect(service.findOne).toHaveBeenCalledWith(user.id);
    });
  });

  describe('updateMe', () => {
    it('should call usersService.updateProfile with the correct parameters', async () => {
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      const updateProfileDto: UpdateProfileDto = { firstName: 'Test' };
      await controller.updateMe(user, updateProfileDto);
      expect(service.updateProfile).toHaveBeenCalledWith(user.id, updateProfileDto);
    });
  });

  describe('updateSettings', () => {
    it('should call usersService.updateSettings with the correct parameters', async () => {
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      const updateSettingsDto: UpdateSettingsDto = { enableTwoFactorAuth: true };
      await controller.updateSettings(user, updateSettingsDto);
      expect(service.updateSettings).toHaveBeenCalledWith(
        user.id,
        updateSettingsDto,
      );
    });
  });

  describe('changePassword', () => {
    it('should call usersService.changePassword with the correct parameters', async () => {
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'password',
        newPassword: 'new-password',
      };
      await controller.changePassword(user, changePasswordDto);
      expect(service.changePassword).toHaveBeenCalledWith(
        user.id,
        changePasswordDto,
      );
    });
  });

  describe('findAll', () => {
    it('should call usersService.findAll with the correct parameters', async () => {
      const paginationQuery = { page: 1, limit: 10 };
      await controller.findAll(paginationQuery);
      expect(service.findAll).toHaveBeenCalledWith(paginationQuery);
    });
  });

  describe('findOne', () => {
    it('should call usersService.findOne with the correct id', async () => {
      const id = '1';
      await controller.findOne(id);
      expect(service.findOne).toHaveBeenCalledWith(id);
    });
  });

  describe('update', () => {
    it('should call usersService.update with the correct parameters', async () => {
      const id = '1';
      const updateUserDto: UpdateUserDto = { firstName: 'Test' };
      const actor = { id: 'actor', email: 'admin@example.com', role: UserRole.ADMIN };
      await controller.update(id, updateUserDto, actor);
      expect(service.update).toHaveBeenCalledWith(id, updateUserDto);
      expect(adminService.recordLog).toHaveBeenCalled();
    });
  });

  describe('promoteToPro', () => {
    it('should call usersService.setProStatus with the correct id', async () => {
      const id = '1';
      const actor = { id: 'actor', email: 'admin@example.com', role: UserRole.ADMIN };
      await controller.promoteToPro(id, actor);
      expect(service.setProStatus).toHaveBeenCalledWith(id);
      expect(adminService.recordLog).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should call usersService.remove with the correct id', async () => {
      const id = '1';
      const actor = { id: 'actor', email: 'admin@example.com', role: UserRole.ADMIN };
      await controller.remove(id, actor);
      expect(service.remove).toHaveBeenCalledWith(id);
      expect(adminService.recordLog).toHaveBeenCalled();
    });
  });
});
