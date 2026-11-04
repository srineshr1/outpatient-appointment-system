import { describe, expect, it, vi } from "vitest";
import { FAST2SMS_URL, indianMobile, renderSms, sendSms, smsMode } from "./sms";

const data = { firstName: "Asha", patientName: "Asha Rao", reference: "WB-1234", doctorName: "Dr Meera Iyer", when: "Sat 7 Nov, 10:20", token: 4 };
const okFetch = () => vi.fn(async () => new Response(JSON.stringify({ return: true, request_id: "x", message: ["ok"] }), { status: 200 }));

describe("sms mode", () => {
  it("is mock unless live and a key are both set", () => {
    expect(smsMode({})).toBe("mock");
    expect(smsMode({ FAST2SMS_API_KEY: "k" })).toBe("mock");
    expect(smsMode({ SMS_MODE: "live" })).toBe("mock");
    expect(smsMode({ SMS_MODE: "live", FAST2SMS_API_KEY: "k" })).toBe("live");
    expect(smsMode({ SMS_MODE: "off", FAST2SMS_API_KEY: "k" })).toBe("off");
  });
});

describe("indian mobile", () => {
  it("accepts Indian mobiles in stored and typed forms", () => {
    expect(indianMobile("+919876543210")).toBe("9876543210");
    expect(indianMobile("09876543210")).toBe("9876543210");
    expect(indianMobile("98765 43210")).toBe("9876543210");
  });
  it("rejects other numbers", () => {
    expect(indianMobile("+447700900123")).toBeNull();
    expect(indianMobile("+911234567890")).toBeNull();
    expect(indianMobile("")).toBeNull();
  });
});

describe("renderSms", () => {
  it("keeps each notice to one SMS", () => {
    for (const kind of ["booking_confirmed", "appointment_rescheduled", "appointment_cancelled", "reminder"] as const) {
      const text = renderSms(kind, { ...data, amountMinor: 50000, refundMinor: 50000 });
      expect(text).toContain("WB-1234");
      expect(text.length).toBeLessThanOrEqual(160);
    }
    expect(renderSms("appointment_rescheduled", data)).toContain("moved to Sat 7 Nov, 10:20, token 4");
  });
});

describe("sendSms", () => {
  it("does not call Fast2SMS in mock mode", async () => {
    const fetcher = okFetch();
    expect(await sendSms("+919876543210", "hi", { FAST2SMS_API_KEY: "k" }, fetcher)).toBe("skipped");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("posts a quick SMS in live mode", async () => {
    const fetcher = okFetch();
    expect(await sendSms("+919876543210", "hi", { SMS_MODE: "live", FAST2SMS_API_KEY: "secret" }, fetcher)).toBe("sent");
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(FAST2SMS_URL);
    expect((init.headers as Record<string, string>).authorization).toBe("secret");
    expect(JSON.parse(String(init.body))).toMatchObject({ route: "q", message: "hi", numbers: "9876543210" });
  });
  it("skips non-Indian numbers without calling out", async () => {
    const fetcher = okFetch();
    expect(await sendSms("+447700900123", "hi", { SMS_MODE: "live", FAST2SMS_API_KEY: "k" }, fetcher)).toBe("skipped");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("reports failures so the outbox retries", async () => {
    const refused = vi.fn(async () => new Response(JSON.stringify({ return: false, message: "Invalid key" }), { status: 401 }));
    expect(await sendSms("9876543210", "hi", { SMS_MODE: "live", FAST2SMS_API_KEY: "k" }, refused)).toBe("failed");
    const down = vi.fn(async () => { throw new Error("network"); });
    expect(await sendSms("9876543210", "hi", { SMS_MODE: "live", FAST2SMS_API_KEY: "k" }, down)).toBe("failed");
  });
});
