#!/usr/bin/env python3
"""
voci.py — incide una volta per tutte la voce di ogni frase del corpus.

    tools/.venv/Scripts/python tools/voci.py           # tutte le lingue
    tools/.venv/Scripts/python tools/voci.py de ru     # solo queste

PERCHE' UN FILE INVECE DI SINTETIZZARE SUL MOMENTO.

`speechSynthesis` legge con le voci installate sul dispositivo, e quelle
cambiano da telefono a telefono: su iPhone il russo ha una voce sola, la Milena
compatta, e le versioni migliorate scaricate dal sistema al browser non
arrivano. Regolare velocita' e tono non serve: la voce e' quella. L'endpoint di
Google Translate, che l'app usava per rimediare, e' un servizio non documentato
che va raggiunto a ogni ascolto e che puo' sparire.

Il corpus pero' e' un insieme CHIUSO di frasi corte. Inciderle una volta con
una voce neurale e servirle come file risolve tutte e tre le cose insieme: la
voce e' la stessa su ogni dispositivo, si sente anche senza rete, e nessuna
frase viaggia piu' verso nessuno mentre si studia. La dipendenza da un servizio
esterno si sposta da chi studia a chi pubblica.

COSA PRODUCE, per ogni lingua:

    assets/audio/<lingua>/<id>.mp3     una frase, ~14 kB
    assets/audio/<lingua>/tempi.json   durata e attacco di OGNI PAROLA

I tempi sono la parte che non si vede e vale di piu': il sintetizzatore dice a
che secondo comincia ogni parola, quindi l'ascolto guidato illumina la parola
giusta mentre suona, e toccare una parola ne fa risentire soltanto quella —
senza spezzare la frase in tanti file, e con la prosodia della frase intera
invece che di una parola pronunciata da sola.

DA DOVE VIENE LA VOCE, detto per intero: sono le voci neurali di Microsoft,
prese dall'endpoint che usa la lettura ad alta voce di Edge (`edge-tts`, la
libreria che ci parla). Non e' un'API documentata per questo uso, e i file che
produce restano qui dentro: e' una scelta ragionevole per un'app personale e
NON lo sarebbe per una pubblicata. Il resto del programma non ne dipende — la
sorgente e' dietro una tabella di poche righe, e passare a un motore locale e
libero (Piper) vuol dire cambiare quella e rilanciare questo script.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import edge_tts

RADICE = Path(__file__).resolve().parent.parent
AUDIO = RADICE / 'assets' / 'audio'

# Una voce per lingua, femminile, neurale. Il dialetto non ha una voce sua:
# ripiega sul tedesco standard svizzero, che e' un'indicazione, non un modello.
VOCI = {
    'de': 'de-DE-KatjaNeural',
    'gsw': 'de-CH-LeniNeural',
    'ru': 'ru-RU-SvetlanaNeural',
    'en': 'en-GB-SoniaNeural',
    'es': 'es-ES-ElviraNeural',
}

# Quante frasi alla volta. Sopra questa soglia il servizio comincia a chiudere
# le connessioni, e riprovare costa piu' di quanto la fretta faccia guadagnare.
INSIEME = 6
TENTATIVI = 3


def frasi() -> list[dict]:
    """Il corpus, chiesto a chi lo possiede: node."""
    node = os.environ.get('NODE', r'C:\Program Files\nodejs\node.exe')
    if not Path(node).exists():
        node = 'node'
    out = subprocess.run(
        [node, str(RADICE / 'tools' / 'frasi-da-leggere.mjs')],
        cwd=RADICE, capture_output=True, check=True,
    )
    return json.loads(out.stdout.decode('utf-8'))


def impronta(testo: str, voce: str) -> str:
    """Cambia se cambia la frase O la voce: solo allora si reincide."""
    return hashlib.sha256(f'{voce}\n{testo}'.encode('utf-8')).hexdigest()[:16]


async def incidi(testo: str, voce: str) -> tuple[bytes, list, float]:
    """Un mp3 e gli attacchi di ogni parola, in secondi."""
    ultimo = None
    for tentativo in range(TENTATIVI):
        try:
            comm = edge_tts.Communicate(testo, voce, boundary='WordBoundary')
            audio = bytearray()
            parole = []
            fine = 0.0
            async for pezzo in comm.stream():
                if pezzo['type'] == 'audio':
                    audio += pezzo['data']
                elif pezzo['type'] == 'WordBoundary':
                    t = pezzo['offset'] / 1e7
                    d = pezzo['duration'] / 1e7
                    parole.append([round(t, 3), round(d, 3), pezzo['text']])
                    fine = max(fine, t + d)
            if not audio:
                raise RuntimeError('nessun audio')
            return bytes(audio), parole, round(fine, 3)
        except Exception as err:            # noqa: BLE001 — si riprova e poi si dice
            ultimo = err
            await asyncio.sleep(1.5 * (tentativo + 1))
    raise RuntimeError(f'non incisa dopo {TENTATIVI} tentativi: {ultimo}')


async def lingua(codice: str, righe: list[dict]) -> None:
    voce = VOCI[codice]
    cartella = AUDIO / codice
    cartella.mkdir(parents=True, exist_ok=True)
    tempi_file = cartella / 'tempi.json'

    vecchi = {}
    if tempi_file.exists():
        vecchi = json.loads(tempi_file.read_text(encoding='utf-8')).get('frasi', {})

    da_fare = []
    tempi = {}
    for r in righe:
        segno = impronta(r['testo'], voce)
        gia = vecchi.get(r['id'])
        if gia and gia.get('h') == segno and (cartella / f"{r['id']}.mp3").exists():
            tempi[r['id']] = gia          # invariata: non si rifa'
        else:
            da_fare.append((r, segno))

    print(f'[{codice}] {len(righe)} frasi, {len(da_fare)} da incidere con {voce}')

    guardia = asyncio.Semaphore(INSIEME)
    fatte = 0
    guasti = []

    async def una(r, segno):
        nonlocal fatte
        async with guardia:
            try:
                audio, parole, durata = await incidi(r['testo'], voce)
            except Exception as err:       # noqa: BLE001
                guasti.append((r['id'], str(err)))
                return
            (cartella / f"{r['id']}.mp3").write_bytes(audio)
            # Le parole segnate dal motore devono essere tante quante quelle
            # della frase, altrimenti l'app non saprebbe quale illuminare: se
            # non tornano si tiene l'audio e si buttano i tempi.
            allineate = len(parole) == r['parole']
            tempi[r['id']] = {
                'h': segno,
                'd': durata,
                'p': parole if allineate else None,
            }
            fatte += 1
            if fatte % 25 == 0:
                print(f'  {fatte}/{len(da_fare)}')

    await asyncio.gather(*(una(r, s) for r, s in da_fare))

    if guasti:
        print(f'  {len(guasti)} non incise:')
        for ident, err in guasti[:5]:
            print(f'    {ident}: {err}')

    senza_tempi = sum(1 for v in tempi.values() if not v.get('p'))
    tempi_file.write_text(
        json.dumps({'voce': voce, 'frasi': tempi}, ensure_ascii=False, separators=(',', ':')),
        encoding='utf-8',
    )
    peso = sum(f.stat().st_size for f in cartella.glob('*.mp3')) / 1048576
    print(f'[{codice}] {len(tempi)} incise, {peso:.1f} MB'
          + (f', {senza_tempi} senza tempi per parola' if senza_tempi else ''))


async def main() -> int:
    volute = sys.argv[1:] or list(VOCI)
    tutte = frasi()
    uscita = 0
    for codice in volute:
        if codice not in VOCI:
            print(f'lingua sconosciuta: {codice}')
            uscita = 1
            continue
        await lingua(codice, [r for r in tutte if r['lang'] == codice])
    return uscita


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
