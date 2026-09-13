import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IzdanjaService } from '../izdanja.service';
import { formatDatum } from '../izdanje.model';

@Component({
  selector: 'app-arhiva-page',
  imports: [RouterLink],
  template: `
    <h1 class="pt-8 text-2xl font-semibold text-white">Arhiva</h1>

    @if (izdanja.index.isLoading()) {
      <p class="py-16 text-center text-slate-500">Učitavam…</p>
    } @else if (!izdanja.index.value().length) {
      <p class="py-16 text-center text-slate-400">Još nema izdanja.</p>
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
                @for (naslov of e.naslovi; track $index) {
                  <li class="text-slate-200">{{ naslov }}</li>
                }
              </ul>
              <p class="mt-3 text-xs text-slate-500">
                {{ e.broj.vesti }} vesti · {{ e.broj.novo }} novih stvari · {{ e.broj.istrazivanje }} radova · {{ e.broj.ideje }} ideja
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
  protected readonly datum = (d: string) => formatDatum(d);
}
