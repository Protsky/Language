# Parte 2 — Vento in diretta (classe HAWK) e piattaforma per sviluppatori

**Documento di ricerca** — complemento a [`strumento-80mm-esp32-specifica-hardware.md`](./strumento-80mm-esp32-specifica-hardware.md).
Versione 0.1 — settembre 2026.

Due domande distinte, trattate separatamente:
**A.** cosa serve, in hardware, per avere il **vento istantaneo** come LXNAV HAWK o Anemoi;
**B.** cosa chiederanno gli sviluppatori (storage, AI locale, connettività, API) e come predisporlo oggi.

---

# PARTE A — Vento in diretta

## A.1 Cosa fanno i prodotti di riferimento

| Prodotto | Approccio | Cosa possiamo imparare |
|---|---|---|
| **LXNAV HAWK** | Filtro di Kalman esteso (EKF) che stima congiuntamente le **tre** componenti del moto della massa d'aria. Vento **istantaneo**, senza attendere né spiralare. Non usa la conservazione dell'energia → **nessuna compensazione TE necessaria**, netto più accurato e indipendente dalla velocità, niente false termiche generate dalle raffiche | È un'opzione software su hardware che ha già IMU + air data. **Il valore è nell'algoritmo, non in sensori esotici** |
| **Anemoi** (RS Flight Systems) | Filtro di Kalman **non lineare a 14 stati**, fonde inerziale + pressione + dati GPS. Scatola sensori con IMU + pitot + statica + ingresso NMEA da FLARM, display remoti da 1,3". **Esplicitamente senza magnetometro**, "prono a interferenze" | Conferma che la prua magnetica **non serve** e anzi peggiora le cose. Conferma anche l'architettura "sensor box + display" |
| **Larus** (open source, `larus-breeze`) | IMU + sensori di pressione + (D-)GNSS. Kalman che fonde quota, velocità verticale e accelerazione verticale per un vario ultra-rapido; compensazione di velocità **GNSS/INS** invece che pneumatica; bussola 3D auto-calibrante con modello magnetico NOAA; uscita NMEA per XCSoar; **simulatore SIL** per qualificare gli algoritmi | **Da studiare riga per riga**: firmware, PCB e documentazione di protocollo sono pubblici. È il punto di partenza tecnico più solido esistente |

**Conclusione strategica**: il vento in diretta non richiede un hardware "diverso" — richiede che l'hardware
che stiamo già progettando sia **calibrato, sincronizzato e a basso bias**. È qui che si vince o si perde.

## A.2 La fisica in una riga, e dove si rompe

```
  vento(NED)  =  velocità al suolo (GNSS)  −  R(assetto) · [ TAS, 0, 0 ]
```

Tre grandezze, tre modi di sbagliare:

| Sorgente d'errore | Effetto sul vento | Ordine di grandezza |
|---|---|---|
| **Errore di prua/assetto** (deriva del giroscopio, disallineamento di montaggio) | Errore proporzionale alla TAS: **1° di prua a 100 km/h ≈ 1,7 km/h di vento fittizio** | **Dominante** |
| **Errore di TAS** (pressione dinamica, OAT, posizione della presa statica) | Errore diretto lungo l'asse longitudinale | 2–5 km/h se OAT è sbagliata di 10 °C |
| **Derapata non misurata** | L'aria non arriva da prua: errore laterale = TAS × sin(β) | 2° di derapata a 100 km/h ≈ 3,5 km/h |
| **Disallineamento temporale dei sensori** | Rumore correlato con le manovre, il vento "salta" in virata | 20 ms a 50 m/s = 1 m |
| **Errori del GNSS in velocità** | Rumore diretto | 0,05 m/s con Doppler multi-banda — trascurabile |

Il messaggio: **la prua è il nemico**. Ecco perché HAWK e Anemoi stimano l'assetto con l'EKF invece di
usare un magnetometro, e perché la qualità dell'IMU e la sua calibrazione termica contano più di
qualunque altra scelta di componente.

## A.3 Requisiti hardware — la lista operativa

### 1. IMU: conta il *bias*, non il rumore

Il parametro che determina la qualità del vento è la **instabilità di bias del giroscopio** e la sua
deriva termica, non la densità di rumore su cui si concentrano i datasheet.

