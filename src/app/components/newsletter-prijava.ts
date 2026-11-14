import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { PodesavanjaService } from '../podesavanja.service';

type Stanje = 'unos' | 'saljem' | 'poslato' | 'greska';

/** Da li je newsletter podešen na serveru: pita se jednom za celu stranicu. */
let podesen: Promise<boolean> | null = null;
const proveriPodesenost = () =>
  (podesen ??= fetch('/api/newsletter')
    .then((r) => (r.ok ? r.json() : null))
    .then((p) => p?.ukljuceno === true)
    .catch(() => false));

let brojac = 0;

/**
 * Prijava na jutarnji email newsletter (api/newsletter.mjs). Posle prijave stiže mejl za potvrdu.
 * `hero`: samo polje i dugme (na vrhu početne strane), inače kartica sa naslovom.
 */
@Component({
  selector: 'app-newsletter-prijava',
  imports: [NgTemplateOutlet],
  template: `
    @if (ukljuceno()) {
      @if (hero()) {
        <ng-container *ngTemplateOutlet="forma" />
      } @else {
        <section [attr.aria-labelledby]="id + '-naslov'" class="mt-12 rounded-2xl border border-amber-900/40 bg-amber-950/20 p-5 lg:p-6">
          <h2 [id]="id + '-naslov'" class="text-lg font-semibold text-white">☕ {{ t('newsletter.naslov') }}</h2>
          <p class="mt-1 text-sm leading-relaxed text-slate-300">{{ t('newsletter.opis') }}</p>
          <div class="mt-4"><ng-container *ngTemplateOutlet="forma" /></div>
        </section>
      }
    }

    <ng-template #forma>
      @if (stanje() === 'poslato') {
        <p role="status" class="rounded-xl bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">{{ t('newsletter.poslato') }}</p>
      } @else {
        <form (submit)="prijavi($event)" class="flex flex-col gap-2 sm:flex-row">
          <label [for]="id" class="sr-only">Email</label>
          <input
            [id]="id"
            type="email"
            name="email"
            required
            autocomplete="email"
            [placeholder]="t('newsletter.placeholder')"
            class="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
            [class]="hero() ? 'py-3.5' : 'py-2.5'"
          />
          <!-- Skriveno polje za botove -->
          <input type="text" name="web" tabindex="-1" autocomplete="off" aria-hidden="true" class="hidden" />
          <button
            type="submit"
            [disabled]="stanje() === 'saljem'"
            class="rounded-xl bg-amber-400 px-5 text-sm font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
            [class]="hero() ? 'py-3.5' : 'py-2.5'"
          >
            {{ stanje() === 'saljem' ? t('newsletter.saljem') : t('newsletter.dugme') }}
          </button>
        </form>
        @if (stanje() === 'greska') {
          <p role="alert" class="mt-2 text-sm text-rose-400">{{ t('newsletter.greska') }}</p>
        } @else if (hero()) {
          <p class="mt-2 text-xs text-slate-500">{{ t('newsletter.besplatno') }}</p>
        }
      }
    </ng-template>
  `,
})
export class NewsletterPrijava {
  readonly hero = input(false);
  protected readonly t = inject(PodesavanjaService).t;
  protected readonly stanje = signal<Stanje>('unos');
  /** Forma se prikazuje tek kad je newsletter podešen na serveru (Resend ključevi). */
  protected readonly ukljuceno = signal(false);
  protected readonly id = `newsletter-${++brojac}`;

  constructor() {
    proveriPodesenost().then((da) => this.ukljuceno.set(da));
  }

  protected async prijavi(e: Event): Promise<void> {
    e.preventDefault();
    const forma = new FormData(e.target as HTMLFormElement);
    this.stanje.set('saljem');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forma.get('email'), web: forma.get('web') }),
      });
      this.stanje.set(res.ok ? 'poslato' : 'greska');
    } catch {
      this.stanje.set('greska');
    }
  }
}
