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
 * ────────────────────────────────────────────────────────────────────────
 * PERCHE' UN DURABLE OBJECT E NON KV O R2, che sarebbero la scelta ovvia.
 *
 * Non è una preferenza tecnica: è l'unica forma di deposito che si accende
 * **dal repository**. Uno spazio KV e un bucket R2 sono risorse dell'account:
 * vanno creati a mano, restituiscono un id, e quell'id va incollato nella
 * configurazione — cioè almeno un passaggio nel pannello, per ogni volta che
 * si riparte da zero. Un Durable Object invece si dichiara qui sotto e lo crea
 * il deploy: chi clona questo repository e pubblica, ottiene un'app che salva,
 * senza toccare niente. (R2 in più chiede un metodo di pagamento anche nel
 * piano gratuito.)
 *
 * Il prezzo, per intero: tutte le richieste passano per una sola istanza, che
 * quindi le serve una alla volta. Per un deposito che riceve una scrittura a
 * fine sessione è irrilevante, e in cambio non esistono scritture concorrenti
 * che si sovrascrivono a metà. Se un giorno questo diventasse un servizio con
 * del traffico vero, la cosa da cambiare è questa riga, non il resto.
 * ────────────────────────────────────────────────────────────────────────
 *
 * COME SI E' RICONOSCIUTI, e i suoi limiti, detti subito.
 *
 * Non ci sono account: c'è un CODICE di quattro parole, generato dal server.
 * Il codice è la password. Chi ce l'ha legge e sovrascrive quel mazzo, e non
 * c'è modo di distinguerlo dal proprietario. Va bene per un'app personale, e
 * NON andrebbe bene per un servizio: se un giorno lo diventa, questo file va
 * riscritto attorno a un'identità vera, non allargato.
 *
 * Per CREARE un mazzo nuovo serve la parola d'ordine dello studio, di cui qui
 * dentro c'è solo l'IMPRONTA (vedi `PAROLA_HASH` in wrangler.jsonc). Anche
 * questo serve a non dover configurare niente a mano: un secret va messo
 * sull'account, un'impronta sta nel repository. Non è un segreto: è il
 * risultato di 200'000 giri di PBKDF2 sulla parola, che da lì non si torna
 * indietro se la parola è lunga — e quella generata lo è.
 *
 * Scrivere richiede un codice CHE ESISTE GIA'. Un codice non si può inventare:
 * o lo si è ricevuto dalla creazione, o non apre niente.
 */

/* Quattro parole da un elenco corto: si leggono al telefono e si scrivono a
 * mano senza sbagliare. Niente cifre, niente lettere che si confondono. */
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

/* Un mazzo completo di cinque lingue, compresso, sta molto sotto. Il tetto non
 * serve a chi studia: serve a impedire che il deposito diventi un posto dove
 * parcheggiare file. */
const MAX = 2 * 1024 * 1024;

/*
 * CENTOMILA E NON DUECENTOMILA: e' il tetto che Cloudflare mette a PBKDF2 nei
 * Worker. In locale non c'e', quindi la differenza si e' vista solo online —
 * l'API rispondeva 1101, cioe' l'eccezione generica, su qualunque richiesta.
 * Con otto parole sorteggiate (51 bit) centomila giri bastano largamente: la
 * lentezza serve contro le parole indovinabili, e questa non lo e'.
 */
const GIRI = 100000;

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

/**
 * L'impronta della parola d'ordine: PBKDF2, non un digest secco.
 *
 * L'impronta sta in un file versionato di un repository pubblico, quindi
 * chiunque può provare a indovinare la parola offline. Con uno SHA-256 diretto
 * un elenco di parole comuni si prova per intero in pochi secondi; con 100'000
 * giri ogni tentativo costa, e su una parola generata a caso il conto non
 * torna più a nessuno. Il sale è fisso perché il segreto è uno solo: qui il
 * sale non serve contro le tabelle precalcolate di un database rubato, serve
 * solo a legare l'impronta a questa app.
 */
async function impronta(parola) {
  const chiave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(parola), 'PBKDF2', false, ['deriveBits'],
  );
  const bit = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode('frasi/parola'), iterations: GIRI, hash: 'SHA-256' },
    chiave, 256,
  );
  return [...new Uint8Array(bit)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Confronto a tempo costante: con un === il tempo di risposta racconta quanto ci si è avvicinati. */
function pariPari(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
  }
  return diff === 0;
}

