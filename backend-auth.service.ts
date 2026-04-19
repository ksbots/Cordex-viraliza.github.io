/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUTH MODULE — WebAuthn (Passkeys) + JWT + OAuth 2.0 + MFA
 * OWASP Top 10 2026 compliance: A07 (Auth failures), A02 (Crypto failures)
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── src/modules/auth/auth.module.ts ─────────────────────────────────────────
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WebAuthnService } from './webauthn.service';
import { MfaService } from './mfa.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GitHubStrategy } from './strategies/github.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: '15m',         // Short-lived access token
          issuer: 'acelera.digital',
          audience: 'acelera-api',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, WebAuthnService, MfaService,
    JwtStrategy, GoogleStrategy, GitHubStrategy,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}


// ── src/modules/auth/auth.controller.ts ────────────────────────────────────
import {
  Controller, Post, Get, Body, Req, Res,
  UseGuards, HttpCode, HttpStatus, Version,
  Headers, Ip,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { WebAuthnService } from './webauthn.service';
import { MfaService } from './mfa.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import {
  LoginDto, RegisterDto, RefreshTokenDto,
  WebAuthnRegistrationDto, WebAuthnAuthenticationDto,
  MfaVerifyDto, ForgotPasswordDto, ResetPasswordDto,
} from './dto';
import type { Request, Response } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly webAuthnService: WebAuthnService,
    private readonly mfaService: MfaService,
  ) {}

  // ── REGISTER ─────────────────────────────────────────────────────────────
  @Post('register')
  @Version('1')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 registrations/min per IP
  @ApiOperation({ summary: 'Register new user account' })
  async register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.authService.register(dto, ip);
  }

  // ── LOGIN (email + password + optional MFA) ──────────────────────────────
  @Post('login')
  @Version('1')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // Rate limit: prevents brute force
  @ApiOperation({ summary: 'Authenticate with email/password + optional MFA' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    const result = await this.authService.login(dto, ip, ua);
    
    // HttpOnly cookie for refresh token — prevents XSS token theft
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth/refresh',
    });

    return {
      accessToken: result.accessToken,
      user: result.user,
      requiresMfa: result.requiresMfa,
    };
  }

  // ── REFRESH TOKEN ─────────────────────────────────────────────────────────
  @Post('refresh')
  @Version('1')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    const result = await this.authService.refreshTokens(refreshToken);
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true, secure: true, sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/refresh',
    });
    return { accessToken: result.accessToken };
  }

  // ── LOGOUT ───────────────────────────────────────────────────────────────
  @Post('logout')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.sub);
    res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
  }

  // ── WEBAUTHN (Passkeys) — REGISTRATION ───────────────────────────────────
  @Post('webauthn/register/options')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getWebAuthnRegistrationOptions(@Req() req: any) {
    return this.webAuthnService.generateRegistrationOptions(req.user.sub);
  }

  @Post('webauthn/register/verify')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async verifyWebAuthnRegistration(
    @Req() req: any,
    @Body() dto: WebAuthnRegistrationDto,
  ) {
    return this.webAuthnService.verifyRegistration(req.user.sub, dto);
  }

  // ── WEBAUTHN (Passkeys) — AUTHENTICATION ─────────────────────────────────
  @Post('webauthn/auth/options')
  @Version('1')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async getWebAuthnAuthOptions(@Body('email') email: string) {
    return this.webAuthnService.generateAuthenticationOptions(email);
  }

  @Post('webauthn/auth/verify')
  @Version('1')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async verifyWebAuthnAuth(
    @Body() dto: WebAuthnAuthenticationDto,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const result = await this.webAuthnService.verifyAuthentication(dto, ip);
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true, secure: true, sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/refresh',
    });
    return { accessToken: result.accessToken, user: result.user };
  }

  // ── MFA SETUP ────────────────────────────────────────────────────────────
  @Post('mfa/setup')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async setupMfa(@Req() req: any) {
    return this.mfaService.generateSecret(req.user.sub);
  }

  @Post('mfa/verify')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async verifyMfa(@Req() req: any, @Body() dto: MfaVerifyDto) {
    return this.mfaService.verify(req.user.sub, dto.code);
  }

  // ── OAUTH 2.0 — GOOGLE ───────────────────────────────────────────────────
  @Get('google')
  @Version('1')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {} // Redirects to Google

  @Get('google/callback')
  @Version('1')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.oauthLogin(req.user, 'google');
    const url = `${process.env.FRONTEND_URL}/auth/callback?token=${result.accessToken}`;
    res.redirect(url);
  }

  // ── OAUTH 2.0 — GITHUB ───────────────────────────────────────────────────
  @Get('github')
  @Version('1')
  @UseGuards(AuthGuard('github'))
  async githubAuth() {}

  @Get('github/callback')
  @Version('1')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.oauthLogin(req.user, 'github');
    const url = `${process.env.FRONTEND_URL}/auth/callback?token=${result.accessToken}`;
    res.redirect(url);
  }

  // ── PASSWORD RESET ───────────────────────────────────────────────────────
  @Post('forgot-password')
  @Version('1')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ short: { limit: 3, ttl: 300000 } }) // 3 resets per 5 min
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.initiatePasswordReset(dto.email);
    // Always return same response to prevent email enumeration (OWASP)
    return { message: 'If an account exists, a reset email has been sent.' };
  }

  @Post('reset-password')
  @Version('1')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}


