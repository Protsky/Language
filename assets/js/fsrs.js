/*
 * fsrs.js — Free Spaced Repetition Scheduler (FSRS v5).
 *
 * Modello DSR (Difficulty / Stability / Retrievability) descritto in
 * Ye et al., "Optimizing Spaced Repetition Schedule by Capturing the
 * Dynamics of Memory" (2022) e nelle revisioni successive dell'algoritmo.
 *
 * Idee chiave:
 *   - la memoria decade secondo una legge di potenza, non esponenziale:
 *       R(t) = (1 + FACTOR * t / S) ^ DECAY
 *   - S (stabilità) è l'intervallo in giorni al quale la probabilità di
 *     ricordare vale 0.9; cresce di più quando si ripassa "sul filo",
 *     cioè quando R è già basso (spacing effect / desiderable difficulty);
 *   - D (difficoltà, 1..10) rallenta la crescita di S ed è soggetta a
 *     regressione verso la media, così un singolo errore non affossa la carta;
 *   - l'intervallo si sceglie invertendo la curva per la ritenzione voluta.
 *
 * Nessuna dipendenza: gira uguale nel browser e in node (per i test).
 */

/** Pesi di default di FSRS-5 (19 parametri, ottimizzati su ~700M ripetizioni). */
export const DEFAULT_W = [
  0.40255, 1.18385, 3.173, 15.69105,
  7.1949, 0.5345, 1.4604, 0.0046,
  1.54575, 0.1192, 1.01925, 1.9395,
  0.11, 0.29605, 2.2698, 0.2315,
  2.9898, 0.51655, 0.6621,
];

/** Esponente della curva di oblio (legge di potenza). */
export const DECAY = -0.5;
/** Costante che ancora la curva a R = 0.9 quando t = S. */
export const FACTOR = 19 / 81;

export const AGAIN = 1;
export const HARD = 2;
export const GOOD = 3;
export const EASY = 4;

export const GRADES = [AGAIN, HARD, GOOD, EASY];

/** Stati di una carta, come in Anki. */
export const NEW = 'new';
export const LEARNING = 'learning';
export const REVIEW = 'review';
export const RELEARNING = 'relearning';

const DAY = 86400000;
const S_MIN = 0.01;
const S_MAX = 36500;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** Probabilità di ricordare dopo `t` giorni con stabilità `s`. */
export function retrievability(t, s) {
  if (!(s > 0)) return 0;
  return Math.pow(1 + FACTOR * (Math.max(0, t) / s), DECAY);
}

/** Intervallo (in giorni, non arrotondato) che porta R al valore voluto. */
export function intervalFor(s, requestRetention) {
  const r = clamp(requestRetention, 0.7, 0.99);
  return (s / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);
}

/** Giorni trascorsi dall'ultimo ripasso. */
export function elapsedDays(card, now) {
  if (!card.last) return 0;
  return Math.max(0, (now - card.last) / DAY);
}

/** Carta nuova: nessuna traccia di memoria, scadenza immediata. */
export function newCard(id, extra = {}) {
  return {
    id,
    state: NEW,
    s: 0,          // stabilità in giorni
    d: 0,          // difficoltà 1..10
    due: 0,        // timestamp ms
    last: 0,       // timestamp ms dell'ultimo ripasso
    reps: 0,
    lapses: 0,
    ivl: 0,        // ultimo intervallo assegnato, in giorni
    ...extra,
  };
}

export function initStability(w, grade) {
  return clamp(w[grade - 1], S_MIN, S_MAX);
}

export function initDifficulty(w, grade) {
  return clamp(w[4] - Math.exp(w[5] * (grade - 1)) + 1, 1, 10);
}

function nextDifficulty(w, d, grade) {
  const delta = -w[6] * (grade - 3);
  // smorzamento lineare: più la carta è già difficile, meno si muove
  const damped = d + delta * ((10 - d) / 9);
  // regressione verso la difficoltà iniziale di una risposta "Facile"
  return clamp(w[7] * initDifficulty(w, EASY) + (1 - w[7]) * damped, 1, 10);
}

function stabilityAfterRecall(w, s, d, r, grade) {
  const hard = grade === HARD ? w[15] : 1;
  const easy = grade === EASY ? w[16] : 1;
  const inc = 1
    + Math.exp(w[8])
    * (11 - d)
    * Math.pow(s, -w[9])
    * (Math.exp(w[10] * (1 - r)) - 1)
    * hard
    * easy;
  return clamp(s * Math.max(1, inc), S_MIN, S_MAX);
}

