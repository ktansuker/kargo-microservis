/* eslint-disable */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { ShipmentService } from '../modules/shipment/shipment.service';
import { CargoConnectionService } from '../connection/cargo-connection.service';
import {
  CargoPackage,
  CargoPackageItem,
  CargoPayload,
} from './interfaces/cargo-payload.interface';
import {
  CreateShipmentBody,
  CreateShipmentResponse,
  SendShippingItemRequest,
} from './interfaces/send-shipping-request.interface';
import { RabbitMqDeathHeader } from './interfaces/rabbitmq-death-header.interface';
import { AppException } from '../common/exceptions/app.exception';
import { ProviderConfigurationException } from '../common/exceptions/provider-configuration.exception';
import { ShipmentMappingException } from '../common/exceptions/shipment-mapping.exception';
import { InvalidMessagePayloadException } from '../common/exceptions/invalid-message-payload.exception';
import { CargoApiRequestException } from '../common/exceptions/cargo-api-request.exception';
import { CargoApiAuthenticationException } from '../common/exceptions/cargo-api-authentication.exception';

const BORUSAN_API_BASE_URL =
  process.env.CARGO_API_BASE_URL ?? 'http://localhost:8000';
const CREATE_SHIPMENT_PATH = '/createShipment';
const MAX_RETRY_COUNT = 5;
const RETRY_QUEUE_TTL_MS = 10000;
const RABBITMQ_URL =
  process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';

@Injectable()
export class ShipmentConsumerService implements OnModuleInit {
  private readonly logger = new Logger(ShipmentConsumerService.name);
  private channel!: amqp.Channel;

  constructor(
    private readonly shipmentService: ShipmentService,
    private readonly connection: CargoConnectionService,
  ) {}

  async onModuleInit() {
    await this.connectToBroker();
  }

  // ---------------------------------------------------------------------
  // RabbitMQ bağlantısı
  // ---------------------------------------------------------------------

  private async connectToBroker(): Promise<void> {
    try {
      const conn = await amqp.connect(RABBITMQ_URL);
      this.channel = await conn.createChannel();

      const providerCode = this.resolveProviderCode();
      this.logger.log(
        `RabbitMQ bağlantısı başarılı. Ben bir [${providerCode}] Worker'ıyım!`,
      );

      await this.startListening(providerCode);
    } catch (error) {
      this.logger.error('RabbitMQ bağlantı hatası:', error);
      setTimeout(() => this.connectToBroker(), 5000);
    }
  }

  /** @throws {ProviderConfigurationException} CARGO_PROVIDER tanımlı değilse. */
  private resolveProviderCode(): string {
    const providerCode = process.env.CARGO_PROVIDER;
    if (!providerCode) {
      throw new ProviderConfigurationException('CARGO_PROVIDER');
    }
    return providerCode;
  }

  // ---------------------------------------------------------------------
  // Kuyruk dinleme (okuma)
  // ---------------------------------------------------------------------