- **ICM-42688-P** (già selezionato in Parte 1) è adeguato: 2,8 mdps/√Hz, buona stabilità termica e
  bassa sensibilità cross-axis. È il minimo sindacale.
- **Doppio IMU** (ICM-42688-P + BMI270) su assi ruotati di 90°: consente voting, cancellazione di
  errori comuni e diagnostica. Costo marginale ~4 €, beneficio grande.
- **Salto di categoria (opzionale)**: ADIS16505 / ADIS16507 (grado tattico, calibrato in fabbrica su
  temperatura). Costo e ingombro sono un altro mondo — da riservare a una eventuale versione "Pro".
- **Calibrazione per singola unità in produzione, non negoziabile**: tumble test a 12 posizioni +
  soak termico (−20 / +25 / +60 °C) con acquisizione dei coefficienti di bias, scala e ortogonalità.
  I coefficienti vanno in una partizione firmata. **È il vero costo nascosto del prodotto**, e insieme
  è ciò che separa uno strumento serio da un giocattolo.

### 2. GNSS: la velocità, non la posizione

- Rate **≥10 Hz** (25 Hz se disponibile), con **accuratezza in velocità** (soluzione Doppler) come
  criterio di scelta, non la CEP di posizione.
- **Doppia banda L1+L5 (NEO-F10N)**: il multipath è il killer della velocità GNSS, e L5 lo riduce.
- **PPS cablato a un timer capture** del P4 — vedi punto 4.
- Antenna esterna con LNA: già previsto in Parte 1.

### 3. Air data: TAS accurata, non solo IAS

- Il canale differenziale **a basso range (SDP31 ±500 Pa)** è ciò che dà risoluzione alle basse
  velocità, dove il rapporto vento/TAS è più favorevole e la stima converge meglio.
- **Sonda OAT esterna, schermata dalla radiazione solare** e in flusso d'aria: un errore di 10 °C
  produce ~1,7% di errore sulla TAS. Molti strumenti sbagliano qui perché leggono la temperatura
  *dentro* la scatola.
- **Compensazione dell'errore di posizione statica** (SPEC): tabella per tipo di aliante, calibrabile
  dall'utente in volo. Va esposta nell'SDK.
- **Modello del ritardo pneumatico**: tubi lunghi 1–2 m con Ø interno piccolo introducono un ritardo
  del primo ordine (decine di ms) diverso su statica e totale. Va modellato e compensato, altrimenti
  in manovra il vento oscilla. Parametri configurabili per installazione.

### 4. Sincronizzazione temporale — il requisito che quasi tutti sottovalutano

Tutti i campioni devono portare un **timestamp hardware su un unico clock**:

- IMU su **SPI con DMA a 200–400 Hz**, campionato su interrupt DRDY, timestamp preso in ISR con
  timer a 1 µs.
- Barometrici e differenziali a 100 Hz, stesso schema.
- GNSS disciplinato dal **PPS**: il PPS aggancia il clock locale al tempo GPS, così il timestamp del
  fix è noto con precisione < 1 ms invece dei 50–200 ms di jitter tipici di un messaggio UART.
- Il core LP dell'ESP32-P4 può fare da time-stamper indipendente dal carico grafico — dettaglio
  architetturale che vale la pena sfruttare.

### 5. Montaggio meccanico e allineamento

- L'IMU dev'essere **rigidamente accoppiato alla cellula**. Uno strumento nel cruscotto è accettabile,
  ma il cruscotto flette e vibra: prevedere smorzamento e, soprattutto, stimare i **tre angoli di
  disallineamento di montaggio come stati dell'EKF**, con procedura di allineamento in volo
  ("volo rettilineo stabilizzato 60 s").
- Fondamentale per l'usabilità: lo strumento **non deve richiedere un'installazione perfetta**.
  L'auto-allineamento è una feature di prodotto, non un dettaglio.

### 6. Magnetometro: presente, ma mai in comando

Anemoi lo esclude, Larus lo usa auto-calibrandolo con il **modello NOAA (WMM)**. La sintesi giusta:

- Montarlo (costa 1,5 €), usarlo **solo come misura ausiliaria a covarianza alta** per limitare la
  deriva di heading nel volo rettilineo prolungato.
