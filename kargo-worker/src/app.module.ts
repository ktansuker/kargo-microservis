/* eslint-disable */
import { ShipmentService } from './shipment/shipment.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Shipment } from './shipment.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'postgres',
      port: 5432,
      username: 'kargouser',
      password: 'kargopassword',
      database: 'kargodb',
      entities: [Shipment],
      autoLoadEntities: true,
      synchronize: true,
    }),
    // Hatanın sebebi buranın eksik olması veya kaydedilmemesidir:
    TypeOrmModule.forFeature([Shipment]), 
  ],
  controllers: [AppController],
  providers: [AppService, ShipmentService],
})
export class AppModule {}