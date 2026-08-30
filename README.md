# 💬 Frasi

App web per **imparare una lingua memorizzando frasi**, non parole singole.
Frasi corte, una difficoltà grammaticale alla volta, riproposte nel momento in
cui stai per dimenticarle. Pensata per iPhone: si usa con il pollice, si
aggiunge alla schermata Home e funziona offline.

Nessuna dipendenza, nessun build: HTML, CSS e JavaScript puri.

## L'idea

Una parola isolata non porta con sé né la grammatica né le collocazioni. Una
frase di sei parole sì, e resta comunque dentro la memoria di lavoro. Quindi:

1. **Un test adattivo** stabilisce il livello in 8-16 domande.
2. **Le frasi nuove** vengono pescate appena sopra quel livello, nel settore
   che hai scelto (lavoro, viaggi, tecnologia, salute, ricerca, quotidiano).
3. **Ogni frase diventa quattro carte** in ordine crescente di sforzo, e
   ognuna si sblocca solo quando la precedente è consolidata.
4. **Un algoritmo di ripetizione dilazionata** decide quando rivedere ciascuna
   carta, puntando alla probabilità di ricordare che hai richiesto.

## I quattro esercizi, e perché nessuno si autovaluta

| | Esercizio | Come si corregge |
| --- | --- | --- |
| 🔗 | **Abbina** — sei coppie da chiudere a tocchi | coppia giusta o sbagliata |
| 👂 | **Riconosci** — quattro possibilità, una giusta | scelta giusta o sbagliata |
| 🧩 | **Componi** — tessere da rimettere in fila, due di troppo | ordine esatto |
| ✏️ | **Completa** — buchi che aumentano col consolidarsi della carta | parola per parola |
| 🗣️ | **Produci** — la frase intera, scritta o dettata a voce | confronto completo |
| 🎧 | **Ascolta e scrivi** — una produzione su tre arriva senza testo, solo audio | confronto completo |

### I distrattori, che non sono riempitivo

Le tre opzioni sbagliate di *Riconosci* e le due tessere di troppo di *Componi*
decidono che cosa misura l'esercizio. Prese fra frasi qualsiasi dello stesso
livello, la risposta giusta si trova riconoscendo **una parola piena** — "caffè"
sta in una sola delle quattro — senza sapere niente della regola che la frase
insegna: il gradino diventa gratis, e il voto che ne esce dice a FSRS che la
carta è solida quando non lo è. È la stessa illusione di competenza contro cui
è costruito tutto il resto dell'app, entrata dalla porta di servizio.

I distrattori vengono quindi, in ordine: dalle frasi con **lo stesso punto
grammaticale** — sono le coppie minime che il corpus contiene apposta, `wo`
contro `wohin`, `ser` contro `estar` — poi da quelle dello **stesso settore** a
livello vicino, e solo dopo dal resto. Dove il corpus ha almeno tre altri
esempi della stessa regola, i tre distrattori vengono **tutti** da lì: sono 172
frasi su 211 in tedesco e 189 su 232 in inglese, e il validatore lo verifica
lingua per lingua.

In pratica: alla richiesta "Mi ha aiutato molto" le quattro opzioni sono
`Mir geht es gut, danke` · `Das gefällt mir sehr` · `Er hat mir sehr geholfen` ·
`Es ist mir egal, wer das macht` — quattro dativi, e per scegliere bisogna
sapere quale verbo lo regge. Fra le tessere di `Ich möchte einen Kaffee` le due
di troppo sono `eine` e `Tag`: la prima è esattamente l'articolo sbagliato.

### L'abbinamento che apre la sessione

Quando in coda ci sono almeno quattro riconoscimenti **di frasi già
incontrate**, la sessione si apre con un **abbinamento a sei coppie**: si tocca
la frase in italiano, si tocca la sua traduzione, e la coppia si chiude.

Non è un tipo di carta nuovo — è un altro modo di far sostenere lo stesso
riconoscimento a sei carte insieme, e ognuna esce con il voto che si è preso:
**al primo colpo** → Bene, **dopo un errore** → Difficile, **dopo due** → Di
nuovo. Il vantaggio non è la velocità: è che i cinque distrattori sono frasi
vere, presenti sullo schermo nello stesso momento, quindi il richiamo avviene
**sotto interferenza** invece che contro tre opzioni pescate a caso. Si spegne
dalle impostazioni.

#### Perché mai su frasi nuove

Richiamare presuppone che ci sia qualcosa da richiamare. Su sei frasi mai viste
l'abbinamento non è un esercizio difficile, è una **lotteria**: l'unico modo di
risolverla è provare finché non resta l'ultima coppia, e chi la fa non impara
niente perché non c'era niente da ricordare.

Il danno però non è la frustrazione: è che da lì esce un **voto**, e quel voto
va dritto dentro FSRS. Fino al 30/08/2026 il primo giorno di una lingua nuova si
apriva esattamente così — la coda è fatta di sole carte mai viste — e le prime
sei frasi entravano nel modello di memoria con l'esito di un sorteggio al posto
di una risposta. Adesso `matchable()` tiene fuori le carte nuove, e il primo
giorno la sessione comincia dalla prima carta: un riconoscimento a quattro
opzioni, che si può sbagliare imparando qualcosa.

### Ascolta e scrivi

Una produzione su tre arriva **senza il testo italiano**: solo un bottone
grande, l'audio, e il campo dove scrivere quello che hai sentito. Decidere
quale tocca a chi è deterministico (dipende dal seme della carta), e succede
solo se una voce c'è: senza audio la carta resta una produzione normale.

È il gradino che mancava fra il capire e il produrre — decodificare il parlato
e riscriverlo mette insieme le due cose — e su una lingua con un altro alfabeto
è l'unico esercizio che lega davvero il suono alla forma scritta.

### Il verso conta più di quanto sembri

In *Impostazioni* si sceglie che cosa si vuole saper fare, e cambia sia la
domanda sia l'ordine dei gradini:

| | **Parlare** (di partenza) | **Capire** |
| --- | --- | --- |
| Riconosci | vedi l'italiano, scegli fra quattro frasi nella lingua | vedi la frase, scegli fra quattro traduzioni |
| Scala | comp → **prod** → build → cloze | comp → build → cloze → **prod** |

Non è una preferenza estetica. Con *Capire* la produzione è il quarto gradino:
arriva dopo settimane, e nel frattempo si pratica solo il verso opposto a quello
che serve. Con *Parlare* si parte sempre dall'italiano e la produzione è il
secondo gradino, quindi arriva al secondo giro. È il principio del
**transfer-appropriate processing** (Morris, Bransford & Franks, 1977): si
ricorda meglio quando le condizioni dello studio somigliano a quelle dell'uso.
Chi punta a capire il parlato ha la scala classica di Nation, che per quel-
l'obiettivo resta la più sensata.

