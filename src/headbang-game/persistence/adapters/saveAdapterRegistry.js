import { genericSaveAdapter } from './genericSaveAdapter.js';
import { v017SaveAdapter } from './v017SaveAdapter.js';
import { v019SaveAdapter } from './v019SaveAdapter.js';

const adapters = [];

export function registerSaveAdapter(adapter) {
  const required = [
    'id',
    'localStorageKeys',
    'canRead',
    'read',
    'toCanonical',
    'fromCanonical',
    'validateLocal',
    'priority',
  ];

  if (
    !adapter ||
    required.some((property) => adapter[property] === undefined) ||
    typeof adapter.id !== 'string'
  ) {
    throw new TypeError('El adaptador no cumple el contrato de persistencia.');
  }

  const existingIndex = adapters.findIndex(({ id }) => id === adapter.id);
  if (existingIndex >= 0) {
    adapters.splice(existingIndex, 1, adapter);
  } else {
    adapters.push(adapter);
  }
  adapters.sort((left, right) => right.priority - left.priority);
  return adapter;
}

export function getRegisteredSaveAdapters() {
  return [...adapters];
}

export function getSaveAdapterById(adapterId) {
  return adapters.find(({ id }) => id === adapterId) ?? null;
}

registerSaveAdapter(v019SaveAdapter);
registerSaveAdapter(v017SaveAdapter);
registerSaveAdapter(genericSaveAdapter);
