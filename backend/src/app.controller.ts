import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Endpoint de salud: confirma que el proceso está vivo y que la conexión
// a MySQL realmente funciona — no solo que Nest arrancó.
@Controller()
export class AppController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get('health')
  async health() {
    const dbConectada = this.dataSource.isInitialized;
    return {
      status: dbConectada ? 'ok' : 'db_desconectada',
      database: this.dataSource.options.database,
      timestamp: new Date().toISOString(),
    };
  }
}
