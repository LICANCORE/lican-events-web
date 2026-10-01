# LICAN MERCH

Tienda estática integrada en LICAN EVENTS. No usa CMS ni una librería de e-commerce. El catálogo, la ficha de producto, el carrito persistente y el checkout funcionan en el navegador; el cobro real queda desacoplado para conectarlo después a un Cloudflare Worker y SumUp Hosted Checkout.

## Estructura

- `index.html`: presentación breve, filtros por marca, catálogo, envíos y FAQ.
- `product.html?product=<slug>`: ficha, galería, talla/cantidad y relacionados.
- `checkout.html`: datos mínimos del pedido y resumen.
- `success.html` / `error.html`: estados de retorno. `success.html` no acredita por sí sola un pago.
- `data/products.json`: fuente pública estructurada del catálogo.
- `assets/products/`: derivados WebP optimizados. Los originales permanecen intactos en `../MERCH_SHOP`.
- `js/config.js`: modo de pago y tarifas de envío centralizadas.
- `js/cart.js`: estado del carrito, persistencia e importes en céntimos.
- `scripts/build-merch-catalog.mjs`: analiza carpetas fuente y genera slugs, WebP y JSON.

## Regenerar catálogo e imágenes

La carpeta fuente esperada es `../MERCH_SHOP`, junto al proyecto. Cada producto debe tener su propia subcarpeta; se admiten JPG, PNG, WebP y AVIF, y `PRODUCT.txt` es opcional.

```bash
npm run merch:build
```

El script conserva los originales, rota según EXIF, limita cada derivado a 1600 × 1600 px y genera WebP con calidad 76. También guarda en `products.json` la correspondencia entre cada original y su derivado.

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
- `requiresSize`: obliga a seleccionar variante antes de añadir.
- `variants`: tallas con `{ "id": "m", "name": "M", "priceCents": 2595, "stock": 4 }`.
- `pending`: información aún no confirmada.

Para cambiar una imagen, sustituye o añade el original en la subcarpeta fuente y ejecuta `npm run merch:build`. No edites a mano los WebP generados.

## Envíos

Todas las tarifas viven en `js/config.js` y usan céntimos enteros. Los campos son `peninsula`, `balearic`, `canary`, `eu`, `international`, `eventPickup` y `freeShippingFromCents`. Solo aparecen métodos cuyo valor sea un entero. Actualmente todos están en `null` porque no existe `INFORMACION_TIENDA.txt` ni una tarifa definitiva.

## Carrito

Guarda solo `productId`, `variantId` y `quantity` en `localStorage`, bajo `lican-merch-cart-v1`. Al mostrar totales vuelve a hidratar esos identificadores desde el catálogo. Los importes se calculan en céntimos. Los precios del navegador son informativos y nunca deberán aceptarse como autoridad en el backend.

## Pago y SumUp

`js/config.js` contiene `PAYMENT_MODE`. El valor actual es `mock`; simula el retorno sin enviar el evento `purchase` ni afirmar que existe un pago real.

Para activar SumUp:

1. Implementar `POST /api/create-checkout` en un Cloudflare Worker.
2. Guardar únicamente allí `SUMUP_API_KEY` o token, `SUMUP_MERCHANT_CODE`, la URL pública y cualquier secreto de webhook.
3. Recibir del navegador solo IDs de producto, ID de variante, cantidad y datos necesarios de cliente/envío.
4. Leer precios y stock desde una fuente fiable en el servidor, recalcular subtotal, envío y total, y crear el checkout con SumUp.
5. Responder `{ "hosted_checkout_url": "https://..." }`.
6. Validar el pago con la API de SumUp o un webhook antes de marcar un pedido como `PAID`.
7. Cambiar `PAYMENT_MODE` a `sumup` y ajustar `PAYMENT_ENDPOINT` si el Worker usa otro dominio.

Nunca se debe incluir una credencial en HTML, JavaScript público, `products.json` ni variables Vite expuestas al navegador.

## Analítica

`js/tracking.js` centraliza `view_item`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout` y `purchase`. Emite `lican:commerce` y se conecta a `gtag`/`fbq` si existen. El modo mock no emite `purchase`.

## Pendientes legales y comerciales

Faltan los textos definitivos de compra, devoluciones y envíos, además de stock cuantificado y varias fichas técnicas. El catálogo contiene siete productos: los Clippers naranja y azul son referencias independientes; seis productos tienen compra habilitada y la camiseta permanece visible con stock 0 y estado `SOLD OUT`.
