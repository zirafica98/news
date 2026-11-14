import { httpResource } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NewsletterPrijava } from '../components/newsletter-prijava';
import { SlikaKartice, slikaNovo, slikaVesti } from '../components/slika-kartice';
import { IzdanjaService } from '../izdanja.service';
import { formatDatum } from '../izdanje.model';
import { izdanjeZaRutu } from '../izdanje-ruta';
import { PodesavanjaService } from '../podesavanja.service';

interface Video {
  id: string;
  naslov: string;
  datum: string;
  url: string;
  short: boolean;
}

/**
 * Početna za nove posetioce: šta je AI Morning Brief, prijava na newsletter, današnje vesti sa slikama,
 * alat dana i najnoviji videi. Stalni čitaoci i instalirana aplikacija idu pravo na izdanje (app.routes.ts).
 */
@Component({
  selector: 'app-pocetna-page',
  imports: [RouterLink, NewsletterPrijava, SlikaKartice],
  template: `
    <!-- Hero -->
    <section class="relative grid items-center gap-8 pb-10 pt-10 lg:grid-cols-[1fr_auto] lg:gap-12 lg:pb-16 lg:pt-16">
      <div class="pointer-events-none absolute -right-24 -top-10 -z-10 size-[28rem] rounded-full bg-amber-500/10 blur-3xl" aria-hidden="true"></div>
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.3em] text-amber-400">AI Morning Brief</p>
        <h1 class="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
          {{ t('pocetna.naslov1') }}<br />
          <span class="bg-gradient-to-r from-amber-300 via-amber-400 to-violet-400 bg-clip-text text-transparent">{{ t('pocetna.naslov2') }}</span>
        </h1>
        <p class="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">{{ t('pocetna.opis') }}</p>
        <div class="mt-7 max-w-lg">
          <app-newsletter-prijava [hero]="true" />
        </div>
        @if (najnovije(); as d) {
          <a [routerLink]="['/izdanje', d]" class="mt-5 inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white">
            {{ t('pocetna.citaj') }} <span aria-hidden="true">→</span>
          </a>
        }
      </div>
      <img src="/byte/wave.svg" alt="Byte, the AI Morning Brief robot" width="400" height="470" class="mx-auto hidden w-56 drop-shadow-[0_20px_60px_rgba(251,191,36,0.15)] sm:block lg:w-72" />
    </section>

    <!-- Šta dobijaš -->
    <ul class="grid gap-3 border-y border-slate-800/80 py-6 sm:grid-cols-3">
      @for (f of funkcije; track f.naslov) {
        <li class="flex gap-3">
          <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-800/70 text-lg" aria-hidden="true">{{ f.ikona }}</span>
          <div>
            <p class="font-semibold text-white">{{ t(f.naslov) }}</p>
            <p class="text-sm leading-relaxed text-slate-400">{{ t(f.opis) }}</p>
          </div>
        </li>
      }
    </ul>

    <!-- Današnje izdanje -->
    @if (ruta.izdanje(); as iz) {
      <section aria-labelledby="pocetna-danas" class="mt-12">
        <div class="flex items-end justify-between gap-4">
          <div>
            <h2 id="pocetna-danas" class="text-2xl font-bold text-white">{{ t('pocetna.danas') }}</h2>
            <p class="mt-1 text-sm text-slate-400 first-letter:uppercase">{{ datumNaslov(iz.datum) }}</p>
          </div>
          <a [routerLink]="['/izdanje', iz.datum]" class="shrink-0 text-sm font-medium text-amber-400 hover:text-amber-300">{{ t('pocetna.sveVesti') }} →</a>
        </div>

        <div class="mt-6 grid gap-5 lg:grid-cols-2">
          @if (vesti()[0]; as glavna) {
            <a [routerLink]="['/izdanje', iz.datum, 'vest', glavna.i]" class="group block overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 hover:border-slate-700 lg:row-span-2">
              <app-slika-kartice [src]="slika(iz.datum, glavna.i)" [alt]="glavna.v.naslov" [hitno]="true" />
              <div class="p-5 lg:p-6">
                <p class="text-xs font-semibold uppercase tracking-widest text-amber-400">{{ tIli('kategorija.' + glavna.v.kategorija, glavna.v.kategorija) }}</p>
                <h3 class="mt-2 text-2xl font-bold leading-snug text-white group-hover:text-amber-100 lg:text-3xl">{{ glavna.v.naslov }}</h3>
                <p class="mt-3 line-clamp-2 leading-relaxed text-slate-400">{{ glavna.v.zastoJeBitno }}</p>
              </div>
            </a>
          }
          <div class="grid gap-5 sm:grid-cols-2">
            @for (s of vesti().slice(1, 5); track s.i) {
              <a [routerLink]="['/izdanje', iz.datum, 'vest', s.i]" class="group block overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 hover:border-slate-700">
                <app-slika-kartice [src]="slika(iz.datum, s.i)" [alt]="s.v.naslov" />
                <div class="p-4">
                  <p class="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{{ tIli('kategorija.' + s.v.kategorija, s.v.kategorija) }}</p>
                  <h3 class="mt-1 line-clamp-3 font-semibold leading-snug text-white group-hover:text-amber-100">{{ s.v.naslov }}</h3>
                </div>
              </a>
            }
          </div>
        </div>
      </section>

      <!-- Alat dana -->
      @if (alat(); as a) {
        <section aria-labelledby="pocetna-alat" class="mt-12">
          <a [routerLink]="['/izdanje', iz.datum, 'novo', a.i]" class="group grid overflow-hidden rounded-2xl border border-emerald-900/60 bg-emerald-950/20 hover:border-emerald-700/70 md:grid-cols-2">
            <app-slika-kartice [src]="slikaAlata(iz.datum, a.i)" [alt]="a.n.naziv" />
            <div class="flex flex-col justify-center p-5 lg:p-8">
              <h2 id="pocetna-alat" class="text-xs font-bold uppercase tracking-widest text-emerald-400">🛠 {{ t('pocetna.alatDana') }}</h2>
              <p class="mt-2 text-2xl font-bold text-white group-hover:text-emerald-100">{{ a.n.naziv }}</p>
              <p class="mt-2 line-clamp-2 leading-relaxed text-slate-300">{{ a.n.opis }}</p>
              <p class="mt-4 text-sm font-medium text-emerald-400">{{ t('pocetna.koraka', { n: a.n.kakoProbati.length }) }} →</p>
            </div>
          </a>
        </section>
      }
    }

    <!-- Videi -->
    @if (videi().length) {
      <section aria-labelledby="pocetna-videi" class="mt-14">
        <div class="flex items-end justify-between gap-4">
          <div>
            <h2 id="pocetna-videi" class="text-2xl font-bold text-white">{{ t('pocetna.videi') }}</h2>
            <p class="mt-1 text-sm text-slate-400">{{ t('pocetna.videiOpis') }}</p>
          </div>
          <a href="https://www.youtube.com/@ai-morning-brief" target="_blank" rel="noopener" class="hidden shrink-0 text-sm font-medium text-amber-400 hover:text-amber-300 sm:block">{{ t('pocetna.sviVidei') }} ↗</a>
        </div>
        <ul class="-mx-4 mt-6 flex snap-x gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-0">
          @for (v of videi(); track v.id) {
            <li class="w-40 shrink-0 snap-start lg:w-auto">
              <a [href]="v.url" target="_blank" rel="noopener" class="group block">
                <div class="relative aspect-[9/16] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                  <img [src]="'https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg'" [alt]="v.naslov" loading="lazy" class="size-full scale-[1.35] object-cover transition-transform duration-500 group-hover:scale-[1.42]" />
                  <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10 text-xs font-medium leading-snug text-white line-clamp-4">{{ v.naslov }}</span>
                </div>
              </a>
            </li>
          }
        </ul>
      </section>
    }

    <!-- Mreže -->
    <section class="mt-14 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 text-center lg:p-8">
      <p class="text-sm text-slate-400">{{ t('pocetna.mreze') }}</p>
      <div class="mt-3 flex flex-wrap justify-center gap-2 text-sm font-medium">
        @for (m of mreze; track m.naziv) {
          <a [href]="m.url" target="_blank" rel="noopener" class="rounded-full border border-slate-700 px-4 py-2 text-slate-200 hover:border-amber-400 hover:text-white">{{ m.naziv }}</a>
        }
      </div>
    </section>

    <app-newsletter-prijava />
  `,
})
export class PocetnaPage {
  private readonly izdanja = inject(IzdanjaService);
  private readonly podesavanja = inject(PodesavanjaService);
  protected readonly t = this.podesavanja.t;
  protected readonly tIli = this.podesavanja.tIli;

