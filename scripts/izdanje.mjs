// Provera izdanja i upis u index. Koriste ih finalize.mjs (srpski) i translate-digest.mjs (engleski).

import { readJson, writeJson } from './lib.mjs';

/** Dopisuje izdanje u index.json (zamenjuje isti datum) i vraća broj izdanja u arhivi. */
export async function azurirajIndex(indexFile, izdanje) {
  const index = (await readJson(indexFile, [])).filter((e) => e.datum !== izdanje.datum);
  index.push({
    datum: izdanje.datum,
    ukratko: izdanje.ukratko,
    naslovi: izdanje.vesti.slice(0, 3).map((v) => v.naslov),
    broj: {
      vesti: izdanje.vesti.length,
      novo: izdanje.novo.length,
      istrazivanje: izdanje.istrazivanje.length,
      ideje: izdanje.ideje.length,
    },
  });
  index.sort((a, b) => b.datum.localeCompare(a.datum));
  await writeJson(indexFile, index);
  return index.length;
}

/** Lista grešaka u izdanju (prazna lista znači da je ispravno). */
export function proveriIzdanje(d, datum) {
  const errors = [];
  const text = (v) => typeof v === 'string' && v.trim().length > 0;
  const link = (v) => typeof v === 'string' && /^https?:\/\/\S+$/.test(v);
  const check = (ok, msg) => ok || errors.push(msg);
  const list = (v) => (Array.isArray(v) ? v : []);

  check(d.datum === datum, `datum je "${d.datum}", a treba "${datum}"`);
  check(text(d.ukratko), 'nema „ukratko“');
  check(text(d.cene), 'nema komentara o cenama');

  check(list(d.vesti).length >= 1 && list(d.vesti).length <= 12, `vesti: ${list(d.vesti).length} (treba 1–12)`);
  list(d.vesti).forEach((v, i) => {
    const n = `vest ${i + 1}`;
    check(text(v.naslov) && text(v.staSeDesilo) && text(v.zastoJeBitno), `${n}: prazan tekst`);
    check([1, 2, 3].includes(v.vaznost), `${n}: važnost mora biti 1–3`);
    check(list(v.izvori).length > 0 && list(v.izvori).every((s) => text(s.naziv) && link(s.url)), `${n}: izvori nemaju ispravan link`);
  });

  check(list(d.novo).length <= 8, `novo: ${list(d.novo).length} (najviše 8)`);
  list(d.novo).forEach((x, i) => {
    const n = `novo ${i + 1}`;
    check(text(x.naziv) && text(x.opis) && text(x.cena), `${n}: prazan tekst`);
    check(list(x.kakoProbati).length > 0 && list(x.kakoProbati).every(text), `${n}: nema koraka „kako probati“`);
    check(link(x.link), `${n}: neispravan link`);
  });

  check(list(d.istrazivanje).length <= 5, `istraživanje: ${list(d.istrazivanje).length} (najviše 5)`);
  list(d.istrazivanje).forEach((r, i) => {
    const n = `rad ${i + 1}`;
    check(text(r.naslov) && text(r.objasnjenje) && text(r.zastoJeZanimljivo), `${n}: prazan tekst`);
    check(link(r.url), `${n}: neispravan link`);
    check(r.github === null || link(r.github), `${n}: neispravan GitHub link`);
  });

  const platforme = ['x', 'bluesky', 'reddit', 'hackernews', 'youtube', 'mastodon', 'github', 'producthunt', 'ostalo'];
  const mreze = d.mreze ?? { teme: [], snimci: [] };
  check(list(mreze.teme).length <= 6, `mreže: ${list(mreze.teme).length} tema (najviše 6)`);
  list(mreze.teme).forEach((t, i) => {
    const n = `tema ${i + 1}`;
    check(text(t.naslov) && text(t.oCemuSePrica) && text(t.glasovi), `${n}: prazan tekst`);
    check([1, 2, 3].includes(t.jacina), `${n}: jačina mora biti 1–3`);
    check(list(t.izvori).length > 0 && list(t.izvori).every((s) => platforme.includes(s.platforma) && text(s.naziv) && link(s.url)), `${n}: izvori nisu ispravni`);
  });
  check(list(mreze.snimci).length <= 6, `snimci: ${list(mreze.snimci).length} (najviše 6)`);
  list(mreze.snimci).forEach((v, i) => check(text(v.naslov) && text(v.kanal) && text(v.opis) && link(v.url), `snimak ${i + 1}: nije ispravan`));

  check(list(d.ideje).length === 5, `ideje: ${list(d.ideje).length} (treba tačno 5)`);
  list(d.ideje).forEach((x, i) => {
    const n = `ideja ${i + 1}`;
    check(text(x.naziv) && text(x.problem) && text(x.zaKoga) && text(x.ulogaAi) && text(x.inspiracija), `${n}: prazan tekst`);
    check([1, 2, 3, 4, 5].includes(x.tezina), `${n}: težina mora biti 1–5`);
    check(typeof x.vikendProjekat === 'boolean', `${n}: vikendProjekat mora biti da/ne`);
    check(list(x.prviKoraci).length > 0 && list(x.prviKoraci).every(text), `${n}: nema prvih koraka`);
  });

  return errors;
}
