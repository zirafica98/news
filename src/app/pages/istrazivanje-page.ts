import { Component, inject, input } from '@angular/core';
import { DatumTraka } from '../components/datum-traka';
import { izdanjeZaRutu } from '../izdanje-ruta';
import { PodesavanjaService } from '../podesavanja.service';
import { SacuvajDugme } from '../sacuvaj-dugme';
import { SacuvanoService } from '../sacuvano.service';

@Component({
  selector: 'app-istrazivanje-page',
  imports: [DatumTraka, SacuvajDugme],
  template: `
    <app-datum-traka [datum]="ruta.aktivniDatum()" sekcija="istrazivanje" [stanje]="ruta.stanje()" [prevodNedostaje]="ruta.prevodNedostaje()" />

    @if (ruta.izdanje(); as iz) {
      <h1 class="mt-4 text-2xl font-semibold text-white">{{ t('istrazivanje.naslov') }}</h1>
      <p class="mt-1 text-sm text-slate-500">{{ t('istrazivanje.opis') }}</p>

      @if (!iz.istrazivanje.length) {
        <p class="py-16 text-center text-slate-400">{{ t('istrazivanje.prazno') }}</p>
      } @else {
        <ul class="mt-6 space-y-4">
          @for (r of iz.istrazivanje; track $index) {
            <li class="rounded-2xl border border-sky-900/50 bg-sky-950/20 p-5">
              <div class="flex items-start justify-between gap-3">
                <h2 class="text-lg font-semibold leading-snug text-white">{{ r.naslov }}</h2>
                <app-sacuvaj-dugme
                  class="-mr-2 -mt-2"
                  [stavka]="{ kljuc: kljuc(iz.datum, 'istrazivanje', $index), tip: 'istrazivanje', datum: iz.datum, naslov: r.naslov, opis: r.objasnjenje, url: r.url }"
                />
              </div>
              <p class="mt-2 leading-relaxed text-slate-300">{{ r.objasnjenje }}</p>
              <p class="mt-3 rounded-xl bg-slate-800/40 px-4 py-3 text-sm leading-relaxed text-slate-300">
                <span class="font-medium text-sky-300">{{ t('istrazivanje.zasto') }}</span> {{ r.zastoJeZanimljivo }}
              </p>
              <p class="mt-4 flex gap-4 text-sm font-medium">
                <a [href]="r.url" target="_blank" rel="noopener" class="text-sky-400 hover:text-sky-300">{{ t('istrazivanje.rad') }} ↗</a>
                @if (r.github) {
                  <a [href]="r.github" target="_blank" rel="noopener" class="text-sky-400 hover:text-sky-300">{{ t('istrazivanje.github') }} ↗</a>
                }
              </p>
            </li>
          }
        </ul>
      }
    }
  `,
})
export class IstrazivanjePage {
  readonly datum = input<string>();

  protected readonly ruta = izdanjeZaRutu(this.datum);
  protected readonly kljuc = SacuvanoService.kljuc;
  protected readonly t = inject(PodesavanjaService).t;
}
