import { Signal, computed, inject } from '@angular/core';
import { IzdanjaService } from './izdanja.service';
import { Izdanje } from './izdanje.model';

export type Sekcija = 'vesti' | 'istrazivanje' | 'ideje';

export type StanjeIzdanja = 'nema-izdanja' | 'ucitava' | 'ne-postoji' | 'spremno';

/** Link do sekcije za dati dan. Bez datuma vodi na najnovije izdanje. */
export function putanjaSekcije(sekcija: Sekcija, datum?: string): string[] {
  const osnova = datum ? ['/izdanje', datum] : ['/'];
  return sekcija === 'vesti' ? osnova : [...osnova, sekcija];
}

/**
 * Za stranice Vesti, Istraživanje i Ideje: izdanje za datum iz rute, ili najnovije kad datuma nema.
 * Mora se pozvati u inicijalizaciji polja komponente.
 */
export function izdanjeZaRutu(datum: Signal<string | undefined>) {
  const izdanja = inject(IzdanjaService);

  const aktivniDatum = computed(() => datum() ?? izdanja.najnovije());
  const ref = computed(() => {
    const d = aktivniDatum();
    return d ? izdanja.izdanje(d) : undefined;
  });

  const izdanje = computed<Izdanje | undefined>(() => (ref()?.hasValue() ? ref()!.value() : undefined));

  const stanje = computed<StanjeIzdanja>(() => {
    const r = ref();
    if (!r) return izdanja.index.isLoading() ? 'ucitava' : 'nema-izdanja';
    if (r.error()) return 'ne-postoji';
    return r.hasValue() ? 'spremno' : 'ucitava';
  });

  return { aktivniDatum, izdanje, stanje };
}
