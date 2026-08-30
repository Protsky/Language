/*
 * sync.js — la copia dei progressi che non sta sul telefono.
 *
 * L'app resta offline-first e non cambia: mentre studi decide tutto il
 * telefono, e `localStorage` è la verità. Questo file serve a una cosa sola —
 * che quella verità non sia anche l'UNICA copia.
 *
 * `localStorage` è legato all'origine e al dispositivo: si svuota se il browser
 * fa pulizia, se cambi telefono, se apri un indirizzo diverso. Quello che l'app
 * accumula sono mesi di storia dei ripassi, cioè l'unica cosa qui dentro che
 * non si può rifare.
 *
 * QUANDO PARLA CON IL SERVER: all'apertura e a fine sessione. Mai durante lo
 * studio — una sincronizzazione a metà sessione potrebbe sostituire sotto i
 * piedi il mazzo su cui si sta rispondendo.
 *
 * COME SI RISOLVE UN DISACCORDO: vince la copia più recente, per intero. Non
 * si fondono i due mazzi carta per carta: sarebbe molto più codice, su un
 * modello di memoria, con l'errore che non si vedrebbe. Il prezzo è che
 * studiando dallo stesso codice su due dispositivi senza sincronizzare in
 * mezzo, l'ultimo che chiude vince e l'altra sessione si perde. L'app lo dice
 * quando succede, invece di far sparire il lavoro in silenzio.
 */

const CHIAVE_CODICE = 'frasi/codice';
const CHIAVE_ULTIMA = 'frasi/ultima-sync';

export const getCodice = () => {
  try { return localStorage.getItem(CHIAVE_CODICE) || null; } catch { return null; }
};

export const setCodice = (codice) => {
  try {
    if (codice) localStorage.setItem(CHIAVE_CODICE, codice);
    else localStorage.removeItem(CHIAVE_CODICE);
  } catch { /* navigazione privata: si continua senza ricordarlo */ }
};

/*
 * Il codice sta FUORI dallo stato sincronizzato, ed è voluto.
 *
 * Dentro, ripristinare il backup di un altro codice porterebbe con sé anche il
 * codice di quello: da lì in poi si scriverebbe sul mazzo di qualcun altro
 * senza accorgersene. Il codice appartiene al dispositivo, non al mazzo.
 */

export const ultimaSync = () => {
  const v = Number(localStorage.getItem(CHIAVE_ULTIMA) || 0);
  return Number.isFinite(v) ? v : 0;
};
const segnaSync = (quando) => {
  try { localStorage.setItem(CHIAVE_ULTIMA, String(quando)); } catch { /* pazienza */ }
};

/* ----------------------------- compressione ---------------------------- */

const comprimibile = typeof CompressionStream === 'function';

const daBytes = (b) => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};
const aBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/**
 * Un mazzo completo di cinque lingue è qualche megabyte di JSON, e a fine
 * sessione parte da un telefono, spesso in mobilità. Gzip lo porta a circa un
 * decimo; il base64 ne rimette un terzo, e il conto resta largamente a favore.
 */
async function comprimi(testo) {
  if (!comprimibile) return { compresso: false, stato: testo };
  const flusso = new Blob([testo]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(flusso).arrayBuffer());
  return { compresso: true, stato: daBytes(bytes) };
}

async function decomprimi(corpo) {
  if (!corpo.compresso) return corpo.stato;
  const flusso = new Blob([aBytes(corpo.stato)]).stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Response(flusso).text();
}

/* -------------------------------- rete --------------------------------- */

async function chiedi(url, opzioni = {}) {
  const risposta = await fetch(url, { cache: 'no-store', ...opzioni });
  const testo = await risposta.text();
  let corpo = null;
  try { corpo = JSON.parse(testo); } catch { /* il server ha risposto altro */ }
  if (!risposta.ok) {
    throw new Error(corpo?.errore || `il server ha risposto ${risposta.status}`);
  }
  return corpo;
}

