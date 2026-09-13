import { Component, computed, inject } from '@angular/core';
import { PROVAJDERI, Promena, formatCena } from '../cene.model';
import { IzdanjaService } from '../izdanja.service';
import { formatDatum } from '../izdanje.model';

/** Mešovita cena: tipična aplikacija pošalje ~3 puta više tokena nego što dobije nazad. */
function mesovita(ulaz: number, izlaz: number): number {
  return (3 * ulaz + izlaz) / 4;
}

@Component({
  selector: 'app-cene-page',
  template: `
    <h1 class="pt-6 text-2xl font-semibold text-white">Cene tokena</h1>
    <p class="mt-1 text-sm leading-relaxed text-slate-500">
      U dolarima za 1 milion tokena (oko 750.000 reči). <span class="text-slate-400">Ulaz</span> je tekst koji šalješ modelu,
      <span class="text-slate-400">izlaz</span> je tekst koji model napiše.
    </p>

    @if (izdanja.cene.isLoading()) {
      <p class="py-24 text-center text-slate-500">Učitavam…</p>
    } @else if (!izdanja.cene.hasValue()) {
      <p class="py-24 text-center text-slate-400">Cene trenutno nisu dostupne.</p>
    } @else if (izdanja.cene.value(); as c) {
      @if (komentar(); as k) {
        <p class="mt-5 rounded-2xl border border-amber-900/40 bg-amber-950/20 p-4 text-sm leading-relaxed text-slate-200">
          <span class="font-medium text-amber-300">Ukratko:</span> {{ k }}
        </p>
      }

      <!-- Promene -->
      <section aria-labelledby="naslov-promene" class="mt-8">
        <h2 id="naslov-promene" class="text-xs font-semibold uppercase tracking-widest text-slate-500">Promene cena · 30 dana</h2>
        @if (!c.promene.length) {
          <p class="mt-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 text-sm leading-relaxed text-slate-400">
            Nijedan praćeni model nije promenio cenu od {{ kratak(c.pratimoOd) }}, kad je praćenje počelo. Svaka promena će se pojaviti ovde,
            a uz modele i koliko su pojeftinili ili poskupeli za 7 i 30 dana.
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
          <h2 [id]="'grupa-' + g.id" class="text-xs font-semibold uppercase tracking-widest text-slate-500">{{ g.naziv }}</h2>
          <p class="mt-1 text-sm text-slate-500">{{ g.opis }}</p>
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
                    <span class="block text-[11px] text-slate-600">ulaz / izlaz</span>
                  </p>
                </div>
                <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
                  <div class="h-full rounded-full bg-amber-400/70" [style.width.%]="sirina(m.ulaz, m.izlaz)"></div>
                </div>
                <p class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  @if (trend(m.promena7); as t) {
                    <span [class]="t.klasa">7 dana: {{ t.tekst }}</span>
                  }
                  @if (trend(m.promena30); as t) {
                    <span [class]="t.klasa">30 dana: {{ t.tekst }}</span>
                  }
                  @if (m.prethodnik; as p) {
                    <span [class]="poredjenje(p.ulaz, p.izlaz, m.ulaz, m.izlaz).klasa">
                      u odnosu na {{ p.naziv }}: {{ poredjenje(p.ulaz, p.izlaz, m.ulaz, m.izlaz).tekst }}
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
          <h2 id="naslov-novi" class="text-xs font-semibold uppercase tracking-widest text-slate-500">Novi modeli · 14 dana</h2>
          <ul class="mt-3 divide-y divide-slate-800/80 rounded-2xl border border-slate-800/80 bg-slate-900/60">
            @for (m of c.noviModeli; track m.id) {
              <li class="flex items-center justify-between gap-3 px-4 py-3">
                <div class="min-w-0">
                  <p class="truncate font-medium text-white">{{ m.naziv }}</p>
                  <p class="text-xs text-slate-500">{{ provajder(m.provajder) }} · od {{ kratak(m.objavljen) }}</p>
                </div>
                <p class="shrink-0 text-sm tabular-nums text-slate-300">{{ cena(m.ulaz) }} / {{ cena(m.izlaz) }}</p>
              </li>
            }
          </ul>
        </section>
      }

      <p class="mt-10 text-center text-xs leading-relaxed text-slate-600">
        Izvor: <a [href]="c.izvor.url" target="_blank" rel="noopener" class="underline hover:text-slate-400">{{ c.izvor.naziv }}</a>
        (najniža cena među provajderima, može biti niža od zvanične) · ažurirano {{ vreme(c.azurirano) }}
      </p>
    }
  `,
})
export class CenePage {
  protected readonly izdanja = inject(IzdanjaService);

  /** Komentar o cenama iz najnovijeg izdanja, ako ga ima. */
  protected readonly komentar = computed(() => {
    const d = this.izdanja.najnovije();
    const ref = d ? this.izdanja.izdanje(d) : undefined;
    return ref?.hasValue() ? ref.value()?.cene : undefined;
  });

  private readonly opseg = computed(() => {
    const c = this.izdanja.cene.value();
    const cene = c?.grupe.flatMap((g) => g.modeli.map((m) => mesovita(m.ulaz, m.izlaz))).filter((p) => p > 0) ?? [];
    return { min: Math.log(Math.min(...cene)), max: Math.log(Math.max(...cene)) };
  });

  protected readonly cena = formatCena;
  protected readonly provajder = (id: string) => PROVAJDERI[id] ?? id;
  protected readonly kratak = (d: string) => formatDatum(d, { day: 'numeric', month: 'long' });
  protected readonly vreme = (iso: string) =>
    new Intl.DateTimeFormat('sr-Latn-RS', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  /** Širina trake na logaritamskoj skali, da se i modeli od $0,10 i od $50 vide. */
  protected sirina(ulaz: number, izlaz: number): number {
    const { min, max } = this.opseg();
    if (max === min) return 100;
    return 8 + ((Math.log(mesovita(ulaz, izlaz)) - min) / (max - min)) * 92;
  }

  protected trend(p: Promena | null): { tekst: string; klasa: string } | null {
    if (!p) return null;
    const vrednost = Math.abs(p.ulaz ?? 0) >= Math.abs(p.izlaz ?? 0) ? (p.ulaz ?? 0) : (p.izlaz ?? 0);
    return this.opis(vrednost, 'pojeftinio', 'poskupeo', 'bez promene');
  }

  protected poredjenje(ulazPre: number, izlazPre: number, ulaz: number, izlaz: number): { tekst: string; klasa: string } {
    const pre = mesovita(ulazPre, izlazPre);
    const razlika = pre > 0 ? ((mesovita(ulaz, izlaz) - pre) / pre) * 100 : 0;
    return this.opis(razlika, 'jeftiniji', 'skuplji', 'ista cena');
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