/**
 * Dopo un errore.
 *
 * Il tetto non è `s`, è `s / e^(w17·w18)`: con i pesi di serie vuol dire che
 * dimenticare una carta le toglie almeno il 29% di stabilità. Con `min(sf, s)`
 * — come era scritto qui fino al 05/09/2026 — una carta molto stabile poteva
 * uscire da un "Di nuovo" con la stabilità intatta, perché la formula lunga
 * restituisce più di `s` proprio dove `s` è grande: l'errore non costava
 * niente e l'intervallo successivo ripartiva da dov'era. Il tetto corto è
 * quello di FSRS-6 (`_next_forget_stability`), e non chiede pesi nuovi.
 */
function stabilityAfterLapse(w, s, d, r) {
  const sf = w[11]
    * Math.pow(d, -w[12])
    * (Math.pow(s + 1, w[13]) - 1)
    * Math.exp(w[14] * (1 - r));
  return clamp(Math.min(sf, s / Math.exp(w[17] * w[18])), S_MIN, S_MAX);
}

/**
 * Ripasso nello stesso giorno: effetto piccolo, formula dedicata di FSRS-5.
 *
 * Il pavimento a 1 vale solo per "Bene" e "Facile" (è la regola di FSRS-6):
 * richiamare una carta non può ridurne la stabilità, qualunque cosa dicano i
 * pesi. Con quelli di serie il fattore è già 1,41 e 2,36, quindi non morde
 * mai; morde su una taratura personale che spingesse w17 o w18 verso lo zero.
 * "Difficile" resta sotto 1 (0,84) ed è voluto, in FSRS-6 come qui: una carta
 * che a dieci minuti fatica non è più solida di prima.
 */
function stabilityShortTerm(w, s, grade) {
  const inc = Math.exp(w[17] * (grade - 3 + w[18]));
  return clamp(s * (grade >= GOOD ? Math.max(inc, 1) : inc), S_MIN, S_MAX);
}

/**
 * Un passo del modello di memoria, senza scadenze né stato della carta.
 * È il cuore che serve anche all'ottimizzatore, che lo richiama migliaia di
 * volte con pesi diversi per vedere quali spiegano meglio i tuoi ripassi.
 *
 *   state: null per la prima volta, altrimenti { s, d }
 *   elapsed: giorni dall'ultimo ripasso
 */
export function memoryStep(w, state, grade, elapsed) {
  if (!state || !(state.s > 0)) {
    return { s: initStability(w, grade), d: initDifficulty(w, grade) };
  }
  const d = nextDifficulty(w, state.d, grade);
  if (elapsed < 1) return { s: stabilityShortTerm(w, state.s, grade), d };
  const r = retrievability(elapsed, state.s);
  const s = grade === AGAIN
    ? stabilityAfterLapse(w, state.s, state.d, r)
    : stabilityAfterRecall(w, state.s, state.d, r, grade);
  return { s, d };
}

/** Limiti dei 19 pesi: l'ottimizzatore non può uscire da qui. */
export const BOUNDS = [
  [0.01, 100], [0.01, 100], [0.01, 100], [0.01, 100],
  [1, 10], [0.001, 4], [0.001, 4], [0.001, 0.75],
  [0, 4.5], [0, 0.8], [0.001, 3.5], [0.001, 5],
  [0.001, 0.25], [0.001, 0.9], [0, 4], [0, 1],
  [1, 6], [0, 2], [0, 2],
];

/*
 * Rumore sugli intervalli, per non far arrivare tutto lo stesso giorno.
 *
 * Il ±5% di prima non spostava niente, ed è aritmetica: a cinque giorni la
 * finestra era ±0,25 giorni, e l'arrotondamento che viene dopo la richiudeva
 * su un solo giorno. Lo stesso a 3 e a 7. Il rumore c'era nel codice e non
 * nel calendario, e le carte introdotte insieme continuavano a tornare
 * insieme per sempre.
 *
 * Le fasce sono quelle di FSRS (py-fsrs `FUZZ_RANGES`), e la parte che conta
 * è la BASE 1: garantisce almeno un giorno di gioco da subito, prima ancora
 * che le percentuali diventino visibili. A cinque giorni si passa da un
 * giorno raggiungibile a tre, a venti da tre a sette.
 */
const FUZZ_BANDS = [[2.5, 7, 0.15], [7, 20, 0.1], [20, Infinity, 0.05]];

/** Estremi (interi, inclusi) fra cui può cadere un intervallo di `days` giorni. */
export function fuzzRange(days) {
  if (days < 2.5) return [Math.round(days), Math.round(days)];
  let delta = 1;
  for (const [from, to, factor] of FUZZ_BANDS) {
    delta += factor * Math.max(0, Math.min(days, to) - from);
  }
  const lo = Math.max(2, Math.round(days - delta));
  return [lo, Math.max(lo, Math.round(days + delta))];
}

