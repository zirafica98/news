// Oblik podataka iz public/data. Mora da prati scripts/digest-schema.json i scripts/finalize.mjs.

export type Kategorija = 'modeli' | 'alati' | 'kompanije' | 'istrazivanje' | 'bezbednost' | 'regulativa' | 'ostalo';

export interface Izvor {
  naziv: string;
  url: string;
}

export interface Vest {
  naslov: string;
  staSeDesilo: string;
  zastoJeBitno: string;
  kategorija: Kategorija;
  vaznost: 1 | 2 | 3;
  izvori: Izvor[];
}

export interface Novo {
  naziv: string;
  tip: 'model' | 'alat' | 'projekat' | 'funkcija';
  opis: string;
  kakoProbati: string[];
  link: string;
  cena: string;
}

export interface Rad {
  naslov: string;
  objasnjenje: string;
  zastoJeZanimljivo: string;
  url: string;
  github: string | null;
}

export interface Ideja {
  naziv: string;
  problem: string;
  zaKoga: string;
  ulogaAi: string;
  tezina: 1 | 2 | 3 | 4 | 5;
  vikendProjekat: boolean;
  prviKoraci: string[];
  inspiracija: string;
}

export interface Izdanje {
  datum: string;
  generisano: string;
  model: string;
  ukratko: string;
  vesti: Vest[];
  novo: Novo[];
  istrazivanje: Rad[];
  ideje: Ideja[];
  /** Claude-ov komentar o cenama tokena. Nema ga u izdanjima pre 14.09.2026. */
  cene?: string;
}

export interface IndexStavka {
  datum: string;
  ukratko: string;
  naslovi: string[];
  broj: { vesti: number; novo: number; istrazivanje: number; ideje: number };
}

export const KATEGORIJE: Record<Kategorija, string> = {
  modeli: 'Modeli',
  alati: 'Alati',
  kompanije: 'Kompanije',
  istrazivanje: 'Istraživanje',
  bezbednost: 'Bezbednost',
  regulativa: 'Regulativa',
  ostalo: 'Ostalo',
};

/** „nedelja, 13. septembar 2026.“ */
export function formatDatum(datum: string, opcije: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }): string {
  return new Intl.DateTimeFormat('sr-Latn-RS', opcije).format(new Date(`${datum}T12:00:00`));
}
