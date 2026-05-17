import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    const existing = await this.prisma.admin.findUnique({
      where: { email: body.email },
    });

    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(body.password, 10);

    const admin = await this.prisma.admin.create({
      data: {
        email: body.email,
        password: hashedPassword,
      },
    });

    return {
      message: 'Admin registered successfully',
      id: admin.id,
    };
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: body.email },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(body.password, admin.password);

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      token: this.jwtService.sign({
        sub: admin.id,
        email: admin.email,
      }),
    };
  }
}