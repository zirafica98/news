import { Signal, computed, inject } from '@angular/core';
import { IzdanjaService } from './izdanja.service';
import { Izdanje } from './izdanje.model';

export type Sekcija = 'vesti' | 'istrazivanje' | 'ideje' | 'mreze';

export type StanjeIzdanja = 'nema-izdanja' | 'ucitava' | 'ne-postoji' | 'spremno';

/** Link do sekcije za dati dan. Bez datuma vodi na najnovije izdanje. */
export function putanjaSekcije(sekcija: Sekcija, datum?: string): string[] {
  const osnova = datum ? ['/izdanje', datum] : ['/'];
  return sekcija === 'vesti' ? osnova : [...osnova, sekcija];
}

/**
 * Za stranice Vesti, Istraživanje i Ideje: izdanje za datum iz rute (ili najnovije) na izabranom jeziku.
 * Mora se pozvati u inicijalizaciji polja komponente.
 */
export function izdanjeZaRutu(datum: Signal<string | undefined>) {
  const izdanja = inject(IzdanjaService);

  const aktivniDatum = computed(() => datum() ?? izdanja.najnovije());
  const izbor = computed(() => {
    const d = aktivniDatum();
    return d ? izdanja.izdanjeNaJeziku(d) : undefined;
  });

  const izdanje = computed<Izdanje | undefined>(() => {
    const ref = izbor()?.ref;
    return ref?.hasValue() ? ref.value() : undefined;
  });

  const prevodNedostaje = computed(() => izbor()?.prevodNedostaje ?? false);

  const stanje = computed<StanjeIzdanja>(() => {
    const ref = izbor()?.ref;
    if (!ref) return izdanja.index.isLoading() ? 'ucitava' : 'nema-izdanja';
    if (ref.error()) return 'ne-postoji';
    return ref.hasValue() ? 'spremno' : 'ucitava';
  });

  return { aktivniDatum, izdanje, stanje, prevodNedostaje };
}
