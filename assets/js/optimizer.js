/*
 * optimizer.js — tarare FSRS sui tuoi ripassi, invece che su quelli di tutti.
 *
 * I 19 pesi di default della versione 5 vengono da centinaia di milioni di
 * ripetizioni di altre persone: sono un ottimo punto di partenza e un pessimo
 * punto d'arrivo. Il senso dichiarato di FSRS (Ye et al., 2022-2024) è proprio
 * che quei pesi si rifanno sui dati di chi studia.
 *
 * Come si fa, in concreto:
 *
 *  1. si ricostruisce la storia di ogni carta dal registro dei ripassi;
 *  2. per una certa scelta di pesi si rigioca la storia in avanti, e per ogni
 *     ripasso si confronta la probabilità di ricordare che il modello aveva
 *     previsto con quello che è successo davvero;
 *  3. la misura è la log-loss (la stessa che si usa per valutare qualunque
 *     previsione probabilistica), affiancata dall'RMSE di calibrazione, che
 *     dice quanto le previsioni sono oneste e non solo ordinate bene;
 *  4. si scende a coordinate: un peso alla volta, si prova a spostarlo su e
 *     giù e si tiene lo spostamento che abbassa la log-loss. Poche passate
 *     bastano, e girano in un browser in meno di un secondo.
 *
 * Vale la pena dire cosa NON è: con poche centinaia di ripassi la stima è
 * rumorosa e i pesi ottenuti valgono poco più dei default. L'app lo dice
 * apertamente invece di far finta di niente.
 */

import { BOUNDS, DEFAULT_W, memoryStep, retrievability, intervalFor } from './fsrs.js';

const DAY = 86400000;

/** Sotto questa soglia l'ottimizzazione è rumore: si può fare, non conviene. */
export const MIN_REVIEWS = 120;
/** Sopra questa, i pesi cominciano a dire qualcosa di stabile. */
export const GOOD_REVIEWS = 400;

/**
 * Dal registro alle storie delle carte: una sequenza ordinata di
 * (voto, giorni dall'ultimo ripasso) per ogni carta di cui si conosce l'inizio.
 */
export function replay(log) {
  const byCard = new Map();
  for (const e of [...log].sort((a, b) => a.t - b.t)) {
    if (!byCard.has(e.id)) byCard.set(e.id, []);
    byCard.get(e.id).push(e);
  }
  const out = [];
  for (const entries of byCard.values()) {
    // senza il primo ripasso non si sa da dove parte la memoria: si scarta
    if (!entries[0].isNew) continue;
    const steps = entries.map((e, i) => ({
      grade: e.g,
      elapsed: i === 0 ? 0 : (e.t - entries[i - 1].t) / DAY,
    }));
    if (steps.length > 1) out.push(steps);
  }
  return out;
}

const EPS = 1e-6;
const clampP = (p) => Math.min(1 - EPS, Math.max(EPS, p));

/**
 * Rigioca tutte le storie con certi pesi e restituisce le previsioni.
 * Si valutano solo i ripassi a distanza di almeno un giorno: quelli dentro la
 * stessa sessione seguono un'altra formula e non dicono niente sull'oblio.
 *
 * Una storia può arrivare come semplice elenco di passi, oppure come
 * `{ steps, from }`: in quel caso la memoria si ricostruisce dall'inizio — non
 * si può fare altrimenti, lo stato dipende da tutto quello che è successo
 * prima — ma si CONTANO solo le previsioni dal passo `from` in poi. È il modo
 * di misurare dei pesi su ripassi che non hanno contribuito a produrli.
 */
export function predictions(sequences, w) {
  const rows = [];
  for (const seq of sequences) {
    const steps = Array.isArray(seq) ? seq : seq.steps;
    const from = Array.isArray(seq) ? 0 : (seq.from || 0);
    let state = null;
    steps.forEach((step, i) => {
      if (state && step.elapsed >= 1 && i >= from) {
        rows.push({ p: clampP(retrievability(step.elapsed, state.s)), hit: step.grade > 1 ? 1 : 0 });
      }
      state = memoryStep(w, state, step.grade, step.elapsed);
    });
  }
  return rows;
}

/**
 * Taglio nel tempo: la prima parte di ogni storia tara, il resto verifica.
 *
 * Il taglio è DENTRO ogni storia e non fra carte diverse: `replay()` scarta le
 * carte di cui non vede il primo ripasso, quindi mettere certe carte
 * interamente da un lato butterebbe via metà dei dati.
 *
 * Le storie troppo corte per essere divise restano nella taratura: servono a
 * stimare, non a giudicare.
 */
