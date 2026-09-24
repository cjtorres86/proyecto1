import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FormsService } from './forms.service';

@UseGuards(JwtAuthGuard)
@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get('formularios')
  listarFormularios() {
    return this.formsService.listarFormularios();
  }

  @Get('formularios/:id/campos')
  getCampos(@Param('id') id: string) {
    return this.formsService.getCamposDePlantilla(id);
  }

  @Get('slep')
  listarSlep() {
    return this.formsService.listarSlep();
  }
}
