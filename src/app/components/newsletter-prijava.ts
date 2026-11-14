import { Component, inject, signal } from '@angular/core';
import { PodesavanjaService } from '../podesavanja.service';

type Stanje = 'unos' | 'saljem' | 'poslato' | 'greska';

/** Prijava na jutarnji email newsletter (api/newsletter.mjs). Posle prijave stiže mejl za potvrdu. */
@Component({
  selector: 'app-newsletter-prijava',
  template: `
    @if (ukljuceno()) {
    <section aria-labelledby="newsletter-naslov" class="mt-12 rounded-2xl border border-amber-900/40 bg-amber-950/20 p-5 lg:p-6">
      <h2 id="newsletter-naslov" class="text-lg font-semibold text-white">☕ {{ t('newsletter.naslov') }}</h2>
      <p class="mt-1 text-sm leading-relaxed text-slate-300">{{ t('newsletter.opis') }}</p>

      @if (stanje() === 'poslato') {
        <p role="status" class="mt-4 rounded-xl bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">{{ t('newsletter.poslato') }}</p>
      } @else {
        <form (submit)="prijavi($event)" class="mt-4 flex flex-col gap-2 sm:flex-row">
          <label for="newsletter-email" class="sr-only">Email</label>
          <input
            id="newsletter-email"
            type="email"
            name="email"
            required
            autocomplete="email"
            [placeholder]="t('newsletter.placeholder')"
            class="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
          />
          <!-- Skriveno polje za botove -->
          <input type="text" name="web" tabindex="-1" autocomplete="off" aria-hidden="true" class="hidden" />
          <button
            type="submit"
            [disabled]="stanje() === 'saljem'"
            class="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
          >
            {{ stanje() === 'saljem' ? t('newsletter.saljem') : t('newsletter.dugme') }}
          </button>
        </form>
        @if (stanje() === 'greska') {
          <p role="alert" class="mt-2 text-sm text-rose-400">{{ t('newsletter.greska') }}</p>
        }
      }
    </section>
    }
  `,
})
export class NewsletterPrijava {
  protected readonly t = inject(PodesavanjaService).t;
  protected readonly stanje = signal<Stanje>('unos');
  /** Forma se prikazuje tek kad je newsletter podešen na serveru (Resend ključevi). */
  protected readonly ukljuceno = signal(false);

  constructor() {
    fetch('/api/newsletter')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => this.ukljuceno.set(p?.ukljuceno === true))
      .catch(() => {});
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
