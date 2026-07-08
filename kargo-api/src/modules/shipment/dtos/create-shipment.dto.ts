/* eslint-disable */
import { IsString, IsNumber, IsBoolean, ValidateNested, IsOptional, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductDto {
  @IsString() @IsNotEmpty() ProductCode!: string;
  @IsString() @IsNotEmpty() ProductName!: string;
  @IsNumber() ProductDeci!: number;
  @IsNumber() ProductCount!: number;
  @IsString() ProductUOM!: string;
}

export class PackageItemDto {
  @IsString() @IsNotEmpty() ProductCode!: string;
  @IsNumber() ProductCount!: number;
}

export class CreateShipmentPackageDto {
  @IsString() @IsNotEmpty() Barcode!: string;
  @IsNumber() Deci!: number;
  @IsNumber() Weight!: number;
  @IsNumber() RowNumber!: number;
  
  @ValidateNested({ each: true })
  @Type(() => PackageItemDto)
  Items!: PackageItemDto[];
}

export class CreateShipmentDto {
  @IsString() @IsNotEmpty() TransactionID!: string;
  @IsString() @IsNotEmpty() CargoProviderCode!: string;
  @IsString() @IsNotEmpty() ConsignmentNo!: string;
  
  @IsString() @IsOptional() ErpOrderNo?: string;
  @IsString() @IsOptional() WebOrderNo?: string;
  @IsString() @IsOptional() CustomerNo?: string;
  @IsString() @IsNotEmpty() CustomerName!: string;
  
  @IsString() @IsNotEmpty() CityCode!: string;
  @IsString() @IsNotEmpty() TownCode!: string;
  @IsString() @IsOptional() DistrictCode?: string;
  
  @IsString() @IsNotEmpty() AddressText!: string;
  @IsString() @IsNotEmpty() CityText!: string;
  @IsString() @IsNotEmpty() TownText!: string;
  @IsString() @IsOptional() DistrictText?: string;
  @IsString() @IsOptional() PostalCode?: string;
  
  @IsString() @IsNotEmpty() RecipientName!: string;
  @IsString() @IsNotEmpty() RecipientPhone!: string;
  
  @IsNumber() ConsignmentDeci!: number;
  @IsNumber() ConsignmentWeight!: number;
  
  @IsString() @IsOptional() ShippingDate?: string;
  @IsBoolean() IsPartial!: boolean;
  @IsString() @IsOptional() PlannedDeliveryDate?: string;

  @ValidateNested({ each: true })
  @Type(() => CreateShipmentPackageDto)
  Packages!: CreateShipmentPackageDto[];

  @ValidateNested({ each: true })
  @Type(() => ProductDto)
  Products!: ProductDto[];
}