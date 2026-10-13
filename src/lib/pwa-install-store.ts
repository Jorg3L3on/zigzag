import {
  PWA_INSTALL_EVENTS,
  trackClientEvent,
  type PwaInstallSurface,
} from '@/lib/client-analytics';
import { persistPwaInstallBannerDismiss } from '@/lib/pwa-install-persistence';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type PwaInstallSnapshot = { available: boolean };

export type PwaInstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

/**
 * One app-wide holder for Chrome's `beforeinstallprompt` (ZIG-I21-4). The
 * event fires once, early, on whatever page the user lands on, so a listener
 * that mounts later (Mi cuenta) would miss it; this module listens as soon
 * as it loads and every install surface reads the same deferred event.
 */
let deferred: BeforeInstallPromptEvent | null = null;
let snapshot: PwaInstallSnapshot = { available: false };
const SERVER_SNAPSHOT: PwaInstallSnapshot = { available: false };
const listeners = new Set<() => void>();
let initialized = false;

const emit = () => {
  const available = deferred !== null;
  if (snapshot.available !== available) {
    snapshot = { available };
  }
  for (const listener of listeners) listener();
};

const handleBeforeInstallPrompt = (event: Event) => {
  event.preventDefault();
  deferred = event as BeforeInstallPromptEvent;
  emit();
};

const handleAppInstalled = () => {
  persistPwaInstallBannerDismiss();
  deferred = null;
  trackClientEvent(PWA_INSTALL_EVENTS.installed);
  emit();
};

export const initPwaInstallStore = (): void => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
};

export const subscribePwaInstall = (listener: () => void): (() => void) => {
  initPwaInstallStore();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getPwaInstallSnapshot = (): PwaInstallSnapshot => snapshot;
export const getPwaInstallServerSnapshot = (): PwaInstallSnapshot => SERVER_SNAPSHOT;

/** Open Chrome's install dialog and record the answer with the surface that asked. */
export const promptPwaInstall = async (
  surface: PwaInstallSurface,
): Promise<PwaInstallOutcome> => {
  const event = deferred;
  if (!event) return 'unavailable';
  // A deferred event can prompt only once; Chrome fires a new one if needed.
  deferred = null;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    trackClientEvent(
      outcome === 'accepted' ? PWA_INSTALL_EVENTS.accepted : PWA_INSTALL_EVENTS.dismissed,
      { surface },
    );
    if (outcome === 'accepted') persistPwaInstallBannerDismiss();
    return outcome;
  } finally {
    emit();
  }
};

/** Test helper: forget the deferred event and the listeners. */
export const resetPwaInstallStoreForTests = (): void => {
  deferred = null;
  snapshot = { available: false };
  listeners.clear();
};

initPwaInstallStore();
