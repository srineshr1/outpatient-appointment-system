import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseClinicStore } from "@/lib/supabase-store";

type Reply = { status: number; body: unknown };

function stubApi(reply: (url: URL, init: RequestInit) => Reply) {
  const calls: { url: URL; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    calls.push({ url, init });
    const { status, body } = reply(url, init);
    return new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  return calls;
}

const store = () => new SupabaseClinicStore("https://example.supabase.co", "service-key");
const duplicate = { code: "23505", message: "duplicate key value violates unique constraint", details: "", hint: "" };

afterEach(() => vi.unstubAllGlobals());

describe("SupabaseClinicStore", () => {
  it("needs a project URL and a service key", () => {
    expect(() => new SupabaseClinicStore("", "")).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("treats a duplicate user as already existing, so concurrent cold starts are safe", async () => {
    stubApi(() => ({ status: 409, body: duplicate }));
    const result = await store().createUser({
      id: "u1",
      email: "a@b.c",
      passwordHash: "x",
      name: "A",
      role: "patient",
      doctorId: null,
      mobile: "",
      dob: "",
    });
    expect(result).toBe("exists");
  });

  it("reports a taken slot when the held-slot index rejects the insert", async () => {
    stubApi(() => ({ status: 409, body: duplicate }));
    const result = await store().createAppointment({
      id: "a1",
      reference: "HSP-1",
      slotId: "s1",
      doctorId: "d",
      date: "2026-11-02",
      time: "09:00",
      reasonId: "r",
      patientName: "A",
      patientDob: "",
      patientMobile: "",
      patientChi: "",
      note: "",
      status: "booked",
      patientUserId: null,
      createdAt: "2026-10-28T00:00:00.000Z",
    });
    expect(result).toBe("taken");
  });

  it("reads every page of a long list", async () => {
    const calls = stubApi((url) => {
      const range = (url.searchParams.get("offset") ?? "0") === "0" ? 1000 : 5;
      return { status: 200, body: Array.from({ length: range }, (_, i) => ({ slot_id: `s${i}` })) };
    });
    const ids = await store().listBlockedSlotIds();
    expect(ids).toHaveLength(1005);
    expect(calls).toHaveLength(2);
  });

  it("loads charges with their payments in one request", async () => {
    const calls = stubApi(() => ({
      status: 200,
      body: [
        {
          appointment_id: "a1",
          reference: "HSP-1",
          reason_id: "r",
          amount_pence: 5000,
          created_at: "t",
          waived_at: null,
          waived_by_user_id: null,
          waived_by_name: "",
          waived_reason: "",
          version: 0,
          clinic_payment_entries: [
            { id: "e2", kind: "refund", method: "cash", amount_pence: 100, at: "2", by_user_id: null, by_name: "", note: "" },
            { id: "e1", kind: "payment", method: "cash", amount_pence: 5000, at: "1", by_user_id: null, by_name: "", note: "" },
          ],
        },
      ],
    }));
    const charges = await store().listCharges();
    expect(calls).toHaveLength(1);
    expect(charges[0]!.entries.map((entry) => entry.id)).toEqual(["e1", "e2"]);
    expect(charges[0]!.waiver).toBeNull();
  });
});
