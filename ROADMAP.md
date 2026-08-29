# Percorso — verso un'app che si usa come Duolingo

Obiettivo: la scorrevolezza e l'invito a tornare di un'app di massa, senza
buttare via quello che c'è sotto — scheduler tarabile, esercizi che si
correggono da soli, niente numeri che mentono.

Una tappa per iterazione. Ogni tappa finisce quando è **implementata, provata
(`validate` + `smoke`), documentata e pubblicata**.

## Regole che valgono per ogni tappa

1. Niente che premi la risposta giusta più della risposta data: i punti non
   devono spingere verso l'esercizio facile.
2. Niente numero mostrato che non sia calcolato sui dati veri.
3. Ogni aggiunta motivazionale dichiara quanto vale: la letteratura sulla
   gamification è meno univoca di quanto il marketing lasci credere.
4. Ogni esercizio nuovo deve essere correggibile dalla macchina.
5. Movimento e suono si spengono con `prefers-reduced-motion`.

## Tappe

- [x] **1. Obiettivo del giorno** — anello dei punti in home, obiettivo
      scegliibile, chiusura di sessione con animazione e suoni, serie di giorni.
      *(Locke & Latham 2002 sugli obiettivi; il resto dichiarato come
      impalcatura.)*

- [x] **2. Abbina** — esercizio a coppie da toccare, italiano contro lingua,
      sei coppie mescolate. Veloce, adatto all'inizio di una sessione, e
      correggibile in modo secco. *(Riconoscimento sotto interferenza: le
      coppie sbagliate sono distrattori attivi, non decorazione.)*
      Fatto: apre la sessione quando ci sono almeno quattro riconoscimenti in
      coda, sei coppie, voto per carta secondo gli errori della sua coppia.

- [x] **3. Ascolta e scrivi** — dettatura pura: nessun testo, solo audio, e si
      scrive quello che si è sentito. Il gradino che manca fra il capire e il
      produrre. *(Decodifica fonologica; per il russo si appoggia alla voce
      online.)*

- [x] **4. Percorso a unità** — le frasi raggruppate in unità tematiche con un
      percorso visibile, stato di completamento e sblocco progressivo, invece
      di una coda piatta. È la differenza strutturale più grossa con Duolingo.
      Lo scheduler resta il padrone dei ripassi: il percorso governa solo
      l'ordine in cui il materiale nuovo entra.
      Fatto: unità da 4-10 frasi per livello e settore, ordine deterministico,
      il settore scelto riordina il cammino invece di essere ignorato; il
      cammino parte dal livello uscito dal test e le unità sotto restano
      aperte come facoltative; un'unità apre la successiva al 60% imparato o
      quando è stata vista tutta; toccando un'unità aperta si fa una sessione
      con le sole sue frasi. *(Bandura & Schunk 1981 sui traguardi vicini.)*

- [ ] **5. Ripasso degli errori** — una sezione dedicata alle carte sbagliate
      di recente, con un giro corto e mirato. *(Il ripasso concentrato sugli
      errori rende più del ripasso uniforme.)*

- [~] **6. Micro-interazioni e identità** — *avviato*: avanzamento automatico
      quando si indovina (un tocco in meno per carta), barra di attesa sul
      bottone, animazioni che si spengono con `prefers-reduced-motion`.
      Restano: transizioni fra le carte, riscontro aptico, icona propria.

- [ ] **6b. Micro-interazioni e identità** — transizioni fra le carte, riscontro
      aptico dove esiste, schermate meno spoglie, un'icona che non sia un
      fumetto generico.

- [ ] **7. Livelli per unità** — rifare un'unità a difficoltà crescente
      (riconosci → produci → detta), con un segno visibile del grado raggiunto.

- [ ] **8. Riepilogo settimanale** — cosa è migliorato e cosa no, misurato:
      ritenzione, parole nuove, punti grammaticali consolidati.

## Fuori dalle tappe: difetti chiusi il 29/08/2026

