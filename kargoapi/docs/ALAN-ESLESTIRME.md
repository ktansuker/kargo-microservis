# Alan Eşleştirme (Field Mapping) Dökümanı

Bu döküman, **başka bir servisten gelen response** (kaynak format) ile bizim
`kargoapi` servisimizin `POST /createShipment` endpoint'inin beklediği **`sendShipping`
gövdesi** (hedef format) arasındaki alan eşleştirmesini tanımlar.

Akış şu şekildedir:

> Başka servis response'u  →  (parse / dönüştürme)  →  `POST /createShipment` isteği

Amaç: kaynak JSON'daki değerlerin, hedef gövdedeki doğru alanlara mantıklı şekilde
yerleştirilmesi.

---

## 1. Kaynak format (örnek)

Kaynak response, tek bir gönderiyi (consignment) temsil eder ve iki ayrı liste içerir:
paket bazlı `Packages[]` ve ürün bazlı `Products[]`.

```
{
  "TransactionID": "TRX-BRS-MUTLU-001",
  "CargoProviderCode": "Borusan",
  "ConsignmentNo": "858590800123213",
  "CustomerName": "Avansas",
  "CityCode": "41",
  "TownCode": "Gebze",
  "AddressText": "Avansas Tavşanlı Depo",
  "CityText": "KOCAELİ",
  "TownText": "GEBZE",
  "RecipientName": "Ebru Böke",
  "RecipientPhone": "5555555555",
  "ConsignmentDeci": 15.0,
  "ConsignmentWeight": 10.5,
  "IsPartial": false,
  "Packages": [
    { "Barcode": "0029808558", "Deci": 15.0, "Weight": 10.5, "RowNumber": 1,
      "Items": [ { "ProductCode": "PAL", "ProductCount": 1 } ] }
  ],
  "Products": [
    { "ProductCode": "PAL", "ProductName": "ÜLKER ALBENİ ÇİKOLATA BAR",
      "ProductDeci": 15.0, "ProductCount": 1, "ProductUOM": "Adet" }
  ]
}
```

**Önemli gözlem:** Kaynaktaki `CityText / TownText / AddressText` alanları **göndericiye**
(Avansas deposu: Kocaeli / Gebze) aittir. Alıcı için ise yalnızca **ad ve telefon**
(`RecipientName`, `RecipientPhone`) vardır; **alıcı şehir/ilçe/adres bilgisi kaynakta
yoktur** (bkz. Bölüm 4 — Kritik boşluklar).

---

## 2. Üst seviye eşleştirme (sendShipping.*)

| Kaynak Alan | Hedef Alan (sendShipping.*) | Zorunlu | Açıklama |
| --- | --- | --- | --- |
| ConsignmentNo | shippingNumber | Evet | Gönderi/kargo takip numarası. |
| TransactionID | requestNumber | Evet | İşlem/talep numarası. |
| CustomerName | customerId | Evet | DİKKAT: kaynak müşteri ADI verir, hedef müşteri KODU ister. Doğrudan eşleşmez; lookup/sabit gerekir. |
| CityText | senderCity | Evet | Gönderici şehir. |
| AddressText | senderAddress | Evet | Gönderici açık adres. |
| TownText | senderCounty | Hayır | Gönderici ilçe. |
| RecipientName | recipientTitle | Hayır | Alıcı adı / unvanı. |
| RecipientPhone | recipientPhoneNumber | Hayır | Alıcı telefon numarası. |
| IsPartial | shippingType | Hayır | Parçalı gönderi bayrağı; iş kuralına göre bir shippingType koduna çevrilebilir (örn. false -> "1"). |
| CargoProviderCode | (yok) | - | Kargo firması ("Borusan"). Hedefte doğrudan karşılığı yok; bilgi amaçlı. |
| CityCode | (yok) | - | Gönderici il plaka kodu (41 = Kocaeli). Hedefte kod alanı yok. |
| TownCode | (yok) | - | Gönderici ilçe kodu/metni. Hedefte karşılığı yok. |
| ConsignmentDeci | (yok) | - | Gönderi toplam desisi. Hedefte toplam alan yok; desi kalem bazında (unitDeci) tutulur. |
| ConsignmentWeight | (yok) | - | Gönderi toplam ağırlığı. Hedefte toplam alan yok. |

---

## 3. Kalem eşleştirme (sendShippingItem[])

Hedefteki `sendShippingItem[]`, kaynaktaki `Packages[]` ve `Products[]` listelerinin
**birleştirilmesiyle** oluşturulur.

**Kural (önerilen):** Her `Packages[].Items[]` elemanı için bir `sendShippingItem` üretilir.
Ürün adı/desi gibi eksik alanlar, `Products[]` listesinden `ProductCode` ile eşleştirilerek
tamamlanır. Paket bilgileri (barkod, ağırlık) ilgili `Package`'tan alınır.

| Kaynak Alan | Hedef Alan (sendShippingItem.*) | Zorunlu | Açıklama |
| --- | --- | --- | --- |
| Packages[].Items[].ProductCode | productCode | Evet | Ürün kodu. |
| Products[] (ProductCode ile eşleşen).ProductName | productName | Evet | Ürün adı; Products listesinden ProductCode ile bulunur. |
| Packages[].Items[].ProductCount | quantity | Evet | Adet. String'e çevrilir ("1"). |
| Packages[].Barcode | packageNumber | Hayır | Koli/paket barkodu. |
| Packages[].Deci (veya Products[].ProductDeci) | unitDeci | Hayır | Desi. String'e çevrilir. |
| Packages[].Items[].ProductCount | itemCount | Hayır | Adet (sayısal). |
| Packages[].Weight | weight | Hayır | Paket ağırlığı. String'e çevrilir. |
| Products[].ProductUOM | piecesType | Hayır | Birim tipi ("Adet"). Örnek Borusan isteğinde bu alan "PAL" idi; iş kuralına göre UOM ya da paket tipi seçilmelidir. |

