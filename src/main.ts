import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true, // berhenti di error pertama
      skipMissingProperties: false, // pastikan properti kosong tetap dicek
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
