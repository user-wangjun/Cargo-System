import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return { code: 0, message: 'ok', data: await this.authService.login(dto) };
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return { code: 0, message: 'ok', data: await this.authService.register(dto) };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: { user: Record<string, unknown> }) {
    return { code: 0, message: 'ok', data: await this.authService.me(req.user) };
  }

  @Patch('profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Req() req: { user: Record<string, unknown> }, @Body() dto: UpdateProfileDto) {
    return { code: 0, message: 'ok', data: await this.authService.updateProfile(req.user, dto) };
  }

  @Post('change-password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async changePassword(@Req() req: { user: Record<string, unknown> }, @Body() dto: ChangePasswordDto) {
    return { code: 0, message: 'ok', data: await this.authService.changePassword(req.user, dto) };
  }
}