export function splitByTime(sequences, frac = 0.75) {
  const train = [];
  const test = [];
  for (const steps of sequences) {
    const cut = Math.max(2, Math.round(steps.length * frac));
    if (steps.length <= cut) {
      train.push(steps);
      continue;
    }
    train.push(steps.slice(0, cut));
    test.push({ steps, from: cut });
  }
  return { train, test };
}

/** Quanto le previsioni erano sbagliate: più basso, meglio. */
export function logLoss(rows) {
  if (!rows.length) return Infinity;
  let sum = 0;
  for (const { p, hit } of rows) sum -= hit ? Math.log(p) : Math.log(1 - p);
  return sum / rows.length;
}

/**
 * La stessa log-loss, con l'errore standard della media.
 *
 * Serve a non scambiare il rumore per un miglioramento: su duecento ripassi
 * due modelli distano quasi sempre meno di un errore standard, e allora la
 * differenza non c'è, per quanto il terzo decimale sembri dire di sì.
 */
export function logLossStats(rows) {
  const n = rows.length;
  if (!n) return { loss: Infinity, se: Infinity, n: 0 };
  const losses = rows.map(({ p, hit }) => (hit ? -Math.log(p) : -Math.log(1 - p)));
  const loss = losses.reduce((a, b) => a + b, 0) / n;
  const varianza = losses.reduce((a, x) => a + (x - loss) ** 2, 0) / Math.max(1, n - 1);
  return { loss, se: Math.sqrt(varianza / n), n };
}

/**
 * Curva di calibrazione: le previsioni raggruppate per fascia, con accanto
 * quello che è successo davvero. Una previsione dell'85% dovrebbe azzeccarci
 * l'85% delle volte: è questo che il grafico mostra.
 */
export function calibration(rows, bins = 10) {
  const out = Array.from({ length: bins }, (_, i) => ({
    from: i / bins,
    to: (i + 1) / bins,
    n: 0,
    predicted: 0,
    observed: 0,
  }));
  for (const { p, hit } of rows) {
    const b = Math.min(bins - 1, Math.floor(p * bins));
    out[b].n += 1;
    out[b].predicted += p;
    out[b].observed += hit;
  }
  for (const bin of out) {
    if (!bin.n) continue;
    bin.predicted /= bin.n;
    bin.observed /= bin.n;
  }
  return out.filter((b) => b.n > 0);
}

/** RMSE di calibrazione, pesato sul numero di ripassi in ogni fascia. */
export function calibrationRmse(rows, bins = 10) {
  const groups = calibration(rows, bins);
  const total = groups.reduce((a, b) => a + b.n, 0);
  if (!total) return null;
  let sum = 0;
  for (const g of groups) sum += g.n * (g.predicted - g.observed) ** 2;
  return Math.sqrt(sum / total);
}

/** Qualità complessiva di una scelta di pesi sui dati veri. */
export function score(sequences, w) {
  const rows = predictions(sequences, w);
  const { loss, se } = logLossStats(rows);
  return { n: rows.length, logLoss: loss, se, rmse: calibrationRmse(rows), rows };
}

/**
 * I pesi tarati valgono la pena?
 *
 * Fino al 05/09/2026 la risposta veniva da un confronto fatto sugli STESSI
 * ripassi usati per tarare, che è il modo classico di farsi dire di sì: su un
 * registro di poche centinaia di voci la discesa a coordinate trova sempre
 * qualcosa da limare, e quel qualcosa è quasi tutto rumore di questo mazzo.
 * Misurato su un registro sintetico da ~140 valutazioni: +0,0275 di guadagno
 * apparente dentro il campione, −0,0164 fuori. Il bottone si accendeva sulla
 * prima cifra.
 *
 * Adesso il confronto è fuori campione, e il metro non sono i pesi di prima ma
 * quelli DI SERIE: sono ottimizzati su centinaia di milioni di ripassi, e la
 * domanda giusta è se questa manciata di dati batta quelli, non se batta il
 * tentativo precedente. Deve vincere di più di un errore standard, e su
 * abbastanza ripassi di verifica: sotto, si tiene ciò che c'è.
 */
export const MIN_TEST_ROWS = 40;

