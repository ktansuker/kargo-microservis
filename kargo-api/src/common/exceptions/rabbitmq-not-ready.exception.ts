/* eslint-disable */
import { AppException } from './app.exception';
export class RabbitMqNotReadyException extends AppException {
  constructor() {
    super(
      'Servis henüz hazır değil (RabbitMQ kanalı kurulmadı), lütfen birkaç saniye sonra tekrar deneyin.',
      'RABBITMQ_NOT_READY',
      503,
    );
  }
}