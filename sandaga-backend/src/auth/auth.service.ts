import { randomBytes } from 'crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetToken } from './password-reset-token.entity';
import { JwtPayload } from './jwt-payload.interface';
import { User } from '../users/user.entity';
import { UserRole } from '../common/enums/user-role.enum';

export interface AuthResponse {
  accessToken: string;
  user: User;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokenRepository: Repository<PasswordResetToken>
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email is already registered.');
    }

    const user = await this.usersService.create({
      email: registerDto.email,
      password: registerDto.password,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      phoneNumber: registerDto.phoneNumber,
      isPro: registerDto.isPro ?? false,
      role: registerDto.isPro ? UserRole.PRO : UserRole.USER,
      proActivatedAt: registerDto.isPro ? new Date().toISOString() : null,
      companyName: registerDto.companyName,
      companyId: registerDto.companyId,
      companyNiu: registerDto.companyNiu,
      companyRccm: registerDto.companyRccm,
      companyCity: registerDto.companyCity
    });

    return this.buildAuthResponse(user);
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.validateCredentials(
      loginDto.email,
      loginDto.password
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    await this.usersService.markLastLogin(user.id);
    return this.buildAuthResponse(user);
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);

    if (!user) {
      // Avoid leaking account existence
      return {
        message: 'If an account exists, password reset instructions were sent.'
      };
    }

    const tokenValue = randomBytes(32).toString('hex');
    const expiresInMinutes = Number(
      this.configService.get<number>('auth.resetTokenExpiresInMinutes') ?? 60
    );

    const token = this.resetTokenRepository.create({
      token: tokenValue,
      user,
      expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000)
    });

    await this.resetTokenRepository.save(token);

    // In a real application, an email would be sent here.
    return {
      message: 'Password reset instructions were sent if the account exists.'
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const token = await this.resetTokenRepository.findOne({
      where: { token: resetPasswordDto.token },
      relations: { user: true }
    });

    if (!token) {
      throw new NotFoundException('Invalid or expired reset token.');
    }

    if (token.used) {
      throw new ConflictException('Reset token has already been used.');
    }

    if (token.expiresAt.getTime() < Date.now()) {
      throw new ConflictException('Reset token has expired.');
    }

    await this.usersService.updatePassword(token.user.id, resetPasswordDto.password);

    token.used = true;
    await this.resetTokenRepository.save(token);
  }

  private buildAuthResponse(user: User): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role
    };

    const expiresIn = this.configService.get<number>('auth.accessTokenTtlSeconds') ?? 3600;
    const accessToken = this.jwtService.sign(payload, { expiresIn });

    return {
      accessToken,
      user,
      expiresIn
    };
  }
}
