import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IzdanjaService } from '../izdanja.service';
import { IndexStavka, formatDatum } from '../izdanje.model';
import { PodesavanjaService } from '../podesavanja.service';

@Component({
  selector: 'app-arhiva-page',
  imports: [RouterLink],
  template: `
    <h1 class="pt-8 text-2xl font-semibold text-white">{{ t('nav.arhiva') }}</h1>

    @if (izdanja.index.isLoading()) {
      <p class="py-16 text-center text-slate-500">{{ t('stanje.ucitavam') }}</p>
    } @else if (!izdanja.index.value().length) {
      <p class="py-16 text-center text-slate-400">{{ t('arhiva.prazno') }}</p>
    } @else {
      <ul class="mt-6 space-y-3">
        @for (e of izdanja.index.value(); track e.datum) {
          <li>
            <a
              [routerLink]="['/izdanje', e.datum]"
              class="block rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 transition-colors hover:border-slate-600"
            >
              <p class="text-sm font-medium text-amber-400 first-letter:uppercase">{{ datum(e.datum) }}</p>
              <ul class="mt-2 space-y-1">
                @for (naslov of naslovi(e); track $index) {
                  <li class="text-slate-200">{{ naslov }}</li>
                }
              </ul>
              <p class="mt-3 text-xs text-slate-500">
                {{ t('arhiva.broj', e.broj) }}
              </p>
            </a>
          </li>
        }
      </ul>
    }
  `,
})
export class ArhivaPage {
  protected readonly izdanja = inject(IzdanjaService);
  private readonly podesavanja = inject(PodesavanjaService);
  protected readonly t = this.podesavanja.t;
  protected readonly datum = (d: string) => formatDatum(d, this.podesavanja.lokal());

  private readonly engleskiNaslovi = computed(() => new Map(this.izdanja.indexEn.value().map((e) => [e.datum, e.naslovi])));
  /** Na engleskom naslovi iz prevoda, a srpski ako prevoda za taj dan nema. */
  protected readonly naslovi = (e: IndexStavka) =>
    (this.podesavanja.jezik() === 'en' ? this.engleskiNaslovi().get(e.datum) : undefined) ?? e.naslovi;
}
