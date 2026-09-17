import { Injectable, computed, signal } from '@angular/core';
import { SacuvanoTip } from './sacuvano.service';

export type Ocena = 1 | -1;

const STORAGE_KEY = 'ai-jutro:ocene';

/**
 * Palac gore/dole na vest ili ideju.
 * Pamti se u browseru (da se dugme obojii) i šalje sajtu, odakle ga jutarnji posao čita
 * kako bi sledeća izdanja više ličila na ono što čitalac zaista čita.
 */
@Injectable({ providedIn: 'root' })
export class OceneService {
  private readonly ocene = signal<Record<string, Ocena>>(this.ucitaj());
  private readonly sve = computed(() => this.ocene());

  oceni(kljuc: string, ocena: Ocena, stavka: { datum: string; tip: SacuvanoTip; naslov: string }): void {
    const trenutna = this.sve()[kljuc];
    const nova = trenutna === ocena ? undefined : ocena;
    this.ocene.update((s) => {
      const kopija = { ...s };
      if (nova === undefined) delete kopija[kljuc];
      else kopija[kljuc] = nova;
      return kopija;
    });
    this.snimi();
    if (nova !== undefined) void this.posalji({ ...stavka, ocena: nova });
  }

  ocena(kljuc: string): Ocena | undefined {
    return this.sve()[kljuc];
  }

  private async posalji(telo: { datum: string; tip: SacuvanoTip; naslov: string; ocena: Ocena }): Promise<void> {
    try {
      await fetch('/api/ocena', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(telo) });
    } catch {
      // Ocena ostaje zapamćena u browseru i kad slanje ne prođe.
    }
  }

  private ucitaj(): Record<string, Ocena> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  private snimi(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sve()));
    } catch {
      // Privatni režim: ocene važe dok je stranica otvorena.
    }
  }
}
