import { Component, computed, inject, input } from '@angular/core';
import { OceneService } from '../ocene.service';
import { PodesavanjaService } from '../podesavanja.service';
import { SacuvanoTip } from '../sacuvano.service';

/** Palac gore/dole. Ocena utiče na to šta će sutrašnje izdanje više izdvajati. */
@Component({
  selector: 'app-ocena-dugmad',
  host: { class: 'flex items-center gap-1' },
  template: `
    @for (o of dugmad; track o.ocena) {
      <button
        type="button"
        (click)="ocene.oceni(kljuc(), o.ocena, { datum: datum(), tip: tip(), naslov: naslov() })"
        [attr.aria-pressed]="ocena() === o.ocena"
        [attr.aria-label]="t(o.naziv)"
        [title]="t(o.naziv)"
        class="grid size-8 place-items-center rounded-full transition-colors hover:bg-slate-800"
        [class.text-emerald-400]="ocena() === 1 && o.ocena === 1"
        [class.text-rose-400]="ocena() === -1 && o.ocena === -1"
        [class.text-slate-600]="ocena() !== o.ocena"
      >
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
          <path [attr.d]="o.ocena === 1 ? PALAC_GORE : PALAC_DOLE" />
        </svg>
      </button>
    }
  `,
})
export class OcenaDugmad {
  protected readonly ocene = inject(OceneService);
  protected readonly t = inject(PodesavanjaService).t;

  readonly kljuc = input.required<string>();
  readonly datum = input.required<string>();
  readonly tip = input.required<SacuvanoTip>();
  readonly naslov = input.required<string>();

  protected readonly ocena = computed(() => this.ocene.ocena(this.kljuc()));

  protected readonly PALAC_GORE = 'M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3zm0 0 4-8a2.5 2.5 0 0 1 2.5 3.2L13 9h5.5a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 17.2 19H7';
  protected readonly PALAC_DOLE = 'M7 13V4H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h3zm0 0 4 8a2.5 2.5 0 0 0 2.5-3.2L13 15h5.5a2 2 0 0 0 2-2.4l-1.3-6A2 2 0 0 0 17.2 5H7';

  protected readonly dugmad = [
    { ocena: 1 as const, naziv: 'ocena.gore' as const },
    { ocena: -1 as const, naziv: 'ocena.dole' as const },
  ];
}
