/*
 * Elenca, in JSON su stdout, tutto ciò che va letto ad alta voce.
 *
 * Esiste perché il generatore delle voci è in Python (là c'è edge-tts) mentre
 * il corpus è in JavaScript, e una seconda copia del corpus in Python sarebbe
 * una seconda verità: dopo la prima frase aggiunta da una parte sola, le due
 * si separano. Qui il corpus resta uno solo e attraversa il confine come dati.
 *
 *   node tools/frasi-da-leggere.mjs
 */
import { LANGS } from '../assets/js/corpus.js';

/*
 * L'accento tonico del russo è un aiuto per chi legge, non ortografia: nei
 * testi veri non c'è. Misurato il 29/08/2026 su ru-RU-SvetlanaNeural, dandolo
 * in pasto al sintetizzatore l'audio si allunga di quasi un secondo su tre
 * parole e gli attacchi delle parole slittano: il motore ci inciampa invece di
 * usarlo. Quindi si legge la frase senza.
 */
const senzaAccento = (text) => text.normalize('NFD').replace(/́/g, '').normalize('NFC');

const out = [];
for (const lang of LANGS) {
  for (const s of lang.sentences) {
    out.push({
      lang: lang.code,
      locale: lang.locale,
      id: s.id,
      testo: senzaAccento(s.text),
      parole: senzaAccento(s.text).split(/\s+/).filter(Boolean).length,
    });
  }
}
process.stdout.write(JSON.stringify(out));
