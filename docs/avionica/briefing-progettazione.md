# Briefing di progettazione — strumento avionico 80 mm

**Prompt di incarico** da consegnare a una sessione Claude dedicata alla progettazione.
Autoconsistente: contiene vincoli, decisioni già congelate, fasi e criteri di accettazione.

Documenti di riferimento (già prodotti, da **non** rifare):
- [`strumento-80mm-esp32-specifica-hardware.md`](./strumento-80mm-esp32-specifica-hardware.md) — architettura, BOM candidata, regole di layout
- [`vento-in-diretta-e-piattaforma-sviluppatori.md`](./vento-in-diretta-e-piattaforma-sviluppatori.md) — vento istantaneo, AI locale, connettività, API

---

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

Motivazioni complete nei due documenti di riferimento. Riaprire una di queste voci **solo** se emerge
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

## 4. Fasi e deliverable

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

## 5. Regole di lavoro

1. **Non reinventare la ricerca**: i due documenti di riferimento sono il punto di partenza.
   Se una fonte è insufficiente, cercarne un'altra — non tirare a indovinare.
2. **Nessun part number senza verifica di disponibilità reale** (distributore, stock, lifecycle).
   Un componente in EOL o allocato manda il progetto in stallo.
3. **Ogni deviazione dalle decisioni del §3 va dichiarata** con motivo tecnico e impatto, prima di procedere.
4. **Motivare le scelte in due righe**, non in due pagine. Il documento serve a chi costruisce.
5. Quando un requisito è ambiguo e le due letture portano a lavori diversi, **chiedere**.
   Quando è una scelta di routine, decidere e dichiarare l'assunzione.
6. Strumenti: **KiCad 9** salvo diversa indicazione. File versionati nel repo, un commit per fase.
7. Priorità in caso di conflitto: **sicurezza di volo > integrità del dato > apertura agli sviluppatori
   > costo > eleganza**.

---

## 6. Domande da porre al committente prima di F3

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

## 7. Criteri di accettazione

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
