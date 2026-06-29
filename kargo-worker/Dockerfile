# Temel Node.js imajını kullan
FROM node:20-alpine

# Çalışma dizinini oluştur
WORKDIR /app

# Paket dosyalarını kopyala ve bağımlılıkları kur
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Tüm proje dosyalarını kopyala
COPY . .

# Uygulamayı derle
RUN npm run build

# Uygulamanın çalışacağı portu dışarı aç (API'den farklı port vermiştik)
EXPOSE 3001

# Container başladığında arka plan servisini çalıştır
CMD ["node", "dist/main"]