/**
 * Dentro la finestra, il giorno meno carico.
 *
 * Il rumore serve a spargere le carte; sceglierlo a caso lo fa alla cieca,
 * mentre il calendario delle scadenze è già noto. È il load balancer che Anki
 * ha di serie: a parità di carico vince il giorno più vicino all'intervallo
 * che il modello aveva chiesto, così la scelta non si allontana mai dalla
 * ritenzione voluta più di quanto il fuzz già permettesse.
 *
 * `dueByDay(n)` = quante carte scadono già fra `n` giorni. Senza, si torna al
 * sorteggio: l'ottimizzatore e le prove non hanno un calendario da guardare.
 */
function pickDay(days, rnd, dueByDay) {
  const [lo, hi] = fuzzRange(days);
  if (hi <= lo) return lo;
  if (!dueByDay) return lo + Math.floor(rnd() * (hi - lo + 1));
  let best = lo;
  let bestLoad = Infinity;
  for (let d = lo; d <= hi; d++) {
    const load = dueByDay(d);
    if (load < bestLoad || (load === bestLoad && Math.abs(d - days) < Math.abs(best - days))) {
      best = d;
      bestLoad = load;
    }
  }
  return best;
}

export function createScheduler(options = {}) {
  const w = options.w && options.w.length === DEFAULT_W.length ? options.w.slice() : DEFAULT_W.slice();
  const requestRetention = clamp(options.requestRetention ?? 0.9, 0.7, 0.97);
  const maximumInterval = options.maximumInterval ?? 3650;
  // passi di apprendimento in minuti: la carta resta nella sessione
  const learningSteps = options.learningSteps ?? [1, 10];
  const relearningSteps = options.relearningSteps ?? [10];
  const rnd = options.random ?? Math.random;
  /* Il calendario delle scadenze, se chi ci chiama ce l'ha. */
  const dueByDay = typeof options.dueByDay === 'function' ? options.dueByDay : null;

  /** Stato della memoria dopo aver risposto `grade`, senza toccare le scadenze. */
  function nextMemory(card, grade, now) {
    const known = card.state !== NEW && card.s > 0;
    return memoryStep(w, known ? { s: card.s, d: card.d } : null, grade, elapsedDays(card, now));
  }

  /** Intervallo in giorni (arrotondato) suggerito da una stabilità. */
  function daysFor(s) {
    const raw = intervalFor(s, requestRetention);
    return clamp(pickDay(raw, rnd, dueByDay), 1, maximumInterval);
  }

  /**
   * Applica una risposta e restituisce la carta aggiornata.
   * `grade`: 1 Di nuovo, 2 Difficile, 3 Bene, 4 Facile.
   */
  function review(card, grade, now = Date.now()) {
    const mem = nextMemory(card, grade, now);
    const wasNew = card.state === NEW;
    const learning = card.state === NEW || card.state === LEARNING || card.state === RELEARNING;
    const steps = card.state === RELEARNING ? relearningSteps : learningSteps;

    let state = REVIEW;
    let due;
    let ivl = 0;
    let step = card.step ?? 0;

    if (grade === AGAIN) {
      state = wasNew || card.state === LEARNING ? LEARNING : RELEARNING;
      step = 0;
      due = now + (card.state === RELEARNING ? relearningSteps[0] : learningSteps[0]) * 60000;
    } else if (learning && grade !== EASY && step + 1 < steps.length) {
      // ancora un passo breve dentro la sessione
      state = card.state === RELEARNING ? RELEARNING : LEARNING;
      step += 1;
      due = now + steps[step] * 60000;
    } else {
      state = REVIEW;
      step = 0;
      ivl = daysFor(mem.s);
      due = now + ivl * DAY;
    }

    return {
      ...card,
      state,
      step,
      s: mem.s,
      d: mem.d,
      due,
      last: now,
      ivl,
      reps: card.reps + 1,
      lapses: card.lapses + (grade === AGAIN && card.state === REVIEW ? 1 : 0),
    };
  }

  /** Etichette degli intervalli per i quattro bottoni, senza modificare la carta. */
  function preview(card, now = Date.now()) {
    const out = {};
    for (const g of GRADES) {
      const next = review({ ...card }, g, now);
      out[g] = next.state === REVIEW ? { days: next.ivl } : { minutes: Math.round((next.due - now) / 60000) };
    }
    return out;
  }

  /** R attuale della carta: quanto è probabile che se la ricordi adesso. */
  function currentRetrievability(card, now = Date.now()) {
    if (card.state === NEW || !(card.s > 0)) return 0;
    return retrievability(elapsedDays(card, now), card.s);
  }

  return { review, preview, nextMemory, daysFor, currentRetrievability, w, requestRetention };
}
