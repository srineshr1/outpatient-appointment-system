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
  }, 15000);
});

describe("sign-in routing", () => {
  it("sends each role to a page it can use", async () => {
    const { destinationFor } = await import("./auth-routing");
    expect(destinationFor("patient", "/")).toBe("/appointments");
    expect(destinationFor("doctor", "/")).toBe("/dashboard");
    expect(destinationFor("patient", "/book/details")).toBe("/book/details");
    expect(destinationFor("patient", "/#doctors")).toBe("/#doctors");
    expect(destinationFor("patient", "/dashboard?doctor=cho")).toBe("/appointments");
    expect(destinationFor("reception", "/book/details")).toBe("/dashboard");
    expect(destinationFor("doctor", "/appointments")).toBe("/dashboard");
    expect(destinationFor("doctor", "/doctors/cho")).toBe("/doctors/cho");
  });
});

describe("password lockout and reset links", () => {
  it("locks an email for 15 minutes after five wrong passwords, and clears", async () => {
    const { clearFailures, lockedFor, recordFailure, MAX_ATTEMPTS } = await import("./login-codes");
    const at = new Date("2026-10-26T10:00:00Z");
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) expect(await recordFailure("Lock.Test@Example.com", at)).toBe(false);
    expect(await lockedFor("lock.test@example.com", at)).toBe(0);
    expect(await recordFailure("lock.test@example.com", at)).toBe(true);
    expect(await lockedFor("lock.test@example.com", at)).toBeGreaterThan(14 * 60_000);
    expect(await lockedFor("lock.test@example.com", new Date(at.getTime() + 16 * 60_000))).toBe(0);
    await recordFailure("clear.test@example.com", at);
    await clearFailures("clear.test@example.com");
    expect(await (await getStore()).getLoginCode("lock:clear.test@example.com")).toBeNull();
  });

  it("issues a single-use reset token that expires and is stored only as a hash", async () => {
    const { consumeResetToken, issueResetToken, resetTokenValid } = await import("./login-codes");
    const at = new Date("2026-10-26T10:00:00Z");
    const issued = await issueResetToken("Reset.Test@Example.com", at);
    if (!issued.ok) throw new Error("not issued");
    // Asking again straight away is throttled.
    expect(await issueResetToken("reset.test@example.com", new Date(at.getTime() + 5_000))).toMatchObject({ ok: false });
    const record = await (await getStore()).getLoginCode("reset:reset.test@example.com");
    expect(record?.codeHash.includes(issued.token)).toBe(false);
    expect(await resetTokenValid("reset.test@example.com", "wrong-token", at)).toBe(false);
    expect(await consumeResetToken("reset.test@example.com", issued.token, at)).toBe(true);
    expect(await consumeResetToken("reset.test@example.com", issued.token, at)).toBe(false);

    const late = await issueResetToken("late.test@example.com", at);
    if (!late.ok) throw new Error("not issued");
    expect(await consumeResetToken("late.test@example.com", late.token, new Date(at.getTime() + 31 * 60_000))).toBe(false);
  });

  it("never signs in an account that has no password", async () => {
    const { authenticate, createPatient } = await import("./accounts");
    await createPatient("google.only@example.com", "Google Only");
    expect(await authenticate("google.only@example.com", "not-a-real-password")).toEqual({ ok: false });
    expect(await authenticate("google.only@example.com", "")).toEqual({ ok: false });
  });

  it("hashes passwords with salted scrypt and still verifies the older format", async () => {
    const { hashPassword, verifyPassword } = await import("./passwords");
    const { scryptSync } = await import("node:crypto");
    const hash = hashPassword("correct horse");
    expect(hash).toMatch(/^scrypt2\$32768\$8\$3\$/);
    expect(hash).not.toContain("correct horse");
    expect(hashPassword("correct horse")).not.toBe(hash);
    expect(verifyPassword("correct horse", hash)).toBe(true);
    expect(verifyPassword("wrong horse", hash)).toBe(false);
    const legacy = `scrypt$salt$${scryptSync("old one", "salt", 32, { N: 16384, r: 8, p: 1 }).toString("base64url")}`;
    expect(verifyPassword("old one", legacy)).toBe(true);
  });
});
