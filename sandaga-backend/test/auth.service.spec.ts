
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PasswordResetToken } from '../src/auth/password-reset-token.entity';
import { User } from '../src/users/user.entity';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    validateCredentials: jest.fn(),
    markLastLogin: jest.fn(),
    updatePassword: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockResetTokenRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getRepositoryToken(PasswordResetToken),
          useValue: mockResetTokenRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user and return an auth response', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'User',
        phoneNumber: '1234567890',
      };
      const user = new User();
      user.email = registerDto.email;

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(user);
      mockJwtService.sign.mockReturnValue('test-token');
      mockConfigService.get.mockReturnValue(3600);

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken', 'test-token');
      expect(result).toHaveProperty('user', user);
      expect(usersService.findByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(usersService.create).toHaveBeenCalledWith(registerDto);
    });

    it('should throw a ConflictException if email is already registered', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'User',
        phoneNumber: '1234567890',
      };
      const user = new User();

      mockUsersService.findByEmail.mockResolvedValue(user);

      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException('Email is already registered.'),
      );
    });
  });

  describe('login', () => {
    it('should login a user and return an auth response', async () => {
      const loginDto = { email: 'test@example.com', password: 'password' };
      const user = new User();
      user.id = '1';

      mockUsersService.validateCredentials.mockResolvedValue(user);
      mockJwtService.sign.mockReturnValue('test-token');
      mockConfigService.get.mockReturnValue(3600);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken', 'test-token');
      expect(result).toHaveProperty('user', user);
      expect(usersService.validateCredentials).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
      expect(usersService.markLastLogin).toHaveBeenCalledWith(user.id);
    });

    it('should throw an UnauthorizedException for invalid credentials', async () => {
      const loginDto = { email: 'test@example.com', password: 'password' };

      mockUsersService.validateCredentials.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials.'),
      );
    });
  });
});
