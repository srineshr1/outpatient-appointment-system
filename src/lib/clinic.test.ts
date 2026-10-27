import { describe, expect, it } from "vitest";
import { authenticate } from "./accounts";
import { setNow } from "./clock";
import { DEMO_PASSWORD } from "./demo-accounts";
import { hashPassword, verifyPassword } from "./passwords";
import { confirmBooking, getSlots, getUpcoming } from "./repository";
import { getStore } from "./store";
import { changeAppointmentStatus } from "./visits";

describe("passwords", () => {
  it("verifies a matching password and rejects a different one", () => {
    const stored = hashPassword("correct horse");
    expect(verifyPassword("correct horse", stored)).toBe(true);
    expect(verifyPassword("wrong horse", stored)).toBe(false);
    expect(verifyPassword("correct horse", "plain")).toBe(false);
  });
});

describe("clinic book", () => {
  it("signs in a sample doctor and keeps a second booking off a held time", async () => {
    setNow(Date.UTC(2026, 9, 26, 13, 40));
    const doctor = await authenticate("helen.cho@halden.example", DEMO_PASSWORD);
    expect(doctor.ok).toBe(true);
    if (!doctor.ok) return;
    expect(doctor.user.role).toBe("doctor");
    await expect(authenticate("helen.cho@halden.example", "nope")).resolves.toEqual({ ok: false });

    const open = (await getUpcoming())["cho"]![0]!;
    const first = await confirmBooking(
      { slot: open, reasonId: "follow", patientName: "Ann Lee", patientUserId: "user-patient-demo" },
      0,
    );
    expect(first.reference).toMatch(/^HSP-\d{6}$/);
    await expect(
      confirmBooking({ slot: open, reasonId: "new", patientName: "Ben" }, 0),
    ).rejects.toMatchObject({ reason: "taken" });
    expect((await getSlots("cho")).find((slot) => slot.id === open.id)?.taken).toBe(true);

    const store = await getStore();
    const visit = (await store.listAppointments()).find((item) => item.slotId === open.id);
    expect(visit?.patientUserId).toBe("user-patient-demo");
    expect(visit?.status).toBe("booked");

    const patient = await store.getUserById("user-patient-demo");
    expect(patient).not.toBeNull();
    expect(await changeAppointmentStatus(patient!, visit!.id, "cancelled")).toBe("ok");
    expect(await changeAppointmentStatus(patient!, visit!.id, "completed")).toBe("closed");

    // Cancelling frees the time straight away, and rebooking gets a fresh reference.
    const again = await confirmBooking({ slot: open, reasonId: "new", patientName: "Ann Lee" }, 0);
    expect(again.reference).toMatch(/^HSP-\d{6}$/);
    expect(again.reference).not.toBe(first.reference);
    const rebooked = (await store.listAppointments()).find((item) => item.reference === again.reference);
    const other = await store.getUserById("user-reid");
    expect(rebooked && other).toBeTruthy();
    expect(await changeAppointmentStatus(other!, rebooked!.id, "cancelled")).toBe("forbidden");
  });
});

describe("sign-in routing", () => {
  it("sends each role to a page it can use", async () => {
    const { destinationFor } = await import("./auth-routing");
    expect(destinationFor("patient", "/")).toBe("/book");
    expect(destinationFor("doctor", "/")).toBe("/dashboard");
    expect(destinationFor("patient", "/book/details")).toBe("/book/details");
    expect(destinationFor("patient", "/#doctors")).toBe("/#doctors");
    expect(destinationFor("patient", "/dashboard?doctor=cho")).toBe("/book");
    expect(destinationFor("reception", "/book/details")).toBe("/dashboard");
    expect(destinationFor("doctor", "/appointments")).toBe("/dashboard");
    expect(destinationFor("doctor", "/doctors/cho")).toBe("/doctors/cho");
  });
});

describe("email sign-in codes", () => {
  it("accepts the right code once, counts wrong ones, and throttles resends", async () => {
    const { checkCode, issueCode, MAX_ATTEMPTS } = await import("./login-codes");
    const at = new Date("2026-10-26T10:00:00Z");
    const issued = await issueCode("Code.Test@Example.com", at);
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issued.code).toMatch(/^\d{4}$/);

    // A second request within the minute is refused.
    expect(await issueCode("code.test@example.com", new Date(at.getTime() + 5_000))).toMatchObject({ ok: false });

    const wrong = issued.code === "0000" ? "1111" : "0000";
    expect(await checkCode("code.test@example.com", wrong, at)).toEqual({
      ok: false,
      reason: "wrong",
      attemptsLeft: MAX_ATTEMPTS - 1,
    });
    expect(await checkCode("code.test@example.com", issued.code, at)).toEqual({ ok: true });
    // Used up.
    expect(await checkCode("code.test@example.com", issued.code, at)).toMatchObject({ reason: "missing" });

    // The store keeps only a hash.
    const again = await issueCode("hash.test@example.com", at);
    const record = await (await getStore()).getLoginCode("hash.test@example.com");
    expect(again.ok && record?.codeHash.includes(again.code)).toBe(false);
  });

  it("expires after ten minutes and locks after five wrong tries", async () => {
    const { checkCode, issueCode } = await import("./login-codes");
    const at = new Date("2026-10-26T11:00:00Z");
    const first = await issueCode("expire.test@example.com", at);
    if (!first.ok) throw new Error("not issued");
    expect(await checkCode("expire.test@example.com", first.code, new Date(at.getTime() + 11 * 60_000))).toMatchObject({
      reason: "expired",
    });

    const second = await issueCode("lock.test@example.com", at);
    if (!second.ok) throw new Error("not issued");
    const wrong = second.code === "0000" ? "1111" : "0000";
    for (let i = 0; i < 4; i += 1) await checkCode("lock.test@example.com", wrong, at);
    expect(await checkCode("lock.test@example.com", wrong, at)).toMatchObject({ reason: "locked" });
    expect(await checkCode("lock.test@example.com", second.code, at)).toMatchObject({ reason: "locked" });
  });
});