export function verdict(test, candidate, baseline) {
  const mio = predictions(test, candidate);
  const serie = predictions(test, baseline);
  const perdita = ({ p, hit }) => (hit ? -Math.log(p) : -Math.log(1 - p));

  /*
   * Il confronto è APPAIATO: sugli stessi ripassi, riga per riga, quanto ha
   * perso l'uno meno quanto ha perso l'altro. Le due serie sono quasi
   * identiche — stesse carte, stessi giorni — quindi la variabilità della
   * DIFFERENZA è molto più piccola di quella di ciascuna delle due, e
   * confrontare le due medie con l'errore standard di una sola sarebbe un
   * cancello che non si apre mai: con 400 ripassi di verifica chiedeva un
   * guadagno di 0,038 di log-loss, cioè più di quanto separi FSRS-5 da
   * FSRS-6 sull'intero benchmark.
   */
  const n = Math.min(mio.length, serie.length);
  const diff = Array.from({ length: n }, (_, i) => perdita(serie[i]) - perdita(mio[i]));
  const media = n ? diff.reduce((a, b) => a + b, 0) / n : 0;
  const varianza = n > 1 ? diff.reduce((a, x) => a + (x - media) ** 2, 0) / (n - 1) : Infinity;
  const se = Math.sqrt(varianza / Math.max(1, n));

  return {
    n,
    testLoss: logLoss(mio),
    baseLoss: logLoss(serie),
    margine: media,
    se,
    enough: n >= MIN_TEST_ROWS,
    better: n >= MIN_TEST_ROWS && media > se,
  };
}

/**
 * Quali pesi si possono davvero stimare con questi dati.
 *
 * Un peso che governa una situazione mai capitata non viene stimato: viene
 * inventato. w15 vale solo per "Difficile" e w16 solo per "Facile" — e
 * "Facile" non esiste più fra i voti dati a mano, quindi su un registro nuovo
 * quel peso non ha un solo caso da cui imparare. Con pochi ripassi si
 * restringe ancora: si toccano solo i pesi della prima memoria e della
 * crescita, che sono quelli su cui i dati parlano per primi.
 */
export function identifiable(sequences, { rich = false } = {}) {
  const conta = new Map();
  for (const seq of sequences) {
    for (const step of (Array.isArray(seq) ? seq : seq.steps)) {
      conta.set(step.grade, (conta.get(step.grade) || 0) + 1);
    }
  }
  const base = rich
    ? [...Array(DEFAULT_W.length).keys()]
    : [0, 1, 2, 3, 8, 9, 10];
  return base.filter((i) => {
    if (i === 15) return (conta.get(2) || 0) >= 10;
    if (i === 16) return (conta.get(4) || 0) >= 10;
    return true;
  });
}

const clampTo = (x, [lo, hi]) => Math.min(hi, Math.max(lo, x));

/**
 * Discesa a coordinate: un peso alla volta, passi via via più piccoli.
 * Semplice di proposito — deve girare su un telefono senza librerie.
 */
export function optimize(sequences, { start = DEFAULT_W, passes = 4, onProgress, only = null } = {}) {
  let best = start.slice();
  let bestLoss = logLoss(predictions(sequences, best));
  const initial = bestLoss;
  const indici = only || [...Array(best.length).keys()];

  for (let pass = 0; pass < passes; pass++) {
    const scale = 0.35 / (pass + 1);
    for (const i of indici) {
      const [lo, hi] = BOUNDS[i];
      const span = Math.min(hi - lo, Math.abs(best[i]) + 0.1);
      for (const delta of [span * scale, -span * scale, span * scale * 0.3, -span * scale * 0.3]) {
        const candidate = best.slice();
        candidate[i] = clampTo(best[i] + delta, BOUNDS[i]);
        if (candidate[i] === best[i]) continue;
        const loss = logLoss(predictions(sequences, candidate));
        if (loss < bestLoss - 1e-9) {
          best = candidate;
          bestLoss = loss;
        }
      }
    }
    onProgress?.((pass + 1) / passes, bestLoss);
  }

  return { w: best, logLoss: bestLoss, improvement: initial - bestLoss, initialLogLoss: initial };
}

/* ------------------------- ritenzione conveniente ------------------------ */

/** Recuperabilità media lungo un intervallo: quanto la frase è "viva" nel frattempo. */
function averageR(stability, days) {
  if (days <= 0) return 1;
  const F = 19 / 81;
  return (2 * stability / (F * days)) * (Math.sqrt(1 + (F * days) / stability) - 1);
}

