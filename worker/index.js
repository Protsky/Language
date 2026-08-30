/*
 * worker/index.js — il pezzo di server che tiene i progressi.
 *
 * L'app resta quella di prima: funziona offline, decide tutto sul telefono, e
 * `localStorage` continua a essere la verità mentre si studia. Qui non c'è
 * nessuna logica di studio — non si calcolano intervalli, non si scelgono
 * frasi, non si vota niente. C'è un deposito.
 *
 * PERCHE' SERVE. `localStorage` è legato all'origine E al dispositivo: si
 * svuota se il browser fa pulizia, se si cambia telefono, se si sbaglia
 * indirizzo. Quello che l'app accumula — mesi di storia dei ripassi — è anche
 * l'unica cosa che non si può rifare. Qui se ne tiene una copia.
 *
 * COME SI E' RICONOSCIUTI, e i suoi limiti, detti subito.
 *
 * Non ci sono account: c'è un CODICE di quattro parole, generato dal server.
 * Il codice è la password. Chi ce l'ha legge e sovrascrive quel mazzo, e non
 * c'è modo di distinguerlo dal proprietario. Va bene per un'app personale, e
 * NON andrebbe bene per un servizio: se un giorno lo diventa, questo file va
 * riscritto attorno a un'identità vera, non allargato.
 *
 * Per CREARE un mazzo nuovo serve invece la parola d'ordine dello studio
 * (`PAROLA`, una variabile del Worker). Senza, l'endpoint di creazione non
 * risponde. E' quello che tiene chiuso il deposito: chi apre l'indirizzo senza
 * parola d'ordine usa l'app normalmente, con i dati sul suo telefono, e non
 * può riempire il bucket di nessuno.
 *
 * Scrivere richiede un codice CHE ESISTE GIA'. Un codice non si può inventare:
 * o lo si è ricevuto dalla creazione, o non apre niente.
 */

/* Quattro parole da un elenco corto: si leggono al telefono e si scrivono a
 * mano senza sbagliare. Niente l e 1, niente o e 0 — non ci sono cifre. */
const PAROLE = [
  'acqua', 'albero', 'ancora', 'aprile', 'arco', 'aria', 'barca', 'bosco',
  'calma', 'campo', 'carta', 'cielo', 'colle', 'corda', 'corsa', 'costa',
  'crema', 'cresta', 'dado', 'duomo', 'erba', 'faro', 'fiume', 'fondo',
  'forma', 'fuoco', 'gelo', 'ghiaccio', 'giro', 'grano', 'isola', 'lago',
  'lampo', 'legno', 'luce', 'luna', 'mare', 'marmo', 'monte', 'muro',
  'nave', 'nebbia', 'neve', 'nido', 'nodo', 'nube', 'onda', 'orma',
  'passo', 'pausa', 'pesca', 'pietra', 'pioggia', 'ponte', 'porta', 'prato',
  'quercia', 'radice', 'ramo', 'riva', 'roccia', 'rotta', 'sabbia', 'sale',
  'salto', 'scala', 'seme', 'sentiero', 'sera', 'sole', 'sonno', 'specchio',
  'stella', 'strada', 'terra', 'tetto', 'torre', 'traccia', 'valle', 'vela',
  'vento', 'vetta', 'viola', 'volo',
];

const CODICE = /^[a-z]+-[a-z]+-[a-z]+-[a-z]+$/;

/* Il mazzo completo di tutte le lingue, compresso, sta molto sotto. Il tetto
 * non serve a chi studia: serve a impedire che l'endpoint diventi un posto
 * dove parcheggiare file. */
const MAX = 8 * 1024 * 1024;

/*
 * IL PREFISSO, e perche' non e' un vezzo.
 *
 * Il deposito e' uno spazio chiave-valore che su questo account e' condiviso
 * con l'app degli scacchi, che usa `scacchi:`. Senza prefisso due app che
 * scelgono lo stesso codice si sovrascriverebbero i salvataggi a vicenda, e
 * il modo in cui se ne accorgerebbe qualcuno sarebbe un mazzo di frasi che
 * diventa una partita a scacchi.
 *
 * Costa una parola e permette a una persona di avere UN codice per tutte e due
 * le app, invece di uno per ciascuna.
 */
