import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { Pregunta } from './entities/pregunta.entity';
import { Formulario } from './entities/formulario.entity';
import { FormularioPregunta } from './entities/formulario-pregunta.entity';
import { Slep } from './entities/slep.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Pregunta, Formulario, FormularioPregunta, Slep])],
  controllers: [FormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
