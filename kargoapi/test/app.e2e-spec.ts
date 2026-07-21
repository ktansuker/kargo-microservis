import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { validationExceptionFactory } from '../src/common/validation-exception.factory';

// Kullanıcının verdiği örnek payload (birebir).
const EXAMPLE_PAYLOAD = {
  sendShipping: {
    InterfaceId: '1',
    IntegrationDescription: '1',
    customerId: '0002024401',
    shippingType: '1',
    shippingNumber: '858590800123213',
    requestNumber: '64646464',
    requestDate: '11/07/2025 11:30:01',
    senderCity: 'KOCAELİ',
    senderCounty: 'GEBZE',
    senderAddress: 'Avansas Tavşanlı Depo',
    recipientCode: '0070324101',
    recipientTitle: 'Ebru Böke',
    recipientCity: 'ÇORUM',
    recipientCounty: 'MERKEZ',
    recipientAddress:
      'Çepni Mahallesi   Kerebi Gazi 1. Sk. No: 7, 19040   Merkez ÇORUM',
    recipientPhoneNumber: '5555555555',
    sendShippingItem: [
      {
        productCode: 'PAL',
        productName: 'ÜLKER ALBENİ ÇİKOLATA BAR 40 GR 24\'LÜ',
        quantity: '1',
        packageNumber: '0029808558',
        unitDeci: '15',
        itemCount: 1,
        weight: '0',
        piecesType: 'PAL',
      },
      {
        productCode: '000000000500134364',
        productName: 'ÜLKER ALBENİ ÇİKOLATA BAR 40 GR 24\'LÜ',
        quantity: '1',
        packageNumber: '0029808558',
        unitDeci: '15',
        itemCount: 1,
        weight: '0',
        piecesType: 'PAL',
      },
      {
        productCode: '000000000500134364',
        productName: 'ÜLKER ALBENİ ÇİKOLATA BAR 40 GR 24\'LÜ',
        quantity: '1',
        packageNumber: '0029808558',
        unitDeci: '15',
        weight: '0',
        itemCount: 1,
        piecesType: 'PAL',
      },
    ],
  },
};

describe('kargoapi (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableCors({ origin: '*', methods: '*', allowedHeaders: '*' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        exceptionFactory: validationExceptionFactory,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function getToken(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'PO_ARVATO_DEV', password: 'Arvato321!' })
      .expect(200);
    return res.body.token;
  }

  describe('POST /auth/login', () => {
    it('doğru kimlikle 200 ve token döner', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'PO_ARVATO_DEV', password: 'Arvato321!' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeTruthy();
      expect(res.body.tokenType).toBe('Basic');
    });

    it('Basic header ile de token döner', async () => {
      const basic = Buffer.from('PO_ARVATO_DEV:Arvato321!').toString('base64');
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Authorization', `Basic ${basic}`)
        .send({})
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeTruthy();
    });

    it('yanlış kimlikle 401 döner', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'PO_ARVATO_DEV', password: 'yanlis' })
        .expect(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /createShipment', () => {
    it('token yoksa 401 döner', async () => {
      const res = await request(app.getHttpServer())
        .post('/createShipment')
        .send(EXAMPLE_PAYLOAD)
        .expect(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('geçersiz token için 401 döner', async () => {
      const res = await request(app.getHttpServer())
        .post('/createShipment')
        .set('Authorization', 'Basic gecersiz-token')
        .send(EXAMPLE_PAYLOAD)
        .expect(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('geçerli token + örnek payload ile 200 ve başarılı sonuç döner', async () => {
      const token = await getToken();
      const res = await request(app.getHttpServer())
        .post('/createShipment')
        .set('Authorization', `Basic ${token}`)
        .send(EXAMPLE_PAYLOAD)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Shipment created');
      expect(res.body.data.shippingNumber).toBe('858590800123213');
      expect(res.body.data.itemCount).toBe(3);
      expect(res.body.data.trackingNumber).toBeTruthy();
    });

    it('zorunlu alan eksikse (customerId boş) 400 VALIDATION_ERROR döner', async () => {
      const token = await getToken();
      const badPayload = JSON.parse(JSON.stringify(EXAMPLE_PAYLOAD));
      badPayload.sendShipping.customerId = '';

      const res = await request(app.getHttpServer())
        .post('/createShipment')
        .set('Authorization', `Basic ${token}`)
        .send(badPayload)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(
        res.body.details.some((d: string) => d.includes('customerId')),
      ).toBe(true);
    });

    it('sendShippingItem boş dizi ise 400 döner', async () => {
      const token = await getToken();
      const badPayload = JSON.parse(JSON.stringify(EXAMPLE_PAYLOAD));
      badPayload.sendShipping.sendShippingItem = [];

      const res = await request(app.getHttpServer())
        .post('/createShipment')
        .set('Authorization', `Basic ${token}`)
        .send(badPayload)
        .expect(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });
});
