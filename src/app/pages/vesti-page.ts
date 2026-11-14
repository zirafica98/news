import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatumTraka } from '../components/datum-traka';
import { OcenaDugmad } from '../components/ocena-dugmad';
import { SlikaKartice, slikaNovo, slikaVesti } from '../components/slika-kartice';
import { izdanjeZaRutu } from '../izdanje-ruta';
import { PodesavanjaService } from '../podesavanja.service';
import { SacuvajDugme } from '../sacuvaj-dugme';
import { SacuvanoService } from '../sacuvano.service';

/**
 * Izdanje kao mreža kartica sa slikama: naslov i jedna rečenica, a ceo tekst je na strani vesti
 * (/izdanje/:datum/vest/:broj) i alata (/novo/:broj). Kratke vesti ostaju kao spisak linkova.
 */
@Component({
  selector: 'app-vesti-page',
  imports: [DatumTraka, SacuvajDugme, OcenaDugmad, RouterLink, SlikaKartice],
  template: `
    <app-datum-traka [datum]="ruta.aktivniDatum()" sekcija="vesti" [stanje]="ruta.stanje()" [prevodNedostaje]="ruta.prevodNedostaje()" />

    @if (ruta.izdanje(); as iz) {
      <h1 class="sr-only">{{ t('nav.vesti') }}</h1>

      <!-- Ukratko: TL;DR dana -->
      <section class="mt-5 rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900 to-slate-950 p-5 lg:p-6">
        <p class="text-xs font-bold uppercase tracking-widest text-amber-400">☕ {{ t('vesti.ukratko') }}</p>
        <p class="mt-2 leading-relaxed text-slate-200 lg:text-lg" [class.line-clamp-3]="!ceoUvod()">{{ iz.ukratko }}</p>
        @if (!ceoUvod()) {
          <button type="button" (click)="ceoUvod.set(true)" class="mt-2 text-sm font-medium text-amber-400 hover:text-amber-300">{{ t('vesti.vise') }}</button>
        }
      </section>

      @if (iz.nedeljni; as n) {
        <section aria-labelledby="naslov-nedelja" class="mt-5 rounded-2xl border border-amber-900/40 bg-amber-950/20 p-5">
          <h2 id="naslov-nedelja" class="text-xs font-semibold uppercase tracking-widest text-amber-300">{{ t('vesti.nedeljni') }}</h2>
          <ol class="mt-3 grid gap-2 sm:grid-cols-2">
            @for (tacka of n.tacke; track $index) {
              <li class="flex gap-3 text-sm leading-snug text-slate-200">
                <span class="grid size-6 shrink-0 place-items-center rounded-full bg-amber-400/15 text-xs font-bold text-amber-300">{{ $index + 1 }}</span>
                <span>{{ naslovTacke(tacka) }}</span>
              </li>
            }
          </ol>
        </section>
      }

      <!-- Vesti -->
      <section aria-labelledby="naslov-vesti" class="mt-8">
        <h2 id="naslov-vesti" class="text-xl font-bold text-white">{{ t('vesti.najbitnije') }}</h2>
        <ul class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (s of vesti(); track s.i; let prva = $first) {
            <li class="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 transition-colors hover:border-slate-600" [class.sm:col-span-2]="prva" [class.lg:col-span-3]="prva" [class.lg:flex-row]="prva">
              <app-slika-kartice [src]="slikaV(iz.datum, s.i)" [alt]="s.v.naslov" [hitno]="prva" [class.lg:w-3/5]="prva" [class.lg:shrink-0]="prva" />
              <div class="flex flex-1 flex-col p-4" [class.lg:p-8]="prva" [class.lg:justify-center]="prva">
                <div class="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-widest">
                  @if (s.v.vaznost === 3) {
                    <span class="rounded-full bg-amber-400/15 px-2 py-0.5 text-amber-300">{{ t('vesti.velikaVest') }}</span>
                  }
                  @if (s.v.izSrbije) {
                    <span class="rounded-full bg-sky-400/15 px-2 py-0.5 text-sky-300">🇷🇸 {{ t('vesti.srbija') }}</span>
                  }
                  <span class="text-slate-500">{{ tIli('kategorija.' + s.v.kategorija, s.v.kategorija) }}</span>
                </div>
                <h3 class="mt-2 font-bold leading-snug text-white group-hover:text-amber-100" [class.text-lg]="!prva" [class.text-2xl]="prva">
                  <a [routerLink]="['/brief', iz.datum, 'story', s.i]" class="after:absolute after:inset-0">{{ s.v.naslov }}</a>
                </h3>
                <p class="mt-2 text-sm leading-relaxed text-slate-400" [class.line-clamp-2]="!prva" [class.line-clamp-4]="prva">{{ s.v.zastoJeBitno }}</p>
                <!-- Dugmad su iznad linka preko cele kartice -->
                <div class="relative z-10 -mb-2 -ml-2 mt-auto flex items-center pt-2">
                  <app-ocena-dugmad [kljuc]="kljuc(iz.datum, 'vest', s.i)" [datum]="iz.datum" tip="vest" [naslov]="s.v.naslov" />
                  <app-sacuvaj-dugme [stavka]="{ kljuc: kljuc(iz.datum, 'vest', s.i), tip: 'vest', datum: iz.datum, naslov: s.v.naslov, opis: s.v.staSeDesilo, url: s.v.izvori[0]?.url ?? null }" />
                </div>
              </div>
            </li>
          }
        </ul>
      </section>

      <!-- Novo izašlo -->
      @if (iz.novo.length) {
        <section aria-labelledby="naslov-novo" class="mt-12">
          <h2 id="naslov-novo" class="text-xl font-bold text-white">🛠 {{ t('vesti.novoNaslov') }}</h2>
          <ul class="-mx-4 mt-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            @for (n of iz.novo; track $index) {
              <li class="group relative w-72 shrink-0 snap-start overflow-hidden rounded-2xl border border-emerald-900/50 bg-emerald-950/20 transition-colors hover:border-emerald-700/70 sm:w-auto">
                <app-slika-kartice [src]="slikaN(iz.datum, $index)" [alt]="n.naziv" />
                <div class="p-4">
                  <p class="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">{{ tIli('tip.' + n.tip, n.tip) }}</p>
                  <h3 class="mt-1 text-lg font-bold leading-snug text-white group-hover:text-emerald-100">
                    <a [routerLink]="['/brief', iz.datum, 'tool', $index]" class="after:absolute after:inset-0">{{ n.naziv }}</a>
                  </h3>
                  <div class="mt-3 flex flex-wrap gap-2 text-xs">
                    <span class="rounded-full bg-emerald-900/50 px-2.5 py-1 text-emerald-300">{{ cenaKratko(n.cena) }}</span>
                    @if (n.kakoProbati.length) {
                      <span class="rounded-full bg-slate-800 px-2.5 py-1 text-slate-300">{{ t('pocetna.koraka', { n: n.kakoProbati.length }) }}</span>
                    }
                  </div>
                </div>
              </li>
            }
          </ul>
        </section>
      }

      @if (iz.kratkeVesti?.length) {
        <section aria-labelledby="naslov-kratke" class="mt-12">
          <h2 id="naslov-kratke" class="text-xl font-bold text-white">{{ t('vesti.kratkeNaslov') }}</h2>
          <ul class="mt-4 grid gap-2 sm:grid-cols-2">
            @for (k of iz.kratkeVesti; track $index) {
              <li>
                <a [href]="k.url" target="_blank" rel="noopener" class="group flex h-full gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 px-4 py-3 hover:border-slate-600">
                  <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true"></span>
                  <span>
                    <span class="block text-sm leading-snug text-slate-200 group-hover:text-white">{{ k.naslov }}</span>
                    <span class="mt-1 block text-xs text-slate-500">{{ k.izvor }} ↗</span>
                  </span>
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
  /** Iz rute /izdanje/:datum. Na /danas je prazan, pa se prikazuje najnovije izdanje. */
  readonly datum = input<string>();

  private readonly podesavanja = inject(PodesavanjaService);
  protected readonly ceoUvod = signal(false);
  protected readonly ruta = izdanjeZaRutu(this.datum);
  protected readonly t = this.podesavanja.t;
  protected readonly tIli = this.podesavanja.tIli;
  protected readonly kljuc = SacuvanoService.kljuc;
  protected readonly slikaV = slikaVesti;
  protected readonly slikaN = slikaNovo;

  /** Vesti po važnosti (velike prve), sa rednim brojem iz izdanja za link i sliku. */
  protected readonly vesti = computed(() =>
    (this.ruta.izdanje()?.vesti ?? []).map((v, i) => ({ v, i })).sort((a, b) => b.v.vaznost - a.v.vaznost || a.i - b.i),
  );

  /** Tačka nedeljnog pregleda je „Naslov: objašnjenje“; na kartici ide samo naslov. */
  protected readonly naslovTacke = (t: string) => {
    const i = t.indexOf(': ');
    return i > 0 && i < 120 ? t.slice(0, i) : t;
  };

  /** Cena kao kratka oznaka: „Free“, „Paid“ ili prvih par reči. */
  protected readonly cenaKratko = (cena: string) => {
    const c = cena.toLowerCase();
    if (/^(free|besplatn)/.test(c)) return this.t('vesti.besplatno');
    return cena.length > 28 ? `${cena.slice(0, 26).replace(/\s+\S*$/, '')}…` : cena;
  };
}
