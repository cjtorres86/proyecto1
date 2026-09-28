import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreModule } from './core/core.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { FormsModule } from './modules/forms/forms.module';
import { CasesModule } from './modules/cases/cases.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { UsersModule } from './modules/users/users.module';
import { ReportsModule } from './modules/reports/reports.module';
import { MensajesModule } from './modules/mensajes/mensajes.module';
import { BitacoraModule } from './modules/bitacora/bitacora.module';
import { BitacoraInterceptor } from './modules/bitacora/interceptors/bitacora.interceptor';
import { dataSourceOptions } from './database/data-source';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dataSourceOptions),
    CoreModule,
    AuthModule,
    FormsModule,
    CasesModule,
    DashboardModule,
    UsersModule,
    ReportsModule,
    MensajesModule,
    BitacoraModule,
  ],
  controllers: [AppController],
  providers: [
    // Global (mejora post-v2.23): revisa cada petición del sistema, pero
    // solo actúa donde un método tenga @Bitacora(...) — el resto no se ve
    // afectado en nada.
    { provide: APP_INTERCEPTOR, useClass: BitacoraInterceptor },
  ],
})
export class AppModule {}
