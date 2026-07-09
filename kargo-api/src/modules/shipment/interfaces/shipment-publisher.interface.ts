/* eslint-disable */
import { CreateShipmentDto } from '../dtos/create-shipment.dto';
import { PublishResult } from '../../../common/interfaces/publish-result.interface';

export interface ShipmentPublisher {
  /**
   * @throws {ShipmentValidationException} DTO geçersizse.
   * @throws {RabbitMqNotReadyException} kanal henüz hazır değilse.
   */
  createAndPublish(data: CreateShipmentDto): Promise<PublishResult>;
}