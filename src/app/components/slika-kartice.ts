import { Component, input, signal } from '@angular/core';

/** Naslovna slika vesti ili alata (public/insta/…-vest-N.jpg). Ako slike nema (starije izdanje), prikaže obojenu pozadinu. */
@Component({
  selector: 'app-slika-kartice',
  host: { class: 'block overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950' },
  template: `
    @if (!greska()) {
      <img
        [src]="src()"
        [alt]="alt()"
        [attr.loading]="hitno() ? null : 'lazy'"
        [attr.fetchpriority]="hitno() ? 'high' : null"
        width="1200"
        height="630"
        (error)="greska.set(true)"
        class="aspect-[40/21] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
      />
    } @else {
      <div class="aspect-[40/21] w-full"></div>
    }
  `,
})
export class SlikaKartice {
  readonly src = input.required<string>();
  readonly alt = input('');
  /** Prva slika na strani: učitava se odmah. */
  readonly hitno = input(false);
  protected readonly greska = signal(false);
}

/** Putanje do naslovnih slika (pravi ih scripts/slike-vesti.mjs). */
export const slikaVesti = (datum: string, i: number) => `/insta/${datum}-vest-${i}.jpg`;
export const slikaNovo = (datum: string, i: number) => `/insta/${datum}-novo-${i}.jpg`;
