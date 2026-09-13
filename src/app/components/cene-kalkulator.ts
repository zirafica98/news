import { Component, WritableSignal, computed, inject, input, signal } from '@angular/core';
import { PROVAJDERI, PraceniModel, formatIznos } from '../cene.model';
import { Kljuc } from '../i18n';
import { PodesavanjaService } from '../podesavanja.service';

interface Primer {
  id: string;
  naziv: Kljuc;
  ulaz: number;
  izlaz: number;
}

const PRIMERI: Primer[] = [
  { id: 'chat', naziv: 'kalk.primer.chat', ulaz: 1_500, izlaz: 400 },
  { id: 'rezime', naziv: 'kalk.primer.rezime', ulaz: 20_000, izlaz: 1_000 },
  { id: 'pisanje', naziv: 'kalk.primer.pisanje', ulaz: 2_000, izlaz: 3_000 },
  { id: 'agent', naziv: 'kalk.primer.agent', ulaz: 150_000, izlaz: 15_000 },
];

const MAX_TOKENA = 10_000_000;
const MAX_ZAHTEVA = 100_000_000;

/** Koliko bi koštalo korišćenje svakog praćenog modela, za zadatu veličinu zahteva i broj zahteva mesečno. */
@Component({
  selector: 'app-cene-kalkulator',
  template: `
    <div class="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
      <p class="text-sm text-slate-400">{{ t('kalk.opis') }}</p>

      <div class="mt-3 flex flex-wrap gap-2" role="group" [attr.aria-label]="t('kalk.primeri')">
        @for (p of primeri; track p.id) {
          <button
            type="button"
            (click)="izaberi(p)"
            [attr.aria-pressed]="aktivniPrimer() === p.id"
            class="rounded-full border px-3 py-1.5 text-sm transition-colors"
            [class.border-amber-400]="aktivniPrimer() === p.id"
            [class.text-amber-300]="aktivniPrimer() === p.id"
            [class.border-slate-800]="aktivniPrimer() !== p.id"
            [class.text-slate-300]="aktivniPrimer() !== p.id"
          >
            {{ t(p.naziv) }}
          </button>
        }
      </div>

      <div class="mt-4 grid grid-cols-2 gap-3">
        <label class="block">
          <span class="text-xs font-medium text-slate-400">{{ t('kalk.ulaz') }}</span>
          <input
            type="number"
            inputmode="numeric"
            min="0"
            step="100"
            [value]="ulaz()"
            (input)="postavi(ulaz, $event, maxTokena)"
            class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 tabular-nums text-white focus:border-amber-400 focus:outline-none"
          />
          <span class="mt-1 block text-[11px] text-slate-500">≈ {{ reci(ulaz()) }}</span>
        </label>
        <label class="block">
          <span class="text-xs font-medium text-slate-400">{{ t('kalk.izlaz') }}</span>
          <input
            type="number"
            inputmode="numeric"
            min="0"
            step="100"
            [value]="izlaz()"
            (input)="postavi(izlaz, $event, maxTokena)"
            class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 tabular-nums text-white focus:border-amber-400 focus:outline-none"
          />
          <span class="mt-1 block text-[11px] text-slate-500">≈ {{ reci(izlaz()) }}</span>
        </label>
        <label class="col-span-2 block">
          <span class="text-xs font-medium text-slate-400">{{ t('kalk.zahtevi') }}</span>
          <input
            type="number"
            inputmode="numeric"
            min="0"
            step="100"
            [value]="zahtevi()"
            (input)="postavi(zahtevi, $event, maxZahteva)"
            class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 tabular-nums text-white focus:border-amber-400 focus:outline-none"
          />
        </label>
      </div>

      <div class="mt-5 flex items-baseline justify-between text-[11px] font-medium uppercase tracking-wider text-slate-500">
        <span>{{ t('kalk.model') }}</span>
        <span class="text-right"><span class="text-slate-400">{{ t('kalk.mesecno') }}</span> · {{ t('kalk.poZahtevu') }}</span>
      </div>
      <ol class="mt-2 space-y-2" aria-live="polite">
        @for (r of rezultati(); track r.id; let prvi = $first) {
          <li>
            <div class="flex items-end justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-white">{{ r.naziv }}</p>
                <p class="flex items-center gap-1.5 text-xs text-slate-500">
                  {{ provajder(r.provajder) }}
                  @if (prvi && rezultati().length > 1) {
                    <span class="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">{{ t('kalk.najjeftinije') }}</span>
                  }
                </p>
              </div>
              <p class="shrink-0 text-right tabular-nums leading-tight">
                <span class="block text-sm font-semibold text-slate-100">{{ novac(r.mesecno) }}</span>
                <span class="block text-[11px] text-slate-500">{{ novac(r.poZahtevu) }}</span>
              </p>
            </div>
            <div class="mt-1 h-1 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
              <div class="h-full rounded-full bg-amber-400/70" [style.width.%]="r.sirina"></div>
            </div>
          </li>
        }
      </ol>
      <p class="mt-4 text-xs leading-relaxed text-slate-500">{{ t('kalk.napomena') }}</p>
    </div>
  `,
})
export class CeneKalkulator {
  private readonly podesavanja = inject(PodesavanjaService);

  readonly modeli = input.required<PraceniModel[]>();

  protected readonly primeri = PRIMERI;
  protected readonly maxTokena = MAX_TOKENA;
  protected readonly maxZahteva = MAX_ZAHTEVA;

  protected readonly ulaz = signal(PRIMERI[0].ulaz);
  protected readonly izlaz = signal(PRIMERI[0].izlaz);
  protected readonly zahtevi = signal(1_000);

  protected readonly aktivniPrimer = computed(() => PRIMERI.find((p) => p.ulaz === this.ulaz() && p.izlaz === this.izlaz())?.id);

  protected readonly rezultati = computed(() => {
    const ulaz = this.ulaz();
    const izlaz = this.izlaz();
    const zahtevi = this.zahtevi();
    const redovi = this.modeli()
      .map((m) => {
        const poZahtevu = (ulaz * m.ulaz + izlaz * m.izlaz) / 1_000_000;
        return { id: m.id, naziv: m.naziv, provajder: m.provajder, poZahtevu, mesecno: poZahtevu * zahtevi };
      })
      .sort((a, b) => a.mesecno - b.mesecno || a.naziv.localeCompare(b.naziv));
    const najskuplji = redovi.at(-1)?.mesecno ?? 0;
    return redovi.map((r) => ({ ...r, sirina: najskuplji > 0 ? Math.max(2, (r.mesecno / najskuplji) * 100) : 0 }));
  });

  protected readonly t = this.podesavanja.t;
  protected readonly provajder = (id: string) => PROVAJDERI[id] ?? id;

  protected izaberi(p: Primer): void {
    this.ulaz.set(p.ulaz);
    this.izlaz.set(p.izlaz);
  }

  protected postavi(polje: WritableSignal<number>, event: Event, max: number): void {
    const vrednost = Math.floor(Number((event.target as HTMLInputElement).value));
    polje.set(Number.isFinite(vrednost) ? Math.min(Math.max(vrednost, 0), max) : 0);
  }

  /** Engleski: ~0,75 reči po tokenu. Na srpskom je reči nešto manje, piše u objašnjenju. */
  protected reci(tokena: number): string {
    const broj = Math.round((tokena * 0.75) / 10) * 10;
    return this.t('kalk.reci', { broj: broj.toLocaleString(this.podesavanja.lokal()) });
  }

  protected novac(iznos: number): string {
    return formatIznos(iznos, this.podesavanja.lokal());
  }
}
