import { Component, computed, inject, signal } from '@angular/core';
import { CenaKriva } from '../components/cena-kriva';
import { CeneKalkulator } from '../components/cene-kalkulator';
import { PROVAJDERI, Promena, formatCena, formatIznos } from '../cene.model';
import { IzdanjaService } from '../izdanja.service';
import { PodesavanjaService } from '../podesavanja.service';
import { formatDatum } from '../izdanje.model';

const OBJASNJENJE_KEY = 'ai-jutro:cene-objasnjenje';

/** Objašnjenje je otvoreno dok ga korisnik jednom ne zatvori. */
function procitajObjasnjenje(): boolean {
  try {
    return localStorage.getItem(OBJASNJENJE_KEY) !== '0';
  } catch {
    return true;
  }
}

/** Mešovita cena: tipična aplikacija pošalje ~3 puta više tokena nego što dobije nazad. */
function mesovita(ulaz: number, izlaz: number): number {
  return (3 * ulaz + izlaz) / 4;
}

@Component({
  selector: 'app-cene-page',
  imports: [CeneKalkulator, CenaKriva],
  template: `
    <h1 class="pt-6 text-2xl font-semibold text-white">{{ t('naslov.cene') }}</h1>
    <p class="mt-1 text-sm leading-relaxed text-slate-500">{{ t('cene.podnaslov') }}</p>

    <details
      class="group mt-5 rounded-2xl border border-sky-900/50 bg-sky-950/20"
      [open]="objasnjenjeOtvoreno()"
      (toggle)="zapamtiObjasnjenje($event)"
    >
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium text-sky-300">
        {{ t('cene.obj.naslov') }}
        <span class="text-slate-500 transition-transform group-open:rotate-90" aria-hidden="true">›</span>
      </summary>
      <div class="px-4 pb-4">
        <div class="flex items-stretch gap-1.5 text-center text-xs" aria-hidden="true">
          <div class="flex-1 rounded-xl bg-slate-800/60 px-2 py-2">
            <p class="text-base">📝</p>
            <p class="mt-0.5 text-slate-300">{{ t('cene.obj.tokUlaz') }}</p>
            <p class="font-semibold text-sky-300">{{ t('cene.obj.ulaz') }}</p>
          </div>
          <span class="self-center text-slate-500">→</span>
          <div class="flex-1 rounded-xl bg-slate-800/60 px-2 py-2">
            <p class="text-base">🤖</p>
            <p class="mt-0.5 text-slate-300">{{ t('cene.obj.tokModel') }}</p>
          </div>
          <span class="self-center text-slate-500">→</span>
          <div class="flex-1 rounded-xl bg-slate-800/60 px-2 py-2">
            <p class="text-base">💬</p>
            <p class="mt-0.5 text-slate-300">{{ t('cene.obj.tokIzlaz') }}</p>
            <p class="font-semibold text-amber-300">{{ t('cene.obj.izlaz') }}</p>
          </div>
        </div>
        <dl class="mt-4 space-y-3 text-sm leading-relaxed">
          <div><dt class="font-semibold text-white">{{ t('cene.obj.token') }}</dt><dd class="text-slate-300">{{ t('cene.obj.tokenOpis') }}</dd></div>
          <div><dt class="font-semibold text-sky-300">{{ t('cene.obj.ulaz') }}</dt><dd class="text-slate-300">{{ t('cene.obj.ulazOpis') }}</dd></div>
          <div><dt class="font-semibold text-amber-300">{{ t('cene.obj.izlaz') }}</dt><dd class="text-slate-300">{{ t('cene.obj.izlazOpis') }}</dd></div>
          <div><dt class="font-semibold text-white">{{ t('cene.obj.cena') }}</dt><dd class="text-slate-300">{{ t('cene.obj.cenaOpis') }}</dd></div>
        </dl>
        @if (primer(); as p) {
          <p class="mt-4 rounded-xl bg-slate-800/50 px-4 py-3 text-sm leading-relaxed text-slate-200">{{ p }}</p>
        }
      </div>
    </details>

    @if (izdanja.cene.isLoading()) {
      <p class="py-24 text-center text-slate-500">{{ t('stanje.ucitavam') }}</p>
    } @else if (!izdanja.cene.hasValue()) {
      <p class="py-24 text-center text-slate-400">{{ t('cene.nedostupne') }}</p>
    } @else if (izdanja.cene.value(); as c) {
      @if (komentar(); as k) {
        <p class="mt-5 rounded-2xl border border-amber-900/40 bg-amber-950/20 p-4 text-sm leading-relaxed text-slate-200">
          <span class="font-medium text-amber-300">{{ t('cene.ukratko') }}</span> {{ k }}
        </p>
      }

      <!-- Kalkulator -->
      <section aria-labelledby="naslov-kalkulator" class="mt-8">
        <h2 id="naslov-kalkulator" class="text-xs font-semibold uppercase tracking-widest text-slate-500">{{ t('kalk.naslov') }}</h2>
        <app-cene-kalkulator class="mt-3 block" [modeli]="sviModeli()" />
      </section>

      <!-- Promene -->
      <section aria-labelledby="naslov-promene" class="mt-8">
        <h2 id="naslov-promene" class="text-xs font-semibold uppercase tracking-widest text-slate-500">{{ t('cene.promene') }}</h2>
        @if (!c.promene.length) {
          <p class="mt-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 text-sm leading-relaxed text-slate-400">
            {{ t('cene.bezPromena', { datum: kratak(c.pratimoOd) }) }}
          </p>
        } @else {
          <ul class="mt-3 divide-y divide-slate-800/80 rounded-2xl border border-slate-800/80 bg-slate-900/60">
            @for (p of c.promene; track p.id + p.datum) {
              <li class="flex items-center justify-between gap-3 px-4 py-3">
                <div class="min-w-0">
                  <p class="truncate font-medium text-white">{{ p.naziv }}</p>
                  <p class="text-xs text-slate-500">{{ provajder(p.provajder) }} · {{ kratak(p.datum) }}</p>
                </div>
                <div class="shrink-0 text-right text-sm">
                  <p [class]="boja(p.izlazPre, p.izlaz)">{{ cena(p.ulaz) }} / {{ cena(p.izlaz) }}</p>
                  <p class="text-xs text-slate-500 line-through">{{ cena(p.ulazPre) }} / {{ cena(p.izlazPre) }}</p>
                </div>
              </li>
            }
          </ul>
        }
      </section>

      <!-- Grupe modela -->
      @for (g of c.grupe; track g.id) {
        <section [attr.aria-labelledby]="'grupa-' + g.id" class="mt-10">
          <h2 [id]="'grupa-' + g.id" class="text-xs font-semibold uppercase tracking-widest text-slate-500">{{ tIli('cene.grupa.' + g.id, g.naziv) }}</h2>
          <p class="mt-1 text-sm text-slate-500">{{ tIli('cene.grupa.' + g.id + '.opis', g.opis) }}</p>
          <ul class="mt-3 space-y-2">
            @for (m of g.modeli; track m.id) {
              <li class="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate font-medium text-white">{{ m.naziv }}</p>
                    <p class="text-xs text-slate-500">{{ provajder(m.provajder) }}</p>
                  </div>
                  <p class="shrink-0 text-right tabular-nums">
                    <span class="text-slate-200">{{ cena(m.ulaz) }}</span>
                    <span class="text-slate-600"> / </span>
                    <span class="text-slate-200">{{ cena(m.izlaz) }}</span>
                    <span class="block text-[11px] text-slate-600">{{ t('cene.ulazIzlazOznaka') }}</span>
                  </p>
                </div>
                <div class="mt-2 flex items-center gap-3">
                  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
                    <div class="h-full rounded-full bg-amber-400/70" [style.width.%]="sirina(m.ulaz, m.izlaz)"></div>
                  </div>
                  @if (istorija(m.id); as tacke) {
                    <app-cena-kriva class="shrink-0 text-amber-400/80" [tacke]="tacke" />
                  }
                </div>
                <p class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  @if (trend(m.promena7); as tr) {
                    <span [class]="tr.klasa">{{ t('cene.7dana') }}: {{ tr.tekst }}</span>
                  }
                  @if (trend(m.promena30); as tr) {
                    <span [class]="tr.klasa">{{ t('cene.30dana') }}: {{ tr.tekst }}</span>
                  }
                  @if (m.prethodnik; as p) {
                    <span [class]="poredjenje(p.ulaz, p.izlaz, m.ulaz, m.izlaz).klasa">
                      {{ t('cene.uOdnosuNa', { naziv: p.naziv }) }}: {{ poredjenje(p.ulaz, p.izlaz, m.ulaz, m.izlaz).tekst }}
                    </span>
                  }
                </p>
              </li>
            }
          </ul>
        </section>
      }

      <!-- Novi modeli -->
      @if (c.noviModeli.length) {
        <section aria-labelledby="naslov-novi" class="mt-10">
          <h2 id="naslov-novi" class="text-xs font-semibold uppercase tracking-widest text-slate-500">{{ t('cene.noviModeli') }}</h2>
          <ul class="mt-3 divide-y divide-slate-800/80 rounded-2xl border border-slate-800/80 bg-slate-900/60">
            @for (m of c.noviModeli; track m.id) {
              <li class="flex items-center justify-between gap-3 px-4 py-3">
                <div class="min-w-0">
                  <p class="truncate font-medium text-white">{{ m.naziv }}</p>
                  <p class="text-xs text-slate-500">{{ provajder(m.provajder) }} · {{ t('cene.od', { datum: kratak(m.objavljen) }) }}</p>
                </div>
                <p class="shrink-0 text-sm tabular-nums text-slate-300">{{ cena(m.ulaz) }} / {{ cena(m.izlaz) }}</p>
              </li>
            }
          </ul>
        </section>
      }

      <p class="mt-10 text-center text-xs leading-relaxed text-slate-600">
        {{ t('cene.izvor') }} <a [href]="c.izvor.url" target="_blank" rel="noopener" class="underline hover:text-slate-400">{{ c.izvor.naziv }}</a>
        {{ t('cene.izvorNapomena', { vreme: vreme(c.azurirano) }) }}<br />
        {{ t('cene.kriva', { datum: kratak(c.pratimoOd) }) }}
      </p>
    }
  `,
})
export class CenePage {
  protected readonly izdanja = inject(IzdanjaService);
  private readonly podesavanja = inject(PodesavanjaService);
  protected readonly t = this.podesavanja.t;
  protected readonly tIli = this.podesavanja.tIli;

