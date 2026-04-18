import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { UserEntity } from '../users/entities/user.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AuthUserDto } from './dto/auth-response.dto';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto): Promise<{ user: AuthUserDto; token: string }> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('an account with that email already exists');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const user = await this.userRepo.save(
      this.userRepo.create({
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
      }),
    );

    this.logger.log(`Signed up user ${user.id} (${user.email})`);
    return {
      user: this.toPublic(user),
      token: this.signToken(user),
    };
  }

  async login(dto: LoginDto): Promise<{ user: AuthUserDto; token: string }> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('invalid email or password');
    }

    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException('invalid email or password');
    }

    return {
      user: this.toPublic(user),
      token: this.signToken(user),
    };
  }

  async getById(id: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { id, isDeleted: false } });
  }

  toPublic(user: UserEntity): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
  }

  private signToken(user: UserEntity): string {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload);
  }
}