Il punto non è la varietà: è che **nessuno di questi esercizi può essere
corretto da chi studia**. Chiedere "l'avevi indovinata?" dopo aver mostrato la
risposta non misura niente — dopo averla vista la si riconosce, e riconoscerla
viene scambiato per ricordarla (Koriat & Bjork, 2005). Chi si autocorregge si
dà ragione più spesso di quanto i dati giustifichino (Dunlosky & Rawson, 2012),
e quell'errore finisce dritto dentro FSRS, che programma i ripassi su un voto
gonfiato.

Quando indovini la carta successiva **arriva da sola** (aspettando che l'audio,
se parte, finisca di leggere: tagliare a metà la parola che stai imparando è
peggio del tocco che ti si risparmia) (una
barra sul bottone lo dice, e toccando *Avanti* la anticipi): se hai indovinato
non c'è niente da leggere, e un tocco di conferma per ognuna delle venti carte
di una sessione sono venti tocchi di troppo. Quando sbagli si aspetta sempre,
perché lì la correzione è l'unica parte che conta.

Qui il voto **scende dall'esito**: tutto giusto → *Bene*, parole giuste e forma
sbagliata → *Difficile*, manca qualcosa → *Di nuovo*. Resta un bottone per
correggerlo a mano — *Facile* nessuna macchina può indovinarlo — ma la
condizione normale è che tu non debba giudicarti.

### I buchi che crescono, e che si spostano

Il cloze non ha un numero fisso di buchi: ne ha **uno** quando la carta è nuova
e arriva a **metà frase** quando è solida, con il primo buco sempre sulla chiave
grammaticale. È il *fading* dell'impalcatura di Renkl & Atkinson (2003): l'aiuto
si ritira mentre la memoria regge da sola, e la stessa frase resta un esercizio
utile invece di diventare un automatismo.

I buchi in più, però, non cadono a caso: **la carta si ricorda le parole che hai
sbagliato** e li mette lì. Rendere difficile tutto non serve — serve rendere
difficile il punto che cede. È il principio delle difficoltà desiderabili
puntato dove l'errore è già avvenuto, invece che sparso a caso sulla frase.

### La stessa regola in frasi diverse

Quando si sceglie una frase nuova non conta solo il livello e il settore: conta
anche il punto grammaticale. Una regola **mai incontrata** allarga il repertorio;
una regola **già incontrata ma ancora fragile** (stabilità media sotto i 7
giorni) ha bisogno di *un altro esempio*, non della stessa frase ripetuta. È
così che una struttura diventa una regola invece che una frase imparata a
memoria — la variabilità degli esempi è ciò che permette di generalizzarla.

### La voce

Nel passaggio di produzione puoi **dettare la frase** invece di scriverla:
`SpeechRecognition` la trascrive e il confronto è lo stesso di una risposta
scritta. Non è solo comodità — pronunciare ad alta voce quello che si studia lo
fa ricordare meglio del solo leggerlo (*production effect*, MacLeod et al.
2010). Fra le trascrizioni proposte dal motore viene scelta la più vicina alla
frase attesa, così un omofono non conta come errore. Dove il browser non
trascrive (fuori da Safari e Chrome) il microfono non compare nemmeno.

## I grafici: far vedere il modello, non decorarlo

I *Progressi* non sono una bacheca di numeri motivazionali. Ogni grafico
risponde a una domanda che riguarda il modello:

| Grafico | Domanda |
| --- | --- |
| **La tua curva dell'oblio** | come decide, il modello, quando ti ripropone una carta? |
| **Calibrazione** | quando dice "85%", ci azzecca l'85% delle volte? |
| **Il prezzo della ritenzione** | quanto costa ogni scelta che posso fare? |
| **Ripassi fatti / Carico in arrivo** | quanto sto spendendo e quanto spenderò? |
| **Parole diverse incontrate** | quanto lessico diverso mi è passato davanti? |
| **Mappa della grammatica** | quali regole reggono e quali no? |

La curva dell'oblio non è un'illustrazione presa da un libro: è
`R(t) = (1 + 19/81 · t/S)^-0.5` calcolata con **la stabilità mediana del tuo
mazzo** e **i tuoi pesi**, con segnata sopra la soglia di ritenzione che hai
chiesto e il punto in cui la carta torna. La mappa della grammatica è
interattiva: si tocca un punto e si aprono le frasi che lo contengono.

### I colori sono calcolati, non scelti a occhio

La serie categorica e la rampa sequenziale passano i controlli misurabili
contro la superficie scura dell'app: banda di luminosità OKLCH, soglia di
croma, **separazione sotto daltonismo** (protanopia e deuteranopia, ΔE ≥ 8 in
OKLab) e contrasto. L'identità non è mai affidata al solo colore — ogni serie
ha la sua etichetta in legenda, e ogni segno scrive il proprio valore quando lo
tocchi, perché su un telefono il passaggio del mouse non esiste. Nessun grafico
ha due scale sullo stesso asse: dove servono due grandezze diverse (il prezzo
della ritenzione) ci sono due grafici uno sotto l'altro.

## I settori, e perché sono dodici

In *Impostazioni* si sceglie da dove pescare le frasi nuove: vita quotidiana,
casa e faccende, cibo e ristorante, spesa e acquisti, amici e famiglia, tempo
libero e sport, soldi e burocrazia, lavoro, viaggi, tecnologia, salute, studio
e ricerca. Il settore **pesa** la scelta, non nasconde niente: una frase fuori
settore può ancora uscire, vale solo di meno.

Erano sei, e «vita quotidiana» era un sacco: dentro ci stavano il conto al
ristorante, la lavatrice, i suoceri e la partita — situazioni che non hanno una
parola in comune. Chi sceglieva un settore sceglieva quasi sempre quello, e
sceglierlo non voleva dire niente.

Adesso tutti e dodici sono popolati in tutte e cinque le lingue: le 111 frasi
aggiunte a spagnolo e dialetto sono nate dentro i settori nuovi, e le 628 frasi
già esistenti di tedesco, russo e inglese sono state rilette una per una e
ritaggate a mano — 179 hanno cambiato settore. Non a parole chiave, di proposito:
«Vado a camminare ogni giorno» sta in salute *e* in tempo libero, e nessun elenco
di parole ci arriva.

La regola per aggiungerne un altro non è che la categoria esista: è che
esistano abbastanza frasi che ci stanno dentro, **in ogni lingua**. Un settore
vuoto non è neutro — chi lo sceglie ottiene meno di chi non sceglie niente,
perché il punteggio smette di preferire qualunque cosa. `corpus-review.mjs` li
conta per livello, ed è lì che si guarda prima di aggiungere il tredicesimo.

