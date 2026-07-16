import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      name: 'SmartBusiness AI',
      version: '1.0.0',
      status: 'online',
      slogan: 'Gerencie melhor. Decida com inteligência.',
      message: 'Bem-vindo ao SmartBusiness AI!',
    };
  }
}