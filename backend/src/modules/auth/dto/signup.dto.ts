import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SignupDto {
  @ApiProperty({
    type: String,
    format: 'email',
    description: 'Email address used as the unique login handle.',
    example: 'devansh@example.com',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'must be a valid email address' })
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    type: String,
    minLength: 8,
    maxLength: 128,
    description: 'Plain-text password — hashed with Argon2id before storage.',
    example: 'a-decent-password',
  })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128)
  password!: string;

  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: 120,
    description: 'Friendly name shown on the dashboard and to the voice agent.',
    example: 'Devansh',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName!: string;
}