## Il percorso

Le frasi non sono una coda infinita: stanno in **unità da quattro a dieci
frasi**, una per livello e settore — "Lavoro e ufficio" a B1, "Viaggi" ad A2 —
con un cammino visibile, un'unità in corso, quelle già chiuse e quelle ancora
chiuse a chiave. La divisione è deterministica: lo stesso corpus dà sempre lo
stesso percorso, altrimenti le unità si riordinerebbero sotto i piedi.

Quattro cose che vale la pena dire chiaramente, perché è qui che un percorso
può fare danno:

1. **Il percorso non tocca i ripassi.** Governa solo l'ordine in cui il
   materiale *nuovo* entra. Le scadenze restano di FSRS, sempre: una carta
   introdotta tre unità fa torna quando deve tornare, non quando il percorso
   lo trova comodo. Dove Duolingo mette in fila anche i richiami, qui la fila
   è solo per le prime volte.
2. **Il cammino parte dal livello del test.** Se il test adattivo ti mette a
   B1, il cammino comincia dalle unità B1. Quelle sotto restano aperte ma
   segnate *facoltative*: le puoi fare toccandole, non le devi attraversare.
   Un test di livello che poi ti fa ricominciare da A1 è un test decorativo.
3. **Il settore riordina il percorso, non lo subisce.** Dentro un livello, le
   unità che contengono più frasi dei settori scelti vengono per prime — e il
   criterio è quante frasi toccano quel settore, anche come settore
   secondario, non l'etichetta dell'unità. Chi studia per lavoro trova le
   unità di lavoro subito.
4. **Toccare un'unità aperta fa una sessione con le sole sue frasi.** I
   ripassi in scadenza entrano lo stesso: saltarli per fare l'unità che va di
   moda oggi sarebbe barare con le scadenze. Se il tetto di frasi nuove del
   giorno è già speso, l'unità scelta a mano ne concede cinque in più —
   dichiarate, non tolte dal conteggio.

Un'unità apre la successiva quando ne hai **imparato almeno il 60%** — cioè
almeno una carta di quella frase è uscita dall'apprendimento ed è in ripasso —
oppure quando le hai viste tutte. La seconda condizione non è una scorciatoia:
serve a non lasciare la giornata senza frasi nuove il giorno in cui finisci
un'unità, visto che una carta introdotta stamattina non è ancora "imparata" e
non lo sarà fino a domani. Per lo stesso motivo la coda può attingere a
un'unità di riserva oltre quelle aperte: senza, il tetto di frasi nuove non
verrebbe rispettato proprio nei giorni di passaggio.

Perché esista, senza gonfiare: un traguardo vicino regge la motivazione meglio
di uno lontano (Bandura & Schunk, 1981, sui goal prossimali), e le frasi di
un'unità condividono livello e settore, quindi vocabolario e situazione — il
contesto che si ripete costa meno da tenere insieme di dodici frasi scollegate.
Quello che il percorso *non* dimostra di fare è insegnare meglio: è
organizzazione del materiale, non un metodo nuovo. Il metodo resta sotto.

## Obiettivo del giorno, punti e serie

In cima alla home c'è un anello: i punti di oggi contro l'obiettivo che hai
scelto (60, 120, 200 o 300, cioè da sei a trenta carte). A fine sessione
l'anello si riempie, con un suono breve e diverso quando l'obiettivo è appena
stato raggiunto.

La regola che tiene la cosa onesta: **dieci punti per ogni carta portata a
termine, giusta o sbagliata che sia**, più venti una volta al giorno quando
svuoti i ripassi in scadenza. Premiare la risposta giusta spingerebbe a
scegliere gli esercizi facili e a evitare quelli che insegnano di più — cioè
esattamente il contrario di quello che serve. Chi sbaglia una carta difficile
ha lavorato quanto chi ne indovina una facile.

Sul perché esiste, senza gonfiare: fissare un obiettivo esplicito e un po'
sopra la comodità è una delle poche leve motivazionali con basi solide (Locke &
Latham, 2002). Punti e serie di giorni sono un'impalcatura più debole: aiutano
a presentarsi, non a imparare, e la letteratura sulla gamification è molto meno
univoca di quanto il marketing lasci credere. Stanno lì per quello, e per
niente di più — e non toccano in nessun modo lo scheduler.

I suoni si spengono dalle impostazioni, e si tacciono da soli quando il sistema
chiede meno movimento (`prefers-reduced-motion`), insieme alle animazioni.

## Il criterio di sessione

Quante volte devi azzeccare una carta prima che la sessione la lasci andare:
**una** (di serie) o **due**. Con due, dopo un richiamo corretto la carta torna
qualche posizione più avanti e va richiamata di nuovo prima di uscire.

È il *successive relearning* di Rawson & Dunlosky (2011) e Rawson, Dunlosky &
Sciartelli (2013): portare ogni elemento a un criterio di richiamo dentro la
sessione, e poi ripetere la cosa nelle sessioni successive, regge a mesi di
distanza molto meglio del richiamo singolo. Il secondo richiamo costa poco —
la carta è appena stata richiamata — e rende molto. In cambio le sessioni si
allungano, quindi la scelta resta esplicita.

## Tarare il modello sui propri ripassi

I 19 pesi di FSRS vengono di serie dai ripassi di centinaia di milioni di carte
altrui. Rifarli sui propri è il senso dichiarato dell'algoritmo, non un extra —
ed è quello che fa **Progressi ▸ Taratura del modello**.

I pesi stanno **nel mazzo, non nelle impostazioni**: non sono una preferenza,
sono un modello adattato ai ripassi di una lingua. Come si consuma la memoria
sul russo — alfabeto diverso, nessuna parola trasparente — non dice niente su
come si consuma sullo spagnolo. Fino al 29/08/2026 erano un'impostazione
globale, quindi tarare una lingua ritarava di nascosto tutte le altre; i pesi
globali di allora la migrazione li butta invece di regalarli a una lingua a
caso, perché non c'è modo di sapere su quale erano stati calcolati.

Come funziona:

1. dal registro si ricostruisce la storia di ogni carta (voto e giorni
   trascorsi, in ordine), scartando quelle di cui non si conosce l'inizio;
2. per una data scelta di pesi si rigioca la storia in avanti e, a ogni ripasso
   a distanza di almeno un giorno, si confronta la probabilità di ricordare che
   il modello prevedeva con quello che è successo davvero;
3. la misura è la **log-loss**, affiancata dall'**RMSE di calibrazione**: la
   prima dice quanto le previsioni sbagliano, la seconda se sono oneste — un
   modello che dice "85%" deve azzeccarci l'85% delle volte;
