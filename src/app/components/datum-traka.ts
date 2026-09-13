import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IzdanjaService } from '../izdanja.service';
import { formatDatum } from '../izdanje.model';
import { Sekcija, StanjeIzdanja, putanjaSekcije } from '../izdanje-ruta';

/** Datum izdanja sa strelicama za prethodni i sledeći dan, plus poruke kad izdanja nema ili se učitava. */
@Component({
  selector: 'app-datum-traka',
  imports: [RouterLink],
  template: `
    @switch (stanje()) {
      @case ('nema-izdanja') {
        <div class="py-24 text-center">
          <p class="text-4xl">☕</p>
          <p class="mt-4 text-slate-300">Još nema nijednog izdanja.</p>
          <p class="mt-1 text-sm text-slate-500">Prvo stiže sutra ujutru.</p>
        </div>
      }
      @case ('ne-postoji') {
        <div class="py-24 text-center">
          <p class="text-slate-300">Izdanje za ovaj dan ne postoji.</p>
          <a routerLink="/arhiva" class="mt-3 inline-block text-sm text-amber-400 hover:underline">Pogledaj arhivu</a>
        </div>
      }
      @default {
        @if (datum(); as d) {
          <div class="flex items-center justify-between gap-2 pt-5">
            <a
              [routerLink]="starije() ? putanja(starije()!) : null"
              [class.invisible]="!starije()"
              class="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Prethodni dan"
              >←</a
            >
            <p class="text-sm font-medium tracking-wide text-amber-400 first-letter:uppercase">{{ naslov(d) }}</p>
            <a
              [routerLink]="novije() ? putanja(novije()!) : null"
              [class.invisible]="!novije()"
              class="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Sledeći dan"
              >→</a
            >
          </div>
        }
        @if (stanje() === 'ucitava') {
          <p class="py-24 text-center text-slate-500">Učitavam…</p>
        }
      }
    }
  `,
})
export class DatumTraka {
  private readonly izdanja = inject(IzdanjaService);

  readonly datum = input<string>();
  readonly sekcija = input.required<Sekcija>();
  readonly stanje = input.required<StanjeIzdanja>();

  // Index je poređan od najnovijeg, pa je „starije“ sledeće u nizu.
  private readonly pozicija = computed(() => this.izdanja.index.value().findIndex((e) => e.datum === this.datum()));
  protected readonly starije = computed(() => (this.pozicija() >= 0 ? this.izdanja.index.value()[this.pozicija() + 1]?.datum : undefined));
  protected readonly novije = computed(() => (this.pozicija() > 0 ? this.izdanja.index.value()[this.pozicija() - 1]?.datum : undefined));

  protected readonly naslov = (d: string) => formatDatum(d);
  protected readonly putanja = (d: string) => putanjaSekcije(this.sekcija(), d);
}
