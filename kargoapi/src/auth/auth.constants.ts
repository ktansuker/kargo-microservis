/**
 * Login için geçerli kimlik bilgileri.
 *
 * Örnek istekteki `Authorization: Basic UE9fQVJWQVRPX0RFVjpBcnZhdG8zMjEh`
 * header'ı base64 çözüldüğünde `PO_ARVATO_DEV:Arvato321!` değerini verir.
 * Bu yüzden default kullanıcı adı/parola bunlardır. İstenirse ortam
 * değişkenleri (API_USERNAME / API_PASSWORD) ile override edilebilir.
 */
export const VALID_USERNAME = process.env.API_USERNAME ?? 'PO_ARVATO_DEV';
export const VALID_PASSWORD = process.env.API_PASSWORD ?? 'Arvato321!';

/** Login ile üretilen token'ın geçerlilik süresi (saniye). */
export const TOKEN_TTL_SECONDS = Number(process.env.TOKEN_TTL_SECONDS ?? 3600);
export const TOKEN_TTL_MS = TOKEN_TTL_SECONDS * 1000;

/** Cache anahtar önekleri. */
export const TOKEN_CACHE_PREFIX = 'token:';
