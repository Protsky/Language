/*
 * store.js — tutto lo stato dell'app in localStorage.
 *
 * Un mazzo per lingua: profilo (θ del test), carte, registro dei ripassi,
 * conteggi del giorno e serie di giorni consecutivi. Il registro serve alle
 * statistiche (ritenzione reale, carico futuro) ed è tenuto a un tetto per
 * non riempire lo spazio disponibile.
 */

const KEY = 'frasi/v1';
const LOG_MAX = 6000;

const DEFAULTS = {
  v: 1,
  lang: null,
  settings: {
    newPerDay: 8,
    maxReviews: 120,
    retention: 0.9,
    tts: true,
    ttsRate: 0.85,
    ttsPitch: 1,
    dailyGoal: 120,   // punti al giorno
    sounds: true,
    match: true,      // apre la sessione con un abbinamento a coppie
    criterion: 1,     // richiami corretti richiesti dentro la stessa sessione
    autoGrade: true,
    autoNext: true,   // se indovini, la carta successiva arriva da sola
    speechInput: true,
    voices: {},       // lingua -> voce scelta a mano fra quelle del dispositivo
    online: { ru: true },  // lingua -> voce online invece di quella del telefono
    direction: 'produce',   // 'produce' = dall'italiano alla lingua; 'understand' = il contrario
    domains: [],
  },
  decks: {},
};

const EMPTY_DECK = {
  profile: { theta: null, se: null, cefr: null, at: null, history: [] },
  /*
   * I pesi FSRS tarati su QUESTO mazzo, o null per quelli di serie.
   *
   * Stanno nel mazzo e non nelle impostazioni perché non sono una preferenza:
   * sono un modello adattato ai ripassi di una lingua. Difficoltà e stabilità
   * del russo — alfabeto diverso, niente parole trasparenti — non dicono niente
   * su quelle dello spagnolo. Fino al 29/08/2026 erano un'impostazione globale,
   * quindi tarare una lingua ritarava tutte le altre.
   */
  w: null,
  cards: {},
  log: [],
  daily: { day: null, introduced: 0, reviewed: 0, xp: 0, cleared: false },
  streak: { count: 0, last: null },
};

/** Chiave del giorno in ora locale: le giornate di studio non seguono UTC. */
export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/*
 * Lo stato letto una volta e tenuto in memoria.
 *
 * Ogni risposta passava per quattro `JSON.parse` dell'INTERO stato — scheduler,
 * salvataggio della carta, registro, impostazioni — su un registro che arriva a
 * quasi un megabyte. `localStorage` è sincrono: quel lavoro sta tutto sul filo
 * dell'interfaccia, e su un telefono di qualche anno fa si vede.
 *
 * La copia in memoria è la verità finché questa scheda è l'unica a scrivere;
 * se scrive un'altra scheda arriva l'evento `storage` e la copia si butta.
 */
let cache = null;

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (e) => { if (!e.key || e.key === KEY) cache = null; });
}

function read() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return (cache = structuredClone(DEFAULTS));
    const parsed = JSON.parse(raw);
    /*
     * MIGRAZIONE 29/08/2026 — i pesi FSRS erano un'impostazione globale, tarata
     * su un mazzo solo e applicata a tutti. Adesso stanno nel mazzo. Quelli
     * vecchi si buttano invece di regalarli a una lingua a caso: non c'è modo
     * di sapere su quale erano stati calcolati, e attribuirli sbagliando
     * sarebbe peggio che rifare la taratura, che dura due decimi di secondo.
     */
    if (parsed.settings && parsed.settings.w) delete parsed.settings.w;
    cache = {
      ...structuredClone(DEFAULTS),
      ...parsed,
      settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
      decks: parsed.decks || {},
    };
    return cache;
  } catch {
    return (cache = structuredClone(DEFAULTS));
  }
}

/*
 * Se una scrittura fallisce, l'app DEVE dirlo.
 *
 * Fino al 29/08/2026 qui c'era un catch vuoto con scritto «si continua senza
 * salvare»: con lo spazio esaurito o in navigazione privata si poteva studiare
 * per un'ora intera mentre non veniva registrato niente, e non se ne accorgeva
 * nessuno fino al giorno dopo. Un'app che tiene mesi di storia dei ripassi non
 * può perderli in silenzio: adesso l'errore resta segnato e le schermate lo
 * mostrano.
 */
