import { Component, ElementRef, inject, signal } from '@angular/core';
import { Jezik } from '../i18n';
import { NotifikacijeService } from '../notifikacije.service';
import { PodesavanjaService, Tema } from '../podesavanja.service';

/** Dugme ⚙ u zaglavlju sa izborom teme i jezika. */
@Component({
  selector: 'app-podesavanja-meni',
  host: {
    class: 'relative',
    '(document:click)': 'zatvoriAkoJeVan($event)',
    '(document:keydown.escape)': 'otvoren.set(false)',
  },
  template: `
    <button
      type="button"
      (click)="prebaci()"
      [attr.aria-expanded]="otvoren()"
      aria-controls="podesavanja-panel"
      [attr.aria-label]="t('app.podesavanja')"
      class="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white"
      [class.bg-slate-800]="otvoren()"
    >
      <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
        />
      </svg>
    </button>

    @if (otvoren()) {
      <div
        id="podesavanja-panel"
        class="absolute right-0 top-11 w-64 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl shadow-black/30"
      >
        <p id="naslov-tema" class="text-xs font-semibold uppercase tracking-widest text-slate-500">{{ t('app.tema') }}</p>
        <div role="radiogroup" aria-labelledby="naslov-tema" class="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-800/60 p-1">
          @for (o of teme; track o.id) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="podesavanja.tema() === o.id"
              (click)="podesavanja.tema.set(o.id)"
              class="rounded-lg px-2 py-1.5 text-sm transition-colors"
              [class.bg-slate-950]="podesavanja.tema() === o.id"
              [class.text-white]="podesavanja.tema() === o.id"
              [class.text-slate-400]="podesavanja.tema() !== o.id"
            >
              {{ t(o.naziv) }}
            </button>
          }
        </div>

        <p class="mt-4 text-xs font-semibold uppercase tracking-widest text-slate-500">{{ t('app.notifikacije') }}</p>
        @switch (notifikacije.stanje()) {
          @case ('ukljucene') {
            <button type="button" (click)="notifikacije.iskljuci()" class="mt-2 w-full rounded-xl bg-slate-800/60 px-3 py-2 text-sm text-slate-300 hover:text-white">
              {{ t('app.notifikacijeIskljuci') }}
            </button>
            <p class="mt-1 text-xs text-emerald-400">{{ t('app.notifikacijeRade') }}</p>
          }
          @case ('iskljucene') {
            <button type="button" (click)="notifikacije.ukljuci()" class="mt-2 w-full rounded-xl bg-amber-400/15 px-3 py-2 text-sm font-medium text-amber-300 hover:bg-amber-400/25">
              {{ t('app.notifikacijeUkljuci') }}
            </button>
          }
          @case ('trebaPocetniEkran') {
            <p class="mt-2 text-xs leading-relaxed text-slate-400">{{ t('app.notifikacijePocetniEkran') }}</p>
          }
          @case ('odbijene') {
            <p class="mt-2 text-xs leading-relaxed text-slate-400">{{ t('app.notifikacijeOdbijene') }}</p>
          }
          @case ('greska') {
            <p class="mt-2 text-xs leading-relaxed text-rose-400">{{ t('app.notifikacijeGreska') }} {{ notifikacije.poruka() }}</p>
          }
          @case ('nepodrzano') {
            <p class="mt-2 text-xs leading-relaxed text-slate-400">{{ t('app.notifikacijeNepodrzano') }}</p>
          }
        }

        <p id="naslov-jezik" class="mt-4 text-xs font-semibold uppercase tracking-widest text-slate-500">{{ t('app.jezik') }}</p>
        <div role="radiogroup" aria-labelledby="naslov-jezik" class="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-800/60 p-1">
          @for (o of jezici; track o.id) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="podesavanja.jezik() === o.id"
              (click)="podesavanja.jezik.set(o.id)"
              [attr.lang]="o.id === 'sr' ? 'sr-Latn' : 'en'"
              class="rounded-lg px-2 py-1.5 text-sm transition-colors"
              [class.bg-slate-950]="podesavanja.jezik() === o.id"
              [class.text-white]="podesavanja.jezik() === o.id"
              [class.text-slate-400]="podesavanja.jezik() !== o.id"
            >
              {{ o.naziv }}
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class PodesavanjaMeni {
  protected readonly podesavanja = inject(PodesavanjaService);
  private readonly element = inject(ElementRef<HTMLElement>);

  protected readonly notifikacije = inject(NotifikacijeService);
  protected readonly otvoren = signal(false);
  protected readonly t = this.podesavanja.t;

  protected readonly teme = [
    { id: 'sistem', naziv: 'app.tema.sistem' },
    { id: 'svetla', naziv: 'app.tema.svetla' },
    { id: 'tamna', naziv: 'app.tema.tamna' },
  ] as const satisfies readonly { id: Tema; naziv: string }[];

  // Nazivi jezika se ne prevode, da bi se svaki uvek prepoznao.
  protected readonly jezici = [
    { id: 'sr', naziv: 'Srpski' },
    { id: 'en', naziv: 'English' },
  ] as const satisfies readonly { id: Jezik; naziv: string }[];

  protected prebaci(): void {
    this.otvoren.update((o) => !o);
    if (this.otvoren()) void this.notifikacije.proveri();
  }

  protected zatvoriAkoJeVan(event: MouseEvent): void {
    if (this.otvoren() && !this.element.nativeElement.contains(event.target as Node)) this.otvoren.set(false);
  }
}
