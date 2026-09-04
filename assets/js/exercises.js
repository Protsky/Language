/*
 * exercises.js — costruisce l'esercizio di ogni carta.
 *
 * Regola che tiene insieme tutto il file: nessun esercizio può essere
 * corretto da chi studia. Se la risposta non è verificabile dalla macchina,
 * l'esercizio non va bene.
 *
 * Il motivo è documentato: dopo aver visto la soluzione, riconoscerla viene
 * scambiato per ricordarla (Koriat & Bjork 2005, "illusion of competence"),
 * e chi si autocorregge si dà ragione più spesso di quanto dovrebbe
 * (Dunlosky & Rawson 2012). Il voto che arriva a FSRS deve essere un dato,
 * non un'opinione.
 *
 * La scala dei quattro passaggi va dal riconoscere al produrre, che è
 * l'ordine in cui si impara davvero (Nation 2001), e ogni gradino chiede di
 * generare qualcosa in più del precedente (effetto generazione: Slamecka &
 * Graf 1978). I buchi del cloze aumentano man mano che la frase si consolida:
 * è il fading dell'impalcatura di Renkl & Atkinson (2003), l'aiuto si ritira
 * mentre la memoria regge da sola.
 */

import { levelIndex } from './corpus.js';

/* ------------------------- casualità ripetibile ------------------------- */

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Generatore deterministico: la stessa carta dà sempre lo stesso esercizio. */
export function seeded(seed) {
  let a = typeof seed === 'string' ? hash(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, rnd) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const pickSome = (pool, n, rnd) => shuffle(pool, rnd).slice(0, n);

/* --------------------------- parole di contenuto ------------------------- */

/*
 * Le parole che portano il significato, senza quelle che ci sono in ogni
 * frase. L'elenco è italiano perché serve sul lato che chi studia legge di
 * sicuro; per la lingua straniera basta la lunghezza, che taglia via articoli
 * e preposizioni in tutte e cinque senza doverne scrivere l'elenco.
 */
const VUOTE = new Set(('il lo la i gli le un uno una di a da in con su per tra fra e o ma che non mi ti si ci vi ne '
  + 'è sono ho hai ha abbiamo avete hanno del della dei delle al alla ai alle dal dalla nel nella sul sulla '
  + 'come cosa dove quando se lei lui io tu noi voi loro questo questa quello quella qui qua lì là').split(' '));

const parole = (text, stop) => new Set(
  text.toLowerCase().replace(/[^\p{L}\s']/gu, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !(stop && stop.has(w))));

/* Le parole di ogni frase si calcolano una volta sola: `confusables` gira su
 * tutto il corpus a ogni carta, e rifarlo ogni volta si sentirebbe. */
const cacheParole = new Map();
function vocabolario(s) {
  let row = cacheParole.get(s.id);
  if (!row) {
    row = { it: parole(s.it, VUOTE), text: parole(s.text, null) };
    cacheParole.set(s.id, row);
  }
  return row;
}

/** Quanto due insiemi di parole si somigliano (Jaccard, 0 = niente in comune). */
function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/**
 * Da dove vengono i distrattori, e perché non basta «frasi di livello vicino».
 *
 * Con tre opzioni pescate a caso fra frasi dello stesso livello, la risposta
 * giusta si trova riconoscendo una parola piena — «caffè» sta in una sola
 * delle quattro — senza sapere niente della regola che la frase insegna. Il
 * gradino diventa gratis, e il voto che ne esce dice a FSRS che la carta è
 * solida quando non lo è: è la stessa illusione di competenza contro cui è
 * costruito tutto il resto dell'app, entrata dalla porta di servizio.
 *
 * Fino al 04/09/2026 qui si preferivano le frasi con lo STESSO punto
 * grammaticale, e si dava per scontato che bastasse. Misurato sul corpus, non
 * bastava per niente: il punto grammaticale era lo stesso nel 94% dei casi, ma
 * nel 94% dei casi le due frasi non avevano NEMMENO UNA parola di contenuto in
 * comune. «Stessa regola» e «stesse parole» sono due cose diverse, e la
 * scorciatoia che si voleva chiudere passa dalle parole: se le altre tre
 * opzioni parlano di treni e la tua di caffè, riconoscere «Kaffee» basta e
 * avanza.
 *
 * Adesso i due criteri pesano insieme, e il vocabolario pesa di più:
 *   - stesso punto grammaticale (+1): la coppia minima resta la cosa migliore
 *     quando c'è (`wo` contro `wohin`, `ser` contro `estar`);
 *   - parole in comune (fino a +4, contate su ENTRAMBI i lati): è ciò che
 *     toglie la scorciatoia, in tutte e due le direzioni dell'esercizio;
 *   - stesso settore (+0.3) e livello vicino (-0.15 per gradino di distanza).
 *
 * Le tre opzioni escono sorteggiate fra le prime CINQUE e non prese in cima,
 * altrimenti una carta riproporrebbe per sempre le stesse tre. Costa qualche
 * punto di vicinanza e in cambio la domanda non si impara a memoria come
 * figura.
 *
 * Misurato sui cinque corpus, prima e dopo: distrattori senza NEMMENO UNA
 * parola in comune con la risposta giusta — né in italiano né nella lingua —
 * dal 71% al 34%; guardando il solo lato italiano, quello che chi comincia
 * legge di sicuro, dal 93% al 72%. Il punto grammaticale si perde in cambio
 * (dal 93% al 65%): è il baratto voluto, perché la regola condivisa non
 * chiudeva la scorciatoia e il vocabolario condiviso sì.
 */
const REGOLA = 1;      // peso dello stesso punto grammaticale
const LESSICO = 4;     // peso delle parole in comune
const SORTEGGIO = 5;   // fra quanti si sorteggiano le tre opzioni

function confusables(lang, sentence, rnd, limit = 40) {
  const target = levelIndex(sentence.lv);
  const mine = vocabolario(sentence);

  const scored = [];
  for (const s of lang.sentences) {
    if (s.id === sentence.id) continue;
    const his = vocabolario(s);
    const vicino = overlap(mine.it, his.it) + overlap(mine.text, his.text);
    scored.push({
      s,
      score: (s.g === sentence.g ? REGOLA : 0)
        + LESSICO * vicino
        + (s.dom.some((d) => sentence.dom.includes(d)) ? 0.3 : 0)
        - 0.15 * Math.abs(levelIndex(s.lv) - target),
    });
  }
  scored.sort((a, b) => b.score - a.score);
  const rows = scored.slice(0, limit).map((x) => x.s);
  /* I migliori mescolati davanti, il resto in ordine dietro: se le prime
   * scelte danno opzioni ripetute o parole inservibili, chi chiama continua a
   * scendere per qualità. */
  return [...shuffle(rows.slice(0, SORTEGGIO), rnd), ...rows.slice(SORTEGGIO)];
}

/* ------------------------ 1. riconosci il senso ------------------------- */

/**
 * Quattro possibilità, una giusta. Sostituisce il vecchio "mostra e dimmi se
 * l'avevi indovinata": qui la risposta è un dato.
 *
 * Il verso conta. Chi punta a capire vede la frase e sceglie fra quattro
 * traduzioni; chi punta a parlare vede l'italiano e sceglie fra quattro frasi
 * nella lingua che studia — stesso esercizio, ma nella direzione in cui poi
 * dovrà usarla.
 *
 * Le tre opzioni sbagliate vengono da `confusables()`: prima le frasi con lo
 * stesso punto grammaticale, non tre frasi qualsiasi del livello.
 */
export function buildChoice(sentence, lang, seed, direction = 'understand') {
  const rnd = seeded(`${seed}|choice`);
  const pick = direction === 'produce' ? (s) => s.text : (s) => s.it;
  const answer = pick(sentence);
  const used = new Set([answer]);
  const wrong = [];
  for (const s of confusables(lang, sentence, rnd, 40)) {
    if (wrong.length === 3) break;
    const option = pick(s);
    if (used.has(option)) continue;
    used.add(option);
    wrong.push(option);
  }
  const options = shuffle([answer, ...wrong], rnd);
  return { options, correct: options.indexOf(answer), reversed: direction === 'produce' };
}

/* --------------------------- 2. componi ---------------------------------- */

const words = (text) => text.split(/\s+/).filter(Boolean);

/**
 * Tessere da rimettere in fila, più due parole di troppo. Sull'ordine delle
 * parole si gioca metà del tedesco, e toccare le tessere non richiede la
 * tastiera: meno carico estraneo, più attenzione alla struttura.
 *
 * Anche qui le due parole di troppo contano. Prese da una frase qualsiasi si
 * riconoscono a vista e si scartano senza leggere niente; prese da una frase
 * sullo STESSO punto grammaticale sono quasi sempre l'altra forma della stessa
 * cosa — l'articolo nel caso sbagliato, l'ausiliare che non va, la
 * preposizione gemella — e per scartarle bisogna sapere la regola.
 */
export function buildTiles(sentence, lang, seed) {
  const rnd = seeded(`${seed}|tiles`);
  const answer = words(sentence.text);
  const own = new Set(answer.map((w) => w.toLowerCase()));
  const extras = [];
  for (const s of confusables(lang, sentence, rnd, 40)) {
    if (extras.length === 2) break;
    /* Dentro una frase confondibile si preferisce la parola più corta: sono le
     * parole grammaticali — articoli, preposizioni, ausiliari — e sono quelle
     * che si possono davvero scambiare con una della frase. Una parola piena
     * lunga e di un altro argomento tornerebbe a essere gratis da scartare. */
    const candidate = words(s.text)
      .filter((w) => w.length > 1 && !own.has(w.toLowerCase()))
      .sort((a, b) => a.length - b.length)[0];
    if (!candidate) continue;
    own.add(candidate.toLowerCase());
    extras.push(candidate);
  }
  return { answer, tiles: shuffle([...answer, ...extras], rnd), extras: extras.length };
}

/* ------------------------ 3. completa i buchi ---------------------------- */

/** Quanti buchi merita questa carta: uno all'inizio, fino a metà frase poi. */
export function blankCount(total, stability = 0, reps = 0) {
  if (reps < 1 || stability < 3) return 1;
  if (stability < 15) return Math.min(2, total);
  if (stability < 45) return Math.max(2, Math.round(total * 0.35));
  return Math.max(3, Math.round(total * 0.5));
}

/**
 * Il primo buco cade sempre sulla chiave grammaticale. Gli altri vanno dove
 * servono davvero: prima sulle parole che TU hai già sbagliato su questa carta
 * (la carta se le ricorda), poi sulle parole piene, dalla più lunga alla più
 * corta, così restano in piedi gli articoli e la frase resta leggibile.
 *
 * Mettere la difficoltà dove l'errore è già avvenuto è il modo più diretto di
 * applicare il principio delle difficoltà desiderabili: non serve rendere
 * difficile tutto, serve rendere difficile il punto che cede.
 */
export function buildCloze(sentence, card, seed) {
  const all = words(sentence.text);
  const keyWords = words(sentence.key);
  const start = all.findIndex((_, i) =>
    keyWords.every((k, j) => (all[i + j] || '').includes(k) || k.includes(all[i + j] || '')));
  const keyIdx = start >= 0
    ? keyWords.map((_, j) => start + j)
    : [all.findIndex((w) => w.includes(keyWords[0])) || 0];

  const hidden = new Set(keyIdx.filter((i) => i >= 0));
  const wanted = blankCount(all.length, card.s, card.reps);
  const missed = card.miss || {};
  const rest = all
    .map((w, i) => ({ w, i, missed: missed[w] || 0 }))
    .filter(({ i }) => !hidden.has(i))
    .sort((a, b) => b.missed - a.missed || b.w.length - a.w.length || a.i - b.i);
  for (const { i } of rest) {
    if (hidden.size >= wanted + keyIdx.length - 1) break;
    hidden.add(i);
  }

  // parti in ordine, con i buchi contigui raggruppati in uno solo
  const parts = [];
  let run = null;
  all.forEach((w, i) => {
    if (hidden.has(i)) {
      if (!run) { run = { blank: true, answer: [w] }; parts.push(run); }
      else run.answer.push(w);
    } else {
      run = null;
      parts.push({ blank: false, text: w });
    }
  });
  parts.forEach((p) => { if (p.blank) p.answer = p.answer.join(' '); });

  return {
    parts,
    blanks: parts.filter((p) => p.blank).length,
    hidden: hidden.size,
    total: all.length,
  };
}

/* --------------------------- test di livello ----------------------------- */

/**
 * Nei corpus la risposta giusta è scritta quasi sempre per prima: è l'ordine
 * comodo per chi aggiunge item, e i dati restano così. Ma servita nell'ordine
 * del file faceva del test un quiz dove il primo bottone vince — su russo e
 * svizzero tedesco vinceva sempre, e la stima θ premiava chi tocca in alto.
 * Le opzioni si mescolano qui, all'uscita verso lo schermo: stesso generatore
 * seminato degli altri esercizi, così l'ordine è stabile dentro la domanda
 * (un ridisegno non rimescola sotto il dito) ma cambia da un esame all'altro.
 */
export function buildExam(item, seed) {
  const options = shuffle(item.options, seeded(`${seed}|exam`));
  return { ...item, options, correct: options.indexOf(item.options[item.correct]) };
}

/* --------------------------- voto automatico ----------------------------- */

/**
 * Dal risultato oggettivo al voto di FSRS. Nessuna via di mezzo:
 *   tutto giusto        → Bene
 *   parole giuste, forma sbagliata → Difficile
 *   manca qualcosa      → Di nuovo
 * "Facile" resta un'aggiunta manuale: nessuna macchina può sapere che una
 * risposta ti è venuta senza pensarci.
 */
export function autoGrade(result) {
  if (result.correct) return 3;
  if (result.score >= 0.999 && !result.extra) return 2;
  return 1;
}
