/* eslint-disable */

export interface CargoPackageItem {
  ProductCode: string;
  ProductCount: number;
}

export interface CargoPackage {
  Barcode: string;
  Deci: number;
  Weight: number;
  RowNumber: number;
  Items: CargoPackageItem[];
}

export interface CargoProduct {
  ProductCode: string;
  ProductName: string;
  ProductDeci: number;
  ProductCount: number;
  ProductUOM: string;
}

export interface CargoPayload {
  TransactionID: string;
  CargoProviderCode: string;
  ConsignmentNo: string;
  CustomerName: string;
  CityCode: string;
  TownCode: string;
  AddressText: string;
  CityText: string;
  TownText: string;
  RecipientName: string;
  RecipientPhone: string;
  ConsignmentDeci: number;
  ConsignmentWeight: number;
  IsPartial: boolean;
  Packages: CargoPackage[];
  Products: CargoProduct[];
}