> Not: Tip dönüşümlerine dikkat. Hedef DTO'da `quantity`, `unitDeci`, `weight` alanları
> **string** beklenir; kaynakta sayısal (`ProductCount: 1`, `Deci: 15.0`, `Weight: 10.5`)
> gelir. Parse sırasında `String(...)` ile çevrilmelidir. `itemCount` ise sayısaldır.

---

## 4. Kritik boşluklar (kaynakta olmayan zorunlu hedef alanlar)

Aşağıdaki alanlar hedefte **ZORUNLUDUR** ancak kaynak response'ta **yoktur**. Bu alanlar
doldurulmadan `createShipment` isteği `400 VALIDATION_ERROR` döner:

| Hedef Alan | Durum | Çözüm önerisi |
| --- | --- | --- |
| customerId | Kaynakta sadece CustomerName (ad) var, kod yok | Müşteri adı -> kod eşleştirme tablosu / lookup, ya da sabit müşteri kodu. |
| recipientCity | Kaynakta alıcı şehri YOK | Kaynak servis genişletilmeli veya sipariş/CRM gibi başka kaynaktan tamamlanmalı. |
| recipientAddress | Kaynakta alıcı adresi YOK | Aynı şekilde başka kaynaktan tamamlanmalı. |

Ek olarak alıcı tarafındaki opsiyonel alanların da kaynakta karşılığı yoktur:
`recipientCode`, `recipientCounty`. Bunlar boş bırakılabilir ama teslimat için pratikte
gereklidir.

---

## 5. Hedefte opsiyonel, kaynakta karşılığı olmayan alanlar

Bu alanlar zorunlu değildir; boş bırakılabilir veya sabit/varsayılan atanabilir:

- InterfaceId
- IntegrationDescription
- requestDate (gönderim anındaki tarih ile doldurulabilir)
- shippingType (IsPartial'dan türetilebilir)
- recipientCode
- recipientCounty

---

## 6. Somut örnek: kaynak -> createShipment gövdesi

Yukarıdaki kaynak JSON, aşağıdaki `createShipment` gövdesine dönüşür. Kritik boşluklar
`<...>` ile işaretlenmiştir (bu değerler eşleştirme/lookup ile doldurulmalıdır):

```
{
  "sendShipping": {
    "customerId": "<CustomerName='Avansas' -> müşteri kodu eşleştirilmeli>",
    "shippingNumber": "858590800123213",
    "requestNumber": "TRX-BRS-MUTLU-001",
    "shippingType": "1",
    "senderCity": "KOCAELİ",
    "senderCounty": "GEBZE",
    "senderAddress": "Avansas Tavşanlı Depo",
    "recipientTitle": "Ebru Böke",
    "recipientPhoneNumber": "5555555555",
    "recipientCity": "<kaynakta yok - tamamlanmalı>",
    "recipientAddress": "<kaynakta yok - tamamlanmalı>",
    "sendShippingItem": [
      {
        "productCode": "PAL",
        "productName": "ÜLKER ALBENİ ÇİKOLATA BAR",
        "quantity": "1",
        "packageNumber": "0029808558",
        "unitDeci": "15",
        "itemCount": 1,
        "weight": "10.5",
        "piecesType": "Adet"
      }
    ]
  }
}
```

---

## 7. Parse algoritması (özet adımlar)

1. Üst seviye alanları eşle: `ConsignmentNo -> shippingNumber`, `TransactionID ->
   requestNumber`, `CityText -> senderCity`, `TownText -> senderCounty`, `AddressText ->
   senderAddress`, `RecipientName -> recipientTitle`, `RecipientPhone ->
   recipientPhoneNumber`.
2. `customerId`'yi `CustomerName`'den lookup ile çöz (yoksa sabit/varsayılan ata).
3. `recipientCity` ve `recipientAddress`'i kaynak dışı bir yerden tamamla (kaynakta yok).
4. `Products[]`'ı `ProductCode` -> ürün detayı şeklinde bir haritaya al.
5. Her `Packages[]` -> her `Items[]` için bir `sendShippingItem` üret; ürün adı/desiyi
   Products haritasından, paket bilgisini (barcode/weight/deci) Package'tan doldur.
6. Sayısal alanları string'e çevir (`quantity`, `unitDeci`, `weight`).
7. Oluşan gövdeyi `POST /createShipment`'a, `Authorization: Basic <token>` header'ıyla gönder
   (önce `POST /auth/login` ile token al).

---

## 8. Dikkat edilmesi gerekenler

- **Gönderici mi, alıcı mı?** Kaynaktaki City/Town/Address göndericidir (Avansas deposu).
  Yanlışlıkla alıcı alanlarına yazılmamalıdır.
- **Zorunlu alan boşlukları** (customerId, recipientCity, recipientAddress) çözülmeden
  istek reddedilir.
- **Tip uyumu:** hedef DTO string beklerken kaynak sayısal gönderiyor; dönüştürme şart.
- **Packages vs Products:** adet ve barkod Packages'tan, ürün adı Products'tan gelir;
  ikisi ProductCode ile eşleştirilir.
- **Token akışı:** createShipment'tan önce mutlaka login ile token alınmalıdır
  (ayrıntı için KULLANIM dökümanına bakınız).
