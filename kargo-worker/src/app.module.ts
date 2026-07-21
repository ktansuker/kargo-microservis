/* eslint-disable */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './modules/controllers/shipment.controller';
import { Shipment } from './modules/entities/shipment.entity';
import { ShipmentModule } from './modules/shipment/shipment.module';
import { ConnectionModule } from './connection/connection.module';
import { BackgroundModule } from './background/background.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'kargouser',
      password: process.env.DB_PASSWORD || 'kargopassword',
      database: process.env.DB_DATABASE || 'kargodb',
      entities: [Shipment],
      autoLoadEntities: true,
      synchronize: true,
    }),
    ShipmentModule,
    ConnectionModule,
    BackgroundModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}