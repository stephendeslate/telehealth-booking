import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { initSentry } from './sentry';

// Initialize Sentry before anything else
initSentry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Required for Stripe webhook signature verification
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const webUrl = configService.get<string>('WEB_URL', 'http://localhost:3000');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Swagger UI needs inline scripts
          styleSrc: ["'self'", "'unsafe-inline'"], // Swagger UI needs inline styles
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", webUrl],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow Swagger UI assets
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );
  app.use(cookieParser());

  const allowedOrigins = [webUrl];
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000');
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400,
  });

  app.setGlobalPrefix('api', { exclude: ['health'] });

  // Swagger API docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('MedConnect API')
    .setDescription(
      'Multi-tenant telehealth booking platform API. ' +
      'All patient data is synthetic (Synthea-generated). This is a demonstration platform.',
    )
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .addTag('auth', 'Authentication and authorization')
    .addTag('practices', 'Practice management')
    .addTag('providers', 'Provider profiles and availability')
    .addTag('services', 'Service configuration')
    .addTag('appointments', 'Appointment booking and management')
    .addTag('video', 'Video consultation rooms')
    .addTag('payments', 'Payment processing')
    .addTag('intake', 'Intake forms and submissions')
    .addTag('messages', 'In-app messaging')
    .addTag('notifications', 'Notifications')
    .addTag('calendar', 'Calendar synchronization')
    .addTag('admin', 'Practice administration')
    .addTag('users', 'User profile management')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port);
  console.log(`MedConnect API running on port ${port}`);
}

bootstrap();
