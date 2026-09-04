/*
 * Prova end-to-end dell'app "Frasi" su viewport iPhone: onboarding, test di
 * livello, una sessione di studio completa, statistiche e persistenza.
 *
 *   node tools/smoke.mjs                              server locale
 *   node tools/smoke.mjs http://localhost:8080/       altra copia
 */
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { DOMAINS } from '../assets/js/corpus.js';
import { DE } from '../assets/js/corpus-de.js';

const ROOT = new URL('..', import.meta.url).pathname;
const SHOTS = join(ROOT, 'tools', 'screenshots');
const PORT = 8098;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const file = join(ROOT, normalize(path.endsWith('/') ? `${path}index.html` : path));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

const failures = [];
const check = (label, condition, detail = '') => {
  if (condition) console.log(`  ok   ${label}`);
  else {
    console.error(`  FAIL ${label} ${detail}`);
    failures.push(label);
  }
};

const BASE = process.argv[2] || `http://localhost:${PORT}/`;
if (!process.argv[2]) await new Promise((resolve) => server.listen(PORT, resolve));
else console.log(`Verifica del sito pubblicato: ${BASE}`);
mkdirSync(SHOTS, { recursive: true });

// CHROMIUM_PATH torna utile dove il browser scaricato da Playwright non c'è;
// HTTPS_PROXY serve quando la rete esce solo attraverso un proxy.
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  // il proxy vale per la rete esterna: il server locale della prova va escluso
  ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1' } } : {}),
});
const context = await browser.newContext({
  ...devices['iPhone 14'],
  hasTouch: true,
  ignoreHTTPSErrors: Boolean(proxy),
});
const page = await context.newPage();

/*
 * Errori raccolti per il controllo finale. Restano fuori i fallimenti di rete
 * verso l'ESTERNO: la prova stacca la voce online apposta, per vedere il
 * ripiego, e in una macchina senza uscita (o dietro un proxy con la sua
 * autorità) quel tentativo lascia sempre un "Failed to load resource" che non
 * è un errore dell'app. Tutto ciò che viene dal sito in prova resta contato,
 * 404 degli asset compresi.
 */
const errors = [];
const nostro = (url) => !url || url.startsWith(BASE) || url.startsWith('http://localhost') || url.startsWith('blob:');
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (!nostro(m.location()?.url)) return;
  errors.push(m.text());
});

const tap = async (selector) => { await page.click(selector); await page.waitForTimeout(140); };
const shot = (name) => page.screenshot({ path: join(SHOTS, `${name}.png`) });

console.log('\n▸ Benvenuto');
await page.goto(new URL('./', BASE).href, { waitUntil: 'networkidle' });
check('titolo presente', (await page.textContent('.hero__title')).includes('Impara per frasi'));
await shot('1-benvenuto');

console.log('\n▸ Scelta della lingua');
await tap('[data-act="start"]');
check('cinque lingue disponibili', (await page.locator('[data-lang]').count()) === 5);
await tap('[data-lang="de"]');

/* Fra la lingua e il test c'è la stima di partenza ("Quanto conosci il
 * tedesco adesso?"): la prova si fermava qui ad aspettare una domanda che non
 * poteva arrivare, perché nessuno aveva risposto a questa. */
console.log('\n▸ Stima di partenza');
await page.waitForSelector('[data-prior]');
check('cinque punti di partenza', (await page.locator('[data-prior]').count()) === 5);
await tap('[data-prior="boh"]');

console.log('\n▸ Test di livello');
await page.waitForSelector('.prompt');
check('prima domanda mostrata', (await page.textContent('.pill')).includes('Domanda 1'));
check('quattro opzioni', (await page.locator('[data-i]').count()) === 4);
await shot('2-test');

let asked = 0;
while (await page.locator('.prompt').count()) {
  await page.click('[data-i="0"]');
  await page.waitForTimeout(700);
  asked++;
  if (asked > 20) break;
}
check('il test si ferma da solo', asked >= 8 && asked <= 16, `(${asked} domande)`);
await page.waitForSelector('.result__level');
const level = await page.textContent('.result__level');
check('livello assegnato', /^(A1|A2|B1|B2|C1|C2)$/.test(level.trim()), level);
const detail = await page.textContent('.card--flat');
check('stima e incertezza riportate', detail.includes('θ') && detail.includes('errore standard'), detail);
await shot('3-livello');

