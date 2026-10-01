# LICAN MERCH

Tienda estática integrada en LICAN EVENTS. No usa CMS ni una librería de e-commerce. El catálogo, la ficha de producto y el carrito persistente funcionan en el navegador; el cobro se conecta al Cloudflare Worker de LICAN y a SumUp Hosted Checkout.

## Estructura

- `index.html`: presentación breve, filtros por marca, catálogo, envíos y FAQ.
- `product.html?product=<slug>`: ficha, galería, talla/cantidad y relacionados.
- `checkout.html`: datos mínimos del pedido y resumen.
- `success.html` / `error.html`: estados de retorno. `success.html` no acredita por sí sola un pago.
- `data/products.json`: fuente pública estructurada del catálogo.
- `assets/products/`: derivados WebP optimizados. Los originales permanecen intactos en `../MERCH_SHOP`.
- `js/config.js`: modo de pago y URL pública del Worker.
- `js/cart.js`: estado del carrito, persistencia e importes en céntimos.
- `scripts/build-merch-catalog.mjs`: analiza carpetas fuente y genera slugs, WebP y JSON.

## Regenerar catálogo e imágenes

La carpeta fuente esperada es `../MERCH_SHOP`, junto al proyecto. Cada producto debe tener su propia subcarpeta; se admiten JPG, PNG, WebP y AVIF, y `PRODUCT.txt` es opcional.

```bash
npm run merch:build
```

El script conserva los originales, los ordena por su nombre numérico (`1`, `2`, `3`…), rota según EXIF, limita cada derivado a 1440 × 1440 px y genera WebP con calidad 72 y esfuerzo máximo de compresión. También guarda en `products.json` la correspondencia entre cada original y su derivado. En el catálogo, la imagen 1 es la vista inicial y la imagen 2 aparece al pasar el cursor o enfocar la tarjeta.

Para productos nuevos sin una entrada editorial en `productDetails`, el generador crea un registro seguro con datos comerciales pendientes. Añade los datos confirmados a `productDetails` en `scripts/build-merch-catalog.mjs` y regenera.

## Editar un producto

Los campos públicos se definen en `productDetails` dentro del generador:

- `name`, `brand`, `collection`, `type`, `description` y `features`: contenido público confirmado.
- `priceCents`: precio final en céntimos; `2595` equivale a 25,95 €. Mientras sea `null`, no se muestra un precio ficticio.
- `stock`: unidades confirmadas. Mantener `null` mientras no exista el dato.
- `purchasable`: cambiar a `true` solo cuando precio, stock y condiciones estén validados.
- `active`: controla si aparece en el catálogo.
- `sortOrder`: fija el orden manual del catálogo y se conserva dentro de cada filtro.
- `preorder`: muestra el estado de preventa sin bloquear la compra.
- `compareAtPriceCents` y `offerLabel`: muestran el precio anterior tachado y la etiqueta de oferta sin alterar el precio real del carrito.
- `requiresSize`: obliga a seleccionar variante antes de añadir.
- `variants`: tallas con `{ "id": "m", "name": "M", "priceCents": 2595, "stock": 4 }`.
- `pending`: información aún no confirmada.

Para cambiar una imagen, sustituye o añade el original en la subcarpeta fuente y ejecuta `npm run merch:build`. No edites a mano los WebP generados.

## Envíos

Las tarifas son autoridad del Worker y usan céntimos enteros. El navegador las obtiene mediante `GET /store-config`; la copia de `js/config.js` solo es un fallback seguro sin tarifas. Los campos son `peninsula`, `balearic`, `canary`, `eu`, `international`, `eventPickup` y `freeShippingFromCents`. Solo aparecen métodos cuyo valor sea un entero. Actualmente todos están en `null` porque no existe `INFORMACION_TIENDA.txt` ni una tarifa definitiva.

## Carrito

Guarda solo `productId`, `variantId` y `quantity` en `localStorage`, bajo `lican-merch-cart-v1`. Al mostrar totales vuelve a hidratar esos identificadores desde el catálogo. Los importes se calculan en céntimos. Los precios del navegador son informativos y nunca deberán aceptarse como autoridad en el backend.

## Pago y SumUp

`js/config.js` contiene `PAYMENT_MODE`, actualmente en `sumup`, y apunta a `https://lican-merch-api.licancorp.workers.dev`. El código completo que debe desplegarse en ese Worker está en [`../../cloudflare-worker/worker.js`](../../cloudflare-worker/worker.js); las variables y el procedimiento están documentados en [`../../cloudflare-worker/README.md`](../../cloudflare-worker/README.md).

El frontend envía a `POST /create-checkout` únicamente IDs de producto, variante, cantidad y los datos imprescindibles de cliente/envío. El Worker valida el catálogo, stock y variantes, calcula subtotal, envío y total, y devuelve el enlace de SumUp. Antes de salir se guardan el ID y la referencia en `sessionStorage`.

Al volver, `success.html` consulta `GET /checkout-status?id=...`. El carrito solo se vacía cuando SumUp responde `PAID`; `PENDING`, `FAILED`, `EXPIRED`, un retorno manual o un error de red conservan la compra. El webhook `POST /sumup-webhook` vuelve a consultar la API de SumUp antes de confiar en el estado recibido.

Nunca se debe incluir una credencial en HTML, JavaScript público, `products.json` ni variables Vite expuestas al navegador.

## Analítica

`js/tracking.js` centraliza `view_item`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout` y `purchase`. Emite `lican:commerce` y se conecta a `gtag`/`fbq` si existen. `begin_checkout` se registra solo después de que el Worker cree correctamente el checkout. `purchase` requiere un estado `PAID` verificado y nunca se emite cuando SumUp identifica el comercio como sandbox.

## Pendientes legales y comerciales

Faltan los textos definitivos de compra, devoluciones y envíos, además de stock cuantificado y varias fichas técnicas. El catálogo contiene siete productos: los Clippers naranja y azul son referencias independientes; seis productos tienen compra habilitada y la camiseta permanece visible con stock 0 y estado `SOLD OUT`.
