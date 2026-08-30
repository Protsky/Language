/*
 * pubblica.mjs — prepara `dist/`, cioè ciò che di questo repo diventa pubblico.
 *
 *   node tools/pubblica.mjs
 *
 * PERCHE' ESISTE. Su Cloudflare Pages viene servita una cartella, e senza
 * questo passaggio la cartella sarebbe il repo intero: `tools/`, il README, la
 * ROADMAP, i .gitignore. Il repo è privato proprio perché non tutto quello che
 * c'è dentro è destinato a uscire, e «era nella cartella» è il modo abituale in
 * cui finisce online ciò che nessuno aveva deciso di pubblicare.
 *
 * E' la stessa regola che l'nginx dello studio applica rispondendo 404 su
 * `tools/`, sui .md e sui dotfile (ambiente/frasi/nginx.conf). Qui invece di
 * nascondere si copia: quello che non è elencato qui sotto non esiste proprio
 * nella cartella pubblicata, che è più difficile da sbagliare.
 *
 * L'ELENCO E' UNA LISTA DI COSE AMMESSE, non di cose vietate. Una lista di
 * divieti si dimentica di aggiornare, e il file nuovo passa; una lista di
 * permessi si dimentica allo stesso modo, ma il file nuovo NON passa e se ne
 * accorge subito chi lo cercava.
 */
import { cp, mkdir, rm, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RADICE, 'dist');

/** Ciò che è l'app. Tutto il resto resta nel repo. */
const AMMESSI = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'assets',
];

/*
 * Le intestazioni, che su Pages si dichiarano in un file e non in nginx.
 *
 *   sw.js NON si mette in cache. E' il file che decide quando l'app si
 *   aggiorna: servito da una copia vecchia, l'aggiornamento non arriva mai e
 *   l'avviso «c'è una versione nuova» non compare più.
 *
 *   L'audio dura una settimana. Sono 17 MB che non cambiano quasi mai, e
 *   riscaricarli a ogni visita si sente sul telefono. Non `immutable`: se una
 *   frase cambia, la sua incisione cambia sotto lo stesso indirizzo, e con
 *   `immutable` resterebbe quella vecchia finché non si svuota il browser.
 */
const HEADERS = `# Generato da tools/pubblica.mjs — non modificare a mano.

/sw.js
  Cache-Control: no-cache
  Service-Worker-Allowed: /

/assets/audio/*
  Cache-Control: public, max-age=604800

/assets/pronuncia/*
  Cache-Control: public, max-age=3600

/assets/*
  Cache-Control: public, max-age=3600
`;

async function conta(dir) {
  let file = 0;
  let peso = 0;
  for (const voce of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, voce.name);
    if (voce.isDirectory()) {
      const dentro = await conta(p);
      file += dentro.file;
      peso += dentro.peso;
    } else {
      file += 1;
      peso += (await stat(p)).size;
    }
  }
  return { file, peso };
}

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

for (const nome of AMMESSI) {
  const da = join(RADICE, nome);
  if (!existsSync(da)) {
    console.error(`manca ${nome}: non pubblico una cartella incompleta`);
    process.exit(1);
  }
  await cp(da, join(DIST, nome), { recursive: true });
}

await writeFile(join(DIST, '_headers'), HEADERS, 'utf8');

const { file, peso } = await conta(DIST);
console.log(`dist/ pronta: ${file} file, ${(peso / 1048576).toFixed(1)} MB`);
console.log(`fuori: ${['tools', 'README.md', 'ROADMAP.md', 'i dotfile'].join(', ')}`);
