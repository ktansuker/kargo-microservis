# kargoapi

Borusan Lojistik `Order` (SendShipping) isteğini **localde simüle eden** basit NestJS API'si.
DB yoktur; token ve shipment kayıtları bellek içi cache'te tutulur. Port **8000**, CORS full access.

## Endpoint'ler

| Method | Yol               | Açıklama                                              |
| ------ | ----------------- | ---------------------------------------------------- |
| POST   | `/auth/login`     | Kimlik doğrular, `token` döner                       |
| POST   | `/createShipment` | `Authorization: Basic <token>` + alan doğrulaması    |

Dökümanlar:

- Kullanım kılavuzu: [docs/KULLANIM.md](docs/KULLANIM.md) (PDF: `docs/KULLANIM.pdf`)
- Alan eşleştirme (başka servis response'u → sendShipping): [docs/ALAN-ESLESTIRME.md](docs/ALAN-ESLESTIRME.md) (PDF: `docs/ALAN-ESLESTIRME.pdf`)

## Hızlı başlangıç

```bash
# Docker
docker build -t kargoapi:latest .
docker run --rm -p 8000:8000 kargoapi:latest

# veya local
npm install
npm run start
```

## Test

```bash
docker build --target test -t kargoapi:test .   # testler imaj içinde koşar
# veya
npm run test        # unit
npm run test:e2e    # e2e
```

## Döküman PDF üretimi

```bash
npm run docs:pdf          # docs/KULLANIM.md -> docs/KULLANIM.pdf
npm run docs:pdf:mapping  # docs/ALAN-ESLESTIRME.md -> docs/ALAN-ESLESTIRME.pdf
```

## Varsayılan kimlik bilgileri

`PO_ARVATO_DEV` / `Arvato321!` (örnek Basic header'ın base64 çözümü).
`API_USERNAME`, `API_PASSWORD`, `TOKEN_TTL_SECONDS`, `PORT` env ile override edilebilir.
