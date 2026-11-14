import { Component, inject, input, signal } from '@angular/core';
import { DatumTraka } from '../components/datum-traka';
import { SekcijaBaner } from '../components/sekcija-baner';
import { Platforma, Tema } from '../izdanje.model';
import { izdanjeZaRutu } from '../izdanje-ruta';
import { PodesavanjaService } from '../podesavanja.service';
import { SacuvajDugme } from '../sacuvaj-dugme';
import { SacuvanoService } from '../sacuvano.service';

const PLATFORME: Record<Platforma, { naziv: string; klasa: string }> = {
  x: { naziv: '𝕏', klasa: 'bg-slate-800 text-slate-100' },
  bluesky: { naziv: 'Bluesky', klasa: 'bg-sky-400/15 text-sky-300' },
  reddit: { naziv: 'Reddit', klasa: 'bg-amber-400/15 text-amber-300' },
  hackernews: { naziv: 'Hacker News', klasa: 'bg-amber-400/15 text-amber-300' },
  youtube: { naziv: 'YouTube', klasa: 'bg-rose-400/15 text-rose-300' },
  mastodon: { naziv: 'Mastodon', klasa: 'bg-violet-400/15 text-violet-300' },
  github: { naziv: 'GitHub', klasa: 'bg-slate-800 text-slate-300' },
  producthunt: { naziv: 'Product Hunt', klasa: 'bg-rose-400/15 text-rose-300' },
  ostalo: { naziv: 'Web', klasa: 'bg-slate-800 text-slate-300' },
};

