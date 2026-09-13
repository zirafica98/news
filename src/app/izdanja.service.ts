import { httpResource } from '@angular/common/http';
import { Injectable, computed } from '@angular/core';
import { IndexStavka } from './izdanje.model';

@Injectable({ providedIn: 'root' })
export class IzdanjaService {
  /** Spisak svih izdanja, od najnovijeg. Učitava se jednom po poseti. */
  readonly index = httpResource<IndexStavka[]>(() => 'data/index.json', { defaultValue: [] });

  readonly najnovije = computed(() => this.index.value()[0]?.datum);
}
