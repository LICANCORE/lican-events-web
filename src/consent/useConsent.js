import { useSyncExternalStore } from 'react';

const denied = Object.freeze({ preferences: null, analytics: false, storageAvailable: false });
const subscribe = (callback) => window.licanConsent?.subscribe(callback) || (() => {});
const getSnapshot = () => window.licanConsent?.getSnapshot() || denied;

export default function useConsent() {
  return useSyncExternalStore(subscribe, getSnapshot, () => denied);
}
