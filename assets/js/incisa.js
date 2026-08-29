/*
 * incisa.js — la voce registrata una volta per tutte, con i tempi di ogni parola.
 *
 * PERCHE' NON SINTETIZZARE SUL MOMENTO. `speechSynthesis` legge con le voci
 * installate sul dispositivo, e cambiano da telefono a telefono: su iPhone il
 * russo ha una voce sola, la Milena compatta, e le versioni migliorate scaricate
 * dal sistema al browser non arrivano — regolare velocita' e tono non serve,
 * la voce e' quella. L'endpoint di Google Translate, che l'app usava per
 * rimediare, e' un servizio non documentato da raggiungere a ogni ascolto.
 *
 * Il corpus pero' e' un insieme CHIUSO di frasi corte: si incidono una volta
 * (`tools/voci.py`) e si servono come file. La voce diventa la stessa ovunque,
 * si sente senza rete, e mentre si studia non parte piu' nessuna richiesta
 * verso nessuno.
 *
 * LA PARTE CHE VALE DI PIU' NON SI SENTE: insieme all'audio il sintetizzatore
 * consegna l'attacco e la durata di OGNI PAROLA. Quindi l'ascolto guidato
 * illumina la parola giusta mentre suona davvero, e toccare una parola ne fa
 * risentire soltanto quella — dallo stesso file, quindi con la prosodia della
 * frase intera invece che di una parola pronunciata da sola. Prima erano tante
 * sintesi separate, una per parola: si sentiva.
 *
 * Quando i tempi mancano (il motore, su certe frasi, restituisce un segno solo
 * per tutta la frase) il campo resta `null` e chi chiama ripiega: l'audio c'e'
 * lo stesso, e' l'illuminazione che si spegne.
 */

const BASE = 'assets/audio';

/* Un indice per lingua, caricato una volta sola. `null` = non c'e' audio inciso
 * per quella lingua: e' il caso normale finche' `tools/voci.py` non ci gira. */
const indici = new Map();

export const supported = typeof Audio !== 'undefined';

/**
 * Carica l'indice dei tempi di una lingua. Non fallisce mai in modo rumoroso:
 * senza indice l'app usa la voce del dispositivo, come ha sempre fatto.
 */
export async function load(code) {
  if (indici.has(code)) return indici.get(code);
  const attesa = fetch(`${BASE}/${code}/tempi.json`)
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

/** C'è la voce incisa per questa frase? */
export function has(code, sid) {
  const idx = indice(code);
  return Boolean(idx && idx.frasi[sid]);
}

/** Gli attacchi delle parole, o null se il motore non li ha dati allineati. */
export function words(code, sid) {
  const idx = indice(code);
  return idx?.frasi[sid]?.p || null;
}

/** Il nome della voce con cui è stata incisa: si dichiara nelle impostazioni. */
export const voiceName = (code) => indice(code)?.voce || null;

export const src = (code, sid) => `${BASE}/${code}/${sid}.mp3`;

let corrente = null;
let fermata = null;

/** Ferma quello che sta suonando. */
export function stop() {
  if (fermata) { fermata(); fermata = null; }
  if (!corrente) return;
  try {
    corrente.pause();
    corrente.src = '';
  } catch { /* già chiuso */ }
  corrente = null;
}

/**
 * Suona una frase incisa, o solo il pezzo fra `from` e `to` (secondi).
 *
 * `rate` rallenta senza scendere di tono: `preservesPitch` è il difetto dei
 * browser moderni, e senza di lui il "lento" suonerebbe come un disco storto —
 * cioè come un'altra lingua.
 */
export function play(code, sid, { rate = 1, from = null, to = null, onTime = null } = {}) {
  return new Promise((resolve, reject) => {
    if (!supported) return reject(new Error('audio non disponibile'));
    stop();
    const audio = new Audio(src(code, sid));
    corrente = audio;
    audio.preload = 'auto';
    audio.playbackRate = Math.min(2, Math.max(0.5, rate));
    audio.preservesPitch = true;
    audio.mozPreservesPitch = true;
    audio.webkitPreservesPitch = true;

    let chiuso = false;
    let raf = null;
    let finestra = null;
    const finish = (ok, err) => {
      if (chiuso) return;
      chiuso = true;
      window.clearTimeout(guardia);
      window.clearTimeout(finestra);
      if (raf) window.cancelAnimationFrame(raf);
      if (corrente === audio) corrente = null;
      fermata = null;
      ok ? resolve() : reject(err || new Error('riproduzione fallita'));
    };
    fermata = () => finish(true);

    /*
     * Un segmento non ha un evento «finito»: bisogna guardare l'orologio, e
     * guardarlo spesso. `timeupdate` arriva 4 volte al secondo, mentre una
     * parola dura 175 millisecondi: fermandosi su quello si sente anche la
     * parola dopo, cioè si sbaglia proprio la cosa che il ritaglio serve a
     * fare. Con `requestAnimationFrame` il controllo è a ogni fotogramma, e
     * l'illuminazione dell'ascolto guidato smette di procedere a scatti.
     */
    const tick = () => {
      raf = window.requestAnimationFrame(tick);
      if (onTime) onTime(audio.currentTime);
      if (to !== null && audio.currentTime >= to) finish(true);
    };

    audio.addEventListener('playing', () => {
      if (raf === null) tick();
      /* rAF si ferma a scheda nascosta, l'audio no: senza questa rete un
       * segmento avviato e poi messo in secondo piano suonerebbe fino in
       * fondo. Il margine copre l'attacco della riproduzione. */
      if (to !== null) {
        const durata = ((to - Math.max(0, from ?? 0)) / audio.playbackRate) * 1000;
        finestra = window.setTimeout(() => finish(true), durata + 150);
      }
    });
    audio.addEventListener('ended', () => finish(true));
    audio.addEventListener('error', () => finish(false, new Error('file non caricato')));

    const avvia = () => {
      if (from !== null) audio.currentTime = from;
      audio.play().catch((err) => finish(false, err));
    };
    if (from !== null && audio.readyState < 1) {
      audio.addEventListener('loadedmetadata', avvia, { once: true });
    } else {
      avvia();
    }

    // Se il file non parte proprio, chi chiama deve poter ripiegare in fretta.
    const guardia = window.setTimeout(() => finish(false, new Error('troppo lenta')), 9000);
  });
}
