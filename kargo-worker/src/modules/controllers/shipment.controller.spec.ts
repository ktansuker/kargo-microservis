/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './shipment.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('healthCheck', () => {
    it('worker ayakta olduğunu belirten mesajı döner', () => {
      expect(appController.healthCheck()).toBe(
        'Kargo Worker (Job) başarıyla çalışıyor ve kuyruğu dinliyor!',
      );
    });
  });
});