4. si scende **a coordinate**: un peso alla volta, si prova a spostarlo su e giù
   e si tiene lo spostamento che abbassa la log-loss. Quattro passate bastano e
   girano in un browser in un paio di decimi di secondo.

Su dati simulati a partire da pesi diversi da quelli di serie, la procedura
recupera un modello migliore dei default (log-loss 0,297 → 0,290, calibrazione
2,8% → 1,0%, in 180 ms). Su dati che seguono già i default il guadagno resta
trascurabile: è il controllo che impedisce all'ottimizzatore di inventarsi
miglioramenti che non ci sono.

Sotto i 120 ripassi utilizzabili il bottone resta spento, e fra 120 e 400 l'app
avverte che la stima è ancora rumorosa.

### Il prezzo della ritenzione

Alzare la ritenzione richiesta accorcia gli intervalli: ricordi di più e ripassi
di più. Non esiste un numero giusto per tutti, e chi te ne consiglia uno sta
nascondendo delle ipotesi. L'app mostra invece **quanto costa ognuno**,
simulando una popolazione di carte per un anno con i tuoi pesi e con i tuoi
tempi reali per ripasso — misurati dal registro, distinguendo quanto costa
indovinare da quanto costa sbagliare, perché una carta sbagliata torna più volte
e riparte da più in basso.

Con i pesi di serie, da 80% a 95% i ripassi passano da 5,4 a 11,6 all'anno per
carta, più del doppio, a fronte di 8 punti di memoria media in più. La scelta
resta tua, ma con i numeri davanti.

## I due motori

### FSRS — quando ripassare (`assets/js/fsrs.js`)

Implementazione di FSRS v5 (Ye et al.), il modello DSR che sta anche dietro allo
scheduler moderno di Anki. Ogni carta ha:

| | |
| --- | --- |
| **S** stabilità | l'intervallo, in giorni, al quale la probabilità di ricordare vale 0.9 |
| **D** difficoltà | da 1 a 10, con regressione verso la media: un errore isolato non affossa la carta |
| **R** recuperabilità | `R(t) = (1 + 19/81 · t/S)^-0.5`, una legge di potenza, non un esponenziale |

L'intervallo successivo si ottiene invertendo la curva per la ritenzione
richiesta nelle impostazioni (80-95%). Ripassare quando R è già sceso fa
crescere S molto più che ripassare subito: è lo spacing effect, scritto in
formule.

I pesi usati sono i 19 parametri di default della versione 5, ottimizzati su
dati aggregati. Un'ottimizzazione personale richiederebbe qualche migliaio di
ripassi tuoi e non è (ancora) implementata.

### IRT — a che livello sei (`assets/js/irt.js`)

Test adattivo su modello logistico a due parametri:

- `P(θ) = 1 / (1 + e^(-a(θ-b)))`, dove θ è la tua abilità, `b` la difficoltà
  dell'item e `a` quanto quell'item discrimina;
- dopo ogni risposta θ si ristima con **EAP** su una griglia con prior
  N(m, 1): regge anche i pattern "tutte giuste" o "tutte sbagliate", dove la
  massima verosimiglianza divergerebbe;
- l'item successivo è quello di **massima informazione di Fisher** in θ, cioè
  quello di cui l'esito è meno prevedibile;
- ci si ferma quando l'errore standard scende sotto 0.35, o dopo 16 domande.

Le soglie in θ sono ancorate alle bande del QCER (A1-C2). Sulle banche reali,
in simulazione, l'abilità vera viene recuperata entro ±0.36 su tutta la scala.

#### La domanda prima del test

Il centro `m` del prior non è sempre zero, e la differenza si vede alla prima
domanda. Con un prior N(0,1) la stima parte da metà scala — fra B1 e B2 — e
l'item di massima informazione è di conseguenza difficile: chi non ha mai
aperto un libro di tedesco si vedeva arrivare come **domanda 1** una frase al
Konjunktiv II, e poi altre cinque che non poteva capire, perché la regola di
arresto chiede almeno otto risposte. Il livello finale ci arrivava lo stesso:
quello che si perdeva per strada era chi stava studiando.

Adesso prima del test c'è **una domanda sola** — mai studiata / qualche base /
me la cavo / la uso / non saprei — e sposta il centro del prior a -2.2, -1.3,
-0.4, +0.5 o 0. È la prassi dei test adattivi veri, dove il prior si prende da
un questionario di ingresso (van der Linden & Glas 2000). Dichiarando "mai
studiata", la prima domanda tedesca diventa `Ich habe ____ Zeit`.

Due cose che rendono la scelta difendibile invece che comoda:

- **si sposta la media, non la larghezza.** La deviazione standard resta 1,
  cioè il restringimento è quello di prima: la domanda d'ingresso è un punto di
  partenza, non una risposta. Chi si sopravvaluta viene smentito — misurato: un
  principiante vero (θ = -2.2) che dichiara "la uso" esce dal test a -1.79.
- **la griglia di quadratura arriva a ±7** e non più a ±4. Con la media a -2.2
  un bordo a -4 taglia la coda da un lato solo, e la stima esce spostata in su
  di 0.08 già prima della prima risposta: il test direbbe qualcosa che nessuno
  gli ha detto.

## Il corpus

| Lingua | Frasi | di cui A1-A2 | Situazioni quotidiane | Item del test |
| --- | --- | --- | --- | --- |
| 🇩🇪 Tedesco | 260 | 140 | 38/38 | 44 |
| 🇨🇭 Svizzero tedesco | 167 | 94 | 38/38 | 34 |
| 🇷🇺 Russo | 219 | 124 | 38/38 | 40 |
| 🇬🇧 Inglese | 270 | 135 | 38/38 | 48 |
| 🇪🇸 Spagnolo | 187 | 103 | 38/38 | 38 |

**1103 frasi**, tutte incise, tutte con almeno il 50% del corpus fra A1 e A2. In
nessuna delle cinque lingue resta un punto grammaticale con un esempio solo: era
il difetto che restava dopo la copertura delle situazioni, perché una regola
vista una volta sola si impara come frase, non come regola.

Tutte le frasi sono scritte per italofoni: la nota di ogni frase spiega proprio
il punto dove l'italiano ci fa sbagliare (la posizione del verbo tedesco,
`must` contro `have to`, `ser` contro `estar`, il congiuntivo dopo `cuando`).
Media di sei parole per frase.

### Quanto può essere lunga una frase

| | A1 | A2 | B1 | B2-C2 |
| --- | --- | --- | --- | --- |
| massimo di parole | 6 | 7 | 8 | 9 |

Non è una preferenza estetica. Una frase si studia perché entra tutta insieme
nella memoria di lavoro (Miller 1956, 4±1 blocchi); una che non ci entra si
impara a pezzi, cioè non si impara. Ad A1 una frase lunga non è più difficile:
è sbagliata, perché chi è ad A1 non ha ancora i blocchi con cui accorparla.

