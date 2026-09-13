import { HttpResourceRef, httpResource } from '@angular/common/http';
import { Injectable, Injector, computed, inject, untracked } from '@angular/core';
import { Cene } from './cene.model';
import { Jezik } from './i18n';
import { IndexStavka, Izdanje } from './izdanje.model';
import { PodesavanjaService } from './podesavanja.service';

/** Srpska izdanja su u data/, engleski prevodi u data/en/. */
const folder = (jezik: Jezik) => (jezik === 'sr' ? 'data' : 'data/en');

@Injectable({ providedIn: 'root' })
export class IzdanjaService {
  private readonly injector = inject(Injector);
  private readonly podesavanja = inject(PodesavanjaService);
  private readonly izdanja = new Map<string, HttpResourceRef<Izdanje | undefined>>();

  /** Srpski index je glavni spisak dana: prevod za neki dan može da fali, izdanje ne. */
  readonly index = httpResource<IndexStavka[]>(() => 'data/index.json', { defaultValue: [] });
  readonly najnovije = computed(() => this.index.value()[0]?.datum);

  /** Engleski naslovi za arhivu. Učitava se tek kad se izabere engleski. */
  readonly indexEn = httpResource<IndexStavka[]>(() => (this.podesavanja.jezik() === 'en' ? 'data/en/index.json' : undefined), { defaultValue: [] });

  readonly cene = httpResource<Cene>(() => 'data/cene.json');

  /** Jedno izdanje na jednom jeziku. Pamti se, pa prelazak između kartica istog dana ne učitava ponovo. */
  izdanje(datum: string, jezik: Jezik): HttpResourceRef<Izdanje | undefined> {
    const kljuc = `${jezik}:${datum}`;
    let ref = this.izdanja.get(kljuc);
    if (!ref) {
      ref = untracked(() => httpResource<Izdanje>(() => `${folder(jezik)}/${datum}.json`, { injector: this.injector }));
      this.izdanja.set(kljuc, ref);
    }
    return ref;
  }

  /**
   * Izdanje na izabranom jeziku, a srpsko ako prevod za taj dan ne postoji.
   * Pozivati u reaktivnom kontekstu (computed/šablon), da bi se pratila promena jezika i greška prevoda.
   */
  izdanjeNaJeziku(datum: string): { ref: HttpResourceRef<Izdanje | undefined>; prevodNedostaje: boolean } {
    if (this.podesavanja.jezik() === 'en') {
      const en = this.izdanje(datum, 'en');
      if (!en.error()) return { ref: en, prevodNedostaje: false };
      return { ref: this.izdanje(datum, 'sr'), prevodNedostaje: true };
    }
    return { ref: this.izdanje(datum, 'sr'), prevodNedostaje: false };
  }
}
