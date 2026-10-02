# Cloudflare Worker · LICAN MERCH + SumUp

Este directorio contiene el código completo del Worker que actúa como autoridad del checkout. El navegador envía referencias de producto, cantidades, variante y los datos necesarios de cliente/dirección; nunca decide precios, zona, portes ni total. `worker.js` valida el catálogo, calcula todo en céntimos y crea un SumUp Hosted Checkout.

URL pública esperada:

```text
https://lican-merch-api.licancorp.workers.dev
```

## Política definitiva de envíos

### España peninsular

- Subtotal inferior a 25,00 €: 4,99 €.
- Subtotal desde 25,00 € hasta 39,99 €: 3,99 €.
- Subtotal desde 40,00 €: gratis.

Los límites se aplican al subtotal de productos antes del envío, sin redondeos y siempre en céntimos enteros.

### Baleares

- Subtotal inferior a 40,00 €: 4,99 €.
- Subtotal desde 40,00 €: gratis.

Los códigos postales españoles con prefijo `07` se clasifican como `balearic`. No utilizan el tramo peninsular de 3,99 €.

### Europa

Los países incluidos explícitamente en `EUROPEAN_COUNTRIES` tienen una tarifa fija de 12,99 €, sea cual sea el subtotal. No se aplica envío gratuito europeo.

### No disponible

- Canarias (`CANARY_NOT_AVAILABLE`).
- Ceuta (`CEUTA_NOT_AVAILABLE`).
- Melilla (`MELILLA_NOT_AVAILABLE`).
- Reino Unido, Estados Unidos y envíos internacionales (`INTERNATIONAL_NOT_AVAILABLE`).
- Cualquier país no incluido en la lista cerrada (`UNSUPPORTED_COUNTRY`).

La clasificación española usa el código postal: `07` Baleares, `35` y `38` Canarias, `51` Ceuta y `52` Melilla. Los destinos internacionales pueden incorporarse más adelante ampliando la política server-side.

## Endpoints

- `GET /`: comprobación básica del servicio.
- `GET /store-config`: política pública estructurada y lista de países europeos habilitados.
- `POST /create-checkout`: valida el pedido, deriva la zona, calcula subtotal/envío/total y crea el Hosted Checkout.
- `GET /checkout-status?id=<checkout-id>`: consulta el estado directamente en SumUp.
- `POST /sumup-webhook`: responde inmediatamente y vuelve a consultar SumUp antes de confiar en el estado.

La respuesta de `/create-checkout` incluye, además de los datos de SumUp, `subtotal_cents`, `shipping_cents`, `total_cents` y `shipping_zone`. No contiene información sensible.

## Despliegue

1. Sustituir completamente el código publicado del Worker `lican-merch-api` por `worker.js`.
2. Conservar o crear únicamente estos secretos en **Settings → Variables and Secrets**:

   - `SUMUP_API_KEY`
   - `SUMUP_MERCHANT_CODE`

3. Desplegar y comprobar `GET /store-config`.

No hacen falta nuevas variables de Cloudflare para las tarifas: la política definitiva está centralizada mediante constantes dentro de `worker.js`.

Estas variables anteriores han quedado obsoletas y pueden eliminarse:

- `SHIPPING_PENINSULA_CENTS`
- `SHIPPING_BALEARIC_CENTS`
- `SHIPPING_CANARY_CENTS`
- `SHIPPING_EU_CENTS`
- `SHIPPING_INTERNATIONAL_CENTS`
- `SHIPPING_EVENT_PICKUP_CENTS`
- `SHIPPING_FREE_FROM_CENTS`

Los orígenes CORS siguen limitados a los dos dominios LICAN y a `localhost:4173` / `127.0.0.1:4173`.

## Pruebas rápidas

```bash
npm run merch:test
npm run merch:smoke
```

Las pruebas unitarias cubren los límites peninsulares y los tramos baleares con `07001`, `07100`, `07300` y `07800`; Francia y Alemania; y los bloqueos de Canarias, Ceuta, Melilla, Reino Unido y Estados Unidos. También comprueban que cualquier coste enviado por el navegador se ignora.

Para una prueba visual, usa `43001 / Tarragona` para Península y `07001 / Illes Balears` para Baleares. Cambia el país a Francia o Alemania para ver 12,99 €. Usa `35001 / Las Palmas`, `38001 / Santa Cruz de Tenerife`, `51001 / Ceuta` o `52001 / Melilla` para comprobar los bloqueos.

## Sandbox y producción

En sandbox, configura el API key y merchant code de pruebas de SumUp, completa un checkout y confirma que el carrito solo se vacía después de que `/checkout-status` devuelva `PAID`. La página indica que no se ha movido dinero real y no emite el evento analítico `purchase`.

Para producción, sustituye los dos secretos por las credenciales live. Antes de fulfillment real debe añadirse persistencia idempotente del pedido confirmado —por ejemplo D1 o KV— en el punto señalado dentro de `sumupWebhook`. El webhook es una señal para consultar la API, no una prueba de pago por sí solo.

Referencias oficiales:

- SumUp Hosted Checkout: https://developer.sumup.com/online-payments/checkouts/hosted-checkout
- Consulta de checkout: https://developer.sumup.com/api/checkouts/get
- Webhooks: https://developer.sumup.com/online-payments/webhooks
- CORS en Cloudflare Workers: https://developers.cloudflare.com/workers/examples/cors-header-proxy/
