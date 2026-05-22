import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check', description: 'Returns service health status.' })
  @ApiResponse({ status: 200, description: 'Service is healthy.' })
  check() {
    return {
      status: 'ok',
      service: 'core-service',
      timestamp: new Date().toISOString(),
    };
  }
}
