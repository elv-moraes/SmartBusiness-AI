import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return SmartBusiness AI information', () => {
      expect(appController.getHello()).toEqual({
        name: 'SmartBusiness AI',
        version: '1.0.0',
        status: 'online',
        slogan: 'Gerencie melhor. Decida com inteligência.',
        message: 'Bem-vindo ao SmartBusiness AI!',
      });
    });
  });
});
