#!/usr/bin/env python3
"""
pronuncia.py — la riga «come si legge», scritta per un lettore italiano.

    tools/.venv/Scripts/python tools/pronuncia.py           # tutte le lingue
    tools/.venv/Scripts/python tools/pronuncia.py de en     # solo queste

PERCHE' NON BASTA LA FRASE SCRITTA.

Il russo ha gia' la sua riga di traslitterazione, perche' senza non si legge
proprio: l'alfabeto e' un altro. Le altre quattro lingue si scrivono in
caratteri latini, e proprio per questo ingannano — un italiano legge `Ich
moechte` come «ik mocte», `much` come «muk», `gusta` come «giusta». Sono
lettere che conosce, con suoni che non sono i suoi.

Quindi qui non si traslittera: si scrive COME SUONA, con le convenzioni di chi
legge in italiano.

DA DOVE VENGONO I SUONI. Da espeak-ng (via phonemizer), che per ogni parola da'
l'IPA con l'accento tonico. Non e' un elenco di regole scritto a mano: le
regole dell'inglese non esistono, e per il tedesco sarebbero decine con
altrettante eccezioni. Gira tutto offline e in locale.

QUANTO VALE. E' un'APPROSSIMAZIONE, e va detto: certi suoni in italiano non
ci sono, e nessuna scrittura puo' inventarli. La ü tedesca resta ü, la th
spagnola resta th, e la vocale di `bird` diventa una ö che le somiglia senza
esserlo. Serve a non sbagliare di grosso e a sapere dove cade l'accento, non a
sostituire l'ascolto — che infatti sta a un tocco di distanza.

PRODUCE  assets/pronuncia/<lingua>.json  =  { id: "riga di pronuncia" }
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import espeakng_loader
from phonemizer.backend.espeak.wrapper import EspeakWrapper

EspeakWrapper.set_library(espeakng_loader.get_library_path())
EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
from phonemizer import phonemize  # noqa: E402 — dopo aver puntato la libreria

RADICE = Path(__file__).resolve().parent.parent
USCITA = RADICE / 'assets' / 'pronuncia'

# Il dialetto non ha una voce sua in espeak: si legge la grafia Dieth con le
# regole del tedesco, che e' esattamente il patto della grafia Dieth.
LINGUE = {'de': 'de', 'gsw': 'de', 'en': 'en-gb', 'es': 'es'}

ACUTI = {'a': 'á', 'e': 'é', 'i': 'í', 'o': 'ó', 'u': 'ú', 'ö': 'ö́', 'ü': 'ǘ'}

# I DITTONGHI PRIMA DEI SINGOLI: altrimenti aɪ diventa «ai» solo per caso, e
# əʊ diventerebbe «eu» invece che «ou».
DITTONGHI = [
    ('aɪ', 'ai'), ('aʊ', 'au'), ('ɔɪ', 'oi'), ('eɪ', 'ei'), ('əʊ', 'ou'),
    ('oʊ', 'ou'), ('ɪə', 'ie'), ('eə', 'ee'), ('ʊə', 'ue'), ('ɔø', 'oi'),
    ('ɔy', 'oi'), ('aə', 'ea'),
]

# LE DUE LETTERE CHE IN ITALIANO CAMBIANO SUONO DA SOLE.
#
# `c` e `g` in italiano dipendono da cio' che segue: «ca» è dura e «ce» è
# dolce. Scrivere `much` come «mac» farebbe leggere «mak», e `gusta` come
# «gusta» farebbe leggere «giusta» a nessuno ma «ghe» sì. Quindi i due suoni
# viaggiano come segnaposto e diventano lettere solo alla fine, guardando la
# vocale che li segue:
#
#   /tʃ/ -> `ch`   (la stessa convenzione della riga russa già in uso)
#   /dʒ/ -> `g` davanti a e, i;  `gi` altrove
#   /g/  -> `gh` davanti a e, i; `g` altrove
DZ = '\x01'    # /dʒ/
GG = '\x02'    # /g/ dura
LL = '\x03'    # /ʎ/ — in italiano «gl» vale ʎ solo davanti a i: gli, non gla

# Consonanti. `h` fa doppio servizio per la ch tedesca e la j spagnola: sono
# due aspirate diverse, e in italiano non c'e' nessuna delle due.
#
# ATTENZIONE alla `ɡ` dell'IPA (U+0261): somiglia a una g ma non lo e', e senza
# questa riga sparisce insieme a tutto il resto che non sappiamo leggere —
# «gusta» diventava «usta».
CONSONANTI = [
    ('tʃ', 'ch'), ('dʒ', DZ), ('ts', 'ts'), ('dz', 'dz'),
    ('ʃ', 'sh'), ('ʒ', 'zh'), ('θ', 'th'), ('ð', 'dh'),
    ('ç', 'h'), ('x', 'h'), ('χ', 'h'), ('ɣ', GG), ('β', 'b'), ('ɸ', 'f'),
    ('ŋɡ', 'ng'), ('ŋg', 'ng'), ('ŋ', 'ng'), ('ɲ', 'gn'), ('ʎ', LL), ('ɫ', 'l'), ('ɭ', 'l'), ('ʟ', 'l'),
    ('ɹ', 'r'), ('ɾ', 'r'), ('ʀ', 'r'), ('ʁ', 'r'), ('r', 'r'),
    ('j', 'i'), ('w', 'u'), ('ʋ', 'v'),
    ('b', 'b'), ('d', 'd'), ('f', 'f'), ('ɡ', GG), ('g', GG), ('k', 'k'),
    ('l', 'l'), ('m', 'm'), ('n', 'n'), ('p', 'p'), ('s', 's'), ('t', 't'),
    ('v', 'v'), ('z', 'z'), ('h', 'h'),
]

# Vocali. Le tre che l'italiano non ha restano riconoscibili: ü, ö, e la e
# muta inglese, che qui diventa una e perche' e' quello che un italiano fara'.
VOCALI = [
    ('ɐ', 'a'), ('ɑ', 'a'), ('a', 'a'), ('æ', 'a'), ('ʌ', 'a'),
    ('ɛ', 'e'), ('e', 'e'), ('ə', 'e'),
    ('ɪ', 'i'), ('i', 'i'), ('ɨ', 'i'),
    ('ɔ', 'o'), ('ɒ', 'o'), ('o', 'o'), ('ɵ', 'o'), ('ɤ', 'o'),
    ('ʊ', 'u'), ('ᵿ', 'u'), ('u', 'u'), ('ᵻ', 'i'), ('ɘ', 'e'),
    ('ɜ', 'ö'), ('ø', 'ö'), ('œ', 'ö'),
    ('y', 'ü'), ('ʏ', 'ü'),
]

# COSA CAMBIA DA UNA LINGUA ALL'ALTRA.
#
# La mappa sopra è quella generale; queste sono le eccezioni, e ognuna ha una
# ragione che vale solo lì.
#
# Spagnolo: d, g e b fra vocali sono fricative (ð, ɣ, β). È vero, e scriverlo
# rende la riga illeggibile — «de dónde» diventerebbe «de dhónde». Sono suoni
# che un italiano produce da solo parlando in fretta, e che nessuno gli
# contesterà: restano d, g, b. La θ di «gracias» invece NO: quella è una
# distinzione vera, e chi la ignora dice un'altra parola.
#
# Tedesco: la -er finale non è la vocale di «bird» ma una a scura (früher →
# «früa»). ɜ vale ö in inglese e a in tedesco.
PER_LINGUA = {
    'es': [('ð', 'd'), ('ɣ', 'g'), ('β', 'b')],
    'de': [('ɜ', 'a')],
}

# Segni che non dicono niente a chi legge: lunghezza, sillabicita', legature.
DA_TOGLIERE = 'ːˑ̩̯̃ʲʰ‿|'

VOCALI_SCRITTE = 'aeiouöü'


def scioglie(s: str) -> str:
    """I segnaposto di c e g diventano lettere, guardando cosa li segue."""
    out = []
    for i, ch in enumerate(s):
        dopo = s[i + 1] if i + 1 < len(s) else ''
        # `'' in 'ei'` in Python è VERO: senza il controllo su `dopo` ogni g
        # di fine parola diventava «gh», e «cooking» usciva «kukingh».
        dolce = bool(dopo) and dopo in 'ei'
        if ch == DZ:
            out.append('g' if dolce else 'gi')
        elif ch == GG:
            out.append('gh' if dolce else 'g')
        elif ch == LL:
            # «llamo» scritto «glamo» si legge /glamo/: in italiano la gl vale ʎ
            # soltanto davanti a i. Fuori da lì ci vuole la i: «gliamo».
            out.append('gl' if dopo == 'i' else 'gli')
        else:
            out.append(ch)
    return ''.join(out)


def dai_ipa(ipa: str, lingua: str = '') -> str:
    """Da IPA a una parola che un italiano legge ad alta voce senza istruzioni."""
    s = unicodedata.normalize('NFC', ipa)
    for ch in DA_TOGLIERE:
        s = s.replace(ch, '')
    for a, b in PER_LINGUA.get(lingua.split('-')[0], []):
        s = s.replace(a, b)

    # L'accento tonico si tiene da parte: torna come accento acuto sulla
    # vocale, che è il modo in cui l'italiano segna l'accento da sempre.
    #
    # Dentro la frase molte parole hanno solo l'accento SECONDARIO: il primario
    # se lo prende un'altra. «before», in «before I called», esce senza ˈ, e
    # senza questa riga uscirebbe «bifor», cioè senza dire dove cade. Quando il
    # primario non c'è, vale il secondario.
    # UNO SOLO, il primo. Su una parola composta espeak ne segna due
    # («zmittag» esce tsˈɛtmˈɪtɑːk): il secondo restava dentro la riga come un
    # carattere invisibile, e la parola si spezzava in due a metà.
    if 'ˈ' in s:
        s = s.replace('ˈ', '\x00', 1).replace('ˈ', '').replace('ˌ', '')
    elif 'ˌ' in s:
        s = s.replace('ˌ', '\x00', 1).replace('ˌ', '')

    for a, b in DITTONGHI + CONSONANTI + VOCALI:
        s = s.replace(a, b)

    # tutto quello che espeak ha lasciato e che non sappiamo leggere
    s = re.sub(r'[^\x00\x01\x02\x03a-zàèéìòùöü]', '', s)
    s = scioglie(s)

    # SILLABE, non vocali: «ai» e «au» sono dittonghi, cioè una sillaba sola.
    # Contando le lettere, «I» e «how» prenderebbero un accento che a una
    # parola di una sillaba non serve, e che toglie rilievo a quelle che lo
    # hanno davvero.
    # senza togliere il segno dell'accento, quello si mette IN MEZZO al
    # dittongo e lo conta per due: «works» diventava bisillabo e prendeva
    # un acuto che una parola di una sillaba non deve avere.
    sillabe = len(re.findall(r'[aeiouöü]+', s.replace(chr(0), '')))

    if '\x00' in s:
        i = s.index('\x00')
        resto = s[i + 1:]
        # L'ACCENTO SOLO SULLE POLISILLABE. Presa da sola, ogni parola riceve
        # da espeak un accento primario: la riga si riempirebbe di acuti su
        # «e», «la», «per», che nel parlato non ne hanno nessuno, e l'accento
        # smetterebbe di dire dove cade davvero.
        m = re.search(r'[aeiouöü]', resto) if sillabe > 1 else None
        if m:
            j = m.start()
            resto = resto[:j] + ACUTI.get(resto[j], resto[j]) + resto[j + 1:]
        s = s[:i] + resto
    return s


def frasi() -> list[dict]:
    node = os.environ.get('NODE', r'C:\Program Files\nodejs\node.exe')
    if not Path(node).exists():
        node = 'node'
    out = subprocess.run([node, str(RADICE / 'tools' / 'frasi-da-leggere.mjs')],
                         cwd=RADICE, capture_output=True, check=True)
    return json.loads(out.stdout.decode('utf-8'))


def riga(testo: str, lingua: str) -> str:
    """
    La frase intera, ma con le parole ancora separate.

    Chiedere una parola alla volta sembrava piu' sicuro ed e' peggio: fuori
    dalla frase ogni parola riceve l'accento primario e la sua vocale piena,
    quindi `are` diventava «ar» invece di «a» e `I` prendeva un accento che nel
    parlato non ha. L'accento di frase e le vocali ridotte esistono solo dentro
    la frase, e sono meta' di quello che questa riga deve far vedere.

    Se pero' espeak restituisce un numero di parole diverso da quello della
    frase, l'allineamento e' perso e la riga direbbe la pronuncia di una parola
    sotto un'altra: in quel caso si torna parola per parola, che sara' meno
    fedele ma non sara' sbagliato.
    """
    parole = [p for p in re.split(r'\s+', testo) if p]
    nude = []
    for parola in parole:
        n = re.sub(r'[.,!?¿¡;:"()…«»]', '', parola)
        if n:
            nude.append(n)
    if not nude:
        return ''

    # In dialetto gli articoli sono lettere sole (d Wösch, s Zimmer): espeak le
    # legge come nomi di lettera («dé», «ess»), quindi restano come sono.
    solitaria = lambda n: len(n) == 1 and n.lower() not in 'aeiouy'

    intera = phonemize(' '.join(nude), language=lingua, backend='espeak',
                       strip=True, with_stress=True, preserve_punctuation=False,
                       words_mismatch='ignore').split()
    if len(intera) == len(nude):
        return ' '.join(
            n.lower() if solitaria(n) else (dai_ipa(ipa, lingua) or n.lower())
            for n, ipa in zip(nude, intera))

    fuori = []
    for n in nude:
        if solitaria(n):
            fuori.append(n.lower())
            continue
        ipa = phonemize(n, language=lingua, backend='espeak', strip=True,
                        with_stress=True, preserve_punctuation=False,
                        words_mismatch='ignore').strip()
        fuori.append(dai_ipa(ipa, lingua) or n.lower())
    return ' '.join(fuori)


def lingua(codice: str, righe: list[dict]) -> int:
    voce = LINGUE[codice]
    USCITA.mkdir(parents=True, exist_ok=True)
    fuori = {}
    vuote = 0
    for r in righe:
        p = riga(r['testo'], voce)
        if not p:
            vuote += 1
        fuori[r['id']] = p
    (USCITA / f'{codice}.json').write_text(
        json.dumps({'motore': f'espeak-ng/{voce}', 'frasi': fuori},
                   ensure_ascii=False, separators=(',', ':')),
        encoding='utf-8')
    print(f'[{codice}] {len(fuori)} righe di pronuncia da espeak-ng/{voce}'
          + (f', {vuote} vuote' if vuote else ''))
    return vuote


def main() -> int:
    volute = sys.argv[1:] or list(LINGUE)
    tutte = frasi()
    problemi = 0
    for codice in volute:
        if codice not in LINGUE:
            print(f'lingua senza riga di pronuncia: {codice}')
            problemi += 1
            continue
        problemi += lingua(codice, [r for r in tutte if r['lang'] == codice])
    return 1 if problemi else 0


if __name__ == '__main__':
    raise SystemExit(main())
