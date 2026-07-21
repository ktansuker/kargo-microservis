/* eslint-disable */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shipment } from './modules/shipment/entities/shipment.entity';
import { ShipmentModule } from './modules/shipment/shipment.module';

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
    ShipmentModule, // Yeni modülümüzü buraya bağladık!
  ],
  controllers: [], // İçi boş kalmalı
  providers: [],   // İçi boş kalmalı
})
export class AppModule {}