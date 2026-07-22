/* eslint-disable */
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as amqp from 'amqplib';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { Shipment } from '../entities/shipment.entity';
import { CreateShipmentDto } from '../dtos/create-shipment.dto';
import { ShipmentStatus } from '../../../common/enums/shipment-status.enum';
import { PublishResult } from '../../../common/interfaces/publish-result.interface';
import { ShipmentValidationException } from '../../../common/exceptions/shipment-validation.exception';
import { RabbitMqNotReadyException } from '../../../common/exceptions/rabbitmq-not-ready.exception';
import { ShipmentPublisher } from '../interfaces/shipment-publisher.interface';
import { paginate, Pagination, IPaginationOptions } from 'nestjs-typeorm-paginate';

@Injectable()
export class ShipmentService
  implements OnModuleInit, OnModuleDestroy, ShipmentPublisher {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly logger = new Logger(ShipmentService.name);

  constructor(
    @InjectRepository(Shipment)
    private shipmentRepository: Repository<Shipment>,
  ) { }

  async onModuleInit() {
    await this.connectToBroker();
  }

  private async connectToBroker(): Promise<void> {
    try {
      this.connection = await amqp.connect('amqp://guest:guest@rabbitmq:5672');
      this.channel = await this.connection.createChannel();
      this.logger.log('RabbitMQ bağlantısı başarılı (API)');

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ bağlantısı koptu, yeniden bağlanılıyor...');
        this.channel = null;
        setTimeout(() => this.connectToBroker(), 5000);
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('RabbitMQ bağlantı hatası:', message);
      setTimeout(() => this.connectToBroker(), 5000);
    }
  }

  async createAndPublish(data: CreateShipmentDto): Promise<PublishResult> {
    this.assertChannelReady();

    try {
      this.assertValidDto(data);
      await this.saveShipment(data, ShipmentStatus.PENDING);
      this.publishToQueue(data);

      return { statusCode: 200, message: 'Kargo isteği kuyruğa eklendi' };
    } catch (error: unknown) {
      await this.saveFailedShipment(data, error);
      throw error;
    }
  }

  private assertChannelReady(): void {
    if (!this.channel) {
      this.logger.error('RabbitMQ kanalı henüz hazır değil, bağlantı bekleniyor...');
      throw new RabbitMqNotReadyException();
    }
  }

  private assertValidDto(data: CreateShipmentDto): void {
    const dtoInstance = plainToInstance(CreateShipmentDto, data);
    const errors = validateSync(dtoInstance);

    if (errors.length > 0) {
      const errorMessages = errors.map((err) =>
        Object.values(err.constraints || {}).join(', '),
      );
      throw new ShipmentValidationException(errorMessages);
    }
  }

  private async saveShipment(
    data: CreateShipmentDto,
    status: ShipmentStatus,
  ): Promise<void> {
    const shipment = this.shipmentRepository.create({
      cargoProviderCode: data.CargoProviderCode,
      transactionId: data.TransactionID,
      consignmentNo: data.ConsignmentNo || 'Bilinmiyor',
      status,
    });

    await this.shipmentRepository.save(shipment);
    this.logger.log(`[DB KAYIT] Veritabanına eklendi. TransactionID: ${data.TransactionID}`);
  }

  private publishToQueue(data: CreateShipmentDto): void {
    const queueName = `${data.CargoProviderCode}CreateShipment-v2`;
    const retryQueueName = `retry_${queueName}`;

    this.channel!.assertQueue(queueName, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: retryQueueName,
    });

    this.channel!.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), {
      persistent: true,
    });
  }

  private async saveFailedShipment(
    data: CreateShipmentDto,
    error: unknown,
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error('API İşlem Hatası:', errorMessage);

    const failedShipment = this.shipmentRepository.create({
      cargoProviderCode: data?.CargoProviderCode || 'Bilinmiyor',
      transactionId: data?.TransactionID || 'Hata-TRX',
      consignmentNo: data?.ConsignmentNo || 'Yok',
      status: ShipmentStatus.VALIDATION_FAILED,
      errorMessage,
    });

    await this.shipmentRepository.save(failedShipment);
  }

  // ---------------------------------------------------------------------
  // ↓↓↓ YENİ EKLENEN KISIM ↓↓↓
  // ---------------------------------------------------------------------

  async findAll(
    options: IPaginationOptions,
    status?: string,
    provider?: string,
    search?: string,
  ): Promise<Pagination<Shipment>> {
    const queryBuilder = this.shipmentRepository.createQueryBuilder('shipment');

    // 1. Statü Filtresi
    if (status && status !== 'ALL') {
      queryBuilder.andWhere('shipment.status = :status', { status });
    }

    // 2. Kargo Firması Filtresi
    if (provider && provider !== 'ALL') {
      queryBuilder.andWhere('shipment.cargoProviderCode = :provider', { provider });
    }

    // 3. Arama Çubuğu (TransactionID, Konsinye No veya Alıcı İsminde arar)
    // PostgreSQL kullandığımız için büyük/küçük harf duyarsız ILIKE kullanıyoruz
    if (search) {
      queryBuilder.andWhere(
        '(shipment.transactionId ILIKE :search OR shipment.consignmentNo ILIKE :search OR shipment.recipientName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('shipment.createdAt', 'DESC');

    return paginate<Shipment>(queryBuilder, options);
  }

  async findOne(id: string): Promise<Shipment | null> {
    return this.shipmentRepository.findOneBy({ id });
  }

  // ---------------------------------------------------------------------
  // ↑↑↑ YENİ EKLENEN KISIM ↑↑↑
  // ---------------------------------------------------------------------

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}