const chiave = (codice) => `frasi:${codice}`;

const json = (dati, stato = 200) =>
  new Response(JSON.stringify(dati), {
    status: stato,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/** Quattro parole prese dal generatore crittografico, non da Math.random. */
function nuovoCodice() {
  const n = new Uint32Array(4);
  crypto.getRandomValues(n);
  return [...n].map((x) => PAROLE[x % PAROLE.length]).join('-');
}

/*
 * Confronto a tempo costante sulla parola d'ordine.
 *
 * Con un `===` la risposta arriva prima quando il primo carattere è sbagliato,
 * e su abbastanza tentativi quella differenza si misura. Non è il rischio più
 * probabile per un'app personale, ma costa quattro righe.
 */
function pariPari(a, b) {
  const A = new TextEncoder().encode(a || '');
  const B = new TextEncoder().encode(b || '');
  let diff = A.length ^ B.length;
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    diff |= (A[i % A.length] || 0) ^ (B[i % B.length] || 0);
  }
  return diff === 0;
}

async function crea(request, env) {
  if (!env.PAROLA) {
    return json({ errore: 'il deposito non è configurato: manca la parola d’ordine' }, 503);
  }
  const corpo = await request.json().catch(() => ({}));
  if (!pariPari(corpo.parola, env.PAROLA)) {
    return json({ errore: 'parola d’ordine sbagliata' }, 403);
  }
  /* Un codice già in uso si scarterebbe in silenzio sovrascrivendo il mazzo di
   * qualcun altro: si riprova finché non ne esce uno libero. */
  for (let tentativo = 0; tentativo < 5; tentativo++) {
    const codice = nuovoCodice();
    if (await env.MAZZI.get(chiave(codice))) continue;
    await env.MAZZI.put(chiave(codice), JSON.stringify({ v: 1, aggiornato: 0, stato: null }));
    return json({ codice });
  }
  return json({ errore: 'non sono riuscito a trovare un codice libero' }, 500);
}

async function leggi(codice, env) {
  const testo = await env.MAZZI.get(chiave(codice));
  if (testo === null) return json({ errore: 'codice sconosciuto' }, 404);
  return new Response(testo, {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function scrivi(request, codice, env) {
  // Un codice si crea, non si inventa: senza questo, chiunque scriverebbe dove vuole.
  if ((await env.MAZZI.get(chiave(codice))) === null) return json({ errore: 'codice sconosciuto' }, 404);

  const testo = await request.text();
  if (testo.length > MAX) return json({ errore: 'troppo grande' }, 413);

  let corpo;
  try {
    corpo = JSON.parse(testo);
  } catch {
    return json({ errore: 'non è JSON' }, 400);
  }
  if (!corpo || typeof corpo.aggiornato !== 'number' || typeof corpo.stato !== 'string') {
    return json({ errore: 'manca aggiornato o stato' }, 400);
  }

  await env.MAZZI.put(chiave(codice), testo);
  return json({ ok: true, aggiornato: corpo.aggiornato });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      // Tutto ciò che non è l'API lo servono gli asset statici, non questo file.
      return new Response('non trovato', { status: 404 });
    }
    /*
     * Senza deposito l'app funziona lo stesso: i progressi restano sul
     * telefono, come hanno sempre fatto. Si risponde 503 dicendo perche',
     * invece di far fallire il deploy per un binding che non c'e' ancora: un
     * sito che non si pubblica e' peggio di un sito senza backup.
     */
    if (!env.MAZZI) {
      return json({ errore: 'il deposito non è collegato: manca lo spazio dei salvataggi' }, 503);
    }

    if (url.pathname === '/api/mazzo' && request.method === 'POST') {
      return crea(request, env);
    }

    const trovato = url.pathname.match(/^\/api\/mazzo\/([a-z-]{4,64})$/);
    if (trovato && CODICE.test(trovato[1])) {
      const codice = trovato[1];
      if (request.method === 'GET') return leggi(codice, env);
      if (request.method === 'PUT') return scrivi(request, codice, env);
      return json({ errore: 'metodo non ammesso' }, 405);
    }

    return json({ errore: 'non trovato' }, 404);
  },
};