// ── src/modules/auth/auth.service.ts ─────────────────────────────────────────
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectCache } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuditLog } from './entities/audit-log.entity';
import type { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(RefreshToken) private refreshRepo: Repository<RefreshToken>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectCache() private cache: Cache,
    private jwt: JwtService,
    private config: ConfigService,
    private dataSource: DataSource,
  ) {}

  async register(dto: RegisterDto, ip: string) {
    // Check email uniqueness
    const existing = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email already in use');

    // Hash password with Argon2id (OWASP recommended over bcrypt)
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,  // 64MB
      timeCost: 3,
      parallelism: 4,
    });

    const user = this.userRepo.create({
      email: dto.email.toLowerCase(),
      name: dto.name,
      passwordHash,
      role: 'user',
      emailVerified: false,
      createdAt: new Date(),
    });

    await this.userRepo.save(user);
    await this.logAudit(user.id, 'REGISTER', ip, 'success');

    // Send verification email (async, non-blocking)
    this.sendVerificationEmail(user).catch(console.error);

    const { accessToken, refreshToken } = await this.generateTokenPair(user);
    return { accessToken, refreshToken, user: this.sanitizeUser(user) };
  }

  async login(dto: LoginDto, ip: string, userAgent: string) {
    // Check account lockout (brute force protection)
    const lockKey = `lockout:${dto.email.toLowerCase()}`;
    const lockout = await this.cache.get<number>(lockKey);
    if (lockout && lockout >= 5) {
      await this.logAudit(null, 'LOGIN_BLOCKED', ip, 'blocked', dto.email);
      throw new UnauthorizedException('Account temporarily locked. Try again in 15 minutes.');
    }

    const user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
      select: ['id', 'email', 'name', 'passwordHash', 'role', 'mfaEnabled', 'mfaSecret', 'isActive'],
    });

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      // Increment failed attempts
      const attempts = (lockout || 0) + 1;
      await this.cache.set(lockKey, attempts, 900); // 15min lockout window
      await this.logAudit(user?.id, 'LOGIN_FAILED', ip, 'failed', dto.email);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account suspended. Contact support.');
    }

    // MFA verification
    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        return { requiresMfa: true, tempToken: await this.createTempMfaToken(user.id) };
      }
      const { totp } = await import('otplib');
      if (!totp.verify({ token: dto.mfaCode, secret: user.mfaSecret })) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    // Clear lockout on success
    await this.cache.del(lockKey);
    await this.logAudit(user.id, 'LOGIN_SUCCESS', ip, 'success');

    const { accessToken, refreshToken } = await this.generateTokenPair(user);
    return { accessToken, refreshToken, user: this.sanitizeUser(user), requiresMfa: false };
  }

  async refreshTokens(token: string) {
    if (!token) throw new UnauthorizedException('No refresh token');

    const storedToken = await this.refreshRepo.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!storedToken || storedToken.expiresAt < new Date() || storedToken.revoked) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Refresh token rotation — invalidate old, issue new
    await this.refreshRepo.update(storedToken.id, { revoked: true });
    return this.generateTokenPair(storedToken.user);
  }

  async logout(userId: string) {
    // Revoke all active refresh tokens for this user
    await this.refreshRepo.update(
      { userId, revoked: false },
      { revoked: true },
    );
    // Blacklist current JWT until expiry
    await this.cache.set(`blacklist:${userId}`, true, 900);
  }

  private async generateTokenPair(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const [accessToken, refreshTokenValue] = await Promise.all([
      this.jwt.signAsync(payload),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    // Store hashed refresh token
    const tokenHash = await argon2.hash(refreshTokenValue);
    await this.refreshRepo.save({
      token: tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return { accessToken, refreshToken: refreshTokenValue };
  }

  async oauthLogin(profile: any, provider: 'google' | 'github') {
    let user = await this.userRepo.findOne({ where: { email: profile.email } });
    if (!user) {
      user = await this.userRepo.save(this.userRepo.create({
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.picture,
        provider,
        providerId: profile.id,
        emailVerified: true,
        role: 'user',
      }));
    }
    return this.generateTokenPair(user);
  }

  private sanitizeUser(user: User) {
    const { passwordHash, mfaSecret, ...safe } = user;
    return safe;
  }

  private async logAudit(userId: string | null, action: string, ip: string, status: string, email?: string) {
    await this.auditRepo.save(this.auditRepo.create({
      userId, action, ip, status, email, createdAt: new Date(),
    }));
  }

  private async sendVerificationEmail(user: User) {
    // Integration with email service (SendGrid/Resend)
  }

  private async createTempMfaToken(userId: string) {
    const token = uuidv4();
    await this.cache.set(`mfa_temp:${token}`, userId, 300); // 5 min
    return token;
  }

  async initiatePasswordReset(email: string) {
    const user = await this.userRepo.findOne({ where: { email: email.toLowerCase() } });
    if (!user) return; // Silent fail prevents email enumeration
    const token = uuidv4();
    await this.cache.set(`pwd_reset:${token}`, user.id, 3600); // 1 hour
    // Send email with reset link (async)
  }

  async resetPassword(dto: { token: string; newPassword: string }) {
    const userId = await this.cache.get<string>(`pwd_reset:${dto.token}`);
    if (!userId) throw new BadRequestException('Invalid or expired token');
    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.userRepo.update(userId, { passwordHash });
    await this.cache.del(`pwd_reset:${dto.token}`);
    // Revoke all sessions
    await this.refreshRepo.update({ userId, revoked: false }, { revoked: true });
  }
}
