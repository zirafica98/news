import { Component, computed, inject, input } from '@angular/core';
import { PodesavanjaService } from './podesavanja.service';
import { SacuvanaStavka, SacuvanoService } from './sacuvano.service';

@Component({
  selector: 'app-sacuvaj-dugme',
  template: `
    <button
      type="button"
      (click)="sacuvano.prebaci(stavka())"
      [attr.aria-pressed]="jeSacuvano()"
      [attr.aria-label]="jeSacuvano() ? t('sacuvaj.ukloni') : t('sacuvaj.sacuvaj')"
      class="grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-amber-400"
      [class.text-amber-400]="jeSacuvano()"
      [class.text-slate-500]="!jeSacuvano()"
    >
      <svg viewBox="0 0 24 24" class="size-5" aria-hidden="true" stroke="currentColor" stroke-width="2" stroke-linejoin="round" [attr.fill]="jeSacuvano() ? 'currentColor' : 'none'">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
      </svg>
    </button>
  `,
})
export class SacuvajDugme {
  protected readonly sacuvano = inject(SacuvanoService);
  protected readonly t = inject(PodesavanjaService).t;

  readonly stavka = input.required<Omit<SacuvanaStavka, 'sacuvano'>>();

  protected readonly jeSacuvano = computed(() => this.sacuvano.jeSacuvano(this.stavka().kljuc));
}
