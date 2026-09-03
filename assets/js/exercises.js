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
 * Quindi si preferiscono, in ordine:
 *   1. le frasi con LO STESSO punto grammaticale — sono le coppie minime che
 *      il corpus contiene apposta (`wo` contro `wohin`, `ser` contro `estar`):
 *      per scartarle bisogna sapere la regola, che è esattamente ciò che si
 *      sta esercitando;
 *   2. le frasi dello stesso settore e livello vicino — stesso vocabolario,
 *      quindi la scorciatoia lessicale non funziona;
 *   3. il resto del livello vicino, come prima.
 *
 * È il richiamo sotto interferenza già rivendicato per l'esercizio Abbina,
 * portato dove finora non c'era.
 */
function confusables(lang, sentence, rnd, limit = 40) {
  const target = levelIndex(sentence.lv);
  const pool = lang.sentences.filter((s) => s.id !== sentence.id);

  const sameRule = pool.filter((s) => s.g === sentence.g);
  const taken = new Set(sameRule.map((s) => s.id));

  const near = pool.filter((s) => !taken.has(s.id) && Math.abs(levelIndex(s.lv) - target) <= 1);
  const sameDomain = near.filter((s) => s.dom.some((d) => sentence.dom.includes(d)));
  const domainIds = new Set(sameDomain.map((s) => s.id));
  const otherNear = near.filter((s) => !domainIds.has(s.id));

  const ranked = [
    ...shuffle(sameRule, rnd),
    ...shuffle(sameDomain, rnd),
    ...shuffle(otherNear, rnd),
  ];
  /* Se il corpus non basta — punto grammaticale con un esempio solo, livello
   * quasi vuoto — si allarga a tutto: meglio un distrattore facile che tre
   * opzioni invece di quattro. */
  if (ranked.length >= limit) return ranked.slice(0, limit);
  const rest = pool.filter((s) => !ranked.some((r) => r.id === s.id));
  return [...ranked, ...shuffle(rest, rnd)].slice(0, limit);
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
