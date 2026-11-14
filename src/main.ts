import { bootstrapApplication } from '@angular/platform-browser';
import { inject } from '@vercel/analytics';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Vercel Web Analytics (posete). Uključuje se i u Vercel → projekat → Analytics.
inject();

// Service worker (bez keširanja, samo push) da bi telefon ponudio instalaciju aplikacije.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
