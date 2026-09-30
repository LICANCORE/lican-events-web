const STORAGE_KEY = 'lican-merch-cart-v1';

const storage = () => (typeof window !== 'undefined' ? window.localStorage : null);

export function normalizeCart(value) {
  if (!value || !Array.isArray(value.items)) return { items: [] };
  return {
    items: value.items
      .filter((item) => typeof item.productId === 'string' && Number.isInteger(item.quantity) && item.quantity > 0)
      .map((item) => ({
        productId: item.productId,
        variantId: typeof item.variantId === 'string' ? item.variantId : null,
        quantity: Math.min(item.quantity, 99),
      })),
  };
}

export function readCart() {
  try {
    return normalizeCart(JSON.parse(storage()?.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return { items: [] };
  }
}

export function writeCart(cart) {
  const normalized = normalizeCart(cart);
  storage()?.setItem(STORAGE_KEY, JSON.stringify(normalized));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('lican:cart-change', { detail: normalized }));
  return normalized;
}

export function addItem(cart, productId, variantId = null, quantity = 1) {
  const next = normalizeCart(cart);
  if (!Number.isInteger(quantity) || quantity < 1) return next;
  const existing = next.items.find((item) => item.productId === productId && item.variantId === variantId);
  if (existing) existing.quantity = Math.min(existing.quantity + quantity, 99);
  else next.items.push({ productId, variantId, quantity: Math.min(quantity, 99) });
  return next;
}

export function updateItem(cart, productId, variantId, quantity) {
  const next = normalizeCart(cart);
  if (!Number.isInteger(quantity) || quantity <= 0) return removeItem(next, productId, variantId);
  const item = next.items.find((entry) => entry.productId === productId && entry.variantId === variantId);
  if (item) item.quantity = Math.min(quantity, 99);
  return next;
}

export function removeItem(cart, productId, variantId = null) {
  const next = normalizeCart(cart);
  next.items = next.items.filter((item) => item.productId !== productId || item.variantId !== variantId);
  return next;
}

export function clearCart() {
  return writeCart({ items: [] });
}

export function hydrateCart(cart, catalog) {
  return normalizeCart(cart).items.flatMap((item) => {
    const product = catalog.products.find((entry) => entry.id === item.productId);
    if (!product) return [];
    const variant = item.variantId ? product.variants?.find((entry) => entry.id === item.variantId) : null;
    const unitPriceCents = variant?.priceCents ?? product.priceCents;
    return [{ ...item, product, variant, unitPriceCents, lineTotalCents: Number.isInteger(unitPriceCents) ? unitPriceCents * item.quantity : null }];
  });
}

export function cartTotals(cart, catalog, shippingCents = null) {
  const lines = hydrateCart(cart, catalog);
  const pricesComplete = lines.every((line) => Number.isInteger(line.lineTotalCents));
  const subtotalCents = pricesComplete ? lines.reduce((sum, line) => sum + line.lineTotalCents, 0) : null;
  const totalCents = Number.isInteger(subtotalCents) && Number.isInteger(shippingCents) ? subtotalCents + shippingCents : null;
  return {
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    pricesComplete,
    subtotalCents,
    shippingCents,
    totalCents,
  };
}

export { STORAGE_KEY };
