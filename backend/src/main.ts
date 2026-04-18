import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.use(cookieParser());

  app.setGlobalPrefix('api/v1', { exclude: ['api/docs', 'api/docs-json'] });

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Second Voice API')
    .setDescription(
      'Voice-first longitudinal mental-health check-in for NHS waiting lists. ' +
        'Endpoints support recording check-ins, retrieving trajectory data, ' +
        'computing baselines, and generating triage packets.',
    )
    .setVersion('1.0.0')
    .addTag('auth', 'Email + password sign-up, login, logout, current user')
    .addTag('checkins', 'Voice check-in upload and analysis')
    .addTag('trajectory', 'User biomarker trajectory over time')
    .addTag('baseline', 'Personal baseline statistics')
    .addTag('triage', 'Divergence events and triage packets')
    .addTag('sessions', 'LiveKit room tokens for the conversational voice agent')
    .addCookieAuth(
      process.env.SESSION_COOKIE_NAME ?? 'second_voice_session',
      { type: 'apiKey', in: 'cookie', name: process.env.SESSION_COOKIE_NAME ?? 'second_voice_session' },
      'session-cookie',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'X-Agent-Secret' },
      'agent-secret',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });

  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port);

  Logger.log(`Second Voice API listening on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Swagger UI: http://localhost:${port}/api/docs`, 'Bootstrap');
  Logger.log(`OpenAPI JSON: http://localhost:${port}/api/docs-json`, 'Bootstrap');
}

bootstrap();
