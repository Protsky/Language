# Strumento avionico 80 mm — dossier completo di progetto

**Documento unico e autoconsistente.** Contiene l'incarico, la ricerca tecnica, le decisioni già
prese e il piano di lavoro per progettare da zero uno strumento avionico circolare da 80 mm (3⅛")
basato su ESP32-P4, concepito come piattaforma aperta per sviluppatori.

Versione 1.0 — settembre 2026.

---

## Come usare questo documento

| Parte | Contenuto | A cosa serve |
|---|---|---|
| **0** | Incarico, vincoli non negoziabili, decisioni congelate | Leggere per prima. Definisce il perimetro |
| **1** | Dossier hardware: architettura, display, pneumatica, sensori, alimentazione, PCB, BOM | Il corpo tecnico del progetto |
| **2** | Vento istantaneo (classe HAWK) e piattaforma per sviluppatori: AI locale, storage, connettività, API | Requisiti che nascono da funzioni avanzate |
| **3** | Fasi di lavoro, regole, domande aperte, criteri di accettazione | Come procedere e quando è finito |
| **4** | Fonti | Verifica di ogni affermazione |

Tutte le affermazioni tecniche sono verificate su fonti citate in Parte 4. Dove una scelta è
opinabile, il documento dice **perché** è stata fatta così: quella motivazione è la parte da
contestare se si vuole cambiare idea, non la conclusione.

---

# Parte 0 — Incarico e perimetro

## 1. Incarico

Progettare **da zero, a livello di PCB**, uno strumento avionico circolare da 80 mm (3⅛") per
aviazione generale e volo a vela, concepito come **piattaforma aperta**: hardware sovradimensionato
in sensoristica e connettività, con un SDK su cui terze parti costruiscono applicazioni.

Il prodotto non è un vario con qualche funzione in più. È **un computer di bordo in formato
strumento**, con la migliore qualità di dato d'aria ottenibile in quel volume, che espone tutto
agli sviluppatori.

Mercato di riferimento: alianti, ultraleggeri, experimental. **Non** aviazione certificata TSO
(percorso di costo incompatibile) — ma progettato ai livelli DO-160 dove non costa nulla farlo.

---

## 2. Vincoli non negoziabili

### Meccanici
| Parametro | Valore |
|---|---|
| Foro pannello | ⌀ 80,0–80,3 mm (standard 3⅛") |
| Fissaggio | 4 viti su quadrato **63,5 mm** (2,5"), 6-32 UNC o M4 |
| Ghiera frontale | ⌀ 82–84 mm max |
| Profondità dietro pannello | **≤ 55 mm**, obiettivo 50 mm, connettori e raccordi inclusi |
| Peso | ≤ 280 g con batteria |
| Architettura interna | **3 schede circolari ⌀70 mm** impilate a passo 9–10 mm su mezzanine |

### Elettrici
| Parametro | Valore |
|---|---|
| Ingresso | 8–36 V continui, transitori clampati a 80 V, inversione di polarità tollerata |
| Consumo | ~3 W tipici, 6,8 W picco; alimentatore dimensionato 10 W continui / 12 W picco |
| Batteria tampone | 1S Li-ion, 2–4 h a display 30%, >12 h in modalità logger |
| EMI | Nessuna emissione udibile sulla radio VHF di bordo. Frequenza di switching e armoniche fuori da 108–137 MHz. Filtro di modo comune su **ogni** cavo che esce dal guscio |

### Funzionali
- **3 porte pneumatiche**: Static, Total (Pitot), TE — nomenclatura e comportamento identici allo
  standard LXNAV. **Predisporre una quarta via** per la misura di derapata.
- **Display rotondo** ad alta luminosità, bonding ottico, leggibile in sole diretto.
- Connettività: **Wi-Fi 6 + BLE 5 + LoRa sub-GHz + GNSS doppia banda**, antenne esterne.
- **Due encoder rotativi con push** a ore 5 e ore 7 + **4 pulsanti** con etichette software.
  Usabili con i guanti. Il touch, se presente, non è mai l'unica via di comando in volo.
- Registratore di volo con **firma IGC** su memoria interna sigillata, separata dalla microSD.

---

## 3. Decisioni già prese — da assumere, non ridiscutere

Motivazioni complete nelle Parti 1 e 2 di questo documento. Riaprire una di queste voci **solo** se emerge
un impedimento tecnico concreto, e in tal caso segnalarlo esplicitamente prima di procedere.

| Blocco | Scelta |
|---|---|
| SoC applicativo | **ESP32-P4** (dual RISC-V 400 MHz, MIPI-DSI, acceleratore 2D) |
| Radio co-processore | **ESP32-C6** via SDIO (`esp_hosted`) |
| Memoria | 32 MB PSRAM ottale (footprint fino a 64 MB), 16 MB NOR, **eMMC 16–32 GB**, microSD su **SDIO 4 bit** |
| Display | Round IPS 2.8" 480×480, ≥1000 nit, optical bonding, AG+AR. Fallback: 2.1" 480×480 MIPI sunlight |
| Barometrico | **BMP581** primario + **MS5611** ridondante, entrambi su linea statica |
| Vario TE | **SDP810-500Pa** differenziale TE↔Static |
| Anemometrica | **doppio range**: SDP31 ±500 Pa + MS4525DO ±1 psi, crossfade firmware 80–110 km/h |
| IMU | **ICM-42688-P** + secondo IMU (BMI270) su assi ruotati di 90° |
| Magnetometro | MMC5983MA — misura **ausiliaria a covarianza alta**, mai heading primario. Modello WMM a bordo |
| Ambiente | SHT45 interno + **sonda OAT esterna schermata** (requisito, non opzione) |
| GNSS | **u-blox NEO-F10N** (L1+L5), footprint alternativo ZED-F9P. LNA MAX2659, bias-tee commutabile, **PPS su timer capture** |
| Sub-GHz | **SX1262** + TCXO, 868/915 MHz. FANET+/OGN in TX. **FLARM solo in RX via seriale** — mai trasmesso |
| Sicurezza | **ATECC608B** + secure boot v2 + flash encryption |
| Alimentazione | TVS + ideal diode LM74700 + LM5164 → 5 V; TPS62933 3,3 V; LP8864S backlight; BQ25798 charger |
| Audio | TAS2770 I²S + speaker ⌀23–28 mm + **line-out isolato 600 Ω** verso intercom |
| I/O | 2× RS-232, 2× CAN (TCAN1462), 2 ingressi opto, 2 analogici 0–5 V, USB-C OTG+JTAG |
| Encoder | **Bourns EM14** ottici con switch (1 M cicli) |

---

---

# Parte 1 — Dossier hardware

## 1. Sintesi delle decisioni

| Area | Scelta raccomandata | Perché |
|---|---|---|
| Calcolo | **ESP32-P4** (dual-core RISC-V 400 MHz, FPU/DSP) + **ESP32-C6** come radio co-processor | Unico Espressif con MIPI-DSI, PPA/2D-DMA e banda di memoria per una GUI fluida a 480×480; il C6 porta Wi-Fi 6 + BLE 5 + 802.15.4 senza rubare cicli alla grafica |
| Display | **Round IPS 2.8" 480×480**, ≥1000 nit, bonding ottico, AG/AR | Massima area utile dentro una ghiera 80 mm (⌀ attivo 71,1 mm); leggibile in sole diretto |
| Pneumatica | 3 porte: **Static / Total (Pitot) / TE** — identico allo standard LXNAV | Compatibilità con impianti esistenti degli alianti |
| Barometrico | **BMP581** (primario) + **MS5611** (ridondante/cross-check) | 0,08 Pa RMS ≈ 1 cm di risoluzione, ODR fino a 622 Hz |
| Vario TE | **SDP810-500Pa** differenziale TE↔Static | Nessuna deriva di zero, il vario TE esce direttamente dal differenziale |
| Anemometrica | **doppio range**: SDP31 ±500 Pa (bassa velocità) + **MS4525DO ±1 psi** (fondo scala) | Risoluzione sotto i 100 km/h *e* copertura fino a ~380 km/h |
| AHRS | **ICM-42688-P** + **MMC5983MA** (magnetometro su isola dedicata) | Rumore giroscopico 2,8 mdps/√Hz, stabilità termica migliore della classe |
| GNSS | **u-blox NEO-F10N** (L1+L5) — footprint alternativo **ZED-F9P** | Doppia banda = multipath ridotto e velocità 3D accurata; F9P se serve RTK |
| Radio sub-GHz | **Semtech SX1262** 868/915 MHz, TCXO, +22 dBm | FANET+ / OGN / Meshtastic, tutto open source |
| Alimentazione | Ingresso 8–36 V, transitori a 80 V clampati, batteria tampone 1S Li-ion | Bus 14 V e 28 V, load dump DO-160 |
| Sicurezza | **ATECC608B** + secure boot / flash encryption del P4 | Firma G-record IGC (HMAC-SHA256) e anti-manomissione |

---

## 2. Vincoli meccanici — il formato 80 mm

Lo standard aeronautico "3⅛ pollici" (79,4 mm) è in realtà una famiglia di quote fisse:

| Quota | Valore | Note |
|---|---|---|
| Foro pannello | **⌀ 80,0–80,3 mm** | ACS raccomanda 3,16" (80,26 mm) per tolleranza di lavorazione |
| Fori di fissaggio | 4× su quadrato **63,5 mm** (2,5") | Viti 6-32 UNC oppure M4 |
| Ghiera frontale | ⌀ 82–84 mm max | Deve coprire il foro senza invadere gli strumenti adiacenti |
| Profondità dietro pannello | **≤ 55 mm** (obiettivo 50 mm) | Include connettori e raccordi pneumatici; oltre i 60 mm molti cruscotti non ci stanno |
| Peso obiettivo | ≤ 280 g | Con batteria tampone |

**Conseguenza progettuale n.1**: con ghiera ⌀83 mm e pareti + guarnizione, l'apertura utile è ~74 mm.
Un pannello **rotondo 2,8" (attivo ⌀71,1 mm)** riempie quasi tutto. Un pannello **quadrato 3,4" 800×800**
ha lato attivo ~61 mm: dentro una finestra circolare mostrerebbe solo 61 mm di diametro — *peggiore*
nonostante la diagonale maggiore. Il rotondo vince.

**Conseguenza progettuale n.2**: con ~50 mm di profondità utile servono **tre schede circolari impilate**
a passo 9–10 mm, ⌀ 70–72 mm, collegate da mezzanine board-to-board.

---

## 3. Architettura di calcolo

### 3.1 Il "cervello": ESP32-P4 + ESP32-C6

L'ESP32-P4 è oggi l'unica scelta Espressif sensata per questo prodotto:

- Dual-core RISC-V 32 bit **400 MHz** con FPU e istruzioni DSP, più un core LP a 40 MHz per
  housekeeping a bassissimo consumo (mantiene il logging quando il display è spento).
- **MIPI-DSI 2 lane** — indispensabile per 480×480 a 60 fps senza bruciare GPIO e banda.
- **MIPI-CSI + ISP** — libero per il futuro (telecamera di prua, riconoscimento pista/orizzonte).
- Acceleratore 2D (PPA) e 2D-DMA: rotazioni, blend e scaling in hardware — critico per una GUI
  *circolare* dove quasi tutto ruota (indici, aghi, scale).
- 32 MB PSRAM ottale + 16 MB flash NOR come baseline; prevedere footprint fino a 64 MB PSRAM.

Il P4 **non ha radio**: si affianca un **ESP32-C6** connesso via SDIO (o SPI ad alta velocità) che
espone Wi-Fi 6 (2,4 GHz), BLE 5.x e 802.15.4 (Thread/Zigbee) tramite `esp_hosted`. Vantaggio
architetturale: lo stack radio non compete con il rendering, e il C6 può restare acceso come
"radio keeper" mentre il P4 dorme.

**Alternativa low-cost (variante ridotta del prodotto)**: ESP32-S3 con display 2,1" 480×480 su
interfaccia QSPI/RGB. Metà del costo, ma niente MIPI, GUI meno fluida, niente CSI. Da tenere come
SKU "Lite" condividendo la stessa scheda sensori.

### 3.2 Memoria e storage

| Funzione | Componente | Note |
|---|---|---|
| Firmware + app | 16 MB NOR flash (fino a 32 MB) | Doppia partizione OTA + rollback |
| RAM di lavoro | 32 MB PSRAM ottale | Framebuffer doppio 480×480×16bit = 900 kB |
| Log di volo, mappe, app di terze parti | **eMMC 8–16 GB** (o NAND SPI 2 Gb) | Saldato = affidabile in vibrazione |
| Scambio con l'utente | **microSD push-push** accessibile dal retro | Estrazione tracce IGC, installazione app |

Doppio storage voluto: la memoria interna saldata è quella "sigillata" richiesta per la firma IGC
(la firma deve essere applicata solo a dati provenienti dalla memoria interna del registratore, non
da supporti accessibili all'utente); la microSD è il canale utente.

---

## 4. Display e retroilluminazione

### 4.1 Selezione pannello

| Candidato | Attivo | Risoluzione | Interfaccia | Note |
|---|---|---|---|---|
| **Round 2.8" IPS** (ST7701S / classe equivalente) | ⌀71,1 mm | 480×480 | RGB+SPI o MIPI | **Primaria**. Versioni HB 1000 nit disponibili |
| Round 2.1" (es. Newhaven 480×480 sunlight) | ⌀53 mm | 480×480 | MIPI-DSI | Fallback sicuro, 1000 nit già a catalogo, alta densità |
| Round 3.4" 800×800 | ⌀86 mm | 800×800 | MIPI | **Non entra** in ghiera 80 mm |
| Round AMOLED 1,75"/2,1" 466×466 | ⌀44–53 mm | 466×466 | QSPI/MIPI | Contrasto perfetto, ma burn-in su simbologia statica e degrado UV in cabina: **sconsigliato** |

**Requisiti minimi da capitolato**: ≥1000 nit, contrasto ≥800:1, IPS con angoli di visione ampi,
range operativo **−30…+85 °C** (cabina d'aliante d'estate supera 70 °C), dimming fino a <1% per il volo notturno.

### 4.2 Trattamento ottico — dove si vince davvero

Il bonding ottico conta più dei nit: eliminando l'intercapedine d'aria si sopprime ~90% delle
riflessioni interne, tanto che uno schermo da 800 nit otticamente bondato batte uno da 1200 nit
air-gap. Specifica:

- **Optical bonding OCA/LOCA** pannello ↔ vetro di copertura.
- Vetro **Gorilla/chimicamente temprato 0,7–1,0 mm**, coating **AR + AG**, riflettanza < 1%.
- **Sensore di luce ambiente** (VEML7700 o APDS-9930) dietro un foro nella ghiera → dimming automatico.
- Driver backlight a **corrente costante** (LP8864S-Q1 o TPS61169) con dimming PWM ad alta frequenza
  (>20 kHz, per non battere con l'ottica delle action-cam) più dimming analogico ai livelli bassi.

---

## 5. Sistema pneumatico e sensori di pressione

### 5.1 Le tre prese

Confermato dallo standard di fatto (LXNAV S8x/S10x): `P Static` (pressione statica),
`P Total` (Pitot / pressione totale), `TE` (Total Energy, presa di energia totale).

```
                 ┌──────────────────────────────────────────────┐
  STATIC ────┬───┤ BMP581  (assoluta, primaria)                 │
             ├───┤ MS5611  (assoluta, ridondante)               │
             │   │                                              │
             ├──►│ SDP810-500Pa  ── ref ── TE      (vario TE)    │
             │   │                                              │
             └──►│ SDP31 ±500 Pa ── ref ── TOTAL   (IAS bassa)   │
                 │ MS4525DO ±1psi ─ ref ── TOTAL   (IAS piena)   │
  TE ────────────┤                                              │
  TOTAL ─────────┤                                              │
                 └──────────────────────────────────────────────┘
```

### 5.2 Scelte e motivazioni

**Statica / altimetria / vario barometrico — BMP581**
Rumore RMS 0,08 Pa @1000 hPa (≈ **1 cm** di quota), risoluzione 1/64 Pa, accuratezza relativa
±0,06 hPa, assoluta tipica ±0,3 hPa, ODR fino a **622 Hz**, range 30–125 kPa (copre ~9000 m).
È il pezzo che definisce la qualità del vario. Affiancare **MS5611** (riferimento storico del
settore, comportamento termico noto) come sensore di controllo: la divergenza tra i due è un
ottimo indicatore di occlusione o di acqua nel tubo.

**Vario a energia totale — SDP810-500Pa (o SDP31 SMD)**
Sensori Sensirion a principio termico: **zero drift nullo**, calibrati e compensati in temperatura,
tempo di campionamento breve. Misurando TE↔Static in differenziale si ottiene la compensazione
d'energia totale *in hardware*, senza doverla ricostruire numericamente da IAS (che è la sorgente
principale di rumore nei vari "elettronici" economici). Il pacchetto SDP3x misura 5×8×5 mm — nulla,
in termini di spazio.

**Anemometria — doppio range, la scelta non ovvia**
Un solo sensore non copre bene entrambi gli estremi:
- q = ½ρV² → a 100 km/h sono ~470 Pa, a 380 km/h sono ~6800 Pa.
- Un ±500 Pa (SDP31) satura a ~103 km/h; un ±1 psi (MS4525DO, 6895 Pa ≈ 380 km/h) ha risoluzione
  scarsa in salita lenta e in prossimità dello stallo.

Soluzione: **entrambi in parallelo**, con protezione di sovrapressione sul canale a basso range
(restrittore + valvola di sfiato o semplicemente sensore in grado di reggere la sovrapressione).
Il firmware fonde le due letture con crossfade tra 80 e 110 km/h. Beneficio collaterale: margine
di risoluzione per una funzione **stall margin / AoA stimato** — feature molto richiesta dagli
sviluppatori.

**Alternative degne di nota**: All Sensors **DLHR-L20D** (±20 inH₂O, uscita digitale, ottima
risoluzione), Superior Sensor **ND015D** (multi-range programmabile — elegantissimo, sostituirebbe
entrambi i sensori anemometrici, ma costo e disponibilità sono meno favorevoli). Da valutare in
fase 2 come opzione di semplificazione.

### 5.3 Accorgimenti pneumatici sul PCB

- **Manifold posteriore** in alluminio anodizzato o POM lavorato, con 3 portagomma da **4 mm** e
  O-ring; distribuzione ai sensori tramite canali interni al manifold, non tubetti volanti.
- **Trappola d'acqua** e restrittore ⌀0,3–0,5 mm su ogni linea (protezione da colpi di pressione).
- **Camera di smorzamento** ~5–10 cm³ ricavata nel manifold sulla linea statica: filtra le pulsazioni.
- Sensori montati su **isola meccanica disaccoppiata** dalla scheda principale (slot antivibranti o
  scheda dedicata con montaggio su gommini), lontani da fonti di calore (il P4 e il driver backlight
  sono i due punti caldi).
- Distanza termica: il BMP581 vuole un gradiente stabile — copertura in schiuma nera aperta,
  keep-out di rame sotto il sensore, nessuna traccia di potenza a meno di 5 mm.

---

## 6. Assetto, magnetometro, ambiente

| Funzione | Componente | Note |
|---|---|---|
| IMU 6 assi | **TDK ICM-42688-P** | 2,8 mdps/√Hz gyro, 70 µg/√Hz accel, ODR fino a 32 kHz; migliore stabilità termica e cross-axis della classe |
| IMU ridondante (opz.) | Bosch **BMI270** | Filtri anti-alias hardware, dato molto pulito; utile come secondo canale con voting |
| Magnetometro | **MMC5983MA** (o **PNI RM3100** se serve il top assoluto) | Montato sulla scheda più lontana da speaker, DC-DC e cavi di potenza |
| Umidità/temp interna | **SHT45** | Compensazione sensori + diagnostica condensa |
| OAT esterna | Sonda NTC/PT1000 su jack 2,5 mm o su 1-Wire (DS18B20) | Necessaria per TAS e densità dell'aria |
| Luce ambiente | VEML7700 | Dimming automatico |

**Nota critica sul magnetometro**: in uno strumento da 80 mm con altoparlante e buck converter, il
campo magnetico locale è il nemico. Prevedere: schermatura del magnete dell'altoparlante, routing
delle correnti di potenza in coppia stretta (loop area minima), e **procedura di calibrazione hard/soft
iron** esposta nell'SDK. Se la qualità della prua magnetica è un requisito forte, valutare il
magnetometro su una **mini-scheda satellite remota** collegata via I²C — soluzione usata dai sistemi
AHRS seri.

---

## 7. GNSS

**Primario: u-blox NEO-F10N** — doppia banda **L1 + L5**, che è il vero salto di qualità: L5 riduce
drasticamente multipath ed errore ionosferico, e migliora l'accuratezza della **velocità 3D**, che per
un vario GPS-assistito conta più della posizione. Multi-costellazione (GPS, Galileo, GLONASS, BeiDou).

**Opzione high-end: ZED-F9P** — L1/L2, RTK centimetrico con correzioni NTRIP (via Wi-Fi/LTE del
telefono). Sovradimensionato per la navigazione, ma abilita casi d'uso da laboratorio volante
(taratura sensori, misura del vento con precisione, ricerca). Prevedere **footprint alternativo /
modulo mezzanine** in modo che la stessa scheda accetti F10N o F9P.

**Bassa potenza: MAX-M10S** — se in futuro si vuole una modalità logger a batteria da giorni interi.

Requisiti di contorno:
- **Antenna esterna obbligatoria**: dietro un pannello metallico non si riceve nulla. Connettore
  **MCX o SMA femmina** sul retro, **bias-tee** commutabile 3,3 V/5 V per antenna attiva, protezione
  ESD e limitazione di corrente con diagnostica di corto/aperto sull'antenna.
- Front-end con **SAW + LNA** (es. MAX2659) prima del modulo, per non dipendere dalla qualità del cavo.
- Rate ≥10 Hz (25 Hz se il modulo lo consente) con timepulse **PPS** cablato al P4 per il time-tagging
  hardware dei campioni: è ciò che permette una fusione IMU/baro/GPS pulita.

---

## 8. Connettività

### 8.1 Wireless

| Radio | Chip | Uso |
|---|---|---|
| Wi-Fi 6 (2,4 GHz) + BLE 5 + 802.15.4 | ESP32-C6 (co-processore) | Config da browser, OTA, streaming dati a EFB/tablet, mesh Thread |
| LoRa sub-GHz 868/915 MHz | **Semtech SX1262** +22 dBm, TCXO | **FANET+** (traffico e termiche fra alianti/parapendii), **OGN** (Open Glider Network), Meshtastic, telemetria a terra |

Sul sub-GHz, l'ecosistema è maturo e open: **GXAirCom** implementa FANET+ e l'interfaccia OGN su
moduli LoRa economici; **SoftRF** copre un sottoinsieme di FANET. Questi progetti sono il riferimento
per il firmware di bordo.

> **Attenzione legale/protocollare**: il protocollo FLARM è proprietario e la sua trasmissione non è
> liberamente implementabile. Progettare per **trasmettere FANET/OGN** e per **ricevere il traffico
> FLARM via porta seriale** da un dispositivo FLARM certificato. Non inserire trasmissione FLARM nel
> prodotto senza licenza.

Antenne: due connettori **u.FL → pigtail → SMA** sul retro (GNSS e LoRa), keep-out RF rigorosi,
matching network con π-network a 3 componenti su entrambe le catene.

### 8.2 Cablate — il set che rende lo strumento "integrabile"

| Interfaccia | Implementazione | Uso tipico |
|---|---|---|
| **2× RS-232** | SP3232E / MAX3232, ESD ±15 kV | Porta FLARM/GPS in, porta PDA/PNA out (NMEA), livelli TTL selezionabili + 5 V di alimentazione al dispositivo esterno |
| **2× CAN 2.0B** | TCAN1462 (o **ISO1042** isolato) | Bus strumenti: secondo posto, remote stick, unità satellite. È lo schema LXNAV (secondo seggiolino e stick su CAN/RS485) |
| **Ingressi digitali** | 2× opto-isolati, 5–30 V | Interruttore **SC** (speed-command), carrello, warning esterni |
| **Ingressi analogici** | 2× 0–5 V, 12 bit, protetti | Potenziometro flap, sonda AoA, livello acqua zavorra |
| **Uscita audio** | Speaker interno + **line-out** a 600 Ω verso intercom | Vario acustico, allarmi vocali |
| **USB-C** | USB 2.0 OTG + **JTAG integrato** del P4 | Firmware, log come mass-storage, debug, host per chiavette |
| **microSD** | Push-push retro | Log IGC, mappe, app |
| **Connettore di espansione** | FPC 24 vie o board-to-board: SPI, I²C, 2× GPIO, UART, 3,3 V, 5 V | **Terze parti**: moduli LTE, ricevitore ADS-B 1090, sensori custom |

Connettori posteriori: un **Molex Micro-Fit 3.0** multipolare per alimentazione + I/O generici,
più **RJ45/RJ12** per compatibilità con la cablatura esistente del mondo aliantistico (è la
convenzione LXNAV: RJ12 per GPS/FLARM, RJ45 8 vie per PDA con GND/TX/RX RS-232 + TX/RX TTL + 5 V).

---

## 9. Interfaccia utente fisica

### 9.1 Layout

Ispirato agli LXNAV S8/S80/S100 ma con più libertà per gli sviluppatori:

```
        ╭───────────────────────────╮
       ╱      ┌───────────────┐      ╲
      │     ╱   display ⌀71    ╲      │
      │    │   480 × 480 IPS    │     │
      │    │    1000+ nit       │     │
      │     ╲                  ╱      │
       ╲      └───────────────┘      ╱
        │  [B1] [B2]   [B3] [B4]    │     ← 4 tasti soft-label sotto la ghiera
        ╰──(ENC-A)───────(ENC-B)────╯     ← 2 encoder con push, ore 7 e ore 5
```

- **2 encoder rotativi con pulsante integrato**, posizionati a ore 5 e ore 7 (pollice destro e
  sinistro senza staccare la mano dalla cloche). Uno dei due può essere **doppio concentrico**
  (interno/esterno) in stile Garmin per gestire due grandezze insieme (es. MC + QNH).
- **4 pulsanti tattili** lungo il bordo inferiore, con etichette software disegnate sul display
  immediatamente sopra ciascuno: le funzioni cambiano per applicazione — è ciò che rende la ghiera
  utilizzabile da app di terze parti senza serigrafie fisse.
- Tutti gli elementi **retroilluminati** (LED bianchi dimmerabili con il display).

### 9.2 Componenti

| Elemento | Candidato | Note |
|---|---|---|
| Encoder | **Bourns EM14 / ES14 ottici**, 14 mm, con switch | Vita 1.000.000 cicli contro le ~100k di un meccanico (Grayhill 25LB); −40…+70 °C. In cabina si girano *continuamente*: il costo extra si ripaga |
| Encoder economico (SKU Lite) | Bourns PEC11R / Alps EC12 | Meccanico, accettabile su volumi bassi |
| Pulsanti | Tattili 6×6 mm con attuatore lungo, forza 2,5–3 N | Devono funzionare **con i guanti** |
| Touch (opzionale) | CTP capacitivo sul vetro, GT911/CST826 | Utile a terra per la configurazione; **non** deve essere l'unica via di comando in volo (turbolenza + guanti) |
| Haptics (opzionale) | LRA + DRV2605L | Feedback di detent programmabile |

---

## 10. Audio

Il vario acustico è metà dello strumento. Catena:

- **Codec/amplificatore I²S classe D** — MAX98357A (semplice) oppure **TAS2770** (con speaker
  monitoring, più efficiente e protetto).
- **Altoparlante** ⌀23–28 mm, alta efficienza, in camera acustica ricavata nel guscio posteriore.
- **Line-out isolato** verso intercom: amplificatore operazionale + trasformatore audio o
  isolamento capacitivo, uscita 600 Ω regolabile in guadagno, per non introdurre loop di massa
  nell'impianto radio dell'aereo.
- Generazione tono a **sintesi**: il tono del vario deve essere costruito in DSP (frequenza, duty,
  interruzione, "damping") ed esposto all'SDK come API, non hard-coded.

---

## 11. Alimentazione

### 11.1 Catena di ingresso

```
 +12/28 V ─┬─ Fuse 2A ─ TVS SMBJ36A ─ Ideal diode (LM74700 + N-MOS) ─ π-filter + CM choke ─┐
           └─ Zener + varistore (transitorio load dump)                                    │
                                                                                           ▼
                                              Buck primario (LM5164 / MPQ4436, Vin 60 V)  5 V @ 2 A
                                                                                           │
             ┌────────────┬───────────────┬────────────────┬──────────────┬────────────────┤
        3,3 V sistema  1,8 V/1,1 V P4   Backlight CC   Charger 1S      5 V ausiliari     RF LDO
        (TPS62933)     (PMIC dedicato)  (LP8864S)      (BQ25798)      (RS232/PDA)     (basso rumore)
```

**Requisiti**:
- Ingresso continuo **8–36 V** (bus 14 V e 28 V), sopravvivenza a transitori fino a **80 V** e a
  inversione di polarità. In aeronautica l'alternatore non riesce a ridurre rapidamente l'uscita e
  scarica l'energia sul bus: è il classico **load dump** che non si può filtrare, va clampato.
- Riferimento normativo: **DO-160** sez. 16 (power input), 17 (spike), 21 (emissioni), 20
  (suscettibilità), 22 (lightning induced). Anche senza certificazione, progettare a quei livelli
  evita che lo strumento disturbi la radio VHF — problema reale e ricorrente negli strumenti
  autocostruiti. Filtro comune-modo su **tutti** i cavi che escono dal guscio.

### 11.2 Batteria tampone

- **1S Li-ion** 2000–2500 mAh (18650 non entra: usare pouch LiPo o 14500), charger **BQ25798** con
  power-path (lo strumento funziona mentre carica), fuel gauge **BQ27427**.
- Autonomia obiettivo: **2–4 h** con display al 30%, o >12 h in "modalità logger" (display spento,
  core LP attivo).
- Funzione critica: **chiusura pulita del file di volo e firma IGC** in caso di caduta del bus.
- Termistore obbligatorio, protezione carica sopra +45 °C (cabina d'estate).

### 11.3 Bilancio di potenza (stima)

| Blocco | Tipico | Picco |
|---|---|---|
| Backlight 1000 nit @70% | 1,6 W | 2,5 W |
| ESP32-P4 + PSRAM | 0,7 W | 1,2 W |
| ESP32-C6 (Wi-Fi attivo) | 0,3 W | 0,8 W |
| GNSS (F10N) | 0,12 W | 0,2 W |
| LoRa | 0,02 W | 0,45 W (TX) |
| Sensori + housekeeping | 0,15 W | 0,2 W |
| Audio | 0,1 W | 1,5 W |
| **Totale** | **~3,0 W** | **~6,8 W** |

Dimensionare l'alimentatore primario per **10 W** continui con margine termico: 12 W di picco.

---

## 12. Sicurezza, integrità dati, registratore IGC

Se lo strumento vuole essere preso sul serio nel volo a vela, deve registrare tracce **firmate**.

- Il registratore deve calcolare una **firma digitale di sicurezza** e accodarla al file IGC come
  **G-record**; la firma deve applicarsi **solo** a dati provenienti dalla memoria interna del
  registratore, mai a dati passati per supporti accessibili all'utente. → da qui la scelta di eMMC
  saldata separata dalla microSD.
- Cripto: minimo **HMAC-SHA256 con chiave a 256 bit** (livello CIVL); l'approvazione IGC/GFAC
  richiede tipicamente **crittografia asimmetrica con chiave privata unica per strumento**.
  → **ATECC608B** o NXP **SE050**: chiave privata generata on-chip, mai esportabile.
- **Secure boot v2 + flash encryption** dell'ESP32-P4; firmware firmato; anti-rollback.
- Manomissione fisica: vite sigillata / etichetta a strappo, e rilevamento apertura guscio via
  switch cablato al secure element (invalidazione della chiave o marcatura nel log).
- Fornire il **programma di validazione** (VALI-xxx) come richiesto dalla procedura di approvazione.

---

## 13. La piattaforma per sviluppatori — il vero prodotto

L'hardware è il mezzo; il valore è nel far costruire agli altri. Elementi minimi:

### 13.1 Stack software

| Livello | Scelta |
|---|---|
| RTOS/base | ESP-IDF (FreeRTOS), BSP di bordo versionato |
| GUI | **LVGL 9** con tema circolare, accelerato da PPA/2D-DMA del P4 |
| Runtime app di terze parti | **WAMR (WebAssembly Micro Runtime)** — sandbox, quasi-nativo, linguaggio libero (C/Rust/AssemblyScript). Alternativa/aggiunta: MicroPython o Lua per prototipazione rapida |
| Fusione sensori | Servizio di sistema (EKF baro/IMU/GNSS) con uscite a rate fisso |
| Update | OTA A/B via Wi-Fi o USB, rollback automatico |

### 13.2 Modello dati

Un **bus publish/subscribe interno** con schema versionato (CBOR), pubblicato a rate garantiti:

```
altitude.baro_qnh    50 Hz    pressure.static      100 Hz
altitude.baro_std    50 Hz    pressure.te          100 Hz
vario.te             20 Hz    pressure.dynamic     100 Hz
vario.netto          20 Hz    airspeed.ias/tas      50 Hz
attitude.roll/pitch 100 Hz    gnss.fix              10 Hz
wind.estimate         1 Hz    energy.total          20 Hz
```

Lo stesso schema esposto verso l'esterno su: **WebSocket + REST** (Wi-Fi), **BLE GATT** (servizio
tipo NUS + caratteristiche tipizzate), **NMEA/LXWP** su RS-232 e CAN per compatibilità con
XCSoar/LK8000/SeeYou. Un'app di terze parti che gira *sopra* lo strumento e una che gira *accanto*
(su tablet) vedono la stessa API.

### 13.3 Strumenti di sviluppo

- **Simulatore/replay**: iniezione di log IGC/NMEA nel bus interno — si sviluppa e si collauda a
  terra, in volo simulato. Funzione indispensabile e spesso assente nei prodotti concorrenti.
- **Debug JTAG via USB-C** (integrato nel P4, nessuna sonda esterna).
- Console seriale, logging remoto su Wi-Fi, core dump analizzabile.
- **SDK**: container Docker + PlatformIO/ESP-IDF, esempi, CI con test hardware-in-the-loop.
- **App store / sideload**: pacchetti firmati, permessi dichiarati (accesso sensori, radio, storage),
  quota di CPU e RAM per app. La firma delle app non deve poter compromettere la firma IGC.
- **Documentazione dell'espansione hardware**: pinout, meccanica, alimentazione disponibile
  (≥300 mA a 3,3 V e 5 V per moduli di terze parti).

---

## 14. Architettura PCB — impilaggio e ottimizzazione dello spazio

### 14.1 Tre schede circolari

| Scheda | ⌀ | Contenuto | Note |
|---|---|---|---|
| **A — Frontale/HMI** | 70 mm | Connessione display (FPC), driver backlight, LED ghiera, encoder, pulsanti, sensore luce, touch controller | Sta immediatamente dietro il pannello; qui niente sorgenti di calore se possibile |
| **B — Main** | 70 mm | ESP32-P4, PSRAM, flash, eMMC, ESP32-C6, SX1262, GNSS, IMU, USB-C, microSD | 8 strati HDI; è la scheda densa |
| **C — Power/IO/Pneumatica** | 70 mm | Front-end alimentazione, buck, charger, batteria, RS-232, CAN, audio, sensori di pressione, manifold | A contatto con il guscio posteriore per dissipare |

Interconnessione: **mezzanine Hirose DF40** (passo 0,4 mm, altezza 3–5 mm impilabile) oppure
Samtec QTH/QSH; due connettori per scheda per rigidità meccanica. Segnali critici (MIPI-DSI,
SDIO verso C6) su lunghezze minime e coppie differenziali controllate.

### 14.2 Stack-up raccomandato (scheda B, 8 strati HDI)

```
L1  Signal / componenti      ─ microstrip 50 Ω, MIPI 100 Ω diff
L2  GND (continuo)           ─ riferimento sacro, nessun taglio
L3  Signal (routing interno)
L4  Power (3,3 V split)
L5  Power / GND
L6  Signal
L7  GND
L8  Signal / componenti retro
```

- Via-in-pad riempite e placcate sotto BGA del P4; 1× stacked microvia (1-2-1) per il fan-out.
- Impedenze: **90 Ω** USB diff, **100 Ω** MIPI D-PHY, **50 Ω** single-ended RF, **120 Ω** CAN.

### 14.3 Regole di piazzamento specifiche di questo prodotto

1. **Isole RF**: GNSS e LoRa in settori opposti del cerchio, ciascuno con corona di via stitching e
   schermo metallico saldato; il cristallo/TCXO del SX1262 lontano dal buck.
2. **Il buck è il nemico di tutto**: posizionarlo sul bordo della scheda C, loop di commutazione
   minimizzato, snubber, e piano di massa continuo sotto. Frequenza di switching scelta **fuori**
   dalla banda 108–137 MHz e dalle sue armoniche vicine (tipicamente 400–500 kHz con buon filtraggio,
   oppure spread-spectrum).
3. **Magnetometro**: massima distanza da speaker, batteria e tracce di potenza; nessun componente
   ferromagnetico entro 10 mm (attenzione a induttori schermati e connettori nichelati).
4. **Barometrici**: keep-out termico, niente rame pesante sotto, foro di ventilazione verso la
   camera statica, e **nessuna aria in movimento** (il flusso sul sensore genera rumore di vario).
5. **Termica**: il P4 sotto carico grafico e il driver backlight sono ~2 W complessivi. Termal pad
   verso il guscio in alluminio; il guscio è il dissipatore. Verificare il funzionamento a +70 °C
   ambiente (cabina sotto plexiglass in estate).
6. **Vibrazione**: tutti i componenti alti (elettrolitici — meglio evitarli, usare polimero/ceramici;
   connettori; batteria) incollati o vincolati; nessun cristallo in posizione a sbalzo.
7. **Ottimizzazione dell'area circolare**: la geometria rotonda "spreca" gli angoli — usare la corona
   esterna per connettori, encoder e pulsanti, e il centro per i BGA. Progettare con **origin polare**
   e piazzamento radiale dei tasti.

### 14.4 Meccanica

- Guscio posteriore in **alluminio tornito/anodizzato** (dissipatore + schermo EMI + massa RF),
  ghiera frontale in alluminio con guarnizione.
- Manifold pneumatico integrato nel guscio posteriore (lavorazione unica = meno tenute, meno peso).
- Guarnizione perimetrale sul vetro, grado di protezione frontale ~IP54 (schizzi, condensa).
- Prova di caduta e vibrazione: profilo **DO-160 sez. 8** categoria S, curva per aeroplani a pistoni.

---

## 15. Distinta componenti chiave (bozza)

| Blocco | Part number | Alternativa |
|---|---|---|
| SoC applicativo | ESP32-P4NRW32 | ESP32-S3R8 (SKU Lite) |
| Radio co-proc | ESP32-C6-MINI-1 | ESP32-C5 (Wi-Fi 6 dual-band) |
| Display | Round 2.8" 480×480 IPS HB + CTP | Newhaven 2.1" 480×480 MIPI sunlight |
| Driver backlight | TI LP8864S-Q1 | TPS61169 |
| Baro primario | Bosch **BMP581** | Bosch BMP585 (versione stagnata a liquido) |
| Baro ridondante | TE **MS5611-01BA03** | Infineon DPS368 |
| Diff. TE | Sensirion **SDP810-500Pa** | SDP31 (SMD) |
| Diff. IAS basso range | Sensirion **SDP31** | SDP32 |
| Diff. IAS pieno range | TE **MS4525DO-DS3AI001DP** | All Sensors DLHR-L20D / Superior ND015D |
| IMU | TDK **ICM-42688-P** | Bosch BMI270 |
| Magnetometro | MEMSIC **MMC5983MA** | PNI RM3100 |
| Umidità/temp | Sensirion SHT45 | — |
| GNSS | u-blox **NEO-F10N** | ZED-F9P (RTK) / MAX-M10S (low power) |
| LNA GNSS | MAX2659 | — |
| LoRa | Semtech **SX1262** + TCXO | LLCC68 |
| Secure element | Microchip **ATECC608B** | NXP SE050 |
| Buck primario | TI **LM5164** | MPS MPQ4436 |
| Ideal diode | TI LM74700-Q1 | — |
| Charger 1S | TI **BQ25798** | BQ25792 |
| Fuel gauge | TI BQ27427 | MAX17048 |
| Ampli audio | TI **TAS2770** | MAX98357A |
| RS-232 | SP3232EEY | MAX3232E |
| CAN | TI **TCAN1462** | ISO1042 (isolato) |
| Encoder | Bourns **EM14** ottico c/switch | PEC11R (meccanico) |
| Mezzanine | Hirose DF40C-40DS-0.4V | Samtec QTH/QSH |

---

## 16. Rischi e punti da decidere

| # | Questione | Impatto | Nota |
|---|---|---|---|
| 1 | Disponibilità reale del **pannello rotondo 2,8" a 1000 nit** con bonding | Alto — definisce tutta la meccanica | Molti round 2,8" sono da 300–500 nit. Serve un fornitore che faccia HB + bonding su ordinativo. Piano B: 2,1" MIPI sunlight (già a catalogo Newhaven) |
| 2 | **ESP32-P4 + pannello RGB**: il P4 nasce per MIPI-DSI | Medio | Scegliere un pannello **MIPI** nativo, oppure prevedere un bridge DSI→RGB. Da verificare sulla revisione corrente del TRM prima del layout |
| 3 | Profondità 50 mm con 3 schede + manifold + batteria | Alto | Fare un mock-up 3D **prima** dello schematico. La batteria è il volume più critico |
| 4 | Certificazione | Medio | Realisticamente: mercato **alianti / ultraleggeri / experimental**, non aviazione certificata. Il percorso TSO è di un altro ordine di costo. Documentarlo esplicitamente |
| 5 | Trasmissione FLARM | Alto (legale) | **Non implementare**. Solo FANET/OGN in trasmissione, FLARM in ricezione via seriale |
| 6 | Approvazione IGC | Medio | Va progettata dall'inizio (memoria sigillata, secure element, tamper) — aggiungerla dopo è quasi impossibile |
| 7 | EMI verso la radio VHF di bordo | Alto | È il modo classico in cui uno strumento nuovo viene rifiutato dai piloti. Filtri e schermatura non sono opzionali |
| 8 | Sicurezza del modello "app di terze parti" | Medio | Un'app non deve poter falsificare il log firmato né bloccare il vario. Isolamento dei task, watchdog, priorità fisse ai servizi di volo |

---

## 17. Prossimi passi suggeriti

1. **Mock-up meccanico 3D** (guscio, 3 schede, manifold, batteria, display) per validare i 50 mm.
2. **Scheda di valutazione sensori**: BMP581 + SDP810 + SDP31 + MS4525DO su un unico banco, con
   generatore di pressione, per misurare rumore e latenza *reali* del vario prima di congelare la BOM.
3. **Prototipo display**: P4 devkit + pannello candidato, misura di fps, consumo e leggibilità in
   sole diretto (misurazione con luxmetro, non a occhio).
4. **Definizione dell'API pubblica** (il modello dati del §13.2): va congelata presto, perché è il
   contratto verso gli sviluppatori e vincola i rate di campionamento in hardware.
5. Schematico a blocchi → revisione → layout, in quest'ordine, con le regole del §14.3 come checklist.

---

---

# Parte 2 — Vento in diretta e piattaforma per sviluppatori

## A — Vento in diretta

### A.1 Cosa fanno i prodotti di riferimento

| Prodotto | Approccio | Cosa possiamo imparare |
|---|---|---|
| **LXNAV HAWK** | Filtro di Kalman esteso (EKF) che stima congiuntamente le **tre** componenti del moto della massa d'aria. Vento **istantaneo**, senza attendere né spiralare. Non usa la conservazione dell'energia → **nessuna compensazione TE necessaria**, netto più accurato e indipendente dalla velocità, niente false termiche generate dalle raffiche | È un'opzione software su hardware che ha già IMU + air data. **Il valore è nell'algoritmo, non in sensori esotici** |
| **Anemoi** (RS Flight Systems) | Filtro di Kalman **non lineare a 14 stati**, fonde inerziale + pressione + dati GPS. Scatola sensori con IMU + pitot + statica + ingresso NMEA da FLARM, display remoti da 1,3". **Esplicitamente senza magnetometro**, "prono a interferenze" | Conferma che la prua magnetica **non serve** e anzi peggiora le cose. Conferma anche l'architettura "sensor box + display" |
| **Larus** (open source, `larus-breeze`) | IMU + sensori di pressione + (D-)GNSS. Kalman che fonde quota, velocità verticale e accelerazione verticale per un vario ultra-rapido; compensazione di velocità **GNSS/INS** invece che pneumatica; bussola 3D auto-calibrante con modello magnetico NOAA; uscita NMEA per XCSoar; **simulatore SIL** per qualificare gli algoritmi | **Da studiare riga per riga**: firmware, PCB e documentazione di protocollo sono pubblici. È il punto di partenza tecnico più solido esistente |

**Conclusione strategica**: il vento in diretta non richiede un hardware "diverso" — richiede che l'hardware
che stiamo già progettando sia **calibrato, sincronizzato e a basso bias**. È qui che si vince o si perde.

### A.2 La fisica in una riga, e dove si rompe

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

### A.3 Requisiti hardware — la lista operativa

#### 1. IMU: conta il *bias*, non il rumore

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

#### 2. GNSS: la velocità, non la posizione

- Rate **≥10 Hz** (25 Hz se disponibile), con **accuratezza in velocità** (soluzione Doppler) come
  criterio di scelta, non la CEP di posizione.
- **Doppia banda L1+L5 (NEO-F10N)**: il multipath è il killer della velocità GNSS, e L5 lo riduce.
- **PPS cablato a un timer capture** del P4 — vedi punto 4.
- Antenna esterna con LNA: già previsto in Parte 1.

#### 3. Air data: TAS accurata, non solo IAS

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

#### 4. Sincronizzazione temporale — il requisito che quasi tutti sottovalutano

Tutti i campioni devono portare un **timestamp hardware su un unico clock**:

- IMU su **SPI con DMA a 200–400 Hz**, campionato su interrupt DRDY, timestamp preso in ISR con
  timer a 1 µs.
- Barometrici e differenziali a 100 Hz, stesso schema.
- GNSS disciplinato dal **PPS**: il PPS aggancia il clock locale al tempo GPS, così il timestamp del
  fix è noto con precisione < 1 ms invece dei 50–200 ms di jitter tipici di un messaggio UART.
- Il core LP dell'ESP32-P4 può fare da time-stamper indipendente dal carico grafico — dettaglio
  architetturale che vale la pena sfruttare.

#### 5. Montaggio meccanico e allineamento

- L'IMU dev'essere **rigidamente accoppiato alla cellula**. Uno strumento nel cruscotto è accettabile,
  ma il cruscotto flette e vibra: prevedere smorzamento e, soprattutto, stimare i **tre angoli di
  disallineamento di montaggio come stati dell'EKF**, con procedura di allineamento in volo
  ("volo rettilineo stabilizzato 60 s").
- Fondamentale per l'usabilità: lo strumento **non deve richiedere un'installazione perfetta**.
  L'auto-allineamento è una feature di prodotto, non un dettaglio.

#### 6. Magnetometro: presente, ma mai in comando

Anemoi lo esclude, Larus lo usa auto-calibrandolo con il **modello NOAA (WMM)**. La sintesi giusta:

- Montarlo (costa 1,5 €), usarlo **solo come misura ausiliaria a covarianza alta** per limitare la
  deriva di heading nel volo rettilineo prolungato.
- Modello **WMM** a bordo per la declinazione, calibrazione hard/soft-iron guidata dall'utente
  ("fai due 360° lenti"), rilevamento automatico di disturbo (variazione del modulo del campo) con
  esclusione dinamica dalla soluzione.

#### 7. Il salto di qualità opzionale: misurare la derapata

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

#### 8. Calcolo

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

#### 9. Validazione — dove il progetto vive o muore

- **Simulatore SIL** con riproduzione di log reali (Larus ne ha uno: copiarne l'approccio).
- **Registrazione grezza di tutti i canali a rate pieno** durante il volo (vedi §B.4): serve per
  sviluppare l'algoritmo offline su dati veri, ed è anche la feature più amata dagli sviluppatori.
- Campagna di volo con riferimento: confronto con vento da spiralata mediato, con radiosondaggi,
  e con un secondo strumento commerciale.

### A.4 Cosa si ottiene, oltre al vento

Una volta che l'EKF gira, escono gratis grandezze che oggi si pagano a parte:

- **Vario a energia totale senza tubo TE** (la compensazione diventa inerziale/GNSS) — il tubo TE
  resta per ridondanza e compatibilità, non per necessità.
- **Netto e vario di massa d'aria** accurati e indipendenti dalla velocità.
- **Gradiente di vento** con la quota (fondamentale in finale e in onda).
- **Componente verticale della massa d'aria**: è ciò che rende utile un vario in dinamica di pendio.
- Base per **assistenza al centraggio** della termica e per stime di prestazione (polare reale).

---

## B — Cosa serviranno agli sviluppatori

### B.1 Storage: doppio livello, e la SD non basta

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

### B.2 AI locale: cosa è vero e cosa no

Va detto chiaramente, perché è l'area con più marketing e meno sostanza.

#### Cosa gira davvero a bordo (oggi, sul P4)

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

#### Cosa **non** gira a bordo

Un modello linguistico, anche "piccolo". Un modello da 100 M parametri richiede ~100 MB a 8 bit:
tre ordini di grandezza oltre il budget di un microcontrollore. I modelli 0,5–3 B girano su telefono
o Raspberry Pi con **GB** di RAM, non su MCU. Il pattern che l'industria ha adottato nel 2026 è
**ibrido**: locale ciò che è routinario e a bassa latenza, cloud/telefono ciò che è raro e pesante.

#### Come predisporre l'hardware oggi per l'AI di domani

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

#### Cosa deve offrire l'SDK perché l'ecosistema ML esista

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

### B.3 Connettività — presente e futuro

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

### B.4 Le cose che gli sviluppatori chiederanno per prime

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

### B.5 Progetti da studiare prima di scrivere una riga di codice

| Progetto | Cosa prendere |
|---|---|
| **Larus** (`larus-breeze/sw_sensor`, `hw_sensor`, `doc_larus`) | Algoritmi EKF, protocollo NMEA, simulatore SIL, **e il PCB**: è il precedente più vicino al nostro |
| **XCVario** (`iltis42/XCVario`) | Vario su **ESP32** con interfaccia dati aperta (formati OpenVario, Cambridge, Borgelt, XCVario), OTA via webserver, driver sensori. Prova che l'approccio funziona |
| **XCSoar** (`XCSoar/XCSoar`) | I driver dei dispositivi = la specifica dei protocolli da supportare |
| **GXAirCom** (`gereic/GXAirCom`) | FANET+ / OGN su LoRa, già funzionante |
| **OpenVario** | Ecosistema hardware/software aperto e le sue lezioni di integrazione |

---

### Sintesi delle azioni da portare nel progetto

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

---

# Parte 3 — Piano di lavoro

## 1. Fasi e deliverable

Procedere in ordine. Ogni fase produce artefatti verificabili; **non passare alla successiva senza
chiudere la precedente**.

### F0 — Verifiche bloccanti (prima di qualsiasi disegno)
Tre incognite possono invalidare l'architettura. Risolverle per prime, documentando la risposta:

1. **Pannello 2.8" rotondo, 1000 nit, con bonding ottico esiste davvero e in quantità?**
   Molti round 2.8" sono da 300–500 nit. Serve un fornitore reale con quotazione. Se no → 2.1" MIPI.
2. **Interfaccia del pannello vs ESP32-P4.** Il P4 nasce per MIPI-DSI. Verificare sul TRM della
   revisione corrente cosa supporta davvero, e scegliere un pannello **MIPI nativo** oppure mettere
   a progetto un bridge DSI→RGB. Non dare per scontato il parallelo RGB.
3. **I 50 mm ci stanno?** 3 schede + manifold pneumatico + batteria + connettori. Serve un
   **mock-up 3D volumetrico** prima dello schematico. La batteria è il volume critico.

**Output**: nota tecnica con esito, alternative e impatto sulle fasi successive.

### F1 — Architettura di sistema congelata
- Schema a blocchi completo con tutti i bus nominati e le loro velocità.
- **Power tree** con correnti, efficienze, dissipazioni per rail e budget termico.
- **Mappa dei pin del P4 e del C6**: ogni periferica assegnata, conflitti risolti, GPIO di riserva.
- Assegnazione dei tre PCB: cosa sta su A (frontale/HMI), B (main), C (power/IO/pneumatica).
- Catena di sincronizzazione temporale: DRDY, timer a 1 µs, PPS. **Requisito di sistema, non dettaglio.**

### F2 — Meccanica
- Modello 3D di guscio, ghiera, manifold pneumatico integrato, alloggiamento batteria, speaker.
- Disegno quotato dell'interfaccia pannello e della disposizione posteriore dei connettori.
- Percorso termico: P4 e driver backlight → guscio in alluminio. Verifica a +70 °C ambiente.
- Posizione di encoder e pulsanti verificata ergonomicamente (raggiungibili senza lasciare la cloche).

### F3 — Schematici
Organizzati per blocco funzionale, un foglio per blocco, con note di progetto sul foglio stesso:
alimentazione e protezioni · P4 + memorie · C6 + SDIO · display + backlight · sensori pneumatici ·
IMU/magnetometro · GNSS + RF · LoRa + RF · audio · I/O cablati e protezioni · HMI · espansione.

Ogni componente con **part number completo, package e link al datasheet**. ERC pulito.
Per ogni scelta non già congelata: due righe di motivazione.

### F4 — Layout PCB
- Stack-up 8 strati HDI sulla scheda B (definito in Parte 1 §14.2), 4 strati su A e C se sufficienti.
- Impedenze: 90 Ω USB diff, 100 Ω MIPI D-PHY, 50 Ω RF single-ended, 120 Ω CAN.
- **Applicare come checklist le 7 regole di piazzamento** della Parte 1 §14.3: isole RF, loop del
  buck, keep-out magnetometro, keep-out termico dei barometrici, termica, vibrazione, geometria polare.
- DRC pulito. Output: Gerber, drill, **BOM e CPL** per assemblaggio, render 3D.

### F5 — Bring-up e collaudo
- Piano di accensione per rail, con punti di test accessibili **prima** di impilare le schede.
- Test point per ogni bus critico, connettore di debug raggiungibile a strumento montato.
- Procedura di **calibrazione termica per unità** (tumble 12 posizioni + soak −20/+25/+60 °C) e
  formato della partizione firmata dei coefficienti.
- Banco di prova pneumatico per misurare rumore e latenza reali del vario.

### F6 — Documentazione per sviluppatori
- Modello dati pub/sub versionato (Parte 1 §13.2) con i rate garantiti — **è il contratto pubblico**.
- Pinout del connettore di espansione, budget di potenza disponibile, esempi di scheda accessoria.
- Elenco dei protocolli NMEA supportati: `LXWP0/1/2/3`, `LXDT`, `LXBC`, Borgelt B50, Cambridge,
  OpenVario, XCVario, protocollo Larus. Riferimento: i driver di XCSoar.
- Formato del pacchetto app, permessi, quote di CPU/RAM, modalità sviluppatore.

---

## 2. Regole di lavoro

1. **Non reinventare la ricerca**: le Parti 1 e 2 di questo documento sono il punto di partenza.
   Se una fonte è insufficiente, cercarne un'altra — non tirare a indovinare.
2. **Nessun part number senza verifica di disponibilità reale** (distributore, stock, lifecycle).
   Un componente in EOL o allocato manda il progetto in stallo.
3. **Ogni deviazione dalle decisioni congelate (Parte 0 §3) va dichiarata** con motivo tecnico e impatto, prima di procedere.
4. **Motivare le scelte in due righe**, non in due pagine. Il documento serve a chi costruisce.
5. Quando un requisito è ambiguo e le due letture portano a lavori diversi, **chiedere**.
   Quando è una scelta di routine, decidere e dichiarare l'assunzione.
6. Strumenti: **KiCad 9** salvo diversa indicazione. File versionati nel repo, un commit per fase.
7. Priorità in caso di conflitto: **sicurezza di volo > integrità del dato > apertura agli sviluppatori
   > costo > eleganza**.

---

## 3. Domande da porre al committente prima di F3

1. **EDA**: KiCad o Altium? (default assunto: KiCad 9)
2. **Volumi previsti** nella prima serie: cambia la scelta fra componenti costosi-affidabili e
   alternative economiche, e la strategia di assemblaggio.
3. **Batteria tampone in v1** o rinviata a v2? È il volume più critico dei 50 mm.
4. **Approvazione IGC**: obiettivo dichiarato o opzione futura? Determina la struttura di sicurezza
   e i costi di certificazione.
5. **Touch sul display**: sì o no in v1? Impatta vetro, bonding e costo.
6. Preferenza sul **connettore posteriore principale**: Molex Micro-Fit, D-Sub, o compatibilità
   con la cablatura LXNAV esistente (RJ12/RJ45)?

---

## 4. Criteri di accettazione

Il lavoro è completo quando:

- I tre rischi di F0 sono chiusi con risposta documentata e fornitori identificati.
- Esiste un mock-up 3D che **dimostra** che tutto sta in 50 mm.
- Schematici con ERC pulito e ogni componente tracciato a un datasheet e a uno stock reale.
- Layout con DRC pulito, impedenze verificate, e le 7 regole di piazzamento applicate e documentate.
- BOM e CPL pronti per un assemblatore, con costo unitario stimato ai volumi dichiarati.
- Un documento di bring-up che un tecnico può seguire senza aver partecipato al progetto.
- Il contratto API pubblico è scritto e congelato.

**Il criterio finale, sopra tutti**: uno sviluppatore esterno deve poter ricevere lo strumento,
leggere la documentazione e far girare la propria applicazione senza mai parlare con noi.

---

# Parte 4 — Fonti

## Hardware, formato, sensori, alimentazione

- [LXNAV S8x & S10x manual (porte Pstatic / Ptotal / TE)](https://gliding.lxnav.com/wp-content/uploads/manuals/LXS8xS10xManualEnglishVer0606.pdf)
- [LXNAV S100 — LX Avionik](https://www.lx-avionik.de/produkte/s100/)
- [LXNAV Remote stick / CAN-RS485 installation manual](https://gliding.lxnav.com/wp-content/uploads/manuals/RemoteStickInstallationManualEnglishVer0111rev6.pdf)
- [Bosch BMP581 datasheet](https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmp581-ds004.pdf)
- [Bosch — BMP581 announcement](https://www.bosch-sensortec.com/en/news/bosch-barometic-sensor-bmp581.html)
- [Sensirion SDP31 — differential pressure ±500 Pa](https://sensirion.com/products/catalog/SDP31)
- [MS4525DO airspeed sensor](https://siderion.io/products/ms4525do-airspeed-differential-pressure-sensor)
- [PX4 — Airspeed sensors](https://docs.px4.io/main/en/sensor/airspeed)
- [TDK ICM-42688-P datasheet](https://product.tdk.com/system/files/dam/doc/product/sensor/mortion-inertial/imu/data_sheet/ds-000347-icm-42688-p-v1.6.pdf)
- [u-blox ZED-F9P](https://www.u-blox.com/en/product/zed-f9p-module)
- [Semtech SX1262](https://www.semtech.com/products/wireless-rf/lora-connect/sx1262)
- [GXAirCom — FANET+ / FLARM / OGN open source](https://github.com/gereic/GXAirCom)
- [Open Glider Network — TTN interface](http://wiki.glidernet.org/ttn-interface)
- [FAI Sporting Code S7H — CIVL Flight Recorder Specification](https://www.fai.org/sites/default/files/civl/documents/sporting_code_s7_h_-_civl_flight_recorder_specification_2018_v0.9.0.pdf)
- [FAI — GNSS Flight Recorders, IGC approval (Annex B, Ch.1)](https://www.fai.org/sites/default/files/documents/6_2_6_sc3_annexb_ch1.pdf)
- [Newhaven — 2.1" 480×480 round sunlight readable IPS](https://newhavendisplay.com/2-1-inch-480x480-round-ips-tft-lcd-display/)
- [Zhunyi — 2.8" round 480×480 ST7701S](https://www.zhunyidisplay.com/products/z28007-2.8-inch-round-lcd-display-480-480-tft-type-spi-rgb-interface-ic-st7701s/)
- [Sunlight readable TFT — nit, contrasto, bonding ottico](https://www.displaymodule.com/blogs/knowledge/sunlight-readable-tft-displays-nits-brightness-contrast-anti-glare)
- [Waveshare — ESP32-P4 + C6 Wi-Fi 6 Touch LCD](https://docs.waveshare.com/ESP32-P4-WIFI6-Touch-LCD-XC)
- [CNX Software — ESP32-P4 + ESP32-C6 board](https://www.cnx-software.com/2026/03/27/esp32-p4-pi-viewe-raspberry-pi-esp32-p4-esp32-c6-board/)
- [Bourns EM14 — encoder ottico 14 mm con switch](https://www.bourns.com/docs/Product-Datasheets/em14.pdf)
- [Grayhill — scegliere un encoder rotativo](https://grayhill.com/blog/5-questions-to-ask-before-choosing-a-rotary-encoder/)
- [Instrument panel hole sizes (John DeRosa)](http://aviation.derosaweb.net/presentations/documents/Instrument_Hole_SizesX.pdf)
- [Van's Air Force — standard 3⅛" panel cutout](https://vansairforce.net/threads/standard-3-1-8-panel-cutout-dimensions.6863/)
- [GAIA Converter — DC/DC per avionica](https://www.gaia-converter.com/markets/dc-dc-converters-for-avionics/)
- [Military Embedded — wide-range DC-DC e load dump](https://dev007.militaryembedded.com/unmanned/payloads/wide-range-dc-dc-converters-power-military-electronics)

## Vento, algoritmi, AI, connettività, ecosistema

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
