import { DOCUMENT } from '@angular/common';
import { Component, computed, effect, inject, input, numberAttribute } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { OcenaDugmad } from '../components/ocena-dugmad';
import { SlikaKartice, slikaNovo, slikaVesti } from '../components/slika-kartice';
import { formatDatum } from '../izdanje.model';
import { izdanjeZaRutu } from '../izdanje-ruta';
import { PodesavanjaService } from '../podesavanja.service';
import { SacuvajDugme } from '../sacuvaj-dugme';
import { SacuvanoService } from '../sacuvano.service';

/**
 * Jedna vest (/izdanje/:datum/vest/:broj) ili jedna stavka „Novo izašlo“ (/izdanje/:datum/novo/:broj):
 * velika slika, ceo tekst, izvori i ostatak izdanja. Posebna adresa da bi se vest delila i da je Google nađe.
 */
@Component({
  selector: 'app-vest-page',
  imports: [RouterLink, SlikaKartice, SacuvajDugme, OcenaDugmad],
  template: `
    @if (ruta.izdanje(); as iz) {
      <nav class="pt-5">
        <a [routerLink]="['/brief', iz.datum]" class="text-sm text-slate-400 hover:text-white">← {{ t('vest.nazad') }} · <span class="first-letter:uppercase">{{ datumNaslov(iz.datum) }}</span></a>
      </nav>

      <article class="mx-auto mt-5 max-w-3xl">
        @if (vest(); as v) {
          <app-slika-kartice class="rounded-2xl border border-slate-800" [src]="slikaV(iz.datum, broj())" [alt]="v.naslov" [hitno]="true" />
          <div class="mt-6 flex items-start justify-between gap-3">
            <p class="text-xs font-semibold uppercase tracking-widest text-amber-400">{{ tIli('kategorija.' + v.kategorija, v.kategorija) }}</p>
            <div class="-mr-2 -mt-2 flex items-center">
              <app-ocena-dugmad [kljuc]="kljuc(iz.datum, 'vest', broj())" [datum]="iz.datum" tip="vest" [naslov]="v.naslov" />
              <app-sacuvaj-dugme [stavka]="{ kljuc: kljuc(iz.datum, 'vest', broj()), tip: 'vest', datum: iz.datum, naslov: v.naslov, opis: v.staSeDesilo, url: v.izvori[0]?.url ?? null }" />
            </div>
          </div>
          <h1 class="mt-2 text-3xl font-extrabold leading-tight text-white lg:text-4xl">{{ v.naslov }}</h1>
          <p class="mt-5 text-lg leading-relaxed text-slate-200">{{ v.staSeDesilo }}</p>
          <div class="mt-6 rounded-2xl border border-amber-900/40 bg-amber-950/20 p-5">
            <p class="text-xs font-semibold uppercase tracking-widest text-amber-300">{{ t('vesti.zastoJeBitno') }}</p>
            <p class="mt-2 leading-relaxed text-slate-200">{{ v.zastoJeBitno }}</p>
          </div>
          @if (v.izvori.length) {
            <p class="mt-6 text-xs font-semibold uppercase tracking-widest text-slate-500">{{ t('vest.izvori') }}</p>
            <ul class="mt-2 flex flex-wrap gap-2">
              @for (izvor of v.izvori; track izvor.url) {
                <li><a [href]="izvor.url" target="_blank" rel="noopener" class="inline-block rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500 hover:text-white">{{ izvor.naziv }} ↗</a></li>
              }
            </ul>
          }
        } @else if (novo(); as n) {
          <app-slika-kartice class="rounded-2xl border border-emerald-900/60" [src]="slikaN(iz.datum, broj())" [alt]="n.naziv" [hitno]="true" />
          <div class="mt-6 flex items-start justify-between gap-3">
            <p class="text-xs font-semibold uppercase tracking-widest text-emerald-400">{{ tIli('tip.' + n.tip, n.tip) }}</p>
            <app-sacuvaj-dugme class="-mr-2 -mt-2" [stavka]="{ kljuc: kljuc(iz.datum, 'novo', broj()), tip: 'novo', datum: iz.datum, naslov: n.naziv, opis: n.opis, url: n.link }" />
          </div>
          <h1 class="mt-2 text-3xl font-extrabold leading-tight text-white lg:text-4xl">{{ n.naziv }}</h1>
          <p class="mt-5 text-lg leading-relaxed text-slate-200">{{ n.opis }}</p>
          <p class="mt-4 text-slate-400"><span class="text-slate-500">{{ t('vesti.cena') }}</span> {{ n.cena }}</p>
          <ol class="mt-6 space-y-3 rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-5">
            @for (korak of n.kakoProbati; track $index) {
              <li class="flex gap-3 leading-relaxed text-slate-200">
                <span class="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-900/60 text-sm font-semibold text-emerald-300">{{ $index + 1 }}</span>
                <span class="pt-0.5">{{ korak }}</span>
              </li>
            }
          </ol>
          <a [href]="n.link" target="_blank" rel="noopener" class="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-400">{{ t('vesti.otvori', { domen: domen(n.link) }) }} ↗</a>
        } @else {
          <p class="py-24 text-center text-slate-400">{{ t('stanje.nePostoji') }}</p>
        }
      </article>

      <!-- Ostatak izdanja -->
      <section aria-labelledby="vest-jos" class="mt-14">
        <h2 id="vest-jos" class="text-xs font-semibold uppercase tracking-widest text-slate-500">{{ t('vest.jos') }}</h2>
        <ul class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (s of ostale(); track s.link.join('/')) {
            <li>
              <a [routerLink]="s.link" class="group block overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 hover:border-slate-700">
                <app-slika-kartice [src]="s.slika" [alt]="s.naslov" />
                <p class="p-4 font-semibold leading-snug text-white line-clamp-3 group-hover:text-amber-100">{{ s.naslov }}</p>
              </a>
            </li>
          }
        </ul>
      </section>
    } @else {
      <p class="py-24 text-center text-slate-500">{{ t('stanje.ucitavam') }}</p>
    }
  `,
})
export class VestPage {
  readonly datum = input<string>();
  readonly broj = input(0, { transform: numberAttribute });
  /** 'vest' ili 'novo', iz data rute. */
  readonly vrsta = input<'vest' | 'novo'>('vest');