Il tetto sale col livello perché certe strutture non stanno in meno — un
periodo ipotetico ha due proposizioni e non si può mostrare con una — e nove
parole è il massimo assoluto: ci arrivano solo quelle.

Prima il limite era una finestra sola, 2-12 parole per tutti, e nessuna frase
ci arrivava neanche vicino: un limite che non limita niente non è un limite.
Con il tetto per livello sette frasi sono risultate fuori e sono state
riscritte più corte; la mediana del corpus resta 5 parole.

### Come si allarga il corpus, e come si evita di riempirlo di niente

Un corpus può essere corretto e inutile: frasi giuste che nessuno dice mai. Per
non arrivarci, prima di aggiungere si guarda che cosa manca:

```bash
node tools/corpus-review.mjs        # tutte le lingue
node tools/corpus-review.mjs de ru  # solo queste
```

Il rapporto mostra cinque cose: la **forma della piramide** (quante frasi per
livello — in basso ne servono di più, non di meno, perché è lì che si passa il
tempo), la **lunghezza** (ad A1 una frase lunga non è difficile, è sbagliata),
le **situazioni quotidiane coperte** contro un elenco esplicito di 38 — salutare,
chiedere indicazioni, il conto, la farmacia, il bucato, il wifi — i **doppioni**
(due frasi che insegnano la stessa cosa) e i **punti grammaticali con un solo
esempio**, che si imparano a memoria invece che come regola.

Il riconoscimento delle situazioni è dichiaratamente grezzo: parole chiave sulla
traduzione italiana, elencate in chiaro in [`tools/situations.mjs`](tools/situations.mjs)
proprio perché si possano contestare riga per riga. Non è una misura, è una
lente per vedere i buchi.

Quello che il rapporto trova, il validatore lo tiene fermo: almeno il 40% del
corpus fra A1 e A2, nessuna frase facile più lunga di sette parole (nove ad A2),
nessuna frase identica a un'altra, nessuna coppia quasi identica su punti
grammaticali diversi — due frasi vicinissime sullo **stesso** punto sono una
coppia minima voluta (`hay` contro `estar`, `wo` contro `wohin`) e restano — e
un numero di situazioni coperte che non può scendere sotto quello già raggiunto.

Tedesco, russo e inglese coprono tutte e 38 le situazioni. Svizzero tedesco e
spagnolo no, ed è scritto nella tabella qui sopra invece che nascosto.

### Il russo, e i due problemi che porta

**L'alfabeto.** La frase giusta si scrive in cirillico, che sulla tastiera
italiana non c'è. Le risposte si accettano in tutti e due i modi: in cirillico
il confronto è stretto (ь e ъ contano), in caratteri latini entrambe le frasi
vengono ridotte alla stessa traslitterazione grossolana, così le distinzioni che
la tastiera non permette di fare (щ contro ш, ы contro и) non ti penalizzano.
`зову́т`, `zovut`, `zovút`, `zavut`: passano tutte tranne l'ultima, che è
un'altra parola.

**L'accento tonico.** Non si scrive mai nei testi veri, cambia da forma a forma
e sposta il suono di tutte le vocali attorno: è l'informazione che manca sempre
e che serve sempre. Nel corpus si segna con un asterisco davanti alla vocale
(`теб*я`), diventa `тебя́` quando studi e sparisce nel confronto. Il validatore
controlla che ogni parola polisillabica ne abbia esattamente uno, che cada su
una vocale e che non finisca su una ё, che l'accento ce l'ha già per conto suo.

Ogni frase porta con sé una **riga di pronuncia** in caratteri latini, generata
dal testo accentato: `Как тебя́ зову́т?` diventa `kak tebiá zovút?`. È
un'approssimazione pensata per un lettore italiano, non una traslitterazione
scientifica.

### Lo svizzero tedesco, con tre avvertenze

Il dialetto è un caso a parte e l'app lo dice apertamente, sia in questa pagina
sia dentro la schermata di studio:

1. **Non esiste un solo svizzero tedesco.** Qui si usa il **züridütsch**, il
   dialetto di Zurigo: basilese, bernese e vallesano cambiano parecchio.
2. **Non esiste un'ortografia ufficiale.** Si segue la **grafia Dieth**, quella
   di SMS e cartelli: si scrive come si sente.
3. **Il QCER non certifica i dialetti.** I livelli A1-C2 servono solo da bande
   di difficoltà, per far girare la stessa macchina delle altre lingue.

Ogni frase in dialetto porta con sé **l'equivalente in tedesco standard**, che
compare accanto alla traduzione: è il ponte che rende visibile la regola —
`Trotz em Räge` contro `Trotz des Regens` dice in un colpo solo che il genitivo,
in Svizzera, non c'è. La voce sintetica usa `de-CH`, cioè tedesco standard
svizzero: va presa come indicazione, non come modello di pronuncia.

Per aggiungerne, basta una riga in `assets/js/corpus-de.js`, `corpus-gsw.js`,
`corpus-en.js` o `corpus-es.js`:

```js
['b1-46', 'B1', 'She talked us through it.', 'Ci ha spiegato tutto passo passo.',
 'phrasal verb', 'talked us through', ['lavoro'], 'talk somebody through = spiegare passo per passo.'],
```

In svizzero tedesco si aggiunge un nono campo con il tedesco standard.

Poi `node tools/validate.mjs` controlla che la chiave del cloze compaia
davvero nella frase, che il punto grammaticale sia nell'elenco, che i settori
esistano, che la lunghezza resti nella finestra 2-12 parole e che ogni frase in
dialetto abbia il suo equivalente standard.

## I dati

Tutto resta su questo dispositivo, in `localStorage`. L'unica cosa che esce è
la frase da leggere ad alta voce, e solo se la voce online è accesa. Da
*Impostazioni* si esporta e si reimporta un backup JSON.

Quello che questa app accumula — mesi di storia dei ripassi — è anche l'unica
cosa che non si può rifare. Quindi:

- **l'indirizzo fa parte dell'identità del deposito.** `localStorage` è legato
  all'origine: aperta da un indirizzo diverso, l'app riparte vuota. Su un
  tunnel effimero, che cambia nome a ogni riavvio, non si accumula nemmeno una
  settimana — e l'icona aggiunta alla schermata Home punta a un indirizzo morto.
  Serve un dominio stabile, e le impostazioni lo dicono invece di lasciarlo
  scoprire.
- **si chiede al browser di non sfrattare i dati** (`navigator.storage.persist`),
  all'avvio e di nuovo quando si comincia a studiare. Le impostazioni mostrano
  se il permesso c'è davvero: senza, Safari li cancella dopo settimane di
  inattività sul sito.