  private async startListening(providerCode: string): Promise<void> {
    const mainQueue = `${providerCode}CreateShipment-v2`;
    const retryQueue = `retry_${mainQueue}`;
    const dmqQueue = `dmq_${mainQueue}`;

    await this.channel.assertQueue(dmqQueue, { durable: true });
    await this.channel.assertQueue(retryQueue, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: mainQueue,
      messageTtl: RETRY_QUEUE_TTL_MS,
    });
    await this.channel.assertQueue(mainQueue, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: retryQueue,
    });

    this.logger.log(
      `[WORKER] ${mainQueue} kuyruğu 5-Tekrarlı DMQ zekasıyla dinleniyor...`,
    );

    this.channel.consume(mainQueue, (msg) =>
      this.handleMessage(msg, providerCode, dmqQueue),
    );
  }

  private async handleMessage(
    msg: amqp.ConsumeMessage | null,
    providerCode: string,
    dmqQueue: string,
  ): Promise<void> {
    if (!msg) return;

    let payload: CargoPayload;
    try {
      payload = JSON.parse(msg.content.toString()) as CargoPayload;
    } catch (error) {
      this.logger.error(
        new InvalidMessagePayloadException(error).message,
      );
      this.channel.sendToQueue(dmqQueue, msg.content, { persistent: true });
      this.channel.ack(msg);
      return;
    }

    const retryCount = this.getRetryCount(msg);

    if (retryCount >= MAX_RETRY_COUNT) {
      await this.moveToDeadLetter(msg, payload, dmqQueue);
      return;
    }

    await this.processShipment(msg, payload, providerCode, retryCount);
  }

  private getRetryCount(msg: amqp.ConsumeMessage): number {
    const deathHeaders = msg.properties.headers?.['x-death'] as
      | RabbitMqDeathHeader[]
      | undefined;
    return deathHeaders?.[0]?.count ?? 0;
  }

  private async moveToDeadLetter(
    msg: amqp.ConsumeMessage,
    payload: CargoPayload,
    dmqQueue: string,
  ): Promise<void> {
    this.logger.error(
      `[DMQ] ${payload.ConsignmentNo} 5 kez denendi! DMQ'ya taşınıyor.`,
    );
    this.channel.sendToQueue(dmqQueue, msg.content, { persistent: true });
    await this.shipmentService.updateStatus(payload.TransactionID, 'HATALI_DMQ');
    this.channel.ack(msg);
  }

  // ---------------------------------------------------------------------
  // İş mantığı: parse -> gönder -> sonucu değerlendir -> DB güncelle
  // ---------------------------------------------------------------------

  private async processShipment(
    msg: amqp.ConsumeMessage,
    payload: CargoPayload,
    providerCode: string,
    retryCount: number,
  ): Promise<void> {
    try {
      this.logger.log(`[İŞLENİYOR] ${providerCode} Kargosu (Deneme: ${retryCount + 1})`);

      const requestBody = this.buildShippingRequest(payload);

      const response = await this.connection.post<CreateShipmentResponse>(
        `${BORUSAN_API_BASE_URL}${CREATE_SHIPMENT_PATH}`,
        requestBody,
      );

      await this.handleResponse(payload, response.data, providerCode);
      this.channel.ack(msg);
    } catch (error) {
      await this.handleFailure(msg, payload, retryCount, error);
    }
  }

  private async handleResponse(
    payload: CargoPayload,
    responseData: CreateShipmentResponse,
    providerCode: string,
  ): Promise<void> {
    if (!responseData?.success) {
      throw new CargoApiRequestException(
        `${BORUSAN_API_BASE_URL}${CREATE_SHIPMENT_PATH}`,
        undefined,
        responseData,
      );
    }

    await this.shipmentService.updateStatus(payload.TransactionID, 'BAŞARILI');
    this.logger.log(
      `[BAŞARILI] ${payload.ConsignmentNo} başarıyla ${providerCode} sistemine iletildi. ` +
        `(trackingNumber: ${responseData.data?.trackingNumber})`,
    );
  }

  
  private async handleFailure(
    msg: amqp.ConsumeMessage,
    payload: CargoPayload | undefined,
    retryCount: number,
    error: unknown,
  ): Promise<void> {
    this.logFailureDetail(error);

    const summary = error instanceof AppException ? error.message : String(error);
    this.logger.warn(
      `[HATA] İşlem başarısız oldu. Retry kuyruğuna atılıyor. ` +
        `(Deneme: ${retryCount + 1}) Detay: ${summary}`,
    );

    const transactionId = payload?.TransactionID ?? 'Bilinmiyor';
    await this.shipmentService.updateStatus(transactionId, 'YENIDEN_DENENIYOR');
    this.channel.nack(msg, false, false);
  }

  private logFailureDetail(error: unknown): void {
    if (error instanceof CargoApiRequestException) {
      this.logger.debug(
        `CargoApiRequestException — url: ${error.url}, status: ${error.status}, ` +
          `responseData: ${JSON.stringify(error.responseData)}`,
      );
      return;
    }
    if (error instanceof CargoApiAuthenticationException) {
      this.logger.debug(`CargoApiAuthenticationException — ${error.message}`);
      return;
    }
    if (error instanceof ShipmentMappingException) {
      this.logger.debug(
        `ShipmentMappingException — eksik alanlar: ${error.missingFields.join(', ')}`,
      );
      return;
    }
    if (error instanceof AppException) {
      this.logger.debug(`${error.code} — ${error.message}`);
      return;
    }
    this.logger.debug(`Beklenmeyen hata tipi: ${String(error)}`);
  }

  // ---------------------------------------------------------------------
  // Parselleme (mapping) — CargoPayload -> SendShipping
  // ---------------------------------------------------------------------

  /**
   * @throws {ShipmentMappingException} zorunlu bir alan boş/eksik çıkarsa
   * (kargoapi'nin DTO validasyonuyla aynı zorunlu alan listesi).
   */

  private buildShippingRequest(payload: CargoPayload): CreateShipmentBody {
    const customerId = '0002024401'; // TODO: CustomerName -> kod lookup
    const senderCity = 'KOCAELİ'; // TODO: sabit; payload.CityText kullanılmalı mı?
    const senderAddress = 'Avansas Tavşanlı Depo';
    const recipientCity = payload.CityText;
    const recipientAddress = payload.AddressText;
    const sendShippingItem = this.buildShippingItems(payload);

    this.assertRequiredFields({
      customerId,
      shippingNumber: payload.ConsignmentNo,
      requestNumber: payload.TransactionID,
      senderCity,
      senderAddress,
      recipientCity,
      recipientAddress,
      sendShippingItem,
    });

    return {
      sendShipping: {
        InterfaceId: '1',
        IntegrationDescription: '1',
        customerId,
        shippingType: '1',
        shippingNumber: payload.ConsignmentNo,
        requestNumber: payload.TransactionID,
        requestDate: this.buildRequestDate(),
        senderCity,
        senderCounty: 'GEBZE',
        senderAddress,
        recipientCode: '0070324101', // TODO: kaynakta yok, sabit
        recipientTitle: payload.RecipientName,
        recipientCity,
        recipientCounty: payload.TownText,
        recipientAddress,
        recipientPhoneNumber: payload.RecipientPhone,
        sendShippingItem,
      },
    };
  }

  /**
   * kargoapi'nin zorunlu kıldığı çekirdek alanları kontrol eder.
   * @throws {ShipmentMappingException}
   */
  private assertRequiredFields(fields: {
    customerId: string;
    shippingNumber: string;
    requestNumber: string;
    senderCity: string;
    senderAddress: string;
    recipientCity: string;
    recipientAddress: string;
    sendShippingItem: SendShippingItemRequest[];
  }): void {
    const missing: string[] = [];
    if (!fields.customerId) missing.push('customerId');
    if (!fields.shippingNumber) missing.push('shippingNumber');
    if (!fields.requestNumber) missing.push('requestNumber');
    if (!fields.senderCity) missing.push('senderCity');
    if (!fields.senderAddress) missing.push('senderAddress');
    if (!fields.recipientCity) missing.push('recipientCity');
    if (!fields.recipientAddress) missing.push('recipientAddress');
    if (!fields.sendShippingItem || fields.sendShippingItem.length === 0) {
      missing.push('sendShippingItem');
    }

    if (missing.length > 0) {
      throw new ShipmentMappingException(missing);
    }
  }

  private buildRequestDate(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (
      `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ` +
      `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    );
  }

  private buildShippingItems(payload: CargoPayload): SendShippingItemRequest[] {
    return payload.Packages.flatMap((pkg) =>
      pkg.Items.map((item) => this.buildShippingItem(pkg, item, payload)),
    );
  }

  private buildShippingItem(
    pkg: CargoPackage,
    item: CargoPackageItem,
    payload: CargoPayload,
  ): SendShippingItemRequest {
    const productInfo = payload.Products?.find(
      (p) => p.ProductCode === item.ProductCode,
    );

    return {
      productCode: item.ProductCode || 'PAL',
      productName: productInfo ? productInfo.ProductName : 'Bilinmeyen Ürün',
      quantity: item.ProductCount?.toString() ?? '1',
      packageNumber: pkg.Barcode,
      unitDeci: pkg.Deci?.toString() ?? '15',
      itemCount: 1,
      weight: pkg.Weight?.toString() ?? '0',
      piecesType: 'PAL',
    };
  }
}