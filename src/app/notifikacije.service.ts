import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type StanjeNotifikacija = 'nepoznato' | 'nepodrzano' | 'trebaPocetniEkran' | 'iskljucene' | 'odbijene' | 'ukljucene' | 'greska';

/**
 * Push notifikacije o novom izdanju.
 * Na iPhone-u rade samo kad je sajt dodat na početni ekran (Share → Add to Home Screen), od iOS 16.4.
 */
@Injectable({ providedIn: 'root' })
export class NotifikacijeService {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;

  readonly stanje = signal<StanjeNotifikacija>('nepoznato');
  readonly poruka = signal<string>('');

  async proveri(): Promise<void> {
    const w = this.window;
    if (!w || !('serviceWorker' in navigator) || !('PushManager' in w)) {
      // iOS van početnog ekrana uopšte nema PushManager.
      this.stanje.set(this.jeIosBezPocetnogEkrana() ? 'trebaPocetniEkran' : 'nepodrzano');
      return;
    }
    if (Notification.permission === 'denied') return this.stanje.set('odbijene');
    const registracija = await navigator.serviceWorker.getRegistration();
    const pretplata = await registracija?.pushManager.getSubscription();
    this.stanje.set(pretplata ? 'ukljucene' : 'iskljucene');
  }

  /** Traži dozvolu, pretplaćuje uređaj i šalje pretplatu sajtu. Mora da se pozove iz klika korisnika. */
  async ukljuci(): Promise<void> {
    try {
      const dozvola = await Notification.requestPermission();
      if (dozvola !== 'granted') return this.stanje.set('odbijene');

      const kljuc = await fetch('/api/pretplata').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
      const registracija = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const pretplata =
        (await registracija.pushManager.getSubscription()) ??
        (await registracija.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: uInt8(kljuc.javniKljuc) }));

      const odgovor = await fetch('/api/pretplata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pretplata),
      });
      if (!odgovor.ok) throw new Error(`HTTP ${odgovor.status}`);
      this.stanje.set('ukljucene');
    } catch (greska) {
      this.poruka.set(greska instanceof Error ? greska.message : String(greska));
      this.stanje.set('greska');
    }
  }

  async iskljuci(): Promise<void> {
    const registracija = await navigator.serviceWorker.getRegistration();
    await (await registracija?.pushManager.getSubscription())?.unsubscribe();
    this.stanje.set('iskljucene');
  }

  private jeIosBezPocetnogEkrana(): boolean {
    const w = this.window;
    if (!w) return false;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return ios && !w.matchMedia?.('(display-mode: standalone)').matches;
  }
}

/** VAPID ključ je base64url, a pushManager traži bajtove. */
function uInt8(base64url: string): ArrayBuffer {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const tekst = atob(base64);
  const bajtovi = new Uint8Array(new ArrayBuffer(tekst.length));
  for (let i = 0; i < tekst.length; i++) bajtovi[i] = tekst.charCodeAt(i);
  return bajtovi.buffer;
}
