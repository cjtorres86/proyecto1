import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Usuario } from './entities/usuario.entity';
import { Perfil } from './entities/perfil.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Perfil]),
    PassportModule,
    // registerAsync (no register): JWT_SECRET se lee recién cuando Nest
    // resuelve la inyección de dependencias, no cuando este archivo se
    // importa — JwtModule.register({secret: process.env.X}) lee esa
    // variable ANTES de que ConfigModule.forRoot() alcance a cargar el
    // .env, y siempre queda undefined. Hallazgo real de esta fase.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') || '8h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