  protected readonly ruta = izdanjeZaRutu(computed(() => undefined));
  protected readonly najnovije = this.izdanja.najnovije;
  protected readonly slika = slikaVesti;
  protected readonly slikaAlata = slikaNovo;
  protected readonly datumNaslov = (d: string) => formatDatum(d, this.podesavanja.lokal());

  /** Vesti po važnosti, sa rednim brojem iz izdanja (za link i sliku). Domaće vesti samo na srpskom. */
  protected readonly vesti = computed(() =>
    (this.ruta.izdanje()?.vesti ?? [])
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => this.podesavanja.jezik() === 'sr' || !v.izSrbije)
      .sort((a, b) => b.v.vaznost - a.v.vaznost || a.i - b.i),
  );

  /** Alat dana: prvi alat ili projekat sa koracima, kao u Tool of the Day videu. */
  protected readonly alat = computed(() => {
    const novo = (this.ruta.izdanje()?.novo ?? []).map((n, i) => ({ n, i })).filter(({ n }) => n.kakoProbati?.length);
    return novo.find(({ n }) => n.tip === 'alat' || n.tip === 'projekat') ?? novo[0];
  });

  private readonly videiResurs = httpResource<Video[]>(() => 'data/videi.json', { defaultValue: [] });
  protected readonly videi = computed(() => (this.videiResurs.hasValue() ? this.videiResurs.value().slice(0, 6) : []));

  protected readonly funkcije = [
    { ikona: '📰', naslov: 'pocetna.f1' as const, opis: 'pocetna.f1opis' as const },
    { ikona: '🛠', naslov: 'pocetna.f2' as const, opis: 'pocetna.f2opis' as const },
    { ikona: '💸', naslov: 'pocetna.f3' as const, opis: 'pocetna.f3opis' as const },
  ];

  protected readonly mreze = [
    { naziv: 'YouTube', url: 'https://www.youtube.com/@ai-morning-brief' },
    { naziv: 'Instagram', url: 'https://www.instagram.com/ai.morning.brief/' },
    { naziv: 'Threads', url: 'https://www.threads.net/@ai.morning.brief' },
    { naziv: 'Telegram', url: 'https://t.me/aimorningbrief' },
  ];
}
