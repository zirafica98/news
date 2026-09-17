import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IzdanjaService } from '../izdanja.service';
import { IndexStavka, formatDatum } from '../izdanje.model';
import { Sekcija, putanjaSekcije } from '../izdanje-ruta';
import { PodesavanjaService } from '../podesavanja.service';

type TipStavke = 'vest' | 'kratka' | 'novo' | 'istrazivanje' | 'ideja' | 'tema';

interface DanPretrage {
  datum: string;
  stavke: { tip: TipStavke; naslov: string; tekst?: string; url?: string }[];
}

const SEKCIJA: Record<TipStavke, Sekcija> = {
  vest: 'vesti',
  kratka: 'vesti',
  novo: 'vesti',
  istrazivanje: 'istrazivanje',
  ideja: 'ideje',
  tema: 'mreze',
};

/** „Đ“ i „dj“, velika i mala slova: sve isto za pretragu. */
function zaPoredjenje(tekst: string): string {
  return tekst
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

@Component({
  selector: 'app-arhiva-page',
  imports: [RouterLink],
  template: `
    <h1 class="pt-8 text-2xl font-semibold text-white">{{ t('nav.arhiva') }}</h1>

    <label class="mt-4 block">
      <span class="sr-only">{{ t('arhiva.pretraga') }}</span>
      <input
        type="search"
        [value]="upit()"
        (input)="upit.set($any($event.target).value)"
        [placeholder]="t('arhiva.pretraga')"
        class="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
      />
    </label>

    @if (upit().trim().length >= 2) {
      @if (pretraga.isLoading()) {
        <p class="py-10 text-center text-slate-500">{{ t('stanje.ucitavam') }}</p>
      } @else if (!rezultati().length) {
        <p class="py-10 text-center text-slate-400">{{ t('arhiva.nemaRezultata', { upit: upit().trim() }) }}</p>
      } @else {
        <p class="mt-3 text-xs text-slate-500">{{ t('arhiva.rezultata', { n: rezultati().length }) }}</p>
        <ul class="mt-3 space-y-2">
          @for (r of rezultati(); track r.kljuc) {
            <li>
              <a [routerLink]="putanja(r.tip, r.datum)" class="block rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 transition-colors hover:border-slate-600">
                <p class="text-xs text-slate-500">{{ tIli('pretraga.tip.' + r.tip, r.tip) }} · {{ kratakDatum(r.datum) }}</p>
                <p class="mt-0.5 font-medium leading-snug text-white">{{ r.naslov }}</p>
                @if (r.tekst) {
                  <p class="mt-1 text-sm leading-relaxed text-slate-400">{{ r.tekst }}</p>
                }
              </a>
            </li>
          }
        </ul>
      }
    } @else if (izdanja.index.isLoading()) {
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
  protected readonly tIli = this.podesavanja.tIli;
  protected readonly datum = (d: string) => formatDatum(d, this.podesavanja.lokal());
  protected readonly kratakDatum = (d: string) => formatDatum(d, this.podesavanja.lokal(), { day: 'numeric', month: 'long', year: 'numeric' });
  protected readonly putanja = (tip: TipStavke, datum: string) => putanjaSekcije(SEKCIJA[tip] ?? 'vesti', datum);

  protected readonly upit = signal('');

  /** Spisak svega objavljenog; učitava se tek kad se krene sa kucanjem. */
  protected readonly pretraga = httpResource<DanPretrage[]>(() => (this.upit().trim().length >= 2 ? 'data/pretraga.json' : undefined), {
    defaultValue: [],
  });

  protected readonly rezultati = computed(() => {
    const reci = zaPoredjenje(this.upit().trim()).split(/\s+/).filter(Boolean);
    if (!reci.length) return [];
    return this.pretraga
      .value()
      .flatMap((dan) =>
        dan.stavke.map((s, i) => ({ ...s, datum: dan.datum, kljuc: `${dan.datum}-${i}`, trazi: zaPoredjenje(`${s.naslov} ${s.tekst ?? ''}`) })),
      )
      .filter((s) => reci.every((r) => s.trazi.includes(r)))
      .slice(0, 60);
  });

  private readonly engleskiNaslovi = computed(() => new Map(this.izdanja.indexEn.value().map((e) => [e.datum, e.naslovi])));
  /** Na engleskom naslovi iz prevoda, a srpski ako prevoda za taj dan nema. */
  protected readonly naslovi = (e: IndexStavka) =>
    (this.podesavanja.jezik() === 'en' ? this.engleskiNaslovi().get(e.datum) : undefined) ?? e.naslovi;
}
