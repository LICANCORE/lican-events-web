import assert from 'node:assert/strict';
import test from 'node:test';

import { addItem, cartTotals, normalizeCart, removeItem, updateItem } from '../../public/merch/js/cart.js';

const catalog = {
  products: [
    { id: 'shirt', name: 'Camiseta', priceCents: 2595, variants: [{ id: 'm', name: 'M', priceCents: 2595 }] },
    { id: 'cap', name: 'Gorra', priceCents: 1800, variants: [] },
  ],
};

test('normaliza entradas y limita cantidades', () => {
  assert.deepEqual(normalizeCart({ items: [{ productId: 'shirt', variantId: 'm', quantity: 101 }, { productId: 'bad', quantity: 0 }] }), {
    items: [{ productId: 'shirt', variantId: 'm', quantity: 99 }],
  });
});

test('añade, modifica y elimina líneas por producto y variante', () => {
  let cart = addItem({ items: [] }, 'shirt', 'm', 2);
  cart = addItem(cart, 'shirt', 'm', 1);
  cart = addItem(cart, 'cap', null, 1);
  assert.equal(cart.items[0].quantity, 3);
  cart = updateItem(cart, 'cap', null, 2);
  assert.equal(cart.items[1].quantity, 2);
  cart = removeItem(cart, 'shirt', 'm');
  assert.deepEqual(cart.items, [{ productId: 'cap', variantId: null, quantity: 2 }]);
});

test('calcula importes únicamente en céntimos enteros', () => {
  const cart = { items: [{ productId: 'shirt', variantId: 'm', quantity: 3 }, { productId: 'cap', variantId: null, quantity: 2 }] };
  const totals = cartTotals(cart, catalog, 495);
  assert.equal(totals.subtotalCents, 11385);
  assert.equal(totals.totalCents, 11880);
  assert.equal(totals.itemCount, 5);
});

test('bloquea el total cuando falta un precio o el envío', () => {
  const incomplete = { products: [{ id: 'pending', name: 'Pendiente', priceCents: null, variants: [] }] };
  const totals = cartTotals({ items: [{ productId: 'pending', variantId: null, quantity: 1 }] }, incomplete, null);
  assert.equal(totals.pricesComplete, false);
  assert.equal(totals.subtotalCents, null);
  assert.equal(totals.totalCents, null);
});
