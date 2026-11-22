'use client';

import { useEffect, useState } from 'react';
import { Download, Wifi, WifiOff, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export default function PwaBridge() {
  const [online, setOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [iosInstall, setIosInstall] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    setIosInstall(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    );
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      void navigator.serviceWorker.register('/sw.js').then(async (registration) => {
        await navigator.serviceWorker.ready;
        // Warm lazy tool sections once so an installed copy does not discover a
        // missing code chunk only after the player has left network coverage.
        await Promise.allSettled([
          import('./DungeonGuide'),
          import('./CharacterLab'),
          import('./LogReader'),
          import('./CombatMeter'),
          import('./SpellLibrary'),
          import('./CraftingGuide'),
        ]);
        const urls = performance.getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((url) => url.startsWith(window.location.origin));
        (registration.active || navigator.serviceWorker.controller)?.postMessage({
          type: 'CACHE_URLS',
          urls,
        });
      }).catch(() => {
        // The application remains usable as a normal website when registration
        // is unavailable (private mode and managed browsers can block it).
      });
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstallPrompt(null);
  }

  const showInstall = (installPrompt || iosInstall) && !dismissed && !isStandalone();
  return (
    <div className="pwa-status" aria-live="polite">
      <span className={online ? 'online' : 'offline'} title={online ? 'Connected; verified data can refresh' : 'Offline; using the installed EQLSaK database'}>
        {online ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
        {online ? 'Online' : 'Offline ready'}
      </span>
      {showInstall && (
        <div className="pwa-install">
          {installPrompt ? (
            <button type="button" onClick={install} title="Install EQLSaK on this device for faster access and offline use">
              <Download aria-hidden="true" /> Install app
            </button>
          ) : (
            <span className="ios-install"><Download aria-hidden="true" /> Share → Add to Home Screen</span>
          )}
          <button type="button" className="pwa-dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss install suggestion">
            <X aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
