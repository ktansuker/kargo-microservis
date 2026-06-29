/* eslint-disable */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Gelen tüm istekleri DTO'muza göre filtreleyen sihirli kalkan:
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, // DTO'da tanımlanmayan saçma sapan alanları otomatik siler
    transform: true  // Gelen JSON'ı CreateShipmentDto sınıfına dönüştürür
  }));

  await app.listen(3000);
}
bootstrap();