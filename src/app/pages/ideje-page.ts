import { Component, inject, input, signal } from '@angular/core';
import { DatumTraka } from '../components/datum-traka';
import { OcenaDugmad } from '../components/ocena-dugmad';
import { SekcijaBaner } from '../components/sekcija-baner';
import { izdanjeZaRutu } from '../izdanje-ruta';
import { PodesavanjaService } from '../podesavanja.service';
import { SacuvajDugme } from '../sacuvaj-dugme';
import { SacuvanoService } from '../sacuvano.service';

/** Ideje za aplikacije kao kartice: broj, naziv, problem u dva reda i oznake; detalji i prvi koraci na klik. */
@Component({
  selector: 'app-ideje-page',
  imports: [DatumTraka, SacuvajDugme, OcenaDugmad, SekcijaBaner],
  template: `
    <app-datum-traka [datum]="ruta.aktivniDatum()" sekcija="ideje" [stanje]="ruta.stanje()" [prevodNedostaje]="ruta.prevodNedostaje()" />

    @if (ruta.izdanje(); as iz) {
      <app-sekcija-baner boja="violet" izraz="sly" [oznaka]="t('ideje.oznaka')" [naslov]="t('ideje.naslov')" [opis]="t('ideje.opis')" />

      <ol class="mt-6 grid gap-4 sm:grid-cols-2">
        @for (ideja of iz.ideje; track $index) {
          <li class="flex flex-col rounded-2xl border border-violet-900/50 bg-slate-900/60 p-5">
            <div class="flex items-start gap-4">
              <span class="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl font-extrabold text-white shadow-lg shadow-violet-950/50">{{ $index + 1 }}</span>
              <div class="min-w-0 flex-1">
                <h2 class="text-lg font-bold leading-snug text-white">{{ ideja.naziv }}</h2>
                <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span class="flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-1 text-slate-300" [attr.aria-label]="t('ideje.tezinaOd', { n: ideja.tezina })">
                    {{ t('ideje.tezina') }}
                    @for (n of [1, 2, 3, 4, 5]; track n) {
                      <span class="size-1.5 rounded-full" [class.bg-violet-400]="n <= ideja.tezina" [class.bg-slate-600]="n > ideja.tezina"></span>
                    }
                  </span>
                  @if (ideja.vikendProjekat) {
                    <span class="rounded-full bg-violet-400/15 px-2 py-1 font-medium text-violet-300">⚡ {{ t('ideje.vikend') }}</span>
                  }
                </div>
              </div>
            </div>

            <p class="mt-4 text-sm leading-relaxed text-slate-300" [class.line-clamp-2]="!otvoreno().has($index)">{{ ideja.problem }}</p>

            @if (otvoreno().has($index)) {
              <div class="mt-4 grid gap-2 text-sm leading-relaxed">
                <div class="rounded-xl bg-slate-800/50 px-4 py-3"><p class="text-xs font-semibold uppercase tracking-widest text-slate-500">👥 {{ t('ideje.zaKoga') }}</p><p class="mt-1 text-slate-200">{{ ideja.zaKoga }}</p></div>
                <div class="rounded-xl bg-slate-800/50 px-4 py-3"><p class="text-xs font-semibold uppercase tracking-widest text-slate-500">🤖 {{ t('ideje.ulogaAi') }}</p><p class="mt-1 text-slate-200">{{ ideja.ulogaAi }}</p></div>
                <div class="rounded-xl bg-violet-950/40 px-4 py-3">
                  <p class="text-xs font-semibold uppercase tracking-widest text-violet-300">🚀 {{ t('ideje.prviKoraci') }}</p>
                  <ol class="mt-2 space-y-2">
                    @for (korak of ideja.prviKoraci; track $index) {
                      <li class="flex gap-3 text-slate-200">
                        <span class="grid size-6 shrink-0 place-items-center rounded-full bg-violet-500/25 text-xs font-bold text-violet-200">{{ $index + 1 }}</span>
                        <span>{{ korak }}</span>
                      </li>
                    }
                  </ol>
                </div>
                <p class="text-xs text-slate-500">{{ t('ideje.inspiracija') }} {{ ideja.inspiracija }}</p>
              </div>
            }

            <div class="-mb-2 mt-auto flex items-center justify-between gap-2 pt-3">
              <button type="button" (click)="prebaci($index)" class="rounded-full border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-white">
                {{ otvoreno().has($index) ? t('kartica.manje') : t('ideje.kakoDaPocnes') }}
              </button>
              <div class="-mr-2 flex items-center">
                <app-ocena-dugmad [kljuc]="kljuc(iz.datum, 'ideja', $index)" [datum]="iz.datum" tip="ideja" [naslov]="ideja.naziv" />
                <app-sacuvaj-dugme [stavka]="{ kljuc: kljuc(iz.datum, 'ideja', $index), tip: 'ideja', datum: iz.datum, naslov: ideja.naziv, opis: ideja.problem, url: null }" />
              </div>
            </div>
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

  protected readonly otvoreno = signal(new Set<number>());
  protected prebaci(i: number): void {
    const s = new Set(this.otvoreno());
    if (!s.delete(i)) s.add(i);
    this.otvoreno.set(s);
  }
}
