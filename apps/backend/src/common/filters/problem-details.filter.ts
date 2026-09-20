import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException
} from '@nestjs/common';
import { ApiProblemDetails } from '@pharma-signal/contracts';

interface HttpResponse {
  status(code: number): this;
  header(name: string, value: string): this;
  json(body: unknown): void;
}

@Catch(HttpException)
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // If the exception response is already formatted as an RFC 7807 problem details object
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'type' in exceptionResponse &&
      'title' in exceptionResponse
    ) {
      response
        .status(status)
        .header('Content-Type', 'application/problem+json')
        .json(exceptionResponse);
      return;
    }

    // Default fallback for other HttpExceptions
    const problemDetails: ApiProblemDetails = {
      type: `https://api.pharmasignal.com/errors/http-${status}`,
      title: exception.message || 'HTTP Error',
      status,
      detail: typeof exceptionResponse === 'string' ? exceptionResponse : (exceptionResponse as any).message || exception.message,
      timestamp: new Date().toISOString()
    };

    response
      .status(status)
      .header('Content-Type', 'application/problem+json')
      .json(problemDetails);
  }
}