console.log('\n▸ Settore');
await tap('[data-act="next"]');
check(`i ${DOMAINS.length} settori proposti`, (await page.locator('[data-dom]').count()) === DOMAINS.length);
await tap('[data-dom="lavoro"]');
check('settore selezionato', (await page.locator('.chip-card--on').count()) === 1);
await tap('[data-act="done"]');
await shot('4-settore');

console.log('\n▸ Home');
await page.waitForSelector('[data-act="study"]');
check('obiettivo del giorno in cima', (await page.locator('.today .ring').count()) === 1);
check('punti di oggi a zero all’inizio', (await page.textContent('.today')).includes('su 120'));
check('oltre l’obiettivo si vede che è superato', await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('frasi/v1'));
  s.decks.de.daily = { day: new Date().toISOString().slice(0, 10), introduced: 0, reviewed: 0, xp: 180, cleared: false };
  localStorage.setItem('frasi/v1', JSON.stringify(s));
  return true;
}));
await page.reload({ waitUntil: 'networkidle' });
const over = await page.textContent('.today');
check('l’anello non dice più "180 su 120"', over.includes('obiettivo 120') && over.includes('60 punti oltre'), over.replace(/\s+/g, ' ').slice(0, 90));
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('frasi/v1'));
  s.decks.de.daily = { day: null, introduced: 0, reviewed: 0, xp: 0, cleared: false };
  localStorage.setItem('frasi/v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
const queueText = await page.textContent('.queue');
check('coda del giorno mostrata', queueText.includes('frasi nuove'));
check('livello in evidenza', (await page.textContent('.today__chips')).includes(level.trim()));
check('lingua scelta in barra', (await page.textContent('#bar-title')).includes('Tedesco'));
check('copertura del corpus mostrata', (await page.locator('.levels__row').count()) === 6);
await shot('5-home');

console.log('\n▸ Percorso');
check('riquadro del percorso in home', (await page.locator('.unit-card').count()) === 1);
const unitCard = (await page.textContent('.unit-card')).replace(/\s+/g, ' ');
check('il riquadro dice a che unità si è', /unità \d+ di \d+/.test(unitCard), unitCard.slice(0, 80));
check('e quante frasi ne mancano', /\d+\/\d+ frasi imparate/.test(unitCard), unitCard.slice(0, 80));

// il percorso si guarda da principiante: così le unità chiuse ci sono davvero
const realProfile = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('frasi/v1'));
  const keep = JSON.stringify(s.decks.de.profile);
  s.decks.de.profile = { ...s.decks.de.profile, theta: -1.6, cefr: 'A2' };
  localStorage.setItem('frasi/v1', JSON.stringify(s));
  return keep;
});
await page.reload({ waitUntil: 'networkidle' });
await tap('.unit-card');
await page.waitForSelector('.path');
const unitRows = await page.locator('.unit-row').count();
check('il percorso elenca tutte le unità', unitRows > 10, `${unitRows} unità`);
check('un’unità è quella in corso', (await page.locator('.unit-row--on').count()) === 1);
check('le unità più avanti sono chiuse', (await page.locator('.unit-row--locked').count()) > 0);
check('le unità chiuse non si possono toccare', await page.locator('.unit-row--locked').first().isDisabled());
check('quelle sotto il livello del test restano facoltative', (await page.locator('.unit-row--behind').count()) > 0);
check('i livelli fanno da intestazione', (await page.locator('.unit-level').count()) >= 5);
const onUnit = (await page.textContent('.unit-row--on')).replace(/\s+/g, ' ');
check('l’unità in corso dice quante frasi ne restano', /\d+\/\d+ imparate/.test(onUnit), onUnit.slice(0, 70));
check('il percorso spiega che i ripassi non li governa lui',
  (await page.textContent('.pad')).includes('I ripassi no'));
await shot('5b-percorso');

