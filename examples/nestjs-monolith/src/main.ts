import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MetricsService } from './metrics.service';
import { emitEvent, installRequestObservability } from './observability';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  installRequestObservability(app, app.get(MetricsService));
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  emitEvent('service_started');
}

bootstrap().catch((error: unknown) => {
  console.error('Unable to start testbed API', error);
  process.exitCode = 1;
});
