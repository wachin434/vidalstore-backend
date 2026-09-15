import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:4200';

  app.enableCors({
    origin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = Number(process.env.PORT ?? 8080);
  await app.listen(port);
  console.log(`gateway de VidalStore escuchando en http://localhost:${port}`);
  console.log(`CORS habilitado solo para ${origin}`);
}
void bootstrap();
