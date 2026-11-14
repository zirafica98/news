import { Component, input } from '@angular/core';

export type BojaSekcije = 'sky' | 'violet' | 'rose' | 'amber';

const STIL: Record<BojaSekcije, { okvir: string; sjaj: string; tekst: string }> = {
  sky: { okvir: 'border-sky-900/50 from-sky-950/60', sjaj: 'bg-sky-500/20', tekst: 'text-sky-300' },
  violet: { okvir: 'border-violet-900/50 from-violet-950/60', sjaj: 'bg-violet-500/20', tekst: 'text-violet-300' },
  rose: { okvir: 'border-rose-900/50 from-rose-950/50', sjaj: 'bg-rose-500/20', tekst: 'text-rose-300' },
  amber: { okvir: 'border-amber-900/50 from-amber-950/50', sjaj: 'bg-amber-500/20', tekst: 'text-amber-300' },
};

/** Zaglavlje sekcije (Research, Ideas, Social): obojena traka sa naslovom, brojem stavki i Byte-om. */
@Component({
  selector: 'app-sekcija-baner',
  template: `
    <header class="relative mt-5 overflow-hidden rounded-3xl border bg-gradient-to-br to-slate-950 px-5 py-6 sm:px-8 sm:py-8" [class]="stil().okvir">
      <div class="pointer-events-none absolute -right-10 -top-16 size-72 rounded-full blur-3xl" [class]="stil().sjaj" aria-hidden="true"></div>
      <div class="relative flex items-center justify-between gap-4">
        <div class="min-w-0">
          <p class="text-xs font-bold uppercase tracking-[0.25em]" [class]="stil().tekst">{{ oznaka() }}</p>
          <h1 class="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-3xl">{{ naslov() }}</h1>
          <p class="mt-2 max-w-md text-sm leading-relaxed text-slate-300">{{ opis() }}</p>
        </div>
        <img [src]="'/byte/' + izraz() + '.svg'" alt="" width="400" height="470" class="w-20 shrink-0 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] sm:w-28" />
      </div>
    </header>
  `,
})
export class SekcijaBaner {
  readonly naslov = input.required<string>();
  readonly opis = input('');
  readonly oznaka = input('');
  readonly boja = input<BojaSekcije>('amber');
  readonly izraz = input<'happy' | 'shock' | 'worried' | 'skeptic' | 'sly' | 'wave'>('happy');

  protected stil() {
    return STIL[this.boja()];
  }
}
