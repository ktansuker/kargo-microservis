# --- 1. aşama: build ---
FROM node:20-alpine AS build
WORKDIR /app

# Vite ortam değişkenleri BUILD anında koda gömülür, bu yüzden ARG olarak alınır.
ARG VITE_KARGO_API_URL=http://localhost:3000
ENV VITE_KARGO_API_URL=$VITE_KARGO_API_URL

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# --- 2. aşama: statik dosyaları nginx ile sun ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