- Modello **WMM** a bordo per la declinazione, calibrazione hard/soft-iron guidata dall'utente
  ("fai due 360° lenti"), rilevamento automatico di disturbo (variazione del modulo del campo) con
  esclusione dinamica dalla soluzione.

### 7. Il salto di qualità opzionale: misurare la derapata

Sia HAWK sia Anemoi **stimano** la derapata. Misurarla elimina la seconda sorgente d'errore. Due strade:

- **Economica ed elegante**: due prese statiche sui fianchi opposti della fusoliera → un quarto
  sensore differenziale. È un "filo di lana elettronico" che dà β direttamente. Richiede una **quarta
  porta pneumatica** (o una porta sull'espansione) e una taratura per tipo di aliante.
- **Completa**: sonda a **5 fori** (quattro a croce + uno centrale) che restituisce il vettore
  velocità 3D — modulo, incidenza e derapata — senza parti mobili, risposta rapidissima, funziona ad
  angoli elevati. Richiede calibrazione in galleria del vento e 5 linee pneumatiche: **fuori scala
  per la v1**, ma è la cosa giusta da supportare via connettore di espansione (modulo air-data
  esterno che parla CAN).

**Raccomandazione**: v1 con 3 porte + derapata stimata dall'EKF; predisporre in hardware una **quarta
via pneumatica** e un canale CAN documentato per un futuro modulo air-data. Costo oggi: quasi zero.

### 8. Calcolo

Un EKF a 15–20 stati a 50–100 Hz è banale per il P4 con FPU. Vettore di stato suggerito:

```
quaternione assetto        4      wind NED                   3
bias giroscopio            3      fattore di scala TAS       1
bias accelerometro         3      (opz.) angolo derapata     1
                                  (opz.) disallineamento     3
```

Requisiti software: task a **priorità fissa e periodo rigido**, aritmetica in `float` con
determinismo verificato, nessuna allocazione dinamica nel loop, e watchdog dedicato. L'EKF è un
servizio di sistema: **nessuna app di terze parti deve poterlo rallentare**.

### 9. Validazione — dove il progetto vive o muore

- **Simulatore SIL** con riproduzione di log reali (Larus ne ha uno: copiarne l'approccio).
- **Registrazione grezza di tutti i canali a rate pieno** durante il volo (vedi §B.4): serve per
  sviluppare l'algoritmo offline su dati veri, ed è anche la feature più amata dagli sviluppatori.
- Campagna di volo con riferimento: confronto con vento da spiralata mediato, con radiosondaggi,
  e con un secondo strumento commerciale.

## A.4 Cosa si ottiene, oltre al vento

Una volta che l'EKF gira, escono gratis grandezze che oggi si pagano a parte:

- **Vario a energia totale senza tubo TE** (la compensazione diventa inerziale/GNSS) — il tubo TE
  resta per ridondanza e compatibilità, non per necessità.
- **Netto e vario di massa d'aria** accurati e indipendenti dalla velocità.
- **Gradiente di vento** con la quota (fondamentale in finale e in onda).
- **Componente verticale della massa d'aria**: è ciò che rende utile un vario in dinamica di pendio.
- Base per **assistenza al centraggio** della termica e per stime di prestazione (polare reale).

---

# PARTE B — Cosa serviranno agli sviluppatori

## B.1 Storage: doppio livello, e la SD non basta

| Livello | Componente | Ruolo |
|---|---|---|
| Sigillato | **eMMC 16–32 GB** saldata | Log firmati IGC, registrazione grezza, app installate, mappe |
| Utente | **microSD UHS-I su SDIO 4-bit** (non SPI) | Estrazione tracce, installazione app, dataset |
| Trasferimento | **USB-C in modalità mass storage** | Il pilota non deve estrarre la scheda con i guanti |

Dettagli che fanno la differenza:

- **SDIO 4 bit, non SPI**: la registrazione a rate pieno di ~30 canali a 100 Hz produce qualche MB/h,
  ma lo scarico di ore di log via SPI è insopportabile. Il P4 ha l'host SDMMC: usarlo.
- **Schede industriali pSLC** raccomandate in documentazione: le microSD consumer si corrompono con
  cicli termici e vibrazione. Esporre una **API di salute della scheda** (cicli, errori, spazio).
- **Filesystem resistente allo spegnimento improvviso** (littlefs sulla partizione interna, FAT con
  journaling/commit frequenti su SD) — l'alimentazione di un aliante cade senza preavviso.
- Slot microSD **accessibile dal retro**, push-push, con protezione ESD e rilevamento inserzione.

## B.2 AI locale: cosa è vero e cosa no

Va detto chiaramente, perché è l'area con più marketing e meno sostanza.

### Cosa gira davvero a bordo (oggi, sul P4)

L'ESP32-P4 ha estensioni di istruzioni orientate all'AI e con **ESP-DL** esegue modelli quantizzati
**INT8**; i modelli si addestrano fuori (PyTorch/TensorFlow), si quantizzano e si convertono. Il
budget realistico su MCU è **50–500 KB di modello** più 20–100 KB di arena in RAM — con i 32 MB di
PSRAM del P4 si può essere più generosi, ma restiamo nell'ordine dei **pochi MB**.

Applicazioni sensate e di valore reale:

| Applicazione | Tipo di modello | Budget |
|---|---|---|
| Discriminazione **termica vs raffica** dal profilo IMU+baro | CNN 1D / GRU piccola | ~100 KB |
| **Predizione di stallo** da AoA stimato + IMU + air data | MLP/GRU | ~50 KB |
| Classificazione della **fase di volo** (traino, termica, transizione, finale, atterraggio) | CNN 1D | ~80 KB |
| **Anomaly detection** sui sensori (tubo ostruito, acqua nella statica, IMU che deriva) | autoencoder | ~60 KB |
| **Keyword spotting** vocale ("vario off", "marca termica") | modello wake-word | ~200 KB |
| Stima della **polare reale** e degrado prestazioni (insetti, pioggia) | regressione + filtro | trascurabile |

### Cosa **non** gira a bordo

Un modello linguistico, anche "piccolo". Un modello da 100 M parametri richiede ~100 MB a 8 bit:
tre ordini di grandezza oltre il budget di un microcontrollore. I modelli 0,5–3 B girano su telefono
o Raspberry Pi con **GB** di RAM, non su MCU. Il pattern che l'industria ha adottato nel 2026 è
**ibrido**: locale ciò che è routinario e a bassa latenza, cloud/telefono ciò che è raro e pesante.

### Come predisporre l'hardware oggi per l'AI di domani

**Tre livelli, uno solo dei quali sulla scheda base:**

1. **A bordo (base)**: TinyML sul P4 via ESP-DL / TFLite-Micro. Nessun costo aggiuntivo.
2. **Modulo NPU opzionale sul connettore di espansione** — è la scelta architetturale corretta:
   tiene fuori dal prodotto base costo, consumo e obsolescenza, e lascia evolvere l'ecosistema.
   Candidati 2026: **Alif Ensemble** (Cortex-M55 + **Ethos-U55**, fino a E8 con U85 + 2× U55),
   **Ambiq Atomiq** (Ethos-U85, ultra-basso consumo, supporta sparsity e decompressione al volo),
   **Kendryte K230** (RISC-V + KPU, gestisce ingressi camera — interessante se un domani si usa
   la MIPI-CSI del P4 per visione).
3. **Fuori bordo**: il carico pesante (copilota conversazionale, nowcasting meteo, ottimizzazione di
   rotta) gira sul tablet accoppiato o in cloud; lo strumento fa la cosa che nessun altro può fare —
   **essere la sorgente dati di qualità**.

### Cosa deve offrire l'SDK perché l'ecosistema ML esista

Questa è la parte che quasi nessun concorrente ha:

- **Runtime di inferenza esposto** come servizio (ESP-DL/TFLM) con quota di memoria e di CPU per app.
- **"Sensor tensor" API**: ring buffer degli ultimi N secondi di *tutti* i canali, già allineati nel
  tempo e normalizzati, in un formato che un modello può consumare direttamente. Senza questo, ogni
  sviluppatore riscrive lo stesso buffer sbagliandolo.
- **Slot modello nel pacchetto app**: il modello è un artefatto versionato e firmato dentro l'app.
- **Etichettatura in volo**: un pulsante "marca questo evento" che scrive un'etichetta nel log grezzo.
  È il modo — l'unico — in cui nasce un dataset aeronautico reale. Feature piccolissima, valore enorme.
- **Pipeline di export**: dal log grezzo a un dataset pronto per l'addestramento, con strumenti da
  riga di comando.

## B.3 Connettività — presente e futuro

| Canale | Componente | Stato | Nota |
|---|---|---|---|
| Wi-Fi 6 + BLE 5 + 802.15.4 | ESP32-C6 (co-processore) | **Base** | Config, OTA, streaming a EFB, Thread per accessori di cabina |
| Wi-Fi dual band 5 GHz | ESP32-C5 | Valutare | Se serve throughput in ambienti affollati |
| LoRa 868/915 | SX1262 | **Base** | FANET+ / OGN / Meshtastic |
| **Cellulare + satellite NTN** | **Quectel BG95-S5** | **Espansione** | LTE-M / NB-IoT / eGPRS **+ 3GPP Rel-17 IoT-NTN su rete Skylo** (banda S/L), GNSS integrato, 23,6 × 19,9 × 2,2 mm, −40…+85 °C. È **la** novità che abilita live tracking e SOS **fuori copertura cellulare**, senza Iridium e senza abbonamenti da satellitare classico |
| eSIM | **MFF2 saldata** | Predisporre footprint ora | Niente cassetto SIM: meno guasti, meno spazio, provisioning remoto |
| **ADS-B in** | uAvionix **pingRX Pro** (978 UAT + 1090 ES, 8 g) via seriale | **Espansione** | Non integrare un ricevitore 1090 sulla scheda base in v1: complessità RF e antenna dedicata. Meglio supportarlo come periferica documentata |
| FLARM | Ricezione via RS-232 da apparato certificato | **Base** | Trasmissione FLARM non implementabile (protocollo proprietario) |
| USB-C host | Nativo P4 | **Base** | Chiavette, seriali, qualunque cosa arrivi domani |

**Predisposizioni da fare adesso, costo quasi nullo:**

- Connettore di espansione con **SPI + I²C + 2× UART + 4 GPIO + 3,3 V/5 V (≥300 mA)** e un pin di
  interrupt dedicato.
- **Footprint eSIM MFF2** e area riservata per un modulo cellulare/NTN (25 × 25 mm) con via di
  antenna verso un terzo connettore u.FL.
- **MIPI-CSI del P4 instradata a un connettore FPC** anche se non usata in v1 (telecamera, visione).
- Budget termico e di alimentazione con **1,5 W di margine** per una scheda di espansione.
- PSRAM: montare 32 MB ma prevedere il footprint da 64 MB.

## B.4 Le cose che gli sviluppatori chiederanno per prime

In ordine di quanto vengono richieste, per esperienza dei progetti esistenti (XCSoar, OpenVario,
XCVario, Larus):

1. **Compatibilità con i protocolli esistenti, dal primo giorno.**
   XCSoar/LK8000/SeeYou hanno già driver per: `LXWP0` (ogni secondo), `LXWP1` (ogni minuto), `LXWP2`,
   `LXWP3`, `LXDT` (trasferimento dati bidirezionale), `LXBC` (broadcast, include AHRS), più i formati
   **Borgelt B50**, **Cambridge**, **OpenVario**, **XCVario**. Implementare il dialetto LXNAV significa
   essere compatibili con l'intero ecosistema **senza che nessuno scriva una riga**. Il codice dei
   driver XCSoar è la specifica de facto. Aggiungere il **protocollo NMEA di Larus** (documentato,
   aperto) per i dati ricchi di vento/AHRS.
2. **Il registratore grezzo ("black box per sviluppatori").**
   Tutti i canali, a rate pieno, con timestamp hardware, in un formato binario documentato +
   convertitore. È ciò che permette di sviluppare algoritmi a terra su voli veri. Costa pochi MB/h.
3. **Simulatore e replay a bordo**: iniezione di log nel bus interno; si sviluppa e si collauda senza volare.
4. **API stabile e versionata** (semver), con garanzie di compatibilità e deprecazione annunciata.
   Il modello dati pub/sub della Parte 1 §13.2 è il contratto: va congelato presto.
5. **Isolamento e sicurezza delle app**: un'app che va in crash non deve fermare il vario né il log.
   Servizi di volo a priorità fissa superiore, quote di CPU/RAM, watchdog per task, permessi dichiarati.
6. **Debug vero**: JTAG su USB-C (nativo del P4), console remota via Wi-Fi, core dump analizzabili,
   log remoto.
7. **Modalità sviluppatore esplicita.** Sblocco che consente firmware non firmato — e che **marca in
   modo permanente il dispositivo come non valido ai fini IGC**. Va progettato dall'inizio: è la
   soluzione onesta al conflitto fra apertura e integrità delle tracce sportive.
8. **Multi-strumento su CAN**: due unità (pilota + secondo posto) che condividono lo stesso bus dati,
   una eventualmente come solo nodo sensore. È lo schema LXNAV ed è dato per scontato dagli utenti.
9. **Documentazione hardware aperta**: pinout del connettore di espansione, STEP/DXF della meccanica,
   budget di potenza disponibile, esempi di schede accessorie.
10. **Toolkit UI per display circolare**: widget radiali, scale ad arco, gestione delle etichette
    soft sopra i quattro pulsanti, tema chiaro/scuro e modalità notte. Se ogni sviluppatore deve
    disegnarsi gli archi da zero, l'ecosistema non decolla.

## B.5 Progetti da studiare prima di scrivere una riga di codice

| Progetto | Cosa prendere |
|---|---|
| **Larus** (`larus-breeze/sw_sensor`, `hw_sensor`, `doc_larus`) | Algoritmi EKF, protocollo NMEA, simulatore SIL, **e il PCB**: è il precedente più vicino al nostro |
| **XCVario** (`iltis42/XCVario`) | Vario su **ESP32** con interfaccia dati aperta (formati OpenVario, Cambridge, Borgelt, XCVario), OTA via webserver, driver sensori. Prova che l'approccio funziona |
| **XCSoar** (`XCSoar/XCSoar`) | I driver dei dispositivi = la specifica dei protocolli da supportare |
| **GXAirCom** (`gereic/GXAirCom`) | FANET+ / OGN su LoRa, già funzionante |
| **OpenVario** | Ecosistema hardware/software aperto e le sue lezioni di integrazione |

---

## Sintesi delle azioni da portare nel progetto

**Per il vento in diretta** (nessuna di queste cambia la BOM in modo sostanziale):

1. Aggiungere il **secondo IMU** su assi ruotati (voting + diagnostica).
2. Progettare la **catena di timestamp hardware**: DRDY su interrupt, timer a 1 µs, PPS del GNSS su timer capture.
3. Portare l'IMU a **SPI dedicato con DMA**, 200–400 Hz, senza condivisione bus con altro.
4. **Sonda OAT esterna** schermata (non la temperatura interna) — requisito, non opzione.
5. Prevedere la **quarta via pneumatica** e il canale CAN per un futuro modulo di derapata/5 fori.
6. Mettere a budget la **calibrazione termica per unità** in produzione (banca dati coefficienti firmata).
7. Includere il magnetometro ma trattarlo come misura ausiliaria + modello WMM a bordo.

**Per la piattaforma sviluppatori** (predisposizioni hardware da decidere ora):

8. microSD su **SDIO 4 bit** + eMMC 16–32 GB + USB mass storage.
9. Connettore di espansione completo, con 1,5 W di budget e interrupt dedicato.
10. Footprint **eSIM MFF2** + area 25×25 mm e terza via d'antenna per modulo **cellulare/NTN**.
11. **MIPI-CSI instradata** a un FPC anche se inutilizzata in v1.
12. PSRAM 32 MB montata, footprint per 64 MB.
13. Registratore grezzo di tutti i canali come funzione di sistema, non come app.

---

## Fonti

**Vento e algoritmi**
- [LXNAV — HAWK wind calculation](https://gliding.lxnav.com/news/hawk-wind-calculation/)
- [LXNAV HAWK — descrizione EKF e vantaggi](https://wingsandwheels.com/lxnav-hawk-license.html)
- [HAWK real-time wind indication](https://wingsandwheels.com/blog/post/hawk-real-time-wind-indication)
- [Anemoi — RS Flight Systems (filtro di Kalman a 14 stati, niente magnetometro)](https://www.fly-anemoi.com/)
- [RS Flight Systems — annuncio dell'indicatore di vento](https://www.rs-flightsystems.com/post/new-development-wind-indicator-for-sailplanes-and-light-aircraft)
- [Larus — firmware sensore](https://github.com/larus-breeze/sw_sensor) · [PCB](https://github.com/larus-breeze/hw_sensor) · [documentazione e protocollo NMEA](https://github.com/larus-breeze/doc_larus/blob/master/documentation/Larus_NMEA_Protocol.md)
- [LARUS — descrizione prodotto e algoritmi (SteFly)](https://www.stefly.aero/en/product/larus_glider_sensor/)
- [XCSoar — discussione sul calcolo del vento in spiralata](https://github.com/XCSoar/XCSoar/discussions/1449)
- [UAV Attitude, Heading and Wind Estimation Using GPS/INS and an Air Data System (AIAA)](https://arc.aiaa.org/doi/10.2514/6.2013-5201)
- [Two-Stage Kalman Filter for Wind Speed and UAV State Estimation](https://www.researchgate.net/publication/332752701_Two-Stage_Kalman_Filter_for_Estimation_of_Wind_Speed_and_UAV_States_by_using_GPS_IMU_and_Air_Data_System)
- [Basic Air Data — sonde multi-foro](https://basicairdata.eu/knowledge-center/measurement/multi-hole-probe-mhp/)
- [Angle of attack measurement using a low-cost 3D printed five-hole probe](https://www.researchgate.net/publication/343885451_Angle_of_attack_measurement_using_low-cost_3D_printed_five_hole_probe_for_UAV_applications)

**Piattaforma, AI, connettività**
- [ESP-DL / TinyML su ESP32 — stato dell'arte](https://derekmolloy.ie/from-tinyml-to-tiny-language-models-the-state-of-edge-ai-in-2026/)
- [Deploying Neural Networks on Microcontrollers with TinyML](https://www.embedded.com/deploying-neural-networks-on-microcontrollers-with-tinyml/)
- [From Tiny Machine Learning to Tiny Deep Learning: A Survey (arXiv)](https://arxiv.org/pdf/2506.18927)
- [Alif Semiconductor — Edge AI on MCUs, buyer's guide](https://alifsemi.com/technology-insights/edge-ai-mcus-buyers-guide/)
- [Alif — MCU con NPU integrata (Ethos-U55/U85)](https://alifsemi.com/mcus-with-integrated-npu-cores-making-edge-ai-reality/)
- [Ambiq Atomiq — SoC con NPU ultra-low-power (2026)](https://s206.q4cdn.com/849744944/files/doc_news/Ambiq-Unveils-Atomiq-the-Worlds-First-Ultra-Low-Power-NPU-SoC-Built-on-SPOT-2026-4LjJRzjeGy-2026.pdf)
- [Kendryte K230 — architettura per edge AI](https://www.embedsbc.com/kendryte-k230-deep-dive-hardware-architecture-for-edge-ai-iot-terminals/)
- [Quectel BG95-S5 — modulo NTN satellitare certificato Skylo](https://www.quectel.com/news-and-pr/ces-2025-satellite-communication-module-bg95-s5-skylo-certification/)
- [Quectel/Skylo — primo modulo NTN al mondo](https://www.skylo.tech/newsroom/quectel-and-skylo-announce-the-worlds-first-non-terrestrial-network-module)
- [uAvionix pingRX Pro — ricevitore ADS-B 978/1090](https://uavionix.com/support/pingrx-pro/)
- [XCSoar — hardware supportato](https://xcsoar.org/hardware/) · [driver LX (parser NMEA)](https://github.com/XCSoar/XCSoar/blob/master/src/Device/Driver/LX/Parser.cpp)
- [XCVario — vario open source su ESP32](https://github.com/iltis42/XCVario)
- [OpenVario](https://www.jollyrabbit.com.ar/openvario/)
- [GXAirCom — FANET+/FLARM/OGN](https://github.com/gereic/GXAirCom)