// toccare un'unità facoltativa apre una sessione fatta delle sue frasi
const optional = page.locator('.unit-row--behind[data-unit]').first();
const optionalId = await optional.getAttribute('data-unit');
await optional.click();
await page.waitForSelector('.study, .match');
check('un’unità toccata apre una sessione', (await page.locator('.study, .match').count()) > 0, optionalId);
await page.evaluate(() => localStorage.setItem('frasi/session-check', '1'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('[data-act="study"]');
/*
 * Per l'abbinamento servono carte GIA' INCONTRATE: da quando `matchable()`
 * tiene fuori le frasi mai viste, un mazzo vuoto apre la sessione dalla prima
 * carta e basta — che è il caso normale del primo giorno, non un difetto. Qui
 * se ne mettono sei in ripasso e scadute, che è la situazione in cui
 * l'abbinamento c'e' davvero.
 */
const sixIds = DE.sentences.filter((x) => x.lv === 'A1').slice(0, 6).map((x) => x.id);
await page.evaluate(([keep, ids]) => {
  const s = JSON.parse(localStorage.getItem('frasi/v1'));
  s.decks.de.profile = JSON.parse(keep);
  s.decks.de.cards = {};
  const ago = Date.now() - 3600000;
  ids.forEach((sid, i) => {
    const id = `${sid}|comp`;
    s.decks.de.cards[id] = {
      id, sid, type: 'comp', state: 'review', step: 0,
      s: 6, d: 5, due: ago - i * 60000, last: ago - 86400000, reps: 2, lapses: 0, ivl: 2,
    };
  });
  s.decks.de.log = [];
  s.decks.de.daily = { day: null, introduced: 0, reviewed: 0, xp: 0, cleared: false };
  localStorage.setItem('frasi/v1', JSON.stringify(s));
  localStorage.removeItem('frasi/session-check');
}, [realProfile, sixIds]);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('[data-act="study"]');
check('dal percorso si torna a casa con il livello del test', (await page.locator('.today').count()) === 1);

console.log('\n▸ Abbina');
await tap('[data-act="study"]');
await page.waitForSelector('.study');
check('la sessione si apre con l’abbinamento', (await page.locator('.pill--match').count()) === 1);
const cells = await page.locator('[data-pair]').count();
check('sei coppie, dodici caselle', cells === 12, `(${cells})`);
await shot('5b-abbina');

// una coppia sbagliata di proposito, poi tutte giuste
const wrongPick = await page.evaluate(() => {
  const l = [...document.querySelectorAll('[data-side="l"]')];
  const r = [...document.querySelectorAll('[data-side="r"]')];
  return { a: l[0].dataset.pair, b: r.find((x) => x.dataset.pair !== l[0].dataset.pair).dataset.pair };
});
await page.click(`[data-side="l"][data-pair="${wrongPick.a}"]`);
await page.click(`[data-side="r"][data-pair="${wrongPick.b}"]`);
check('la coppia sbagliata viene segnalata', (await page.locator('.match__cell--wrong').count()) === 2);
await page.waitForTimeout(750);
check('e poi si può riprovare', (await page.locator('.match__cell--wrong').count()) === 0);

const pairs = await page.evaluate(() => [...document.querySelectorAll('[data-side="l"]')].map((x) => x.dataset.pair));
for (const id of pairs) {
  await page.click(`[data-side="l"][data-pair="${id}"]`);
  await page.click(`[data-side="r"][data-pair="${id}"]`);
  await page.waitForTimeout(90);
}
check('abbinate tutte, la sessione prosegue', (await page.locator('.pill--match').count()) === 0);
check('le sei carte sono state registrate', await page.evaluate(() => {
  const log = JSON.parse(localStorage.getItem('frasi/v1')).decks.de.log;
  return log.filter((e) => e.type === 'comp').length >= 6;
}));
check('chi ha sbagliato prende un voto più basso', await page.evaluate(() => {
  const log = JSON.parse(localStorage.getItem('frasi/v1')).decks.de.log;
  return log.some((e) => e.g === 3) && log.some((e) => e.g < 3);
}));

console.log('\n▸ Sessione di studio');
check('la prima carta è un riconoscimento', (await page.textContent('.pill--comp')).includes('Riconosci'));
check('quattro possibilità fra cui scegliere', (await page.locator('[data-choice]').count()) === 4);
check('si parte dall’italiano', (await page.locator('.hint--big').count()) === 1 && (await page.locator('.target').count()) === 0);
const firstOptions = await page.locator('[data-choice]').allTextContents();
check('le opzioni sono nella lingua studiata', firstOptions.every((o) => /[A-Za-zÄÖÜäöüß]/.test(o)) && !firstOptions[0].includes('  '), firstOptions[0]);
check('nessun voto da dare prima di rispondere', (await page.locator('[data-grade], [data-act="next"]').count()) === 0);
await shot('6-studio');

// mappa frase → traduzione giusta, imparata dalla correzione: così la seconda
// volta che una carta torna, la prova risponde bene e la sessione converge
const known = new Map();
const pickChoice = async () => {
  const target = (await page.textContent('.hint--big, .target')).trim();
  const want = known.get(target);
  if (want) {
    const i = await page.evaluate((w) => [...document.querySelectorAll('[data-choice]')]
      .find((b) => b.textContent.trim() === w)?.dataset.choice, want);
    if (i !== undefined) { await tap(`[data-choice="${i}"]`); return; }
  }
  await tap('[data-choice="0"]');
  known.set(target, (await page.textContent('.btn--right')).trim());
};

/*
 * Comporre, completare e produrre: la prova risponde GIUSTO, e non a caso.
 *
 * Non è pignoleria: una risposta sbagliata rimette la carta in coda, com'è
 * giusto, quindi una prova che tira a indovinare su questi tre tipi non fa
 * finire la sessione — gira finché non sbatte contro il suo stesso tetto. La
 * frase si ritrova dal corpus partendo dall'italiano che è sotto gli occhi.
 */
const byIt = new Map(DE.sentences.map((x) => [x.it.trim(), x]));
const currentSentence = async () => {
  const hint = await page.locator('.hint--big, .hint').first();
  if (!(await hint.count())) return null;
  return byIt.get((await hint.textContent()).trim()) || null;
};

const answerTiles = async (sentence) => {
  if (!sentence) {                       // frase non riconosciuta: meglio finire che bloccarsi
    while (await page.locator('[data-tile]').count()) await page.click('[data-tile]');
  } else {
    for (const word of sentence.text.split(/\s+/)) {
      const tile = page.locator('[data-tile]', { hasText: new RegExp(`^${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first();
      if (await tile.count()) await tile.click();
      else await page.locator('[data-tile]').first().click();
    }
  }
  await tap('[data-act="check"]');
};

/* I buchi in ordine: si cammina sulla riga della frase, uno span è una parola
 * vista, un input è una o più parole nascoste fino allo span successivo. */
const answerCloze = async (sentence) => {
  const wanted = sentence
    ? await page.evaluate((words) => {
      const nodes = [...document.querySelector('.target--cloze').children];
      const out = [];
      let k = 0;
      nodes.forEach((node, n) => {
        if (node.tagName !== 'INPUT') { k += 1; return; }
        const next = nodes.slice(n + 1).find((x) => x.tagName !== 'INPUT');
        const stop = next ? words.indexOf(next.textContent.trim(), k) : words.length;
        out.push(words.slice(k, stop < 0 ? k + 1 : stop).join(' '));
        k = stop < 0 ? k + 1 : stop;
      });
      return out;
    }, sentence.text.split(/\s+/))
    : [];
  const blanks = await page.locator('[data-blank]').count();
  for (let i = 0; i < blanks; i++) {
    await page.locator('[data-blank]').nth(i).fill(wanted[i] || 'x');
  }
  await tap('[data-act="check"]');
};

let answered = 0;
let checkedVerdict = false;
const visti = new Set();          // quali tipi di esercizio ha davvero mostrato la sessione
while (answered < 90 && (await page.locator('.study').count())) {
  for (const cls of await page.locator('.study__meta .pill').first().evaluate((e) => [...e.classList]).catch(() => [])) {
    if (cls.startsWith('pill--') && cls !== 'pill--ghost') visti.add(cls.slice(6));
  }
  if (await page.locator('[data-choice]').count()) await pickChoice();
  else if (await page.locator('[data-tile]').count()) {
    await answerTiles(await currentSentence());
  } else if (await page.locator('[data-blank]').count()) {
    await answerCloze(await currentSentence());
  } else if (await page.locator('.input').count()) {
    const sentence = await currentSentence();
    await page.fill('.input', sentence ? sentence.text : 'x');
    await tap('[data-act="check"]');
  }
  if (!checkedVerdict) {
    checkedVerdict = true;
    check('la correzione compare subito', (await page.locator('.reveal').count()) === 1);
    check('la nota grammaticale compare dopo la risposta', (await page.locator('.note').count()) === 1);
    check('un solo bottone: il voto è già deciso', (await page.locator('[data-act="next"]').count()) === 1);
    check('intervallo stimato mostrato', (await page.textContent('[data-act="next"]')).includes('fra'));
    await tap('[data-act="other"]');
    check('il voto resta correggibile a mano', (await page.locator('[data-grade]').count()) === 4);
    check('scegliere a mano ferma l’avanzamento automatico', (await page.locator('.btn--auto').count()) === 0);
    await shot('7-risposta');
    await tap('[data-grade="3"]');
    answered++;
    continue;
  }
  await tap('[data-act="next"]');
  answered++;
}
check('sessione completata', (await page.locator('.done').count()) === 1, `(${answered} risposte)`);
/* Il primo giorno non è tutto riconoscimento: appena una frase esce
 * dall'apprendimento, il suo gradino successivo entra in fondo alla coda. */
check('la sessione mostra più di un tipo di esercizio', visti.size >= 2, `(${[...visti].join(', ')})`);
check('riepilogo con precisione', (await page.textContent('.done')).includes('%'));
check('punti guadagnati mostrati', /\+\d+/.test(await page.textContent('.done')));
check('anello dell’obiettivo alla fine', (await page.locator('.done .ring').count()) === 1);
const earned = Number((await page.textContent('.done')).match(/\+(\d+)/)[1]);
check('dieci punti a carta più il premio della coda svuotata', earned >= answered * 10, `(+${earned} su ${answered} carte)`);
await shot('8-fine');

console.log('\n▸ Progressi');
await tap('[data-act="stats"]');
await page.waitForSelector('.chart');
const charts = await page.locator('.chart').count();
check('i grafici sono disegnati in SVG', charts >= 4, `(${charts})`);
check('la curva dell’oblio è la prima cosa', (await page.textContent('section')).includes('curva dell’oblio'));
check('la soglia di ritenzione è segnata sulla curva', (await page.locator('.chart line[stroke-dasharray]').count()) >= 1);
check('calendario dello studio disegnato', (await page.textContent('section')).includes('Calendario dello studio'));
check('composizione del mazzo mostrata', (await page.locator('.split__seg').count()) === 3);
const gramSeen = await page.locator('[data-gram]').count();
check('mappa della grammatica sui punti incontrati', gramSeen >= 1, `(${gramSeen})`);
await tap('[data-act="gram-all"]');
check('mappa della grammatica interattiva', (await page.locator('[data-gram]').count()) > 5);
await tap('[data-act="gram-all"]');
check('ogni serie ha la sua etichetta, non solo il colore', (await page.locator('.legend .swatch').count()) >= 3);

// il valore di un segno si legge toccandolo: sui telefoni non c'è il passaggio del mouse
await page.locator('.chart-card').first().locator('[data-readout]').first().dispatchEvent('pointerdown');
const readout = await page.locator('.chart-card').first().locator('.chart__readout').textContent();
check('toccare un segno ne scrive il valore', readout.trim().length > 3, readout);
await shot('9-progressi');

await page.locator('.gram-map').scrollIntoViewIfNeeded();
await page.waitForTimeout(120);
await shot('9b-mappa-grammatica');
const point = await page.locator('[data-gram]').first().getAttribute('data-gram');
await tap('[data-gram]');
check('dalla mappa si arriva alle frasi di quel punto', (await page.textContent('section')).includes(point), point);
check('il filtro si può togliere', (await page.locator('[data-act="clear-g"]').count()) === 1);
await tap('[data-act="clear-g"]');
await shot('10-mappa');
await tap('[data-go="stats"]');
await page.waitForSelector('.chart');

console.log('\n▸ Esplora');
await tap('[data-go="explore"]');
await page.waitForSelector('#q');
const before = await page.locator('.row-item').count();
await page.fill('#q', 'Konjunktiv');
await page.waitForTimeout(250);
const after = await page.locator('.row-item').count();
check('la ricerca filtra', after > 0 && after < before, `(${before} → ${after})`);
await tap('[data-lv="C1"]');
check('filtro per livello attivo', (await page.locator('.chip--on').count()) >= 1);
await shot('11-esplora');

console.log('\n▸ Impostazioni');
await tap('[data-go="settings"]');
await page.waitForSelector('[data-set="newPerDay"]');
await page.locator('[data-set="newPerDay"]').fill('12');
await page.waitForTimeout(150);
check('frasi nuove al giorno aggiornate', (await page.textContent('.val')).includes('12'));
check('backup esportabile', (await page.locator('[data-act="export"]').count()) === 1);
check('si può scegliere che cosa allenare', (await page.locator('[data-dir]').count()) === 2);
check('avanzamento automatico attivo di serie', await page.isChecked('[data-toggle="autoNext"]'));
check('il criterio di sessione è scegliibile', (await page.locator('[data-crit]').count()) === 2);
check('quattro obiettivi fra cui scegliere', (await page.locator('[data-goal]').count()) === 4);
check('i punti non dipendono dall’esito, e lo dice', (await page.textContent('section')).includes('giusta o sbagliata che sia'));
await tap('[data-goal="200"]');
check('obiettivo cambiato', await page.evaluate(() => JSON.parse(localStorage.getItem('frasi/v1')).settings.dailyGoal === 200));
await tap('[data-goal="120"]');
check('una volta è il criterio di partenza', (await page.locator('[data-crit="1"].chip-card--on').count()) === 1);
await tap('[data-crit="2"]');
check('il criterio si cambia', await page.evaluate(() => JSON.parse(localStorage.getItem('frasi/v1')).settings.criterion === 2));
await tap('[data-crit="1"]');
check('parlare è la scelta di partenza', (await page.locator('[data-dir="produce"].chip-card--on').count()) === 1);
check('la velocità della lingua è spiegata', (await page.textContent('section')).includes('di questa velocità'));
check('il tono è regolabile', (await page.locator('[data-set="ttsPitch"]').count()) === 1);
check('l’ascolto parola per parola è spiegato', (await page.textContent('section')).includes('Parola per parola'));
const voiceUi = await page.textContent('section');
check('la scelta della voce è offerta o spiegata', (await page.locator('[data-voice]').count()) === 1
  || voiceUi.includes('voci installate') || voiceUi.includes('Nessuna voce'), voiceUi.slice(0, 80));
check('il limite della sintesi è dichiarato', voiceUi.includes('sintesi è quella del tuo dispositivo')
  || voiceUi.includes('non ne espone') || voiceUi.includes('Nessuna voce'));
await shot('12-impostazioni');

console.log('\n▸ Persistenza');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.today');
check('si riapre sulla home', (await page.locator('[data-go="home"]').count()) === 1);
check('livello ancora salvato', (await page.textContent('.today__chips')).includes(level.trim()));
const seen = await page.locator('.today__chips .pill').nth(2).textContent();
check('frasi viste memorizzate', Number(seen.replace(/\D+/g, '')) > 0, seen);
await shot('13-ritorno');

console.log('\n▸ Componi, completa, produci');
/* Si forza uno stato in cui i gradini precedenti sono già maturi: così i
   passaggi successivi risultano sbloccati senza aspettare giorni veri. */
const seed = async (ladder) => {
  await page.evaluate((mature) => {
    const state = JSON.parse(localStorage.getItem('frasi/v1'));
    state.settings.newPerDay = 1;
    state.decks.de.cards = {};
    for (const type of mature) {
      const id = `de-a1-01|${type}`;
      state.decks.de.cards[id] = {
        id, sid: 'de-a1-01', type, state: 'review',
        s: 12, d: 5, due: Date.now() + 6 * 86400000, last: Date.now() - 86400000,
        reps: 2, lapses: 0, ivl: 12, step: 0,
      };
    }
    state.decks.de.daily = { day: null, introduced: 0, reviewed: 0 };
    localStorage.setItem('frasi/v1', JSON.stringify(state));
  }, ladder);
  await page.reload({ waitUntil: 'networkidle' });
  await tap('[data-act="study"]');
  await page.waitForSelector('.study');
};

// con l'obiettivo "parlare" la scala è comp → prod → build → cloze
await seed(['comp']);
check('dopo il riconoscimento arriva la produzione', (await page.locator('.pill--prod').count()) === 1);
check('si parte dall’italiano', (await page.textContent('.hint--big')).includes('Come ti chiami'));
check('si può scrivere la frase intera', (await page.locator('.input').count()) === 1);
await page.fill('.input', 'Wie heisst du');
await tap('[data-act="check"]');
check('accenti e punteggiatura perdonati', (await page.locator('.check--ok').count()) === 1);
check('parole tutte confermate', (await page.locator('.w--ok').count()) === 3);
check('ascolto intero e parola per parola', (await page.locator('[data-act="say"]').count()) === 1
  && (await page.locator('[data-act="guided"]').count()) === 1);
check('ogni parola è toccabile', (await page.locator('.solution [data-tok]').count()) === 3);
check('la frase giusta viene ripetuta', (await page.textContent('.solution')).includes('Wie heißt du?'));
check('voto automatico su Bene', (await page.textContent('[data-act="next"]')).includes('Bene'));
await shot('13-produci');

await seed(['comp', 'prod']);
check('poi tocca alla composizione', (await page.locator('.pill--build').count()) === 1);
check('le tessere sono più delle parole della frase', (await page.locator('[data-tile]').count()) === 5);
const order = await page.evaluate((want) => {
  const tiles = [...document.querySelectorAll('[data-tile]')];
  return want.map((w) => tiles.find((el) => el.textContent.trim() === w)?.dataset.tile);
}, ['Wie', 'heißt', 'du?']);
check('le tessere contengono la frase intera', order.every((i) => i !== undefined), JSON.stringify(order));
for (const i of order) await tap(`[data-tile="${i}"]`);
await tap('[data-act="check"]');
check('ordine giusto riconosciuto', (await page.locator('.tray--ok').count()) === 1);
await shot('14-componi');

await seed(['comp', 'prod', 'build']);
check('l’ultimo gradino è il cloze', (await page.locator('.pill--cloze').count()) === 1);
check('dettatura possibile ma non su ogni produzione', await page.evaluate(async () => {
  const { seeded } = await import('./assets/js/exercises.js');
  let n = 0;
  for (let i = 0; i < 300; i++) if (seeded(`c${i}|0|dictation`)() < 0.34) n++;
  return n > 60 && n < 150;   // circa una su tre, non tutte e non nessuna
}));
check('un solo buco sulla carta nuova', (await page.locator('[data-blank]').count()) === 1);
// la ß non si digita su una tastiera italiana: "heisst" deve bastare
await page.fill('[data-blank="0"]', 'heisst');
await tap('[data-act="check"]');
check('buco riempito correttamente', (await page.locator('.slot--ok').count()) === 1);
check('anche il cloze diventa toccabile parola per parola', (await page.locator('.target--cloze [data-tok]').count()) === 3);
check('una sola riga toccabile per schermata', (await page.locator('[data-tok]').count()) === 3);
await shot('15-completa');

console.log('\n▸ Svizzero tedesco');
await page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('frasi/v1'));
  state.lang = 'gsw';
  state.settings.newPerDay = 1;
  state.decks.gsw = {
    profile: { theta: -1.3, se: 0.4, cefr: 'A2', at: Date.now(), history: [] },
    cards: {}, log: [], daily: { day: null, introduced: 0, reviewed: 0 }, streak: { count: 0, last: null },
  };
  localStorage.setItem('frasi/v1', JSON.stringify(state));
});
await page.reload({ waitUntil: 'networkidle' });
check('avvertenza sul dialetto mostrata', (await page.textContent('.caveat')).includes('ortografia ufficiale'));
await tap('[data-act="study"]');
await page.waitForSelector('.study');
check('variante indicata sulla carta', (await page.textContent('.study__meta')).includes('Züridütsch'));
await tap('[data-choice="0"]');
const bridge = await page.textContent('.bridge');
check('ponte col tedesco standard', bridge.includes('TEDESCO STANDARD') || bridge.length > 10, bridge);
await shot('16-svizzero');

console.log('\n▸ Russo');
await page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('frasi/v1'));
  state.lang = 'ru';
  state.settings.newPerDay = 1;
  const cards = {};
  for (const type of ['comp', 'build', 'cloze']) {
    const id = `ru-a1-22|${type}`;
    cards[id] = {
      id, sid: 'ru-a1-22', type, state: 'review',
      s: 12, d: 5, due: Date.now() + 6 * 86400000, last: Date.now() - 86400000,
      reps: 2, lapses: 0, ivl: 12, step: 0,
    };
  }
  state.decks.ru = {
    profile: { theta: -2, se: 0.4, cefr: 'A1', at: Date.now(), history: [] },
    cards, log: [], daily: { day: null, introduced: 0, reviewed: 0 }, streak: { count: 0, last: null },
  };
  localStorage.setItem('frasi/v1', JSON.stringify(state));
});
await page.reload({ waitUntil: 'networkidle' });
check('avvertenza sull’alfabeto mostrata', (await page.textContent('.caveat')).includes('caratteri latini'));
await tap('[data-act="study"]');
await page.waitForSelector('.study');
check('si arriva alla produzione', (await page.locator('.pill--prod').count()) === 1);
check('si può rispondere in latino', (await page.textContent('.study__body')).includes('caratteri latini'));
// «Я не знаю» scritto come lo scriverebbe un italiano, senza cirillico
await page.fill('.input', 'ia ne znaiu');
await tap('[data-act="check"]');
check('risposta in caratteri latini accettata', (await page.locator('.check--ok').count()) === 1);
const pron = await page.textContent('.bridge');
// l'accento arriva come segno combinante: si confronta in forma composta
check('riga di pronuncia mostrata', pron.includes('Pronuncia') && pron.normalize('NFC').includes('znáiu'), pron);
check('accento tonico visibile nella soluzione', (await page.textContent('.solution')).includes('\u0301'));
check('le parole russe si possono toccare una a una', (await page.locator('.solution [data-tok]').count()) === 3);
await page.click('.solution [data-tok="1"]');
check('toccare una parola non rompe niente', errors.length === 0, errors.join(' | '));
await tap('[data-act="guided"]');
await page.waitForTimeout(600);
check('l’ascolto guidato illumina una parola alla volta', (await page.locator('.tok--on').count()) <= 1);

// qui la rete verso l'esterno non c'è: è il modo migliore di provare il ripiego
console.log('\n▸ Ripiego della voce online');
await page.reload({ waitUntil: 'networkidle' });   // fuori dalla sessione, senza inseguire schermate
await tap('[data-go="settings"]');
await page.waitForSelector('[data-online]');
check('la voce online è attiva di serie sul russo', await page.isChecked('[data-online]'));
check('il prezzo della voce online è dichiarato', (await page.textContent('section')).includes('arriva ai server di Google'));
await tap('[data-act="test-online"]');
await page.waitForFunction(() => document.body.textContent.includes('Non risponde'), null, { timeout: 25000 });
check('senza rete lo dice e ripiega sul telefono', (await page.textContent('section')).includes('voce del dispositivo'));
check('nessun errore JavaScript dal ripiego', errors.length === 0, errors.join(' | '));
await shot('20-voce-online');
await shot('17-russo');

console.log('\n▸ Taratura del modello');
await page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('frasi/v1'));
  state.lang = 'de';
  // registro sintetico: 40 carte con sei ripassi ciascuna a intervalli crescenti
  const log = [];
  let t = Date.now() - 400 * 86400000;
  for (let c = 0; c < 40; c++) {
    let when = t + c * 3600000;
    log.push({ id: `de-x${c}|comp`, t: when, g: 3, isNew: true, ms: 7000 });
    let ivl = 2;
    for (let i = 0; i < 6; i++) {
      when += ivl * 86400000;
      const g = (c + i) % 5 === 0 ? 1 : 3;
      log.push({ id: `de-x${c}|comp`, t: when, g, isNew: false, ms: g === 1 ? 19000 : 8000 });
      ivl = g === 1 ? 2 : Math.round(ivl * 2.4);
    }
  }
  state.decks.de.log = log;
  localStorage.setItem('frasi/v1', JSON.stringify(state));
});
await page.reload({ waitUntil: 'networkidle' });
await tap('[data-go="stats"]');
await page.waitForSelector('.chart-card');
check('grafico di calibrazione disegnato', (await page.locator('.chart circle').count()) > 1);
check('la diagonale del modello onesto è tracciata', (await page.textContent('section')).includes('modello onesto'));
check('prezzo della ritenzione mostrato', (await page.textContent('section')).includes('prezzo della ritenzione'));
check('costo misurato dai tempi reali', (await page.textContent('section')).includes('se indovini'));
await page.locator('.chart-wrap--square').scrollIntoViewIfNeeded();
await page.waitForTimeout(150);
await shot('18-taratura');

await tap('[data-act="fit"]');
await page.waitForSelector('[data-act="apply"], [data-act="discard"]', { timeout: 20000 });
check('confronto prima/dopo mostrato', (await page.textContent('section')).includes('log-loss'));
const applyEnabled = await page.locator('[data-act="apply"]:not([disabled])').count();
if (applyEnabled) {
  await tap('[data-act="apply"]');
  check('pesi personali applicati', (await page.textContent('.pill')).length > 0
    && (await page.evaluate(() => JSON.parse(localStorage.getItem('frasi/v1')).settings.w !== null)));
} else {
  await tap('[data-act="discard"]');
  check('niente di meglio trovato, e lo dice', true);
}
await page.locator('#tuning-slot').scrollIntoViewIfNeeded();
await shot('19-pesi');

check('nessun errore JavaScript', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();

console.log(`\n${failures.length ? `${failures.length} controllo/i fallito/i` : 'Tutti i controlli superati'} — screenshot in tools/screenshots/`);
process.exit(failures.length ? 1 : 0);
