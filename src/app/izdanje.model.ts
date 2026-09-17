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
  /** Domaća ili regionalna vest. Nema ga u izdanjima pre 14.09.2026. */
  izSrbije?: boolean;
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

export interface KratkaVest {
  naslov: string;
  izvor: string;
  url: string;
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

export type Platforma = 'x' | 'bluesky' | 'reddit' | 'hackernews' | 'youtube' | 'mastodon' | 'github' | 'producthunt' | 'ostalo';

export interface Tema {
  naslov: string;
  oCemuSePrica: string;
  glasovi: string;
  jacina: 1 | 2 | 3;
  izvori: { platforma: Platforma; naziv: string; url: string }[];
}

export interface Snimak {
  naslov: string;
  kanal: string;
  opis: string;
  url: string;
}

export interface Izdanje {
  datum: string;
  generisano: string;
  model: string;
  ukratko: string;
  vesti: Vest[];
  novo: Novo[];
  /** Kratke vesti. Nema ih u izdanjima pre 18.09.2026. */
  kratkeVesti?: KratkaVest[];
  istrazivanje: Rad[];
  ideje: Ideja[];
  /** Claude-ov komentar o cenama tokena. Nema ga u izdanjima pre 14.09.2026. */
  cene?: string;
  /** Društvene mreže. Nema ih u izdanjima pre 17.09.2026. */
  mreze?: { teme: Tema[]; snimci: Snimak[] };
}

export interface IndexStavka {
  datum: string;
  ukratko: string;
  naslovi: string[];
  broj: { vesti: number; novo: number; istrazivanje: number; ideje: number };
}

/** „nedelja, 13. septembar 2026.“ / „Sunday 13 September 2026“ */
export function formatDatum(
  datum: string,
  lokal: string,
  opcije: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
): string {
  return new Intl.DateTimeFormat(lokal, opcije).format(new Date(`${datum}T12:00:00`));
}
