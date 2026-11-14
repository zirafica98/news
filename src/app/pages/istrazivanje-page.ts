import { Component, inject, input, signal } from '@angular/core';
import { DatumTraka } from '../components/datum-traka';
import { SekcijaBaner } from '../components/sekcija-baner';
import { izdanjeZaRutu } from '../izdanje-ruta';
import { PodesavanjaService } from '../podesavanja.service';
import { SacuvajDugme } from '../sacuvaj-dugme';
import { SacuvanoService } from '../sacuvano.service';

/** Radovi dana kao kartice: naslov, kratko objašnjenje i dugmad; ceo tekst se otvara na klik. */
@Component({
  selector: 'app-istrazivanje-page',
  imports: [DatumTraka, SacuvajDugme, SekcijaBaner],
  template: `
    <app-datum-traka [datum]="ruta.aktivniDatum()" sekcija="istrazivanje" [stanje]="ruta.stanje()" [prevodNedostaje]="ruta.prevodNedostaje()" />

    @if (ruta.izdanje(); as iz) {
      <app-sekcija-baner boja="sky" izraz="skeptic" [oznaka]="t('istrazivanje.oznaka', { n: iz.istrazivanje.length })" [naslov]="t('istrazivanje.naslov')" [opis]="t('istrazivanje.opis')" />

      @if (!iz.istrazivanje.length) {
        <p class="py-16 text-center text-slate-400">{{ t('istrazivanje.prazno') }}</p>
      } @else {
        <ul class="mt-6 grid gap-4 sm:grid-cols-2">
          @for (r of iz.istrazivanje; track $index) {
            <li class="flex flex-col overflow-hidden rounded-2xl border border-sky-900/50 bg-slate-900/60">
              <div class="flex items-center justify-between gap-3 bg-gradient-to-r from-sky-950/80 to-transparent px-5 py-3">
                <div class="flex items-center gap-2">
                  <span class="grid size-9 place-items-center rounded-xl bg-sky-400/15 text-lg" aria-hidden="true">📄</span>
                  <span class="text-xs font-bold uppercase tracking-widest text-sky-300">{{ t('istrazivanje.rad') }} {{ $index + 1 }}</span>
                  @if (r.github) {
                    <span class="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300">{{ t('istrazivanje.imaKod') }}</span>
                  }
                </div>
                <app-sacuvaj-dugme [stavka]="{ kljuc: kljuc(iz.datum, 'istrazivanje', $index), tip: 'istrazivanje', datum: iz.datum, naslov: r.naslov, opis: r.objasnjenje, url: r.url }" />
              </div>
              <div class="flex flex-1 flex-col p-5 pt-3">
                <h2 class="text-lg font-bold leading-snug text-white">{{ r.naslov }}</h2>
                <p class="mt-2 text-sm leading-relaxed text-slate-300" [class.line-clamp-3]="!otvoreno().has($index)">{{ r.objasnjenje }}</p>
                @if (otvoreno().has($index)) {
                  <p class="mt-3 rounded-xl bg-sky-950/40 px-4 py-3 text-sm leading-relaxed text-slate-200">
                    <span class="font-semibold text-sky-300">{{ t('istrazivanje.zasto') }}</span> {{ r.zastoJeZanimljivo }}
                  </p>
                }
                <div class="mt-auto flex flex-wrap items-center gap-2 pt-4 text-sm font-medium">
                  <button type="button" (click)="prebaci($index)" class="rounded-full border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-slate-500 hover:text-white">
                    {{ otvoreno().has($index) ? t('kartica.manje') : t('kartica.vise') }}
                  </button>
                  <a [href]="r.url" target="_blank" rel="noopener" class="rounded-full bg-sky-500/15 px-3 py-1.5 text-sky-300 hover:bg-sky-500/25">{{ t('istrazivanje.rad') }} ↗</a>
                  @if (r.github) {
                    <a [href]="r.github" target="_blank" rel="noopener" class="rounded-full bg-slate-800 px-3 py-1.5 text-slate-200 hover:bg-slate-700">GitHub ↗</a>
                  }
                </div>
              </div>
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

  protected readonly otvoreno = signal(new Set<number>());
  protected prebaci(i: number): void {
    const s = new Set(this.otvoreno());
    if (!s.delete(i)) s.add(i);
    this.otvoreno.set(s);
  }
}