- **una scrittura fallita si vede.** Con lo spazio esaurito, o in navigazione
  privata, `localStorage` rifiuta di scrivere; prima l'errore finiva in un
  `catch` vuoto e si poteva studiare un'ora intera senza registrare niente.
  Adesso resta segnato e la home lo dice in rosso. Un mazzo tedesco studiato per
  intero pesa circa mezzo megabyte e il tetto di Safari è 5 MB: con qualche
  lingua ci si arriva.
- **il registro ha un tetto di 6000 ripassi, e si taglia per storie intere.**
  Tagliare le voci più vecchie una per una sembrava ovvio ed era la cosa
  peggiore: l'ottimizzatore scarta ogni carta di cui non vede il primo ripasso,
  che è esattamente quello che il taglio cronologico porta via per primo — le
  carte più vecchie, cioè le uniche con storie lunghe, diventavano inutilizzabili
  proprio quando ce n'erano abbastanza per tarare il modello. Adesso si buttano
  storie complete, dalla carta vista meno di recente in giù, e quello che resta
  resta utilizzabile per intero.

## Provarla

I moduli JavaScript non funzionano aprendo il file da disco: serve un server.

```bash
git clone https://github.com/Protsky/Language.git
cd Language
python3 -m http.server 8080     # poi apri http://localhost:8080/
```

### L'indirizzo

> **https://language.donati.workers.dev/**

Un Worker Cloudflare con gli asset statici, costruito dal ramo `main` a ogni
push. L'indirizzo è fisso, e il sito funziona anche a computer spento.

Prima l'app stava su un quick tunnel, il cui nome cambia a ogni riavvio: fra il
29 e il 30 agosto 2026 è cambiato **cinque volte**, e siccome `localStorage` è
legato all'origine, a ogni giro la storia dei ripassi ripartiva da zero e
l'icona sulla schermata Home restava appesa a un indirizzo morto. Era il
difetto più grosso dell'app, e non stava nel codice.

**Un indirizzo solo, però.** Due indirizzi che servono la stessa app sono due
origini, quindi due mazzi separati: chi aggiunge alla Home l'uno e poi apre
l'altro crede di aver perso tutto. Quando se ne accende un secondo (GitHub
Pages, un tunnel di prova) va spento il primo, o dichiarato quale dei due è
quello vero.

**Che cosa esce, oggi.** Il deploy serve la **radice del repository**, quindi
online c'è anche ciò che non è l'app: `tools/`, questo README, la ROADMAP.
`node tools/pubblica.mjs` prepara `dist/` con solo ciò che serve — elenco di
cose **ammesse**, non di divieti — ma perché venga usato bisogna dire al
progetto Cloudflare che la cartella degli asset è `dist` e il comando di
costruzione è quello. Finché non lo si fa, `dist/` resta il modo di vedere che
cosa uscirebbe.

### Pubblicare solo l'app, invece della radice del repo

L'app è statica: pubblicarla è servire una cartella. `tools/pubblica.mjs`
prepara quella cartella — `dist/` — e ci mette **solo l'app**: niente `tools/`,
niente README, niente dotfile. È la stessa regola dell'nginx dello studio, che
su quei percorsi risponde 404; qui invece di nasconderli non si copiano
affatto, che è più difficile da sbagliare. L'elenco è di cose **ammesse**, non
di cose vietate: un file nuovo non passa finché non lo si aggiunge, e se ne
accorge subito chi lo cercava.

Si accende dichiarandolo al progetto Cloudflare — comando di costruzione
`node tools/pubblica.mjs`, cartella degli asset `dist` — oppure mettendo la
stessa cosa in un `wrangler.jsonc` nel repository, che ha il vantaggio di
essere versionata insieme al resto invece di vivere in un pannello.

`dist/_headers` porta con sé le intestazioni che qui fa nginx. La più
importante è `sw.js` con `no-cache`: è il file che decide quando l'app si
aggiorna, e servito da una copia vecchia l'avviso «c'è una versione nuova» non
comparirebbe mai. L'audio dura una settimana — 17 MB che non cambiano quasi
mai — ma non è `immutable`: se una frase cambia, la sua incisione cambia sotto
lo stesso indirizzo.

**Perché un indirizzo fisso conta più di quanto sembri.** `localStorage` è
legato all'origine: su un tunnel effimero, che cambia nome a ogni riavvio, la
storia dei ripassi riparte da zero ogni volta e l'icona sulla schermata Home
resta appesa a un indirizzo morto. Fra il 29 e il 30 agosto 2026 l'indirizzo è
cambiato cinque volte.

### Sull'iPhone

1. Apri **https://language.donati.workers.dev/** in Safari.
2. *Condividi ▸ Aggiungi a Home*: da lì parte a schermo intero e funziona
   offline, incisioni comprese.

L'indirizzo non cambia più, quindi l'icona continua a puntare allo stesso
deposito: i ripassi si accumulano invece di ricominciare da capo.

### La voce: incisa, non sintetizzata sul momento

Tutte e 1103 le frasi del corpus sono **incise una per una** con una voce
neurale, e servite come file. Non è una comodità: è la sola risposta al motivo
per cui la voce non era buona in nessuna lingua.

`speechSynthesis` legge con le voci installate sul dispositivo, e quelle
cambiano da telefono a telefono. Su iPhone, per il russo, Safari espone **una
voce sola** — la Milena compatta — e le versioni migliorate scaricate dal
sistema al browser non arrivano mai. Regolare velocità e tono non serviva a
niente: la voce era quella. Il corpus però è un insieme *chiuso* di frasi
corte, e inciderlo una volta risolve tre cose insieme:

- la voce è **la stessa su ogni dispositivo**, e non dipende più da cosa c'è
  installato;
- si sente **senza rete**, perché i file finiscono nella cache dell'app;
- mentre studi **non parte nessuna richiesta verso nessuno**: la dipendenza da
  un servizio esterno si sposta da chi studia a chi pubblica.

| | voce | frasi | peso |
| --- | --- | --- | --- |
| 🇩🇪 Tedesco | `de-DE-KatjaNeural` | 260 | 4.8 MB |
| 🇨🇭 Svizzero tedesco | `de-CH-LeniNeural` | 167 | 3.0 MB |
| 🇷🇺 Russo | `ru-RU-SvetlanaNeural` | 219 | 3.9 MB |
| 🇬🇧 Inglese | `en-GB-SoniaNeural` | 270 | 4.2 MB |
| 🇪🇸 Spagnolo | `es-ES-ElviraNeural` | 187 | 3.2 MB |

Si incidono con `tools/voci.py`, che rifà **solo le frasi cambiate**: si
riconosce dall'impronta di frase e voce, quindi aggiungerne dieci costa dieci
incisioni, non mille.

