# Cloudflare Worker · LICAN MERCH + SumUp

Este directorio contiene el código completo del Worker que actúa como autoridad del checkout. El navegador nunca envía precios: solo referencias de producto, cantidades, variante y los datos necesarios de cliente y envío. `worker.js` valida esos datos contra su catálogo, calcula el total en céntimos y crea un SumUp Hosted Checkout.

El código no contiene claves ni credenciales. La URL pública esperada es:

```text
https://lican-merch-api.licancorp.workers.dev
```

## Endpoints

- `GET /`: comprobación básica del servicio.
- `GET /store-config`: configuración pública de envíos que consume el checkout.
- `POST /create-checkout`: valida el pedido, calcula el importe y crea el Hosted Checkout.
- `GET /checkout-status?id=<checkout-id>`: consulta el estado directamente en SumUp.
- `POST /sumup-webhook`: recibe el aviso, responde inmediatamente y vuelve a consultar SumUp antes de considerar fiable el estado.

`POST /create-test-checkout` deja de ser necesario: el flujo sandbox y el de producción usan `/create-checkout` y se distinguen por las credenciales de SumUp.

## Despliegue

1. Copiar el contenido exacto de `worker.js` en el Worker `lican-merch-api` desde el panel de Cloudflare, o desplegarlo con Wrangler si el proyecto se incorpora a un flujo CI.
2. Crear estos secretos en **Settings → Variables and Secrets**:

   - `SUMUP_API_KEY`
   - `SUMUP_MERCHANT_CODE`

3. Configurar como variables de texto, siempre en céntimos enteros, únicamente las tarifas comerciales confirmadas:

   - `SHIPPING_PENINSULA_CENTS`
   - `SHIPPING_BALEARIC_CENTS`
   - `SHIPPING_CANARY_CENTS`
   - `SHIPPING_EU_CENTS`
   - `SHIPPING_INTERNATIONAL_CENTS`
   - `SHIPPING_EVENT_PICKUP_CENTS`
   - `SHIPPING_FREE_FROM_CENTS` (opcional)

No hay tarifas confirmadas en el repositorio y deliberadamente no se ha supuesto ninguna. Mientras un método no tenga valor, no aparece en el checkout. Si no hay ningún método configurado, la compra permanece desactivada y el Worker rechaza el pedido con `SHIPPING_NOT_CONFIGURED`.

Los orígenes admitidos están limitados en `ALLOWED_ORIGINS` a los dos dominios LICAN y a `localhost:4173` / `127.0.0.1:4173`. No debe sustituirse esa lista por `*`.

## Prueba sandbox

1. Usar el API key y merchant code de la cuenta sandbox de SumUp como secretos del Worker.
2. Definir al menos una tarifa de envío de prueba que haya sido aprobada por LICAN.
3. Desplegar `worker.js`.
4. Comprobar `GET /store-config` y que devuelve la tarifa esperada.
5. Abrir `/merch/`, añadir un artículo y completar el checkout.
6. Verificar que el navegador sale a `https://checkout.sumup.com/pay/...`.
7. Completar el pago con las credenciales o medios de prueba de SumUp y volver a `/merch/success.html`.
8. Confirmar que la página muestra `PEDIDO CONFIRMADO`, indica sandbox y solo entonces vacía el carrito.

La página de éxito ignora IDs incluidos en la URL y consulta únicamente el checkout guardado en `sessionStorage`. Un retorno manual sin sesión válida no confirma ningún pago ni vacía el carrito.

## Paso a producción

Cuando SumUp y LICAN hayan validado el comercio, sustituir en Cloudflare los dos secretos sandbox por las credenciales live y confirmar las tarifas definitivas. No hay que mover ninguna clave al frontend ni cambiar el endpoint. El Worker consulta el campo `sandbox` del comercio; si no puede comprobarlo, adopta el valor seguro `true`, por lo que la analítica nunca registrará una compra de producción dudosa.

Antes de fulfillment real debe añadirse persistencia idempotente del pedido confirmado (por ejemplo, D1 o KV) en el punto señalado dentro de `sumupWebhook`. El webhook es una señal para consultar la API, no una prueba de pago por sí solo.

Referencias oficiales:

- SumUp Hosted Checkout: https://developer.sumup.com/online-payments/checkouts/hosted-checkout
- Consulta de checkout: https://developer.sumup.com/api/checkouts/get
- Webhooks de pagos online: https://developer.sumup.com/online-payments/webhooks
- CORS en Cloudflare Workers: https://developers.cloudflare.com/workers/examples/cors-header-proxy/
