
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function corsOriginsFromEnv(): string | string[] | boolean {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) {
    return 'http://localhost:5173';
  }
  if (raw === '*' || raw.toLowerCase() === 'true') {
    return true;
  }
  const list = raw.split(',').map((o) => o.trim()).filter(Boolean);
  return list.length === 1 ? list[0] : list;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: corsOriginsFromEnv(),
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}
bootstrap();
