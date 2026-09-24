import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Usuario } from '../../auth/entities/usuario.entity';
import { Perfil } from '../../auth/entities/perfil.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Perfil])],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