Non erano tappe, erano cose rotte. Chi scrive la prossima tappa deve sapere che:

- **i pesi FSRS si sono spostati dalle impostazioni al mazzo** (`deck.w`, non
  `settings.w`): tarare una lingua non ritara più le altre. La migrazione butta
  i pesi globali di prima invece di attribuirli a caso.
- **il test parte da un prior scelto da chi studia**, con una domanda prima
  della prima domanda: `Irt.estimate(responses, priorMean)` e `Irt.PRIORS`.
  La griglia di quadratura è arrivata a ±7 per reggere i prior estremi.
- **i distrattori vengono dallo stesso punto grammaticale** (`confusables()` in
  `exercises.js`): un esercizio nuovo che pesca opzioni sbagliate a caso
  reintroduce la scorciatoia lessicale che questa app dice di non avere.
- **una scrittura fallita di `localStorage` non è più silenziosa**
  (`Store.storageError()`), e il registro si taglia per storie intere invece che
  cronologicamente, altrimenti l'ottimizzatore perde proprio le carte migliori.
- **`Store.saveCard` e `Store.logReview` non esistono più**: una risposta è una
  scrittura sola, `Store.recordReview(card, entry)`.

## Fuori dalle tappe: la voce, i settori, la lunghezza (29/08/2026)

- **Le frasi sono incise**, non sintetizzate sul momento: `tools/voci.py` le
  produce con una voce neurale e salva i tempi di ogni parola. Chi aggiunge
  frasi al corpus deve rilanciarlo, altrimenti quelle nuove parlano con la voce
  del telefono. Rifà solo le frasi cambiate.
- **I settori sono dodici** e non più sei. Aggiungerne uno senza frasi che ci
  stiano dentro fa danno: chi lo sceglie ottiene meno di chi non sceglie niente.
- **La lunghezza ha un tetto per livello** (6/7/8/9 parole), controllato dal
  validatore. Non è una preferenza: una frase che non entra nella memoria di
  lavoro si impara a pezzi, cioè non si impara.

## Idee tenute in caldo

- Modo "conversazione": due o tre frasi collegate invece di frasi isolate.
- Scelta della difficoltà del giorno (più ripassi o più roba nuova).
- Esportare le frasi ostiche come mazzo Anki.

## Il corpus, lingua per lingua

Non è una tappa: è lavoro che continua. Regola: prima si guarda che cosa manca
con `node tools/corpus-review.mjs`, poi si aggiunge — mai frasi a caso, mai
frasi che nessuno dice. La priorità è la base (A1-A2) e la giornata vera.

- [x] Tedesco — 211 frasi, 38/38 situazioni quotidiane coperte.
- [x] Russo — 185 frasi, 38/38.
- [x] Inglese — 232 frasi, 38/38.
- [x] Svizzero tedesco — 162 frasi, 38/38. Le 14 situazioni che mancavano sono
      state coperte il 29/08/2026 (+47 frasi).
- [x] Spagnolo — 184 frasi, 38/38. Le 11 situazioni che mancavano sono state
      coperte il 29/08/2026 (+64 frasi).

- [x] Tedesco — 260 frasi. +49 il 29/08/2026 sui dodici punti grammaticali che
      avevano un esempio solo o nessuno.
- [x] Russo — 219 frasi. +34, stessa ragione.
- [x] Inglese — 270 frasi. +38, stessa ragione.

**1103 frasi in tutto.** Tutte e cinque le lingue coprono le 38 situazioni, e in
nessuna resta un punto grammaticale con un esempio solo. I dodici settori sono
popolati ovunque: le frasi già esistenti di tedesco, russo e inglese sono state
rilette una per una e ritaggate a mano (179 cambiate), non a parole chiave.

Quello che resta è di un altro tipo: **profondità ai livelli alti** (B2-C2 vive
quasi solo di lavoro e accademico, e i settori quotidiani lì sono vuoti), e le
frasi proprie, che restano l'unica cosa che fa durare il corpus oltre i due mesi
di studio.
