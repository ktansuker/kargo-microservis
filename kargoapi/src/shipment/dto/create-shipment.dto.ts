import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * sendShipping.sendShippingItem içindeki tek bir kalem.
 * Zorunlu (çekirdek) alanlar: productCode, productName, quantity.
 * Diğer alanlar opsiyoneldir ama gelirse korunur.
 */
export class SendShippingItemDto {
  @IsString()
  @IsNotEmpty()
  productCode: string;

  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsString()
  @IsNotEmpty()
  quantity: string;

  @IsOptional()
  @IsString()
  packageNumber?: string;

  @IsOptional()
  @IsString()
  unitDeci?: string;

  @IsOptional()
  itemCount?: number;

  @IsOptional()
  @IsString()
  weight?: string;

  @IsOptional()
  @IsString()
  piecesType?: string;
}

/**
 * sendShipping gövdesi.
 * Zorunlu (çekirdek) alanlar: customerId, shippingNumber, requestNumber,
 * senderCity, senderAddress, recipientCity, recipientAddress ve en az 1
 * elemanlı sendShippingItem. Kalan alanlar opsiyoneldir.
 */
export class SendShippingDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  shippingNumber: string;

  @IsString()
  @IsNotEmpty()
  requestNumber: string;

  @IsString()
  @IsNotEmpty()
  senderCity: string;

  @IsString()
  @IsNotEmpty()
  senderAddress: string;

  @IsString()
  @IsNotEmpty()
  recipientCity: string;

  @IsString()
  @IsNotEmpty()
  recipientAddress: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SendShippingItemDto)
  sendShippingItem: SendShippingItemDto[];

  // --- Opsiyonel alanlar (örnek istekte geçen, zorunlu olmayanlar) ---
  @IsOptional()
  @IsString()
  InterfaceId?: string;

  @IsOptional()
  @IsString()
  IntegrationDescription?: string;

  @IsOptional()
  @IsString()
  shippingType?: string;

  @IsOptional()
  @IsString()
  requestDate?: string;

  @IsOptional()
  @IsString()
  senderCounty?: string;

  @IsOptional()
  @IsString()
  recipientCode?: string;

  @IsOptional()
  @IsString()
  recipientTitle?: string;

  @IsOptional()
  @IsString()
  recipientCounty?: string;

  @IsOptional()
  @IsString()
  recipientPhoneNumber?: string;
}

/**
 * createShipment isteğinin en dış gövdesi: { "sendShipping": { ... } }
 */
export class CreateShipmentDto {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => SendShippingDto)
  sendShipping: SendShippingDto;
}