  /** Komentar o cenama iz najnovijeg izdanja (na izabranom jeziku), ako ga ima. */
  protected readonly komentar = computed(() => {
    const d = this.izdanja.najnovije();
    const ref = d ? this.izdanja.izdanjeNaJeziku(d).ref : undefined;
    return ref?.hasValue() ? ref.value()?.cene : undefined;
  });

  /** Krivulja se crta tek kad model ima bar dve zabeležene cene. */
  protected readonly istorija = (id: string) => {
    const tacke = this.izdanja.ceneIstorija.value()[id];
    return tacke && tacke.length > 1 ? tacke : null;
  };

  protected readonly sviModeli = computed(() => this.izdanja.cene.value()?.grupe.flatMap((g) => g.modeli) ?? []);

  protected readonly objasnjenjeOtvoreno = signal(procitajObjasnjenje());

  /** Primer računa sa pravim, današnjim cenama (Claude Opus 5, ili prvi praćeni model ako njega nema). */
  protected readonly primer = computed(() => {
    const modeli = this.sviModeli();
    const m = modeli.find((x) => x.id === 'anthropic/claude-opus-5') ?? modeli[0];
    if (!m) return null;
    const ulazIznos = (2_000 * m.ulaz) / 1_000_000;
    const izlazIznos = (500 * m.izlaz) / 1_000_000;
    const ukupno = ulazIznos + izlazIznos;
    const lokal = this.podesavanja.lokal();
    const iznos = (n: number) => formatIznos(n, lokal);
    return this.t('cene.obj.primer', {
      model: m.naziv,
      ulazCena: this.cena(m.ulaz),
      izlazCena: this.cena(m.izlaz),
      ulazIznos: iznos(ulazIznos),
      izlazIznos: iznos(izlazIznos),
      ukupno: iznos(ukupno),
      hiljadu: iznos(ukupno * 1_000),
    });
  });

