import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Register PWA service worker cleanly without blocking iOS cold start or every app resume
const hadController = Boolean(navigator.serviceWorker?.controller);
let hasReloadedForUpdate = false;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !hasReloadedForUpdate) {
      hasReloadedForUpdate = true;
      window.location.reload();
    }
  });
}

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    let lastCheckedAt = Date.now();
    const MIN_CHECK_INTERVAL_MS = 10 * 60 * 1000; // At most once per 10 minutes on iOS resume

    // Defer initial update check so iOS cold-launch paint is never delayed
    window.setTimeout(() => {
      void registration.update();
    }, 4000);

    document.addEventListener('visibilitychange', () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastCheckedAt > MIN_CHECK_INTERVAL_MS
      ) {
        lastCheckedAt = Date.now();
        void registration.update();
      }
    });
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
