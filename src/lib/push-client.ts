'use client';

/**
 * Browser side of Web Push (ZIG-I20-2): feature detection, the iOS
 * home-screen rule, subscribe/unsubscribe against the registered service
 * worker. Server registration goes through the push-subscriptions actions.
 */
import {
  removePushSubscription,
  savePushSubscription,
} from '@/actions/push-subscriptions';

export type PushSupport =
  | 'unsupported'
  /** iOS Safari only delivers push to a PWA added to the home screen (16.4+). */
  | 'ios-needs-install'
  | 'denied'
  | 'ready';

export const isIosDevice = (userAgent: string, maxTouchPoints = 0): boolean =>
  /iPhone|iPad|iPod/i.test(userAgent) ||
  (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);

/** Android phones and tablets (Chrome, Samsung Internet, …). */
export const isAndroidDevice = (userAgent: string): boolean => /Android/i.test(userAgent);

export const getPushSupport = (input: {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: NotificationPermission | null;
  isIos: boolean;
  isStandalone: boolean;
}): PushSupport => {
  if (input.isIos && !input.isStandalone) return 'ios-needs-install';
  if (!input.hasServiceWorker || !input.hasPushManager || !input.hasNotification) {
    return 'unsupported';
  }
  if (input.permission === 'denied') return 'denied';
  return 'ready';
};

export const detectPushSupport = (isStandalone: boolean): PushSupport => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported';
  return getPushSupport({
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : null,
    isIos: isIosDevice(navigator.userAgent, navigator.maxTouchPoints),
    isStandalone,
  });
};

/** VAPID public key (URL-safe base64) as the bytes `pushManager.subscribe` wants. */
export const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
};

const serviceWorkerRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  // Give a just-registered worker a moment (first visit of the installed app).
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4_000)),
  ]);
};

export const getCurrentPushSubscription = async (): Promise<PushSubscription | null> => {
  const registration = await serviceWorkerRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
};

export type EnablePushResult = 'enabled' | 'denied' | 'no-service-worker' | 'failed';

/** Ask permission (after a tap), subscribe and register the device on the server. */
export const enablePushOnThisDevice = async (
  vapidPublicKey: string,
): Promise<EnablePushResult> => {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const registration = await serviceWorkerRegistration();
  if (!registration) return 'no-service-worker';
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return 'failed';
  const result = await savePushSubscription({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent.slice(0, 512),
  });
  return result.success ? 'enabled' : 'failed';
};

/** Unsubscribe this device and forget it on the server. Best effort on sign-out. */
export const disablePushOnThisDevice = async (): Promise<void> => {
  try {
    const subscription = await getCurrentPushSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await removePushSubscription(endpoint);
  } catch {
    // The device may be offline or the worker gone; the server also drops
    // subscriptions on 404/410 and on "cerrar sesión en todos mis dispositivos".
  }
};
