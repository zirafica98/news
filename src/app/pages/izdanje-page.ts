import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IzdanjaService } from '../izdanja.service';
import { Izdanje, KATEGORIJE, formatDatum } from '../izdanje.model';
import { SacuvajDugme } from '../sacuvaj-dugme';
import { SacuvanoService } from '../sacuvano.service';

@Component({
  selector: 'app-izdanje-page',
  imports: [RouterLink, SacuvajDugme],
  templateUrl: './izdanje-page.html',
})
export class IzdanjePage {
  private readonly izdanja = inject(IzdanjaService);

  /** Iz rute /izdanje/:datum. Na početnoj strani je prazan, pa se prikazuje najnovije izdanje. */
  readonly datum = input<string>();

  protected readonly aktivniDatum = computed(() => this.datum() ?? this.izdanja.najnovije());
  protected readonly indexUcitan = computed(() => !this.izdanja.index.isLoading());

  protected readonly izdanje = httpResource<Izdanje>(() => {
    const datum = this.aktivniDatum();
    return datum ? `data/${datum}.json` : undefined;
  });

  protected readonly naslovDatuma = computed(() => {
    const datum = this.aktivniDatum();
    return datum ? formatDatum(datum) : '';
  });

  // Index je poređan od najnovijeg, pa je „starije“ sledeće u nizu.
  private readonly pozicija = computed(() => this.izdanja.index.value().findIndex((e) => e.datum === this.aktivniDatum()));
  protected readonly starije = computed(() => (this.pozicija() >= 0 ? this.izdanja.index.value()[this.pozicija() + 1]?.datum : undefined));
  protected readonly novije = computed(() => (this.pozicija() > 0 ? this.izdanja.index.value()[this.pozicija() - 1]?.datum : undefined));

  protected readonly generisano = computed(() => {
    const i = this.izdanje.value();
    return i ? new Intl.DateTimeFormat('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' }).format(new Date(i.generisano)) : '';
  });

  protected skroluj(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected readonly kategorije = KATEGORIJE;
  protected readonly kljuc = SacuvanoService.kljuc;
  protected readonly kratakDatum = (d: string) => formatDatum(d, { day: 'numeric', month: 'short' });
  protected readonly domen = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };
}
