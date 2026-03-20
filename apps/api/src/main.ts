import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const webUrl = configService.get<string>('WEB_URL', 'http://localhost:3000');

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: [webUrl, 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  app.setGlobalPrefix('api', { exclude: ['health'] });

  await app.listen(port);
  console.log(`MedConnect API running on port ${port}`);
}

bootstrap();
