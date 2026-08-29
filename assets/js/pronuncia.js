/*
 * pronuncia.js — la riga «come si legge», caricata a parte.
 *
 * Il russo la sua ce l'ha da sempre e se la calcola da solo: dal cirillico
 * accentato esce una traslitterazione, e senza quella la frase non si legge
 * proprio (`Ск*олько *это ст*оит?` → `skólko éto stóit?`).
 *
 * Le altre quattro lingue si scrivono già in caratteri latini, e proprio per
 * questo ingannano: un italiano legge `much` come «muk», `gusta` come
 * «giusta», `Ich möchte` come «ik moc-te». Lettere che conosce, suoni che non
 * sono i suoi. Per loro la riga non è una traslitterazione ma una RISCRITTURA
 * FONETICA, e non si può calcolare nel browser: l'inglese non ha regole, e il
 * tedesco ne avrebbe decine con altrettante eccezioni. La produce
 * `tools/pronuncia.py` da espeak-ng e arriva qui come dato, un file per lingua.
 *
 * Se il file non c'è, non succede niente: la riga semplicemente non compare.
 */

const BASE = 'assets/pronuncia';

const indici = new Map();

/** Carica le righe di una lingua. Senza file, l'app fa esattamente come prima. */
export async function load(code) {
  if (indici.has(code)) return indici.get(code);
  const attesa = fetch(`${BASE}/${code}.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && j.frasi ? j : null))
    .catch(() => null);
  indici.set(code, attesa);
  const esito = await attesa;
  indici.set(code, esito);
  return esito;
}

const indice = (code) => {
  const v = indici.get(code);
  return v && typeof v.then !== 'function' ? v : null;
};

/** La riga di questa frase, o null. */
export function get(code, sid) {
  return indice(code)?.frasi[sid] || null;
}

/** Da quale motore viene: si dichiara nelle impostazioni. */
export const engine = (code) => indice(code)?.motore || null;
