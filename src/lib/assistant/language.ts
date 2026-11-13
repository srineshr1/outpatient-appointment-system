/**
 * Works out which language a message is written in, so the assistant can reply in it and the
 * dock can listen and speak with the matching voice. Pure and dependency-free: the server and
 * the browser dock both import it.
 *
 * Script comes first because it is reliable even for one Indic word. Latin text is not assumed
 * to be English: a small word list tells English, Hinglish, Spanish and French apart. A short
 * message with no language of its own ("ok", "haan", a name, a time) keeps the previous one.
 */

export interface DetectedLanguage {
  /** Stable id, e.g. "hi", "te", "hi-Latn" for Hinglish. */
  tag: string;
  /** BCP 47 locale for speech recognition and synthesis, e.g. "te-IN". */
  locale: string;
  /** English name for the language, used in the model's hint. */
  name: string;
}

const LANGUAGES: readonly DetectedLanguage[] = [
  { tag: "en", locale: "en-IN", name: "English" },
  { tag: "hi-Latn", locale: "en-IN", name: "Hinglish (Hindi written in Latin script)" },
  { tag: "hi", locale: "hi-IN", name: "Hindi (Devanagari script)" },
  { tag: "mr", locale: "mr-IN", name: "Marathi (Devanagari script)" },
  { tag: "te", locale: "te-IN", name: "Telugu (Telugu script)" },
  { tag: "ta", locale: "ta-IN", name: "Tamil (Tamil script)" },
  { tag: "kn", locale: "kn-IN", name: "Kannada (Kannada script)" },
  { tag: "ml", locale: "ml-IN", name: "Malayalam (Malayalam script)" },
  { tag: "gu", locale: "gu-IN", name: "Gujarati (Gujarati script)" },
  { tag: "pa", locale: "pa-IN", name: "Punjabi (Gurmukhi script)" },
  { tag: "bn", locale: "bn-IN", name: "Bengali (Bengali script)" },
  { tag: "or", locale: "or-IN", name: "Odia (Odia script)" },
  { tag: "ur", locale: "ur-IN", name: "Urdu (Urdu script)" },
  { tag: "ar", locale: "ar", name: "Arabic" },
  { tag: "es", locale: "es-ES", name: "Spanish" },
  { tag: "fr", locale: "fr-FR", name: "French" },
  { tag: "ru", locale: "ru-RU", name: "Russian" },
  { tag: "zh", locale: "zh-CN", name: "Chinese" },
  { tag: "ja", locale: "ja-JP", name: "Japanese" },
  { tag: "ko", locale: "ko-KR", name: "Korean" },
  { tag: "th", locale: "th-TH", name: "Thai" },
];

export const DEFAULT_LANGUAGE: DetectedLanguage = LANGUAGES[0]!;

/** Look a language up by tag ("te"), locale ("te-IN", "te_in") or language prefix ("te-XX"). */
export function languageFor(tagOrLocale: string | null | undefined): DetectedLanguage | null {
  const raw = tagOrLocale?.trim().replace(/_/g, "-").toLowerCase();
  if (!raw) return null;
  const byTag = LANGUAGES.find((language) => language.tag.toLowerCase() === raw);
  if (byTag) return byTag;
  const byLocale = LANGUAGES.find((language) => language.locale.toLowerCase() === raw);
  if (byLocale) return byLocale;
  const prefix = raw.split("-")[0];
  return LANGUAGES.find((language) => language.tag === prefix) ?? null;
}

