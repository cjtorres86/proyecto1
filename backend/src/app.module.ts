import { Module } from '@nestjs/common';
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
  ],
  controllers: [AppController],
})
export class AppModule {}