  protected zapamtiObjasnjenje(event: Event): void {
    const otvoreno = (event.target as HTMLDetailsElement).open;
    this.objasnjenjeOtvoreno.set(otvoreno);
    try {
      localStorage.setItem(OBJASNJENJE_KEY, otvoreno ? '1' : '0');
    } catch {
      // Privatni režim: pamti se dok je stranica otvorena.
    }
  }

  private readonly opseg = computed(() => {
    const c = this.izdanja.cene.value();
    const cene = c?.grupe.flatMap((g) => g.modeli.map((m) => mesovita(m.ulaz, m.izlaz))).filter((p) => p > 0) ?? [];
    return { min: Math.log(Math.min(...cene)), max: Math.log(Math.max(...cene)) };
  });

  protected readonly cena = (n: number) => formatCena(n, this.podesavanja.lokal());
  protected readonly provajder = (id: string) => PROVAJDERI[id] ?? id;
  protected readonly kratak = (d: string) => formatDatum(d, this.podesavanja.lokal(), { day: 'numeric', month: 'long' });
  protected readonly vreme = (iso: string) =>
    new Intl.DateTimeFormat(this.podesavanja.lokal(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  /** Širina trake na logaritamskoj skali, da se i modeli od $0,10 i od $50 vide. */
  protected sirina(ulaz: number, izlaz: number): number {
    const { min, max } = this.opseg();
    if (max === min) return 100;
    return 8 + ((Math.log(mesovita(ulaz, izlaz)) - min) / (max - min)) * 92;
  }

  protected trend(p: Promena | null): { tekst: string; klasa: string } | null {
    if (!p) return null;
    const vrednost = Math.abs(p.ulaz ?? 0) >= Math.abs(p.izlaz ?? 0) ? (p.ulaz ?? 0) : (p.izlaz ?? 0);
    return this.opis(vrednost, this.t('cene.pojeftinio'), this.t('cene.poskupeo'), this.t('cene.bezPromene'));
  }

  protected poredjenje(ulazPre: number, izlazPre: number, ulaz: number, izlaz: number): { tekst: string; klasa: string } {
    const pre = mesovita(ulazPre, izlazPre);
    const razlika = pre > 0 ? ((mesovita(ulaz, izlaz) - pre) / pre) * 100 : 0;
    return this.opis(razlika, this.t('cene.jeftiniji'), this.t('cene.skuplji'), this.t('cene.istaCena'));
  }

  protected boja(pre: number, sad: number): string {
    return sad < pre ? 'text-emerald-400' : sad > pre ? 'text-rose-400' : 'text-slate-300';
  }

  private opis(procenat: number, manje: string, vise: string, isto: string): { tekst: string; klasa: string } {
    const zaokruzeno = Math.round(Math.abs(procenat));
    if (zaokruzeno === 0) return { tekst: isto, klasa: 'text-slate-500' };
    return procenat < 0
      ? { tekst: `↓ ${zaokruzeno}% ${manje}`, klasa: 'text-emerald-400' }
      : { tekst: `↑ ${zaokruzeno}% ${vise}`, klasa: 'text-rose-400' };
  }
}