/** One script per entry; the first match for a word decides that word's script. */
const SCRIPTS: readonly { tag: string; pattern: RegExp }[] = [
  { tag: "Latin", pattern: /\p{Script=Latin}/u },
  { tag: "Devanagari", pattern: /\p{Script=Devanagari}/u },
  { tag: "te", pattern: /\p{Script=Telugu}/u },
  { tag: "ta", pattern: /\p{Script=Tamil}/u },
  { tag: "kn", pattern: /\p{Script=Kannada}/u },
  { tag: "ml", pattern: /\p{Script=Malayalam}/u },
  { tag: "gu", pattern: /\p{Script=Gujarati}/u },
  { tag: "pa", pattern: /\p{Script=Gurmukhi}/u },
  { tag: "bn", pattern: /\p{Script=Bengali}/u },
  { tag: "or", pattern: /\p{Script=Oriya}/u },
  { tag: "Arabic", pattern: /\p{Script=Arabic}/u },
  { tag: "ru", pattern: /\p{Script=Cyrillic}/u },
  { tag: "ja", pattern: /[\p{Script=Hiragana}\p{Script=Katakana}]/u },
  { tag: "zh", pattern: /\p{Script=Han}/u },
  { tag: "ko", pattern: /\p{Script=Hangul}/u },
  { tag: "th", pattern: /\p{Script=Thai}/u },
];

function scriptOf(word: string): string | null {
  for (const char of word) {
    const hit = SCRIPTS.find((script) => script.pattern.test(char));
    if (hit) return hit.tag;
  }
  return null;
}

