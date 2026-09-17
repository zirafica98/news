import { Component, computed, inject, input } from '@angular/core';
import { formatCena } from '../cene.model';
import { PodesavanjaService } from '../podesavanja.service';

/** Tačka istorije: [datum, ulaz, izlaz] u dolarima za milion tokena. */
export type TackaCene = [string, number, number];

const SIRINA = 120;
const VISINA = 28;

/** Mala krivulja kretanja cene kroz vreme. Cena se menja skokovito, pa je linija stepenasta. */
@Component({
  selector: 'app-cena-kriva',
  template: `
    @if (putanja(); as d) {
      <svg [attr.viewBox]="'0 0 ' + sirina + ' ' + visina" class="h-7 w-32" [attr.aria-label]="opis()" role="img">
        <path [attr.d]="d" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
        <circle [attr.cx]="sirina - 1" [attr.cy]="poslednjaVisina()" r="2" fill="currentColor" />
      </svg>
    }
  `,
})
export class CenaKriva {
  private readonly podesavanja = inject(PodesavanjaService);

  readonly tacke = input.required<TackaCene[]>();
  /** 1 = ulazna cena, 2 = izlazna cena. */
  readonly polje = input<1 | 2>(2);

  protected readonly sirina = SIRINA;
  protected readonly visina = VISINA;

  private readonly niz = computed(() => this.tacke().map((t) => t[this.polje()]));
  private readonly raspon = computed(() => {
    const v = this.niz();
    return { min: Math.min(...v), max: Math.max(...v) };
  });

  protected readonly putanja = computed(() => {
    const vrednosti = this.niz();
    if (vrednosti.length < 2) return null;
    const korak = (SIRINA - 1) / (vrednosti.length - 1);
    // Stepenasta linija: cena važi sve do sledeće promene.
    return vrednosti
      .map((v, i) => (i === 0 ? `M0 ${this.y(v)}` : `H${(i * korak).toFixed(1)} V${this.y(v)}`))
      .join(' ')
      .concat(` H${SIRINA - 1}`);
  });

  protected readonly poslednjaVisina = computed(() => this.y(this.niz().at(-1) ?? 0));

  protected readonly opis = computed(() => {
    const { min, max } = this.raspon();
    const lokal = this.podesavanja.lokal();
    return min === max ? formatCena(min, lokal) : `${formatCena(min, lokal)} – ${formatCena(max, lokal)}`;
  });

  private y(vrednost: number): string {
    const { min, max } = this.raspon();
    const v = max === min ? VISINA / 2 : VISINA - 2 - ((vrednost - min) / (max - min)) * (VISINA - 4);
    return v.toFixed(1);
  }
}
