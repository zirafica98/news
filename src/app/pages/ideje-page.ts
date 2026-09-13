import { Component, inject, input } from '@angular/core';
import { DatumTraka } from '../components/datum-traka';
import { izdanjeZaRutu } from '../izdanje-ruta';
import { PodesavanjaService } from '../podesavanja.service';
import { SacuvajDugme } from '../sacuvaj-dugme';
import { SacuvanoService } from '../sacuvano.service';

@Component({
  selector: 'app-ideje-page',
  imports: [DatumTraka, SacuvajDugme],
  template: `
    <app-datum-traka [datum]="ruta.aktivniDatum()" sekcija="ideje" [stanje]="ruta.stanje()" [prevodNedostaje]="ruta.prevodNedostaje()" />

    @if (ruta.izdanje(); as iz) {
      <h1 class="mt-4 text-2xl font-semibold text-white">{{ t('ideje.naslov') }}</h1>
      <p class="mt-1 text-sm text-slate-500">{{ t('ideje.opis') }}</p>

      <ol class="mt-6 space-y-4">
        @for (ideja of iz.ideje; track $index) {
          <li class="rounded-2xl border border-violet-900/50 bg-violet-950/20 p-5">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                <span class="text-3xl font-bold leading-none text-violet-500/70">{{ $index + 1 }}</span>
                <h2 class="text-lg font-semibold leading-snug text-white">{{ ideja.naziv }}</h2>
              </div>
              <app-sacuvaj-dugme
                class="-mr-2 -mt-2"
                [stavka]="{ kljuc: kljuc(iz.datum, 'ideja', $index), tip: 'ideja', datum: iz.datum, naslov: ideja.naziv, opis: ideja.problem, url: null }"
              />
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span class="flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-1 text-slate-300" [attr.aria-label]="t('ideje.tezinaOd', { n: ideja.tezina })">
                {{ t('ideje.tezina') }}
                @for (n of [1, 2, 3, 4, 5]; track n) {
                  <span class="size-1.5 rounded-full" [class.bg-violet-400]="n <= ideja.tezina" [class.bg-slate-600]="n > ideja.tezina"></span>
                }
              </span>
              @if (ideja.vikendProjekat) {
                <span class="rounded-full bg-violet-400/15 px-2 py-1 font-medium text-violet-300">{{ t('ideje.vikend') }}</span>
              }
            </div>
            <dl class="mt-4 space-y-3 text-sm leading-relaxed">
              <div><dt class="text-slate-500">{{ t('ideje.problem') }}</dt><dd class="text-slate-300">{{ ideja.problem }}</dd></div>
              <div><dt class="text-slate-500">{{ t('ideje.zaKoga') }}</dt><dd class="text-slate-300">{{ ideja.zaKoga }}</dd></div>
              <div><dt class="text-slate-500">{{ t('ideje.ulogaAi') }}</dt><dd class="text-slate-300">{{ ideja.ulogaAi }}</dd></div>
            </dl>
            <details class="group mt-4 rounded-xl bg-slate-800/40">
              <summary class="cursor-pointer list-none px-4 py-3 text-sm font-medium text-violet-300">
                <span class="inline-block transition-transform group-open:rotate-90">›</span> {{ t('ideje.prviKoraci') }}
              </summary>
              <ol class="space-y-2 px-4 pb-4">
                @for (korak of ideja.prviKoraci; track $index) {
                  <li class="flex gap-3 text-sm leading-relaxed text-slate-300">
                    <span class="font-semibold text-violet-400">{{ $index + 1 }}.</span>
                    <span>{{ korak }}</span>
                  </li>
                }
              </ol>
            </details>
            <p class="mt-3 text-xs leading-relaxed text-slate-500">{{ t('ideje.inspiracija') }} {{ ideja.inspiracija }}</p>
          </li>
        }
      </ol>
    }
  `,
})
export class IdejePage {
  readonly datum = input<string>();

  protected readonly ruta = izdanjeZaRutu(this.datum);
  protected readonly kljuc = SacuvanoService.kljuc;
  protected readonly t = inject(PodesavanjaService).t;
}