/**
 * Il deposito vero e proprio: una tabella, tre colonne.
 *
 * Sta in SQLite invece che nell'archivio chiave-valore dell'oggetto perché
 * quello ha un tetto di 128 kB per valore, e un mazzo di cinque lingue
 * compresso può superarlo. Una riga di tabella no.
 */
export class Mazzi {
  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS mazzi (codice TEXT PRIMARY KEY, aggiornato INTEGER NOT NULL, corpo TEXT NOT NULL)',
    );
  }

  esiste(codice) {
    return [...this.ctx.storage.sql.exec('SELECT 1 FROM mazzi WHERE codice = ?', codice)].length > 0;
  }

  leggi(codice) {
    const righe = [...this.ctx.storage.sql.exec('SELECT corpo FROM mazzi WHERE codice = ?', codice)];
    return righe.length ? righe[0].corpo : null;
  }

  scrivi(codice, aggiornato, corpo) {
    this.ctx.storage.sql.exec(
      'INSERT INTO mazzi (codice, aggiornato, corpo) VALUES (?, ?, ?) '
      + 'ON CONFLICT(codice) DO UPDATE SET aggiornato = excluded.aggiornato, corpo = excluded.corpo',
      codice, aggiornato, corpo,
    );
  }

  async fetch(request) {
    const url = new URL(request.url);
    const azione = url.searchParams.get('azione');
    const codice = url.searchParams.get('codice') || '';

    if (azione === 'crea') {
      /* Un codice già in uso si prenderebbe in silenzio il mazzo di qualcun
       * altro: si riprova finché non ne esce uno libero. */
      for (let tentativo = 0; tentativo < 6; tentativo++) {
        const nuovo = nuovoCodice();
        if (this.esiste(nuovo)) continue;
        this.scrivi(nuovo, 0, JSON.stringify({ v: 1, aggiornato: 0, stato: null }));
        return json({ codice: nuovo });
      }
      return json({ errore: 'non sono riuscito a trovare un codice libero' }, 500);
    }

    if (azione === 'leggi') {
      const corpo = this.leggi(codice);
      if (corpo === null) return json({ errore: 'codice sconosciuto' }, 404);
      return new Response(corpo, {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    if (azione === 'scrivi') {
      // Un codice si crea, non si inventa: senza questo chiunque scriverebbe dove vuole.
      if (!this.esiste(codice)) return json({ errore: 'codice sconosciuto' }, 404);
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
      this.scrivi(codice, corpo.aggiornato, testo);
      return json({ ok: true, aggiornato: corpo.aggiornato });
    }

    return json({ errore: 'azione sconosciuta' }, 400);
  }
}

/* Un'istanza sola per tutti: il deposito è piccolo e le scritture sono rare,
 * e così non esistono due scritture in volo sullo stesso mazzo. */
const deposito = (env) => env.MAZZI.get(env.MAZZI.idFromName('unico'));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      // Tutto ciò che non è l'API lo servono gli asset statici, non questo file.
      return new Response('non trovato', { status: 404 });
    }
    if (!env.MAZZI) {
      return json({ errore: 'il deposito non è collegato' }, 503);
    }

    if (url.pathname === '/api/mazzo' && request.method === 'POST') {
      if (!env.PAROLA_HASH) {
        return json({ errore: 'il deposito non è configurato: manca l’impronta della parola d’ordine' }, 503);
      }
      const corpo = await request.json().catch(() => ({}));
      if (typeof corpo.parola !== 'string' || corpo.parola.length > 200) {
        return json({ errore: 'parola d’ordine sbagliata' }, 403);
      }
      if (!pariPari(await impronta(corpo.parola), env.PAROLA_HASH)) {
        return json({ errore: 'parola d’ordine sbagliata' }, 403);
      }
      return deposito(env).fetch(new Request(`${url.origin}/?azione=crea`));
    }

    const trovato = url.pathname.match(/^\/api\/mazzo\/([a-z-]{4,64})$/);
    if (trovato && CODICE.test(trovato[1])) {
      const codice = encodeURIComponent(trovato[1]);
      if (request.method === 'GET') {
        return deposito(env).fetch(new Request(`${url.origin}/?azione=leggi&codice=${codice}`));
      }
      if (request.method === 'PUT') {
        return deposito(env).fetch(new Request(`${url.origin}/?azione=scrivi&codice=${codice}`, {
          method: 'POST',
          body: await request.text(),
        }));
      }
      return json({ errore: 'metodo non ammesso' }, 405);
    }

    return json({ errore: 'non trovato' }, 404);
  },
};