@Component({
  selector: 'app-mreze-page',
  imports: [DatumTraka, SacuvajDugme, SekcijaBaner],
  template: `
    <app-datum-traka [datum]="ruta.aktivniDatum()" sekcija="mreze" [stanje]="ruta.stanje()" [prevodNedostaje]="ruta.prevodNedostaje()" />

    @if (ruta.izdanje(); as iz) {
      <app-sekcija-baner boja="rose" izraz="shock" [oznaka]="t('mreze.oznaka')" [naslov]="t('mreze.naslov')" [opis]="t('mreze.opis')" />

      @if (!iz.mreze) {
        <p class="py-16 text-center text-slate-400">{{ t('mreze.nema') }}</p>
      } @else {
        @if (!iz.mreze.teme.length) {
          <p class="py-10 text-center text-slate-400">{{ t('mreze.prazno') }}</p>
        }
        <ol class="mt-6 grid gap-4 sm:grid-cols-2">
          @for (tema of iz.mreze.teme; track $index) {
            <li class="flex flex-col rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
              <div class="flex items-start justify-between gap-3">
                <div [attr.aria-label]="t('mreze.jacina', { n: tema.jacina })" [title]="t('mreze.jacina', { n: tema.jacina })" class="flex items-center gap-2">
                  <span class="text-2xl leading-none">{{ plamen(tema.jacina) }}</span>
                  <span class="flex gap-1" aria-hidden="true">
                    @for (n of [1, 2, 3]; track n) {
                      <span class="h-2 w-6 rounded-full" [class.bg-rose-400]="n <= tema.jacina" [class.bg-slate-700]="n > tema.jacina"></span>
                    }
                  </span>
                </div>
                <app-sacuvaj-dugme class="-mr-2 -mt-2" [stavka]="{ kljuc: kljuc(iz.datum, 'tema', $index), tip: 'tema', datum: iz.datum, naslov: tema.naslov, opis: tema.oCemuSePrica, url: tema.izvori[0]?.url ?? null }" />
              </div>
              <h2 class="mt-3 text-lg font-bold leading-snug text-white">{{ tema.naslov }}</h2>
              <div class="mt-2 flex flex-wrap gap-1.5 text-xs">
                @for (p of platforme(tema); track p) {
                  <span class="rounded-full px-2 py-0.5 font-semibold" [class]="platforma(p).klasa">{{ platforma(p).naziv }}</span>
                }
              </div>
              <p class="mt-3 text-sm leading-relaxed text-slate-300" [class.line-clamp-3]="!otvoreno().has($index)">{{ tema.oCemuSePrica }}</p>
              @if (otvoreno().has($index)) {
                <p class="mt-3 rounded-xl bg-slate-800/50 px-4 py-3 text-sm leading-relaxed text-slate-200">
                  <span class="font-semibold text-rose-300">{{ t('mreze.glasovi') }}</span> {{ tema.glasovi }}
                </p>
                <ul class="mt-3 space-y-1.5 text-sm">
                  @for (izvor of tema.izvori; track izvor.url) {
                    <li class="flex items-center gap-2">
                      <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold" [class]="platforma(izvor.platforma).klasa">{{ platforma(izvor.platforma).naziv }}</span>
                      <a [href]="izvor.url" target="_blank" rel="noopener" class="truncate text-slate-400 underline decoration-slate-700 underline-offset-4 hover:text-white">{{ izvor.naziv }} ↗</a>
                    </li>
                  }
                </ul>
              }
              <div class="mt-auto pt-4">
                <button type="button" (click)="prebaci($index)" class="rounded-full border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-white">
                  {{ otvoreno().has($index) ? t('kartica.manje') : t('mreze.koPrica', { n: tema.izvori.length }) }}
                </button>
              </div>
            </li>
          }
        </ol>

        @if (iz.mreze.snimci.length) {
          <section aria-labelledby="naslov-snimci" class="mt-12">
            <h2 id="naslov-snimci" class="text-xl font-bold text-white">▶ {{ t('mreze.snimci') }}</h2>
            <ul class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              @for (s of iz.mreze.snimci; track s.url) {
                <li>
                  <a [href]="s.url" target="_blank" rel="noopener" class="group block overflow-hidden rounded-2xl border border-rose-900/40 bg-slate-900/60 transition-colors hover:border-rose-700/60">
                    <div class="relative aspect-video bg-slate-800">
                      @if (slicica(s.url); as src) {
                        <img [src]="src" alt="" loading="lazy" class="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                      }
                      <span class="absolute inset-0 grid place-items-center" aria-hidden="true"><span class="grid size-12 place-items-center rounded-full bg-black/60 text-white">▶</span></span>
                    </div>
                    <div class="p-4">
                      <p class="text-xs font-semibold text-rose-300">{{ s.kanal }}</p>
                      <p class="mt-1 line-clamp-2 font-semibold leading-snug text-white">{{ s.naslov }}</p>
                    </div>
                  </a>
                </li>
              }
            </ul>
          </section>
        }

        <p class="mt-10 text-center text-xs leading-relaxed text-slate-600">{{ t('mreze.napomena') }}</p>
      }
    }
  `,
})
export class MrezePage {
  readonly datum = input<string>();

  protected readonly ruta = izdanjeZaRutu(this.datum);
  protected readonly kljuc = SacuvanoService.kljuc;
  protected readonly t = inject(PodesavanjaService).t;

  protected readonly platforma = (p: Platforma) => PLATFORME[p] ?? PLATFORME.ostalo;
  protected readonly platforme = (tema: Tema) => [...new Set(tema.izvori.map((i) => i.platforma))];
  protected readonly plamen = (jacina: number) => (jacina >= 3 ? '🔥' : jacina === 2 ? '💬' : '👀');

  protected readonly otvoreno = signal(new Set<number>());
  protected prebaci(i: number): void {
    const s = new Set(this.otvoreno());
    if (!s.delete(i)) s.add(i);
    this.otvoreno.set(s);
  }

  /** Sličica YouTube snimka (javna adresa sa i.ytimg.com). */
  protected slicica(url: string): string | null {
    try {
      const u = new URL(url);
      const id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v');
      return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null;
    } catch {
      return null;
    }
  }
}