  private readonly podesavanja = inject(PodesavanjaService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  protected readonly t = this.podesavanja.t;
  protected readonly tIli = this.podesavanja.tIli;
  protected readonly ruta = izdanjeZaRutu(this.datum);
  protected readonly kljuc = SacuvanoService.kljuc;
  protected readonly slikaV = slikaVesti;
  protected readonly slikaN = slikaNovo;
  protected readonly datumNaslov = (d: string) => formatDatum(d, this.podesavanja.lokal());

  protected readonly vest = computed(() => (this.vrsta() === 'vest' ? this.ruta.izdanje()?.vesti[this.broj()] : undefined));
  protected readonly novo = computed(() => (this.vrsta() === 'novo' ? this.ruta.izdanje()?.novo[this.broj()] : undefined));

  /** Ostale vesti i novo iz istog izdanja (bez ove). */
  protected readonly ostale = computed(() => {
    const iz = this.ruta.izdanje();
    if (!iz) return [];
    const vesti = iz.vesti
      .map((v, i) => ({ v, i }))
      .filter(({ v, i }) => !(this.vrsta() === 'vest' && i === this.broj()) && (this.podesavanja.jezik() === 'sr' || !v.izSrbije))
      .map(({ v, i }) => ({ naslov: v.naslov, link: ['/brief', iz.datum, 'story', String(i)], slika: slikaVesti(iz.datum, i) }));
    const novo = iz.novo
      .map((n, i) => ({ n, i }))
      .filter(({ i }) => !(this.vrsta() === 'novo' && i === this.broj()))
      .map(({ n, i }) => ({ naslov: n.naziv, link: ['/brief', iz.datum, 'tool', String(i)], slika: slikaNovo(iz.datum, i) }));
    return [...vesti, ...novo].slice(0, 6);
  });

  constructor() {
    // Naslov taba, opis i slika za deljenje.
    effect(() => {
      const iz = this.ruta.izdanje();
      const v = this.vest();
      const n = this.novo();
      if (!iz || (!v && !n)) return;
      const naslov = v?.naslov ?? n!.naziv;
      const opis = (v?.staSeDesilo ?? n!.opis).slice(0, 200);
      // Za deljenje ide verzija sa naslovom (…-og.jpg).
      const slika = `${this.document.location.origin}${(v ? slikaVesti(iz.datum, this.broj()) : slikaNovo(iz.datum, this.broj())).replace(/\.jpg$/, '-og.jpg')}`;
      this.title.setTitle(`${naslov} · AI Morning Brief`);
      this.meta.updateTag({ name: 'description', content: opis });
      this.meta.updateTag({ property: 'og:title', content: naslov });
      this.meta.updateTag({ property: 'og:description', content: opis });
      this.meta.updateTag({ property: 'og:image', content: slika });
    });
  }

  protected readonly domen = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };
}