let writeError = null;

export const storageError = () => writeError;
export const clearStorageError = () => { writeError = null; };

function write(state) {
  /*
   * QUANDO e' stato scritto l'ultima volta. Serve a una cosa sola: decidere
   * quale fra la copia di qui e quella del server e' la piu' recente. Senza un
   * numero che cambia a ogni scrittura, «piu' recente» non si puo' stabilire e
   * la sincronizzazione diventerebbe un tiro a indovinare.
   */
  state.aggiornato = Date.now();
  cache = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    writeError = null;
  } catch (err) {
    writeError = {
      at: Date.now(),
      quota: err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014),
      message: String((err && err.message) || err),
    };
  }
  return state;
}

/**
 * Chiede al browser di non sfrattare questi dati.
 *
 * Senza, `localStorage` è memoria «best effort»: Safari la cancella dopo
 * settimane di inattività sul sito, e con lei se ne va tutta la storia dei
 * ripassi — cioè l'unica cosa che questa app accumula. Va chiesto dopo un gesto
 * dell'utente, quindi si chiama all'avvio e di nuovo quando si comincia a
 * studiare: se il permesso c'è già, la seconda chiamata non costa niente.
 */
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

/** Quanto spazio si sta usando, per dirlo prima che finisca. */
export async function storageUsage() {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    if (!quota) return null;
    return { usage, quota, ratio: usage / quota };
  } catch {
    return null;
  }
}

/** Legge, lascia modificare, salva. Restituisce il valore ritornato da fn. */
export function update(fn) {
  const state = read();
  const out = fn(state);
  write(state);
  return out;
}

export const getState = () => structuredClone(read());

/** Quando e' stato toccato per l'ultima volta lo stato di questo dispositivo. */
export const aggiornatoLocale = () => read().aggiornato || 0;

/* Copia: chi legge le impostazioni non deve poter cambiare quelle di tutti. */
export const getSettings = () => structuredClone(read().settings);

export function setSetting(key, value) {
  return update((s) => {
    s.settings[key] = value;
    return s.settings;
  });
}

export const getLang = () => read().lang;

export function setLang(code) {
  return update((s) => {
    s.lang = code;
    if (!s.decks[code]) s.decks[code] = structuredClone(EMPTY_DECK);
    return code;
  });
}

function ensure(state, code) {
  if (!state.decks[code]) state.decks[code] = structuredClone(EMPTY_DECK);
  const deck = state.decks[code];
  deck.profile = { ...structuredClone(EMPTY_DECK.profile), ...(deck.profile || {}) };
  deck.cards = deck.cards || {};
  deck.log = deck.log || [];
  deck.daily = deck.daily || structuredClone(EMPTY_DECK.daily);
  deck.streak = deck.streak || structuredClone(EMPTY_DECK.streak);
  if (deck.w === undefined) deck.w = null;
  return deck;
}

export function getDeck(code = read().lang) {
  if (!code) return structuredClone(EMPTY_DECK);
  // ensure() lavora sulla copia appena letta: leggere non deve scrivere
  return structuredClone(ensure(read(), code));
}

export function withDeck(fn, code = read().lang) {
  return update((s) => fn(ensure(s, code), s));
}

/* ------------------------------ profilo ------------------------------ */

export function saveProfile(code, profile) {
  return withDeck((deck) => {
    deck.profile = {
      ...deck.profile,
      ...profile,
      at: Date.now(),
      history: [...(deck.profile.history || []), { at: Date.now(), theta: profile.theta, cefr: profile.cefr }].slice(-24),
    };
    return deck.profile;
  }, code);
}

/** I pesi FSRS di questo mazzo: null = quelli di serie. */
export function getW(code = read().lang) {
  return code ? (read().decks[code]?.w ?? null) : null;
}

export function setW(w, code = read().lang) {
  return withDeck((deck) => {
    deck.w = w;
    return w;
  }, code);
}

/* ------------------------------- carte ------------------------------- */

/**
 * Carta e registro nella STESSA scrittura.
 *
 * Erano due `update()` separati, cioè due serializzazioni complete dello stato
 * per ogni risposta; e fra l'una e l'altra c'era una finestra in cui la carta
 * era già avanzata e il ripasso non era ancora registrato. Una scrittura sola
 * chiude tutte e due le cose.
 */