**Da dove viene la voce, per intero.** Sono le voci neurali di Microsoft, prese
dall'endpoint che usa la lettura ad alta voce di Edge. Non è un'API documentata
per questo uso, e i file restano dentro il repo: è una scelta ragionevole per
un'app personale e **non lo sarebbe per una pubblicata**. Il resto del
programma non ne dipende — la sorgente è una tabella di sei righe in
`tools/voci.py`, e passare a un motore locale e libero (Piper) vuol dire
cambiare quella e rilanciare lo script.

**Il ritmo.** Alla voce incisa *non* si applica il moltiplicatore per lingua
(il 72% del russo): quello esisteva per rimediare a una sintesi che a velocità
piena diventava illeggibile, non perché il russo vada letto lento in assoluto.
Su una voce registrata a ritmo naturale sarebbe un handicap raddoppiato, e
studiare per mesi su un parlato rallentato prepara a un parlato che nessuno fa.
Resta la velocità scelta nelle impostazioni, e resta il **🐢 Lento**, che
adesso rallenta *senza abbassare il tono* (`preservesPitch`): un rallentamento
che cala di tono non è la stessa lingua più lenta, è un'altra lingua.

**L'accento tonico del russo non entra nel sintetizzatore.** È un aiuto per chi
legge, non ortografia. Misurato: dandolo in pasto a `ru-RU-SvetlanaNeural`
l'audio si allunga di quasi un secondo su tre parole e gli attacchi slittano —
il motore ci inciampa invece di usarlo. Si legge la frase senza.

### Voce del telefono e voce online, adesso di riserva

Restano tutte e due, e servono solo dove una frase non fosse ancora incisa.

`speechSynthesis` legge con le voci installate sul dispositivo, e su iPhone
Safari per il russo ne espone **una sola**: la Milena compatta. Le versioni
migliorate scaricate da *Accessibilità ▸ Contenuto letto* quasi mai arrivano al
browser, e dal lato del codice non c'è modo di forzarle.

Quindi si prende la voce da un'altra parte. Google Translate espone un endpoint
di sintesi **pubblico e senza chiave** — lo stesso che pronuncia le traduzioni
sul loro sito — che restituisce un mp3 di una voce neurale:

```
https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ru&q=…
```

Non serve libreria né registrazione: basta un `<audio>` che punti lì. È attivo
di serie sul **russo** e si può accendere su qualunque lingua da *Impostazioni
▸ Voce*, con un bottone per provarlo e vedere subito se risponde.

Il prezzo, per intero:

- **serve la connessione.** Senza rete l'app continua a funzionare con la voce
  del telefono;
- **la frase viaggia fino a Google.** Sono frasi di un corpus pubblico, non
  roba tua, ma va detto. La pagina è servita con `referrer: no-referrer`, così
  non parte nemmeno l'indirizzo da cui arriva la richiesta;
- **non è un servizio documentato.** Può rallentare, limitare le richieste o
  sparire. Per questo ogni riproduzione ha un ripiego immediato: al primo
  fallimento l'online si spegne per il resto della sessione e si torna alla
  voce locale, senza attese;
- **non essendoci CORS** l'mp3 non si può leggere via `fetch`, quindi non
  finisce nella cache offline dell'app: resta la cache HTTP del browser, che
  copre i riascolti ravvicinati.

Questa parte è l'unica del progetto che dipende da un servizio esterno, e
l'unica che le prove automatiche non possono verificare fino in fondo: si
controlla che l'indirizzo sia ben formato, che il cirillico sopravviva alla
codifica, che le frasi stiano sotto il limite di caratteri del servizio e —
questo sì, per davvero, perché nell'ambiente di prova la rete non c'è — che
**il ripiego funzioni**: senza connessione l'app lo dice e continua con la voce
del telefono, senza errori.

### Come si legge

Sotto ogni frase c'è una riga che dice **come si pronuncia**, scritta con le
convenzioni di chi legge in italiano:

| | |
| --- | --- |
| 🇷🇺 `Ско́лько э́то сто́ит?` | skólko éto stóit? |
| 🇩🇪 `Ich möchte einen Kaffee.` | ih mö́hte áinen káfe |
| 🇬🇧 `She had left before I called.` | shi had left bifór ai kold |
| 🇪🇸 `Me llamo Marta.` | me gliámo márta |
| 🇨🇭 `S Zimmer isch im dritte Stock.` | s tsíma ish im dríte shtok |

Sono **due cose diverse** con lo stesso scopo. Per il russo è una
traslitterazione, e senza non si legge proprio: l'alfabeto è un altro. La
calcola l'app dal cirillico accentato, e c'era già.

Per le altre quattro non serve traslitterare — si scrivono in caratteri latini,
e proprio per questo ingannano: un italiano legge `much` come «muk», `gusta`
come «giusta», `Ich möchte` come «ik moc-te». Lettere che conosce, suoni che non
sono i suoi. Lì la riga è una **riscrittura fonetica**, e non si può calcolare
nel browser: l'inglese non ha regole, e il tedesco ne avrebbe decine con
altrettante eccezioni. La produce `tools/pronuncia.py` con **espeak-ng**, che dà
l'IPA parola per parola, e la si traduce in lettere che un italiano legge da
solo.

Compare a carta girata (prima sarebbe la risposta) e in **Esplora** subito, dove
non c'è niente da svelare.

#### Le tre scelte che la rendono leggibile

- **`ch` vale «cena», `gh` vale «ghiro», `gli` vale «figlio».** In italiano
  `c` e `g` cambiano suono da sole a seconda di cosa segue: scrivere `much`
  come «mac» farebbe leggere «mak», e `llamo` come «glamo» farebbe leggere
  /glamo/. I due suoni viaggiano come segnaposto e diventano lettere solo alla
  fine, guardando la vocale che li segue.
- **L'accento solo dove serve.** Va sulla sillaba tonica, e solo sulle parole
  di più di una sillaba: presa da sola ogni parola riceve un accento primario,
  e la riga si riempirebbe di acuti su «e», «la», «per», che nel parlato non ne
  hanno nessuno. Per questo la frase viene data a espeak **intera** — così
  `are` resta «a» e `I` non prende l'accento che nel parlato non ha — e solo
  dopo si separano le parole, per poterle rileggere una sotto l'altra.
- **Quello che l'italiano non ha resta com'è.** La `ü` e la `ö` tedesche, la
  `th` spagnola di *gracias*, la `dh` inglese di *the*. Nessuna scrittura può
  inventare un suono che chi legge non ha mai fatto: la riga serve a non
  sbagliare di grosso e a sapere dove cade l'accento, non a sostituire
  l'ascolto — che sta a un tocco di distanza.