/** Secondi per ripasso quando non si hanno ancora misure proprie. */
export const DEFAULT_COST = { pass: 9, fail: 22 };

/**
 * Quanto costa e quanto rende una certa ritenzione richiesta.
 *
 * Si simula una popolazione di carte per un anno: a ogni scadenza il ripasso
 * va bene con probabilità pari alla ritenzione richiesta (è la definizione) e
 * male nel resto dei casi. Si sommano i secondi spesi e si misura quanto la
 * memoria è stata alta nel frattempo.
 *
 * Il punto sta nel costo: sbagliare non costa come indovinare. Una carta
 * sbagliata torna più volte nella stessa sessione e riparte da una stabilità
 * più bassa. Se si contassero i ripassi e basta, la risposta sarebbe sempre
 * "allunga gli intervalli"; contando i secondi, l'ottimo si sposta dentro
 * l'intervallo utile. I secondi si misurano sui tuoi ripassi, quando ce ne
 * sono abbastanza, altrimenti si usano quelli di partenza.
 *
 * Resta una simulazione, con le sue ipotesi: va letta come un'indicazione.
 */
export function workload(w, retention, { days = 365, cards = 120, seed = 7, cost = DEFAULT_COST } = {}) {
  let rnd = seed;
  const next = () => {
    rnd = (rnd * 1103515245 + 12345) % 2147483648;
    return rnd / 2147483648;
  };

  let reviews = 0;
  let seconds = 0;
  let knowledge = 0;
  for (let c = 0; c < cards; c++) {
    let state = memoryStep(w, null, 3, 0);
    reviews += 1;
    seconds += cost.pass;
    let t = 0;
    while (t < days) {
      const interval = Math.max(1, Math.round(intervalFor(state.s, retention)));
      const span = Math.min(interval, days - t);
      knowledge += averageR(state.s, span) * span;
      t += interval;
      if (t >= days) break;
      const grade = next() < retention ? 3 : 1;
      state = memoryStep(w, state, grade, interval);
      reviews += 1;
      seconds += grade === 1 ? cost.fail : cost.pass;
    }
  }
  const totalDays = cards * days;
  const memory = knowledge / totalDays;
  const minutes = seconds / cards / 60;
  return {
    retention,
    reviews: reviews / cards,
    minutes,
    knowledge: memory,
    perMinute: memory / minutes,
  };
}

/**
 * Il costo di ogni ritenzione richiesta, da 80% a 95%.
 *
 * Non c'è un numero "giusto" da consigliare, e chi lo consiglia sta nascondendo
 * delle ipotesi: quale sia il punto migliore dipende da quanto tempo hai e da
 * quanto ti serve ricordare adesso invece che fra un anno. Quello che si può
 * dire senza barare è quanto costa ogni scelta, ed è quello che questa curva
 * mostra: ripassi all'anno, minuti all'anno e memoria media, per carta.
 *
 * Le medie sono su più popolazioni simulate, altrimenti il rumore della
 * simulazione si vede più della differenza fra una ritenzione e l'altra.
 */
export function retentionCurve(w, options = {}) {
  const seeds = [7, 19, 41, 83];
  const out = [];
  for (let step = 80; step <= 95; step += 1) {
    const retention = step / 100;
    const runs = seeds.map((seed) => workload(w, retention, { cards: 300, ...options, seed }));
    const avg = (pick) => runs.reduce((a, r) => a + pick(r), 0) / runs.length;
    out.push({
      retention,
      reviews: avg((r) => r.reviews),
      minutes: avg((r) => r.minutes),
      knowledge: avg((r) => r.knowledge),
    });
  }
  return out;
}

/**
 * Secondi per ripasso misurati sul registro: quanto costa davvero indovinare
 * e quanto costa sbagliare. Le risposte lunghissime si scartano, perché quasi
 * sempre vuol dire che il telefono è finito in tasca.
 */
export function measuredCost(log, fallback = DEFAULT_COST) {
  const clean = log.filter((e) => e.ms > 500 && e.ms < 120000);
  const pass = clean.filter((e) => e.g > 1).map((e) => e.ms / 1000);
  const fail = clean.filter((e) => e.g === 1).map((e) => e.ms / 1000);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    pass: pass.length >= 20 ? mean(pass) : fallback.pass,
    fail: fail.length >= 10 ? mean(fail) : fallback.fail,
    measured: pass.length >= 20 && fail.length >= 10,
    samples: clean.length,
  };
}