export function recordReview(card, entry, code = read().lang) {
  return withDeck((deck) => {
    deck.cards[card.id] = card;
    deck.log.push(entry);
    if (deck.log.length > LOG_MAX) trimLog(deck);
    rollDay(deck, entry.t);
    deck.daily.reviewed += 1;
    deck.daily.xp = (deck.daily.xp || 0) + (entry.xp || 0);
    if (entry.isNew) deck.daily.introduced += 1;
    bumpStreak(deck, entry.t);
    return deck.daily;
  }, code);
}

/*
 * Il registro ha un tetto, e quello che si butta non è indifferente.
 *
 * Tagliare le voci più vecchie una per una sembra la cosa ovvia ed è la
 * peggiore: `optimizer.replay()` scarta ogni carta di cui non vede il PRIMO
 * ripasso, e il primo ripasso è esattamente quello che il taglio cronologico
 * porta via per prima. Così le carte più vecchie — le uniche con storie lunghe,
 * cioè le più informative — diventano inutilizzabili per sempre proprio quando
 * ce ne sono abbastanza per tarare il modello.
 *
 * Si buttano invece storie INTERE, dalla carta vista meno di recente in giù:
 * quello che resta resta completo e utilizzabile. Il prezzo dichiarato è che i
 * grafici per giorno perdono qualche ripasso sparso nei giorni vecchi invece
 * di avere un taglio netto: è il prezzo giusto, perché quei grafici raccontano
 * il passato mentre il registro serve a prevedere il futuro.
 */
function trimLog(deck) {
  const last = new Map();
  for (const e of deck.log) last.set(e.id, Math.max(last.get(e.id) || 0, e.t));
  const order = [...last.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
  const doomed = new Set();
  let left = deck.log.length;
  for (const id of order) {
    if (left <= LOG_MAX) break;
    doomed.add(id);
    left -= deck.log.filter((e) => e.id === id).length;
  }
  deck.log = deck.log.filter((e) => !doomed.has(e.id));
  /* Se una carta sola sfonda il tetto da sola non resta niente da buttare:
   * meglio un registro un po' sopra il tetto che un ciclo che non finisce. */
  if (deck.log.length > LOG_MAX) deck.log.splice(0, deck.log.length - LOG_MAX);
}

function rollDay(deck, ts) {
  const today = dayKey(ts);
  if (deck.daily.day !== today) deck.daily = { day: today, introduced: 0, reviewed: 0, xp: 0, cleared: false };
}

function bumpStreak(deck, ts) {
  const today = dayKey(ts);
  if (deck.streak.last === today) return;
  const yesterday = dayKey(ts - 86400000);
  deck.streak.count = deck.streak.last === yesterday ? deck.streak.count + 1 : 1;
  deck.streak.last = today;
}

/** Conteggi di oggi: se il giorno è cambiato ripartono da zero. */
export function today(code = read().lang) {
  const { daily } = getDeck(code);
  const key = dayKey();
  return daily.day === key
    ? { xp: 0, cleared: false, ...daily }
    : { day: key, introduced: 0, reviewed: 0, xp: 0, cleared: false };
}

/** Segna che oggi la coda è stata svuotata, e assegna il premio una sola volta. */
export function markCleared(bonus, code = read().lang) {
  return withDeck((deck) => {
    rollDay(deck, Date.now());
    if (deck.daily.cleared) return false;
    deck.daily.cleared = true;
    deck.daily.xp = (deck.daily.xp || 0) + bonus;
    return true;
  }, code);
}

export function streak(code = read().lang) {
  const deck = getDeck(code);
  if (!deck.streak.last) return 0;
  const t = dayKey();
  const y = dayKey(Date.now() - 86400000);
  return deck.streak.last === t || deck.streak.last === y ? deck.streak.count : 0;
}

/* ------------------------- esporta e importa ------------------------- */

export function exportJson() {
  return JSON.stringify({ ...read(), exportedAt: new Date().toISOString() }, null, 2);
}

export function importJson(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !parsed.decks) throw new Error('File non riconosciuto');
  cache = null;
  write({
    ...structuredClone(DEFAULTS),
    ...parsed,
    settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
  });
  return true;
}

export function resetDeck(code) {
  update((s) => {
    s.decks[code] = structuredClone(EMPTY_DECK);
  });
}

export function resetAll() {
  update((s) => {
    s.lang = null;
    s.decks = {};
  });
}