function words(text: string): string[] {
  return text
    .normalize("NFC")
    .split(/[\s.,!?;:()"“”‘’¿¡/\\[\]{}<>|*_~`+=#@&%^-]+/u)
    .filter((word) => /[\p{L}\p{M}]/u.test(word));
}

const MARATHI = /ळ|(^|\s)(आहे|आहेत|नाही|मला|तुम्ही|आणि|पाहिजे|काय|माझी|माझे|माझा|उद्या|होय)(?=\s|$|[.,!?])/u;
const HINDI = /(^|\s)(है|हैं|नहीं|मेरा|मेरी|मुझे|क्या|कब|आप|का|की|के|को|में|हाँ|हां|चाहिए)(?=\s|$|[.,!?])/u;
// ے ں ہ ھ ٹ ڈ ڑ ی ک گ are Urdu (or Persian) letters; ة ى ي ك are Arabic ones.
const URDU = /[\u06D2\u06BA\u06C1\u06BE\u0679\u0688\u0691\u06CC\u06A9\u06AF]/u;
const ARABIC = /[\u0629\u0649\u064A\u0643]/u;

const LATIN_WORDS: Record<"en" | "hi-Latn" | "es" | "fr", ReadonlySet<string>> = {
  en: new Set(
    "the is are was were what when where which who how can could would will my your i i'm you with for and of an have has does please this that there want need book cancel show tell any about from".split(" "),
  ),
  "hi-Latn": new Set(
    "hai hain haan nahi nahin kya kab kaise kahan kitne kitna mera meri mere mujhe muje aap aapka aapki apna kal aaj karo karna kar theek thik ji namaste chahiye hoga hogi wala wali ko ka ki ke bhi abhi liye raha rahi dena batao bataiye dikhao milega sakte sakta hum kyun kripya".split(" "),
  ),
  es: new Set(
    "el los las que por para una es está estoy quiero cita mañana hola gracias con del al mi tengo puedo cuándo dónde cómo qué sí hay médico necesito hoy buenos días la de".split(" "),
  ),
  fr: new Set(
    "le les des du est je vous nous pour avec une un bonjour merci rendez-vous demain oui mon ma mes suis voudrais pas ne quand où c'est j'ai médecin aujourd'hui la de et".split(" "),
  ),
};

function latinLanguage(text: string, list: string[], previous: DetectedLanguage | null): DetectedLanguage | null {
  const scores: Record<string, number> = { en: 0, "hi-Latn": 0, es: 0, fr: 0 };
  for (const raw of list) {
    const word = raw.toLowerCase();
    for (const [tag, set] of Object.entries(LATIN_WORDS)) if (set.has(word)) scores[tag] = (scores[tag] ?? 0) + 1;
  }
  if (/[ñ¿¡]/iu.test(text)) scores.es = (scores.es ?? 0) + 2;
  if (/[çèêàùœâî]/iu.test(text)) scores.fr = (scores.fr ?? 0) + 2;
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestTag, best] = ranked[0]!;
  const runnerUp = ranked[1]![1];
  if (best === 0 || best === runnerUp) return null;
  // Without a conversation yet, any clear Latin hint will do.
  if (!previous) return languageFor(bestTag);
  // Mid-conversation, switch only on real evidence so "ok thank you" does not flip it.
  if (best >= 2 || (best >= 1 && list.length >= 4)) return languageFor(bestTag);
  return null;
}

/**
 * The language a message is written in, or null when it has none of its own (empty, a number,
 * a name, or a short reply that could belong to the conversation's language).
 */
export function ownLanguage(text: string, previousTagOrLocale?: string | null): DetectedLanguage | null {
  const previous = languageFor(previousTagOrLocale);
  const list = words(text ?? "");
  if (!list.length) return null;

  const counts = new Map<string, number>();
  for (const word of list) {
    const script = scriptOf(word);
    if (script) counts.set(script, (counts.get(script) ?? 0) + 1);
  }
  const latin = counts.get("Latin") ?? 0;
  let other: [string, number] | null = null;
  for (const entry of counts) if (entry[0] !== "Latin" && (!other || entry[1] > other[1])) other = entry;

  // Indic sentences often borrow English words ("मेरा appointment कब है"), so the native
  // script wins unless the message is mostly Latin.
  if (other && other[1] * 2 >= latin) {
    const [script] = other;
    if (script === "Devanagari") {
      if (MARATHI.test(text)) return languageFor("mr");
      if (previous?.tag === "mr" && !HINDI.test(text)) return previous;
      return languageFor("hi");
    }
    if (script === "Arabic") {
      if (URDU.test(text)) return languageFor("ur");
      if (ARABIC.test(text)) return languageFor("ar");
      return previous?.tag === "ar" || previous?.tag === "ur" ? previous : languageFor("ur");
    }
    return languageFor(script);
  }
  if (latin) return latinLanguage(text, list, previous);
  return null;
}

/** The language of a message, falling back to the conversation's previous language, then English. */
export function detectLanguage(text: string, previousTagOrLocale?: string | null): DetectedLanguage {
  return ownLanguage(text, previousTagOrLocale) ?? languageFor(previousTagOrLocale) ?? DEFAULT_LANGUAGE;
}

/**
 * The language of the latest user message, using the earlier user messages (and then the last
 * assistant reply) as the fallback when the latest one is a short acknowledgement.
 */
export function detectConversation(messages: readonly { role: "user" | "assistant"; content: string }[]): DetectedLanguage {
  let lastUser = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]!.role === "user") {
      lastUser = i;
      break;
    }
  }
  if (lastUser < 0) return DEFAULT_LANGUAGE;
  let previous = null as DetectedLanguage | null;
  for (let i = 0; i < lastUser; i += 1) {
    const message = messages[i]!;
    if (message.role === "user") previous = ownLanguage(message.content, previous?.tag) ?? previous;
  }
  if (!previous) {
    for (let i = lastUser - 1; i >= 0; i -= 1) {
      if (messages[i]!.role !== "assistant") continue;
      previous = ownLanguage(messages[i]!.content);
      if (previous) break;
    }
  }
  return detectLanguage(messages[lastUser]!.content, previous?.tag);
}

/**
 * Which locale to listen in next. Follows the reply's language, except when the reply is an
 * English message (such as a confirmation summary) to someone who wrote in another language.
 */
export function nextListenLocale(userLocale: string, replyLocale: string | null | undefined): string {
  if (!replyLocale) return userLocale;
  if (replyLocale.toLowerCase().startsWith("en") && !userLocale.toLowerCase().startsWith("en")) return userLocale;
  return replyLocale;
}

/** Map a browser or stored locale onto one the dock supports, or null. */
export function supportedLocale(raw: string | null | undefined): string | null {
  return languageFor(raw)?.locale ?? null;
}

/** A voice for the locale: exact match, then the same language, then nothing (the browser default). */
export function pickVoiceFor<V extends { lang: string }>(voices: readonly V[], locale: string): V | null {
  const normal = (lang: string) => lang.toLowerCase().replace(/_/g, "-");
  const exact = normal(locale);
  const prefix = exact.split("-")[0];
  return (
    voices.find((voice) => normal(voice.lang) === exact) ??
    voices.find((voice) => normal(voice.lang).split("-")[0] === prefix) ??
    null
  );
}