Per lo spagnolo una deroga dichiarata: `d`, `g` e `b` fra vocali sono davvero
fricative (ð, ɣ, β), ma scriverlo rende la riga illeggibile — «de dónde»
diventerebbe «de dhónde» — e sono suoni che un italiano produce da solo parlando
in fretta. Restano `d`, `g`, `b`. La `th` invece resta, perché lì chi sbaglia
dice un'altra parola.

### Ascolto guidato, sui tempi veri

Insieme all'audio il sintetizzatore consegna **l'attacco e la durata di ogni
parola**, e quei numeri vengono salvati accanto ai file. È la parte che non si
sente ed è quella che vale di più:

- **👣 Parola per parola** suona la frase **intera**, rallentata, e illumina la
  parola che sta suonando in quel momento;
- **toccando una parola qualsiasi** si sente solo quella, ritagliata dallo
  stesso file: arriva con l'intonazione che ha *dentro* la frase.

Prima erano tante sintesi separate, una per parola, e si sentiva: una parola
pronunciata da sola ha l'intonazione di una parola sola, e ascoltarne sei di
fila non insegna dove finisce l'una e comincia l'altra dentro il parlato vero —
che è tutto il punto dell'esercizio. Su una lingua nuova, a maggior ragione in
un altro alfabeto, metà del problema non è come suona la voce: è la
**segmentazione**. Un canale doppio, che si sente e si vede insieme, lega il
suono alla forma scritta.

Il ritaglio si ferma controllando l'orologio **a ogni fotogramma** e non
sull'evento `timeupdate`, che arriva quattro volte al secondo: una parola dura
175 millisecondi, e fermandosi su `timeupdate` si sentirebbe anche quella dopo,
cioè si sbaglierebbe proprio la cosa che il ritaglio serve a fare.

**Dove i tempi non ci sono.** Su 1103 frasi, 22 tornano dal motore con un segno
solo per tutta la frase invece che uno per parola — sono quasi tutte in
dialetto, e `de-CH-LeniNeural` lo fa in modo ripetibile sulle frasi che
cominciano con «Das». Lì l'audio c'è lo stesso ed è l'illuminazione che si
spegne: meglio nessuna evidenziazione che una che illumina la parola sbagliata.

Per il dialetto non esiste una voce sintetica vera: si usa il tedesco svizzero
standard, che va preso come indicazione e non come modello di pronuncia.

## Leggibilità, e chi non guarda lo schermo

Tre cose che non si vedono finché non servono:

- **lo zoom non è bloccato.** La pagina non dichiara più `user-scalable=no`:
  impedire di ingrandire è un fallimento WCAG 1.4.4, e qui si legge cirillico
  con l'accento tonico segnato, cioè proprio il caso in cui ingrandire serve.
- **il testo straniero dichiara la propria lingua.** La pagina è `lang="it"`, e
  senza un `lang` sulle frasi VoiceOver leggeva `Ich hätte gern` con la voce
  italiana. Adesso ce l'hanno le opzioni, le tessere, i buchi, la soluzione, il
  campo dove si scrive e la colonna destra dell'abbinamento.
- **la correzione viene annunciata.** Il riquadro parola per parola è un
  `role="status"` con `aria-live="polite"`: chi usa lo screen reader sente com'è
  andata invece di doverla cercare.

## Quando esce una versione nuova

L'app è statica e si aggiorna riscrivendo i file, quindi il service worker può
trovarsi una versione nuova sotto i piedi a metà sessione. Non la prende:
il worker nuovo si installa e **aspetta** (niente `skipWaiting` all'installazione,
che servirebbe i moduli nuovi a una pagina caricata con quelli vecchi), un
avviso in fondo allo schermo dice che c'è, e a dargli il posto è chi studia
quando ha finito la carta che ha in mano. Il numero di versione della cache in
`sw.js` è quello che fa comparire l'avviso: va alzato a ogni pubblicazione.

## Strumenti

```bash
node tools/validate.mjs     # corpus, motori, percorso, esercizi, taratura, deposito, voce: 450 controlli
node tools/corpus-review.mjs       # che cosa manca al corpus, lingua per lingua
tools/.venv/Scripts/python tools/voci.py       # incide le frasi nuove (solo quelle)
tools/.venv/Scripts/python tools/pronuncia.py  # rifà le righe «come si legge»
node tools/smoke.mjs        # 127 controlli end-to-end in Chromium (serve playwright)
python3 tools/make-icons.py        # rigenera le icone PNG
```

## Perché dovrebbe funzionare

- **Cepeda et al. (2006)** — meta-analisi su 254 studi: a parità di tempo,
  distribuire le ripetizioni batte concentrarle.
- **Roediger & Karpicke (2006)** — testing effect: richiamare consolida più che
  rileggere. Per questo qui si scrive prima di vedere.
- **Richland, Kornell & Kao (2009)**, **Carpenter & Toftness (2017)** —
  prequestioning: tentare prima di sapere migliora ciò che si impara subito
  dopo. Una frase nuova non viene mostrata, viene chiesta.
- **Morris, Bransford & Franks (1977)** — transfer-appropriate processing:
  l'esercizio deve somigliare all'uso. Da qui la scala "parlare".
- **Bjork** — desirable difficulties: la carta torna quando ricordarla costa.
- **Ye et al. (2022-2024)** — FSRS: il modello di memoria usato qui.
- **Krashen (1985)** — input comprensibile "i+1": le frasi nuove escono appena
  sopra il livello stimato.
- **Wray (2002)**, **Ellis (2012)** — formulaic sequences: si impara a blocchi.
- **Nation (2001)** — la conoscenza ricettiva precede quella produttiva.
- **Rohrer & Taylor (2007)** — interleaving: mescolare conviene.
- **Lord (1980)**, **van der Linden & Glas (2000)** — test adattivi su IRT.
- **Koriat & Bjork (2005)**, **Dunlosky & Rawson (2012)** — illusione di
  competenza: perché l'autovalutazione qui non esiste.
- **Slamecka & Graf (1978)** — effetto generazione: si ricorda ciò che si produce.
- **Renkl & Atkinson (2003)** — fading: i buchi crescono col consolidarsi.
- **MacLeod et al. (2010)** — production effect: dirlo ad alta voce aiuta.
- **Rawson & Dunlosky (2011)**, **Rawson, Dunlosky & Sciartelli (2013)** —
  successive relearning: il criterio di sessione a due richiami.
- **Nation** — copertura lessicale: si conta il lessico per tipi diversi.
- **Bandura & Schunk (1981)** — traguardi vicini: il percorso a unità spezza il
  corpus in pezzi con un inizio e una fine, senza toccare le scadenze.
- **Consiglio d'Europa, QCER (2001/2020)** — la scala A1-C2 (che però i
  dialetti non li copre: per lo svizzero tedesco sono bande di difficoltà).
