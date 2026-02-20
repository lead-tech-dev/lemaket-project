import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MonitoringMetricsService } from './monitoring.metrics.service';

@Injectable()
export class MonitoringInterceptor implements NestInterceptor {
  constructor(private readonly monitoringMetrics: MonitoringMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = String(request?.method || 'UNKNOWN').toUpperCase();
    const route = this.resolveRoute(request);
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      finalize(() => {
        if (route === '/metrics') {
          return;
        }
        const elapsedNs = process.hrtime.bigint() - start;
        const durationSeconds = Number(elapsedNs) / 1e9;
        const statusCode = Number(response?.statusCode || 0);
        this.monitoringMetrics.observeHttpRequest(method, route, statusCode, durationSeconds);
      })
    );
  }

  private resolveRoute(request: any) {
    const baseUrl = typeof request?.baseUrl === 'string' ? request.baseUrl : '';
    const routePath = request?.route?.path;

    if (typeof routePath === 'string' && routePath.length > 0) {
      const normalizedRoute = routePath.startsWith('/') ? routePath : `/${routePath}`;
      const merged = `${baseUrl}${normalizedRoute}` || '/';
      return this.trimQuery(merged);
    }

    if (typeof request?.path === 'string' && request.path.length > 0) {
      return this.trimQuery(request.path);
    }

    if (typeof request?.originalUrl === 'string' && request.originalUrl.length > 0) {
      return this.trimQuery(request.originalUrl);
    }

    return 'unknown';
  }

  private trimQuery(value: string) {
    const [withoutQuery] = value.split('?');
    return withoutQuery || value;
  }
}
