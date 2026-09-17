// Service worker: prima push notifikacije i otvara sajt kad se na njih klikne.
// Namerno bez keširanja: sajt se otvara iz mreže, a izdanja se menjaju svaki dan.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let podaci = {};
  try {
    podaci = event.data?.json() ?? {};
  } catch {
    podaci = { telo: event.data?.text() ?? '' };
  }
  const naslov = podaci.naslov || 'AI News';
  event.waitUntil(
    self.registration.showNotification(naslov, {
      body: podaci.telo || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: podaci.oznaka || 'ai-news',
      data: { url: podaci.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const cilj = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((prozori) => {
      const otvoren = prozori.find((p) => p.url.startsWith(self.location.origin));
      if (otvoren) return otvoren.focus().then((p) => p.navigate?.(cilj));
      return self.clients.openWindow(cilj);
    }),
  );
});
