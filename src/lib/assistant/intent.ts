/**
 * A pending change is confirmed only by a short, unambiguous yes, or rejected by a short no.
 * Anything with a new time, a date or a "but" goes back to the assistant as a fresh request,
 * so "yes, but make it 3pm" cannot confirm the previous time.
 *
 * Covers English, Hindi and Hinglish, the major Indian languages in their own scripts (and a
 * few unambiguous romanised forms), Urdu, Spanish and French.
 */
export type ReplyIntent = "confirm" | "reject" | "chat";

const YES = [
  // English, Hinglish, Hindi
  "yes", "yeah", "yep", "yup", "ok", "okay", "confirm", "confirmed", "sure", "haan", "han", "ji", "please", "go ahead", "do it",
  "book it", "please do", "theek hai", "thik hai", "kar do", "book karo", "haan ji", "ji haan", "हाँ", "हां", "जी", "हाँ जी", "जी हाँ",
  "ठीक है", "कर दो", "बुक करो", "yes please", "ok please", "okay please",
  // Marathi
  "हो", "होय", "ठीक आहे", "हो चालेल", "चालेल",
  // Telugu
  "అవును", "ఔను", "సరే", "అవునండి", "avunu", "sare",
  // Tamil
  "ஆம்", "ஆமாம்", "சரி", "aamam", "aama",
  // Kannada
  "ಹೌದು", "ಸರಿ", "haudu",
  // Malayalam
  "അതെ", "ശരി", "ശരി ആണ്",
  // Bengali
  "হ্যাঁ", "হাঁ", "ঠিক আছে", "আচ্ছা",
  // Gujarati
  "હા", "હાં", "બરાબર", "હા જી",
  // Punjabi
  "ਹਾਂ", "ਹਾਂ ਜੀ", "ਠੀਕ ਹੈ", "ਜੀ",
  // Odia
  "ହଁ", "ହଁ ଠିକ୍ ଅଛି",
  // Urdu
  "جی", "ہاں", "جی ہاں", "ٹھیک ہے",
  // Spanish, French
  "sí", "si", "vale", "claro", "oui", "d'accord",
];

const NO = [
  // English, Hinglish, Hindi
  "no", "nope", "nah", "don't", "dont", "do not", "stop", "cancel", "never mind", "nevermind", "nahi", "nahin", "mat karo",
  "rehne do", "नहीं", "मत", "रहने दो", "no thanks", "no thank you",
  // Marathi
  "नाही", "नको", "nako",
  // Telugu
  "కాదు", "వద్దు", "లేదు", "vaddu", "kaadu",
  // Tamil
  "இல்லை", "வேண்டாம்", "vendam", "venda",
  // Kannada
  "ಇಲ್ಲ", "ಬೇಡ", "beda",
  // Malayalam
  "ഇല്ല", "വേണ്ട",
  // Bengali
  "না", "না থাক", "লাগবে না",
  // Gujarati
  "ના", "નહીં", "રહેવા દો",
  // Punjabi
  "ਨਹੀਂ", "ਨਾ", "ਰਹਿਣ ਦਿਓ",
  // Odia
  "ନା", "ନାହିଁ",
  // Urdu
  "نہیں", "نہ", "رہنے دو",
  // French
  "non", "non merci",
];

function phrases(list: readonly string[]): RegExp {
  const escaped = list.map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^(${escaped.join("|")})[.!।]?$`, "iu");
}

const CONFIRM = phrases(YES);
const REJECT = phrases(NO);

export function interpretReply(text: string): ReplyIntent {
  const trimmed = text.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 40) return "chat";
  if (/\p{Nd}/u.test(trimmed) || /\b(but|except|instead|move|change|reschedule|tomorrow|today|monday|tuesday|wednesday|thursday|friday)\b/i.test(trimmed)) {
    return "chat";
  }
  if (REJECT.test(trimmed)) return "reject";
  if (CONFIRM.test(trimmed)) return "confirm";
  return "chat";
}
