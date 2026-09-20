import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiProblemDetails, InvalidParamDetail } from '@pharma-signal/contracts';

export class InvalidProvenanceException extends HttpException {
  constructor(
    detail = 'Record provenance validation failed: tenantId, deviceId, or dataSourceId does not match authenticated context',
    invalidParams?: InvalidParamDetail[],
    instance = '/api/v1/agent/sync'
  ) {
    const problemDetails: ApiProblemDetails = {
      type: 'https://api.pharmasignal.com/errors/invalid-provenance',
      title: 'Invalid Provenance',
      status: HttpStatus.BAD_REQUEST,
      detail,
      instance,
      invalidParams: invalidParams ?? [],
      timestamp: new Date().toISOString()
    };
    super(problemDetails, HttpStatus.BAD_REQUEST);
  }
}
