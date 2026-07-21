/* eslint-disable */

export interface SendShippingItemRequest {
  productCode: string;
  productName: string;
  quantity: string;
  packageNumber: string;
  unitDeci: string;
  itemCount: number;
  weight: string;
  piecesType: string;
}

export interface SendShippingRequest {
  InterfaceId: string;
  IntegrationDescription: string;
  customerId: string;
  shippingType: string;
  shippingNumber: string;
  requestNumber: string;
  requestDate: string;
  senderCity: string;
  senderCounty: string;
  senderAddress: string;
  recipientCode: string;
  recipientTitle: string;
  recipientCity: string;
  recipientCounty: string;
  recipientAddress: string;
  recipientPhoneNumber: string;
  sendShippingItem: SendShippingItemRequest[];
}

export interface CreateShipmentBody {
  sendShipping: SendShippingRequest;
}

/** kargoapi'nin /createShipment başarılı/başarısız cevabının minimal şekli. */
export interface CreateShipmentResponse {
  success: boolean;
  message?: string;
  data?: {
    shippingNumber: string;
    trackingNumber: string;
    itemCount: number;
  };
}