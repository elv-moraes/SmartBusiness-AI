import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth() {
    return {
      status: 'online',
      service: 'SmartBusiness AI API',
      version: '1.0.0',
      environment: 'development',
      timestamp: new Date().toISOString(),
    };
  }
}