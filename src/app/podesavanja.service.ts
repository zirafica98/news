import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Jezik, Kljuc, LOKALI, RECNIK } from './i18n';

export type Tema = 'sistem' | 'svetla' | 'tamna';

const TEMA_KEY = 'ai-jutro:tema';
const JEZIK_KEY = 'ai-jutro:jezik';

/** Tema i jezik. Pamte se u ovom browseru. */
@Injectable({ providedIn: 'root' })
export class PodesavanjaService {
  private readonly document = inject(DOCUMENT);
  private readonly sistemSvetla = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: light)');

  readonly tema = signal<Tema>(procitaj(TEMA_KEY, ['sistem', 'svetla', 'tamna'], 'sistem'));
  readonly jezik = signal<Jezik>(procitaj(JEZIK_KEY, ['sr', 'en'], 'sr'));
  readonly lokal = computed(() => LOKALI[this.jezik()]);

  private readonly sistemJeSvetao = signal(this.sistemSvetla?.matches ?? false);
  private readonly primenjenaTema = computed(() => {
    const t = this.tema();
    return t === 'sistem' ? (this.sistemJeSvetao() ? 'light' : 'dark') : t === 'svetla' ? 'light' : 'dark';
  });

  constructor() {
    this.sistemSvetla?.addEventListener('change', (e) => this.sistemJeSvetao.set(e.matches));

    effect(() => {
      const tema = this.primenjenaTema();
      const html = this.document.documentElement;
      html.dataset['theme'] = tema;
      this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'light' ? '#f1f5f9' : '#020617');
      sacuvaj(TEMA_KEY, this.tema());
    });

    effect(() => {
      this.document.documentElement.lang = this.jezik() === 'sr' ? 'sr-Latn' : 'en';
      sacuvaj(JEZIK_KEY, this.jezik());
    });
  }

  /** Prevod za ključ, sa zamenom {parametara}. */
  readonly t = (kljuc: Kljuc, parametri?: Record<string, string | number>): string => {
    let tekst = RECNIK[this.jezik()][kljuc];
    for (const [ime, vrednost] of Object.entries(parametri ?? {})) tekst = tekst.replace(`{${ime}}`, String(vrednost));
    return tekst;
  };

  /** Za ključeve koji zavise od podataka (npr. kategorija iz izdanja). Ako prevoda nema, vraća rezervu. */
  readonly tIli = (kljuc: string, rezerva: string): string => RECNIK[this.jezik()][kljuc as Kljuc] || rezerva;
}

function procitaj<T extends string>(kljuc: string, dozvoljeno: readonly T[], podrazumevano: T): T {
  try {
    const v = localStorage.getItem(kljuc) as T | null;
    return v && dozvoljeno.includes(v) ? v : podrazumevano;
  } catch {
    return podrazumevano;
  }
}

function sacuvaj(kljuc: string, vrednost: string): void {
  try {
    localStorage.setItem(kljuc, vrednost);
  } catch {
    // Privatni režim: podešavanje važi dok je stranica otvorena.
  }
}
