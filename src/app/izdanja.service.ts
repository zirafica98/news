import { HttpResourceRef, httpResource } from '@angular/common/http';
import { Injectable, Injector, computed, inject, untracked } from '@angular/core';
import { Cene } from './cene.model';
import { IndexStavka, Izdanje } from './izdanje.model';

@Injectable({ providedIn: 'root' })
export class IzdanjaService {
  private readonly injector = inject(Injector);
  private readonly izdanja = new Map<string, HttpResourceRef<Izdanje | undefined>>();

  /** Spisak svih izdanja, od najnovijeg. Učitava se jednom po poseti. */
  readonly index = httpResource<IndexStavka[]>(() => 'data/index.json', { defaultValue: [] });
  readonly najnovije = computed(() => this.index.value()[0]?.datum);

  readonly cene = httpResource<Cene>(() => 'data/cene.json');

  /** Jedno izdanje. Pamti se, pa prelazak između Vesti, Istraživanja i Ideja istog dana ne učitava ponovo. */
  izdanje(datum: string): HttpResourceRef<Izdanje | undefined> {
    let ref = this.izdanja.get(datum);
    if (!ref) {
      ref = untracked(() => httpResource<Izdanje>(() => `data/${datum}.json`, { injector: this.injector }));
      this.izdanja.set(datum, ref);
    }
    return ref;
  }
}
