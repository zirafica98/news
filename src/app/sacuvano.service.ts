import { Injectable, computed, signal } from '@angular/core';

export type SacuvanoTip = 'vest' | 'novo' | 'istrazivanje' | 'ideja';

export interface SacuvanaStavka {
  kljuc: string;
  tip: SacuvanoTip;
  datum: string;
  naslov: string;
  opis: string;
  url: string | null;
  sacuvano: string;
}

const STORAGE_KEY = 'ai-jutro:sacuvano';

/** Sačuvane stavke žive samo u ovom browseru (localStorage). */
@Injectable({ providedIn: 'root' })
export class SacuvanoService {
  private readonly stavke = signal<SacuvanaStavka[]>(this.ucitaj());

  readonly sve = computed(() => [...this.stavke()].sort((a, b) => b.sacuvano.localeCompare(a.sacuvano)));
  private readonly kljucevi = computed(() => new Set(this.stavke().map((s) => s.kljuc)));

  static kljuc(datum: string, tip: SacuvanoTip, redniBroj: number): string {
    return `${datum}:${tip}:${redniBroj}`;
  }

  jeSacuvano(kljuc: string): boolean {
    return this.kljucevi().has(kljuc);
  }

  prebaci(stavka: Omit<SacuvanaStavka, 'sacuvano'>): void {
    this.stavke.update((sve) =>
      sve.some((s) => s.kljuc === stavka.kljuc)
        ? sve.filter((s) => s.kljuc !== stavka.kljuc)
        : [...sve, { ...stavka, sacuvano: new Date().toISOString() }],
    );
    this.snimi();
  }

  ukloni(kljuc: string): void {
    this.stavke.update((sve) => sve.filter((s) => s.kljuc !== kljuc));
    this.snimi();
  }

  private ucitaj(): SacuvanaStavka[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SacuvanaStavka[]) : [];
    } catch {
      return [];
    }
  }

  private snimi(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stavke()));
    } catch {
      // Privatni režim ili pun storage: čuvanje radi dok je stranica otvorena.
    }
  }
}
