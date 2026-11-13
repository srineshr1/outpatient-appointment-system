import { describe, expect, it } from "vitest";
import { detectConversation, detectLanguage, languageFor, nextListenLocale, ownLanguage, pickVoiceFor, supportedLocale } from "./language";

const locale = (text: string, previous?: string) => detectLanguage(text, previous).locale;

describe("detectLanguage by script", () => {
  it.each([
    ["मेरा अपॉइंटमेंट कब है?", "hi-IN"],
    ["मला उद्या डॉक्टरांची वेळ पाहिजे", "mr-IN"],
    ["నా అపాయింట్‌మెంట్ ఎప్పుడు?", "te-IN"],
    ["என் சந்திப்பு எப்போது?", "ta-IN"],
    ["ನನ್ನ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಯಾವಾಗ?", "kn-IN"],
    ["എന്റെ അപ്പോയിന്റ്മെന്റ് എപ്പോഴാണ്?", "ml-IN"],
    ["મારી એપોઇન્ટમેન્ટ ક્યારે છે?", "gu-IN"],
    ["ਮੇਰੀ ਮੁਲਾਕਾਤ ਕਦੋਂ ਹੈ?", "pa-IN"],
    ["আমার অ্যাপয়েন্টমেন্ট কবে?", "bn-IN"],
    ["ମୋର ଆପଏଣ୍ଟମେଣ୍ଟ କେବେ?", "or-IN"],
    ["میری اپوائنٹمنٹ کب ہے؟", "ur-IN"],
    ["متى موعدي مع الطبيب؟", "ar"],
  ])("%s → %s", (text, expected) => {
    expect(locale(text)).toBe(expected);
  });

  it("reads a single Indic word, even with no conversation yet", () => {
    expect(locale("నమస్కారం")).toBe("te-IN");
    expect(locale("வணக்கம்")).toBe("ta-IN");
  });

  it("keeps the native script when an Indic sentence borrows English words", () => {
    expect(locale("मेरा appointment कब है")).toBe("hi-IN");
    expect(locale("నా appointment ఎప్పుడు")).toBe("te-IN");
  });

  it("keeps Marathi for a short Devanagari reply in a Marathi conversation, but follows clear Hindi", () => {
    expect(locale("ठीक", "mr-IN")).toBe("mr-IN");
    expect(locale("मुझे कल का समय चाहिए", "mr-IN")).toBe("hi-IN");
  });
});

describe("detectLanguage for Latin script", () => {
  it("tells English from Hinglish, and both use Indian English for voice", () => {
    expect(detectLanguage("What time is my appointment with Dr Rao?").tag).toBe("en");
    const hinglish = detectLanguage("mera appointment kab hai");
    expect(hinglish.tag).toBe("hi-Latn");
    expect(hinglish.locale).toBe("en-IN");
    expect(detectLanguage("namaste, kal ka time chahiye").tag).toBe("hi-Latn");
  });

  it("recognises clear Spanish and French", () => {
    expect(locale("Hola, quiero una cita para mañana")).toBe("es-ES");
    expect(locale("Bonjour, je voudrais un rendez-vous demain")).toBe("fr-FR");
  });

  it("defaults to Indian English for an empty or unclear first message", () => {
    expect(locale("")).toBe("en-IN");
    expect(locale("ok")).toBe("en-IN");
    expect(locale("10:30")).toBe("en-IN");
  });
});

describe("short follow-ups and switching", () => {
  it("keeps the conversation language for short or ambiguous replies", () => {
    for (const reply of ["ok", "yes", "haan", "Rao", "10:30", "ok thank you", "  "]) {
      expect(locale(reply, "te-IN")).toBe("te-IN");
      expect(locale(reply, "hi-IN")).toBe("hi-IN");
    }
    expect(ownLanguage("ok", "hi-IN")).toBeNull();
  });

  it("follows the latest message when the user clearly switches", () => {
    expect(locale("What are the clinic hours on Monday?", "te-IN")).toBe("en-IN");
    expect(locale("మీ క్లినిక్ సమయాలు ఏమిటి?", "en-IN")).toBe("te-IN");
    expect(locale("मुझे कल का समय चाहिए", "ta-IN")).toBe("hi-IN");
    expect(locale("appointment kab hai mera", "te-IN")).toBe("en-IN");
  });

  it("detects a conversation from the latest user message, falling back to earlier turns", () => {
    expect(
      detectConversation([
        { role: "user", content: "నా అపాయింట్‌మెంట్ ఎప్పుడు?" },
        { role: "assistant", content: "రేపు ఉదయం 10 గంటలకు." },
        { role: "user", content: "ok" },
      ]).locale,
    ).toBe("te-IN");
    expect(
      detectConversation([
        { role: "user", content: "नमस्ते डॉक्टर" },
        { role: "assistant", content: "नमस्ते!" },
        { role: "user", content: "Can you show my appointments for next week?" },
      ]).locale,
    ).toBe("en-IN");
    expect(
      detectConversation([
        { role: "assistant", content: "আপনার অ্যাপয়েন্টমেন্ট আগামীকাল।" },
        { role: "user", content: "ok" },
      ]).locale,
    ).toBe("bn-IN");
    expect(detectConversation([]).locale).toBe("en-IN");
  });
});

describe("locale helpers", () => {
  it("looks languages up by tag, locale and prefix", () => {
    expect(languageFor("te")?.locale).toBe("te-IN");
    expect(languageFor("ta_IN")?.locale).toBe("ta-IN");
    expect(supportedLocale("kn")).toBe("kn-IN");
    expect(supportedLocale("de-DE")).toBeNull();
    expect(supportedLocale(null)).toBeNull();
  });

  it("listens in the user's language when the reply is an English summary", () => {
    expect(nextListenLocale("te-IN", "en-IN")).toBe("te-IN");
    expect(nextListenLocale("te-IN", "te-IN")).toBe("te-IN");
    expect(nextListenLocale("en-IN", "hi-IN")).toBe("hi-IN");
    expect(nextListenLocale("hi-IN", undefined)).toBe("hi-IN");
  });

  it("picks an exact voice, then one for the same language, and never forces English on Telugu", () => {
    const voices = [{ lang: "en-IN" }, { lang: "en-US" }, { lang: "te_IN" }, { lang: "ta-LK" }, { lang: "hi-IN" }];
    expect(pickVoiceFor(voices, "te-IN")?.lang).toBe("te_IN");
    expect(pickVoiceFor(voices, "ta-IN")?.lang).toBe("ta-LK");
    expect(pickVoiceFor(voices, "kn-IN")).toBeNull();
    expect(pickVoiceFor([{ lang: "en-US" }, { lang: "en-IN" }], "en-IN")?.lang).toBe("en-IN");
  });
});
