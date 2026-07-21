import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validationExceptionFactory } from './common/validation-exception.factory';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Aynı local sunucudan istek geleceği için full access CORS.
  app.enableCors({
    origin: '*',
    methods: '*',
    allowedHeaders: '*',
  });

  // Global doğrulama: bilinmeyen alanları temizle, tipleri dönüştür,
  // hataları standart formatta döndür.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  // Default port başka yerde kullanıldığı için 8000.
  const port = process.env.PORT ?? 8000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`kargoapi ${port} portunda calisiyor -> http://localhost:${port}`);
}

bootstrap();
