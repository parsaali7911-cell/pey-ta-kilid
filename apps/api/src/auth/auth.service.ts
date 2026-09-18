import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { appEnv } from '../env';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

function hashNationalId(nationalId: string): string {
  return createHash('sha256').update(`peytakilid:nid:${nationalId}`).digest('hex');
}

function assertValidIranNationalId(code: string) {
  if (!/^\d{10}$/.test(code) || /^(\d)\1{9}$/.test(code)) {
    throw new BadRequestException('Invalid national ID');
  }
  const check = Number(code[9]);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(code[i]) * (10 - i);
  const r = sum % 11;
  const ok = (r < 2 && check === r) || (r >= 2 && check === 11 - r);
  if (!ok) throw new BadRequestException('Invalid national ID');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email already registered');

    const firstName = dto.firstName?.trim() || null;
    const lastName = dto.lastName?.trim() || null;
    const fullName =
      dto.fullName?.trim() ||
      ([firstName, lastName].filter(Boolean).join(' ') || null);

    let nationalIdHash: string | null = null;
    let nationalIdLast4: string | null = null;
    if (dto.nationalId) {
      const nid = dto.nationalId.replace(/\D/g, '');
      assertValidIranNationalId(nid);
      nationalIdHash = hashNationalId(nid);
      nationalIdLast4 = nid.slice(-4);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        fullName,
        firstName,
        lastName,
        nationalIdHash,
        nationalIdLast4,
      },
    });

    return this.issueTokens(user.id, user.email, user.platformRole);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.issueTokens(user.id, user.email, user.platformRole);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid refresh token');

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user.id, user.email, user.platformRole);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        platformRole: true,
        memberships: {
          select: {
            orgRole: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                canSell: true,
                canBuy: true,
                isProfessional: true,
              },
            },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private async issueTokens(userId: string, email: string, platformRole: string) {
    const accessToken = await this.jwt.signAsync({
      sub: userId,
      email,
      platformRole,
    });

    const refreshToken = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + this.parseTtlMs(appEnv.JWT_REFRESH_TTL));
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return { accessToken, refreshToken, tokenType: 'Bearer' as const };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseTtlMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const n = Number(match[1]);
    const unit = match[2];
    const mult = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
    return n * mult;
  }
}
