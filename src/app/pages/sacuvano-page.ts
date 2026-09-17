import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDatum } from '../izdanje.model';
import { PodesavanjaService } from '../podesavanja.service';
import { putanjaSekcije } from '../izdanje-ruta';
import { SacuvanoService, SacuvanoTip } from '../sacuvano.service';

@Component({
  selector: 'app-sacuvano-page',
  imports: [RouterLink],
  template: `
    <h1 class="pt-8 text-2xl font-semibold text-white">{{ t('nav.sacuvano') }}</h1>
    <p class="mt-1 text-sm text-slate-500">{{ t('sacuvano.opis') }}</p>

    @if (!sacuvano.sve().length) {
      <div class="py-16 text-center">
        <p class="text-slate-400">{{ t('sacuvano.prazno') }}</p>
        <p class="mt-1 text-sm text-slate-500">{{ t('sacuvano.praznoOpis') }}</p>
      </div>
    } @else {
      <ul class="mt-6 space-y-3">
        @for (s of sacuvano.sve(); track s.kljuc) {
          <li class="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
            <div class="flex items-start justify-between gap-3">
              <p class="text-xs text-slate-500">
                {{ tIli('sacuvano.tip.' + s.tip, s.tip) }} ·
                <a [routerLink]="putanja(s.tip, s.datum)" class="hover:text-slate-300 hover:underline">{{ datum(s.datum) }}</a>
              </p>
              <button
                type="button"
                (click)="sacuvano.ukloni(s.kljuc)"
                class="-mr-2 -mt-2 rounded-full px-3 py-1 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300"
              >
                {{ t('sacuvano.ukloni') }}
              </button>
            </div>
            <h2 class="mt-1 font-semibold leading-snug text-white">{{ s.naslov }}</h2>
            <p class="mt-2 text-sm leading-relaxed text-slate-400">{{ s.opis }}</p>
            @if (s.url) {
              <a [href]="s.url" target="_blank" rel="noopener" class="mt-3 inline-block text-sm text-amber-400 hover:underline">{{ t('sacuvano.otvori') }} ↗</a>
            }
          </li>
        }
      </ul>
    }
  `,
})
export class SacuvanoPage {
  protected readonly sacuvano = inject(SacuvanoService);
  private readonly podesavanja = inject(PodesavanjaService);
  protected readonly t = this.podesavanja.t;
  protected readonly tIli = this.podesavanja.tIli;
  protected readonly putanja = (tip: SacuvanoTip, datum: string) =>
    putanjaSekcije(tip === 'istrazivanje' ? 'istrazivanje' : tip === 'ideja' ? 'ideje' : tip === 'tema' ? 'mreze' : 'vesti', datum);
  protected readonly datum = (d: string) => formatDatum(d, this.podesavanja.lokal(), { day: 'numeric', month: 'long', year: 'numeric' });
}
