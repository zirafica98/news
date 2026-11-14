import { DOCUMENT } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { PodesavanjaService } from '../podesavanja.service';

/** Događaj koji Chrome na Androidu šalje kad sajt može da se instalira (nije u TypeScript tipovima). */
interface InstalacijaDogadjaj extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Nacin = 'dugme' | 'ios' | 'uAplikaciji' | 'meni';

const ODBIJENO_KEY = 'ai-jutro:instaliraj-odbijeno';
const PAUZA_DANA = 14;

/**
 * Traka na telefonu koja nudi da se sajt doda na početni ekran (PWA).
 * Android/Chrome: pravo dugme „Instaliraj“. iPhone Safari: uputstvo Share → Add to Home Screen.
 * Instagram/Facebook ugrađeni pregledač: uputstvo da se prvo otvori u pravom pregledaču.
 * Ne prikazuje se na desktopu, u već instaliranoj aplikaciji, ni 14 dana posle zatvaranja.
 */
@Component({
  selector: 'app-instaliraj-baner',
  template: `
    @if (nacin(); as n) {
      <aside
        role="dialog"
        aria-labelledby="instaliraj-naslov"
        class="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md rounded-2xl border border-amber-900/50 bg-slate-900 p-4 shadow-2xl shadow-black/40 lg:hidden"
      >
        <div class="flex items-start gap-3">
          <img src="/icon-192.png" alt="" class="size-11 shrink-0 rounded-xl" />
          <div class="min-w-0 flex-1">
            <p id="instaliraj-naslov" class="font-semibold text-white">{{ t('instaliraj.naslov') }}</p>
            <p class="mt-1 text-sm leading-relaxed text-slate-400">
              @switch (n) {
                @case ('dugme') { {{ t('instaliraj.opis') }} }
                @case ('ios') { {{ t('instaliraj.ios') }} }
                @case ('uAplikaciji') { {{ t('instaliraj.uAplikaciji') }} }
                @default { {{ t('instaliraj.meni') }} }
              }
            </p>
          </div>
          <button
            type="button"
            (click)="zatvori()"
            [attr.aria-label]="t('instaliraj.zatvori')"
            class="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-800 hover:text-white"
          >
            <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        @if (n === 'dugme') {
          <button type="button" (click)="instaliraj()" class="mt-3 w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-300">
            {{ t('instaliraj.dugme') }}
          </button>
        }
      </aside>
    }
  `,
})
export class InstalirajBaner {
  private readonly document = inject(DOCUMENT);
  protected readonly t = inject(PodesavanjaService).t;
  protected readonly nacin = signal<Nacin | null>(null);
  private dogadjaj: InstalacijaDogadjaj | null = null;

  constructor() {
    const w = this.document.defaultView as (Window & { __instalacija?: InstalacijaDogadjaj }) | null;
    if (!w || !this.trebaPrikazati(w)) return;

    const ua = w.navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && w.navigator.maxTouchPoints > 1);
    const uAplikaciji = /Instagram|FBAN|FBAV|FB_IAB|Threads|Line\/|TikTok/i.test(ua);

    // Chrome šalje događaj i pre nego što se Angular pokrene, pa ga index.html sačuva u window.__instalacija.
    const spremno = (e: InstalacijaDogadjaj) => {
      this.dogadjaj = e;
      this.nacin.set('dugme');
    };
    if (w.__instalacija) spremno(w.__instalacija);
    w.addEventListener('instalacija-spremna', () => w.__instalacija && spremno(w.__instalacija));
    w.addEventListener('appinstalled', () => this.nacin.set(null));

    // Kratka pauza, da traka ne iskoči pre nego što čovek vidi sadržaj.
    setTimeout(() => {
      if (this.nacin()) return;
      if (uAplikaciji) this.nacin.set('uAplikaciji');
      else if (ios) this.nacin.set('ios');
      else this.nacin.set('meni');
    }, 4000);
  }

  protected async instaliraj(): Promise<void> {
    const e = this.dogadjaj;
    if (!e) return;
    await e.prompt();
    const { outcome } = await e.userChoice;
    this.dogadjaj = null;
    if (outcome === 'accepted') this.nacin.set(null);
    else this.zatvori();
  }

  protected zatvori(): void {
    this.nacin.set(null);
    try {
      localStorage.setItem(ODBIJENO_KEY, String(Date.now()));
    } catch {
      // Privatni režim: traka se ponovo pojavi sledeći put.
    }
  }

  private trebaPrikazati(w: Window): boolean {
    const telefon = w.matchMedia('(max-width: 1023px)').matches && w.matchMedia('(pointer: coarse)').matches;
    const instalirano = w.matchMedia('(display-mode: standalone)').matches || (w.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!telefon || instalirano) return false;
    try {
      const odbijeno = Number(localStorage.getItem(ODBIJENO_KEY) ?? 0);
      return Date.now() - odbijeno > PAUZA_DANA * 86_400_000;
    } catch {
      return true;
    }
  }
}