/** Crea un mazzo nuovo sul server. Serve la parola d'ordine dello studio. */
export async function crea(parola) {
  const { codice } = await chiedi('api/mazzo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ parola }),
  });
  return codice;
}

/** Quello che c'è sul server: `{ aggiornato, stato }`, o null se è vuoto. */
export async function scarica(codice) {
  const corpo = await chiedi(`api/mazzo/${encodeURIComponent(codice)}`);
  if (!corpo || !corpo.stato) return null;
  return { aggiornato: corpo.aggiornato || 0, stato: await decomprimi(corpo) };
}

/** Manda lo stato al server e segna quando. */
export async function carica(codice, stato, aggiornato) {
  const { compresso, stato: corpo } = await comprimi(stato);
  await chiedi(`api/mazzo/${encodeURIComponent(codice)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ v: 1, aggiornato, compresso, stato: corpo }),
  });
  segnaSync(aggiornato);
}

/**
 * Riprendere da un codice NON è una sincronizzazione, ed è la distinzione che
 * salva i dati.
 *
 * Su un telefono nuovo si sceglie la lingua e magari si fa il test di livello
 * prima di arrivare qui: quei gesti scrivono, quindi la copia locale risulta
 * più recente di quella sul server. Una sincronizzazione normale, che dà
 * ragione alla più recente, manderebbe su il mazzo vuoto appena creato e
 * cancellerebbe mesi di ripassi — esattamente il contrario di quello che
 * stava chiedendo chi ha digitato il codice.
 *
 * Qui la direzione è una sola: si scarica e si adotta. Da lì in poi vale la
 * regola normale.
 */
export async function riprendi(codice, { importa }) {
  const remoto = await scarica(codice);
  if (!remoto) return { esito: 'vuoto' };
  importa(remoto.stato);
  segnaSync(remoto.aggiornato);
  return { esito: 'ricevuto', aggiornato: remoto.aggiornato };
}

/**
 * Il giro completo. Restituisce che cosa è successo, perché l'app lo dica:
 *
 *   'inviato'   il server era indietro, adesso ha la copia di qui
 *   'ricevuto'  il server era avanti, questo dispositivo ha adottato quella
 *   'pari'      erano già d'accordo
 *
 * Con `perso: true` quando adottare la copia del server ha buttato via lavoro
 * fatto qui e mai sincronizzato: è il caso che non va nascosto.
 */
export async function sincronizza(codice, { esporta, importa, aggiornatoLocale, quanteRisposte }) {
  const remoto = await scarica(codice);
  const locale = aggiornatoLocale();

  /*
   * UN MAZZO VUOTO NON SOVRASCRIVE MAI UN MAZZO PIENO, qualunque cosa dicano
   * le date.
   *
   * Confrontare solo i timestamp sembra sufficiente e non lo e': su un
   * dispositivo appena installato ogni gesto — scegliere la lingua, fare il
   * test — scrive, quindi la copia locale e' SEMPRE la piu' recente. Con la
   * sola regola dell'ultimo-vince, aprire l'app su un telefono nuovo che
   * conosce il codice cancella il backup con lo stato appena creato, che e'
   * la cosa peggiore che questo file possa fare.
   *
   * Una data si puo' avere piu' recente per caso. Zero risposte date non e'
   * un caso: e' un mazzo che non ha niente da salvare.
   */
  if (remoto && remoto.aggiornato > 0 && quanteRisposte() === 0) {
    importa(remoto.stato);
    segnaSync(remoto.aggiornato);
    return { esito: 'ricevuto', aggiornato: remoto.aggiornato, salvataggio: true };
  }

  if (!remoto || remoto.aggiornato < locale) {
    await carica(codice, esporta(), locale);
    return { esito: 'inviato', aggiornato: locale };
  }
  if (remoto.aggiornato > locale) {
    const perso = locale > ultimaSync();
    importa(remoto.stato);
    segnaSync(remoto.aggiornato);
    return { esito: 'ricevuto', aggiornato: remoto.aggiornato, perso };
  }
  segnaSync(locale);
  return { esito: 'pari', aggiornato: locale };
}
