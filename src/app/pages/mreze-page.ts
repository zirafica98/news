import { Component, inject, input } from '@angular/core';
import { DatumTraka } from '../components/datum-traka';
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
  imports: [DatumTraka, SacuvajDugme],
  template: `
    <app-datum-traka [datum]="ruta.aktivniDatum()" sekcija="mreze" [stanje]="ruta.stanje()" [prevodNedostaje]="ruta.prevodNedostaje()" />

    @if (ruta.izdanje(); as iz) {
      <h1 class="mt-4 text-2xl font-semibold text-white">{{ t('mreze.naslov') }}</h1>
      <p class="mt-1 text-sm text-slate-500">{{ t('mreze.opis') }}</p>

      @if (!iz.mreze) {
        <p class="py-16 text-center text-slate-400">{{ t('mreze.nema') }}</p>
      } @else {
        @if (!iz.mreze.teme.length) {
          <p class="py-10 text-center text-slate-400">{{ t('mreze.prazno') }}</p>
        }
        <ol class="mt-6 space-y-4">
          @for (tema of iz.mreze.teme; track $index) {
            <li class="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
              <div class="flex items-start justify-between gap-3">
                <div class="flex flex-wrap items-center gap-1.5 text-xs">
                  <span class="mr-1" [attr.aria-label]="t('mreze.jacina', { n: tema.jacina })" [title]="t('mreze.jacina', { n: tema.jacina })">{{ plamen(tema.jacina) }}</span>
                  @for (p of platforme(tema); track p) {
                    <span class="rounded-full px-2 py-0.5 font-medium" [class]="platforma(p).klasa">{{ platforma(p).naziv }}</span>
                  }
                </div>
                <app-sacuvaj-dugme
                  class="-mr-2 -mt-2"
                  [stavka]="{ kljuc: kljuc(iz.datum, 'tema', $index), tip: 'tema', datum: iz.datum, naslov: tema.naslov, opis: tema.oCemuSePrica, url: tema.izvori[0]?.url ?? null }"
                />
              </div>
              <h2 class="mt-2 text-lg font-semibold leading-snug text-white">{{ tema.naslov }}</h2>
              <p class="mt-2 leading-relaxed text-slate-300">{{ tema.oCemuSePrica }}</p>
              <p class="mt-3 rounded-xl bg-slate-800/50 px-4 py-3 text-sm leading-relaxed text-slate-300">
                <span class="font-medium text-sky-300">{{ t('mreze.glasovi') }}</span> {{ tema.glasovi }}
              </p>
              <ul class="mt-3 space-y-1.5 text-sm">
                @for (izvor of tema.izvori; track izvor.url) {
                  <li class="flex items-center gap-2">
                    <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold" [class]="platforma(izvor.platforma).klasa">{{ platforma(izvor.platforma).naziv }}</span>
                    <a [href]="izvor.url" target="_blank" rel="noopener" class="truncate text-slate-400 underline decoration-slate-700 underline-offset-4 hover:text-white">{{ izvor.naziv }} ↗</a>
                  </li>
                }
              </ul>
            </li>
          }
        </ol>

        @if (iz.mreze.snimci.length) {
          <section aria-labelledby="naslov-snimci" class="mt-10">
            <h2 id="naslov-snimci" class="text-xs font-semibold uppercase tracking-widest text-slate-500">{{ t('mreze.snimci') }}</h2>
            <ul class="mt-4 space-y-3">
              @for (s of iz.mreze.snimci; track s.url) {
                <li>
                  <a [href]="s.url" target="_blank" rel="noopener" class="flex gap-3 rounded-2xl border border-rose-900/40 bg-rose-950/10 p-3 transition-colors hover:border-rose-900">
                    @if (slicica(s.url); as src) {
                      <img [src]="src" alt="" loading="lazy" class="aspect-video w-32 shrink-0 rounded-lg object-cover sm:w-40" />
                    }
                    <div class="min-w-0">
                      <p class="text-xs text-rose-300">▶ {{ s.kanal }}</p>
                      <p class="mt-0.5 font-medium leading-snug text-white">{{ s.naslov }}</p>
                      <p class="mt-1 text-sm leading-relaxed text-slate-400">{{ s.opis }}</p>
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
  protected readonly plamen = (jacina: number) => '🔥'.repeat(jacina);

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
