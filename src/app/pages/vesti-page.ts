import { Component, inject, input } from '@angular/core';
import { DatumTraka } from '../components/datum-traka';
import { izdanjeZaRutu } from '../izdanje-ruta';
import { PodesavanjaService } from '../podesavanja.service';
import { SacuvajDugme } from '../sacuvaj-dugme';
import { SacuvanoService } from '../sacuvano.service';

@Component({
  selector: 'app-vesti-page',
  imports: [DatumTraka, SacuvajDugme],
  template: `
    <app-datum-traka [datum]="ruta.aktivniDatum()" sekcija="vesti" [stanje]="ruta.stanje()" [prevodNedostaje]="ruta.prevodNedostaje()" />

    @if (ruta.izdanje(); as iz) {
      <h1 class="sr-only">{{ t('nav.vesti') }}</h1>
      <p class="mt-4 text-lg leading-relaxed text-slate-100">{{ iz.ukratko }}</p>

      <section aria-labelledby="naslov-vesti" class="mt-8">
        <h2 id="naslov-vesti" class="text-xs font-semibold uppercase tracking-widest text-slate-500">{{ t('vesti.najbitnije') }}</h2>
        <ol class="mt-4 space-y-4">
          @for (v of iz.vesti; track $index) {
            <li class="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
              <div class="flex items-start justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2 text-xs">
                  @if (v.vaznost === 3) {
                    <span class="rounded-full bg-amber-400/15 px-2 py-0.5 font-medium text-amber-300">{{ t('vesti.velikaVest') }}</span>
                  }
                  @if (v.izSrbije) {
                    <span class="rounded-full bg-sky-400/15 px-2 py-0.5 font-medium text-sky-300">🇷🇸 {{ t('vesti.srbija') }}</span>
                  }
                  <span class="text-slate-500">{{ tIli('kategorija.' + v.kategorija, v.kategorija) }}</span>
                </div>
                <app-sacuvaj-dugme
                  class="-mr-2 -mt-2"
                  [stavka]="{ kljuc: kljuc(iz.datum, 'vest', $index), tip: 'vest', datum: iz.datum, naslov: v.naslov, opis: v.staSeDesilo, url: v.izvori[0]?.url ?? null }"
                />
              </div>
              <h3 class="mt-1 text-lg font-semibold leading-snug text-white">{{ v.naslov }}</h3>
              <p class="mt-2 leading-relaxed text-slate-300">{{ v.staSeDesilo }}</p>
              <p class="mt-3 rounded-xl bg-slate-800/50 px-4 py-3 text-sm leading-relaxed text-slate-300">
                <span class="font-medium text-amber-300">{{ t('vesti.zastoJeBitno') }}</span> {{ v.zastoJeBitno }}
              </p>
              <p class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                @for (izvor of v.izvori; track izvor.url) {
                  <a [href]="izvor.url" target="_blank" rel="noopener" class="text-slate-400 underline decoration-slate-700 underline-offset-4 hover:text-white hover:decoration-slate-400">{{ izvor.naziv }} ↗</a>
                }
              </p>
            </li>
          }
        </ol>
      </section>

      @if (iz.novo.length) {
        <section aria-labelledby="naslov-novo" class="mt-12">
          <h2 id="naslov-novo" class="text-xs font-semibold uppercase tracking-widest text-slate-500">{{ t('vesti.novoNaslov') }}</h2>
          <ul class="mt-4 space-y-4">
            @for (n of iz.novo; track $index) {
              <li class="rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-5">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-xs uppercase tracking-wide text-emerald-400">{{ tIli('tip.' + n.tip, n.tip) }}</p>
                    <h3 class="mt-1 text-lg font-semibold text-white">{{ n.naziv }}</h3>
                  </div>
                  <app-sacuvaj-dugme
                    class="-mr-2 -mt-2"
                    [stavka]="{ kljuc: kljuc(iz.datum, 'novo', $index), tip: 'novo', datum: iz.datum, naslov: n.naziv, opis: n.opis, url: n.link }"
                  />
                </div>
                <p class="mt-2 leading-relaxed text-slate-300">{{ n.opis }}</p>
                <p class="mt-3 text-sm text-slate-400"><span class="text-slate-500">{{ t('vesti.cena') }}</span> {{ n.cena }}</p>
                <ol class="mt-4 space-y-2">
                  @for (korak of n.kakoProbati; track $index) {
                    <li class="flex gap-3 text-sm leading-relaxed text-slate-300">
                      <span class="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-900/60 text-xs font-semibold text-emerald-300">{{ $index + 1 }}</span>
                      <span class="pt-0.5">{{ korak }}</span>
                    </li>
                  }
                </ol>
                <a [href]="n.link" target="_blank" rel="noopener" class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-400 hover:text-emerald-300">{{ t('vesti.otvori', { domen: domen(n.link) }) }} ↗</a>
              </li>
            }
          </ul>
        </section>
      }

      @if (iz.kratkeVesti?.length) {
        <section aria-labelledby="naslov-kratke" class="mt-12">
          <h2 id="naslov-kratke" class="text-xs font-semibold uppercase tracking-widest text-slate-500">{{ t('vesti.kratkeNaslov') }}</h2>
          <ul class="mt-4 divide-y divide-slate-800/80 rounded-2xl border border-slate-800/80 bg-slate-900/60">
            @for (k of iz.kratkeVesti; track $index) {
              <li class="px-4 py-3">
                <a [href]="k.url" target="_blank" rel="noopener" class="group block">
                  <p class="leading-relaxed text-slate-300 group-hover:text-white">{{ k.naslov }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ k.izvor }} ↗</p>
                </a>
              </li>
            }
          </ul>
        </section>
      }

      <p class="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-600">
        {{ t('vesti.potpis', { model: iz.model }) }}
      </p>
    }
  `,
})
export class VestiPage {
  /** Iz rute /izdanje/:datum. Na početnoj strani je prazan, pa se prikazuje najnovije izdanje. */
  readonly datum = input<string>();

  protected readonly ruta = izdanjeZaRutu(this.datum);
  protected readonly t = inject(PodesavanjaService).t;
  protected readonly tIli = inject(PodesavanjaService).tIli;
  protected readonly kljuc = SacuvanoService.kljuc;
  protected readonly domen = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };
}
