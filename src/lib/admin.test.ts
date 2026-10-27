import { describe, expect, it } from "vitest";
import { AdminError, changeRole, clearLoginCode, createStaff, revokeOneSession, revokeSessions, setAccountDisabled } from "./admin";
import { loadSnapshot, filterVisits, readVisitFilters, matchesEvent, readEventFilters } from "./admin-data";
import { actorOf } from "./audit";
import { addMissingFee, BillingError, recordPayment, refundPayment, restoreFee, waiveFee } from "./billing";
import type { SessionUser, UserAccount } from "./clinic-types";
import { setNow } from "./clock";
import { destinationFor } from "./auth-routing";
import { describeDevice } from "./device";
import { issueCode } from "./login-codes";
import { summarise } from "./payments";
import { confirmBooking, getUpcoming } from "./repository";
import { getStore } from "./store";
import { revokedSession, sessionStartedAt } from "./supabase-session";
import { changeAppointmentStatus } from "./visits";

const MONDAY = Date.UTC(2026, 9, 26, 13, 40);

async function account(id: string): Promise<UserAccount> {
  const found = await (await getStore()).getUserById(id);
  if (!found) throw new Error(`No ${id}`);
  return found;
}

function asSession(user: UserAccount, sessionId: string | null = null): SessionUser {
  return { ...user, expiresAt: "2099-01-01T00:00:00.000Z", sessionId };
}

async function book(doctorId: string, payNow: boolean, index = 0) {
  setNow(MONDAY);
  const slot = (await getUpcoming(40))[doctorId]![index]!;
  return confirmBooking({ slot, reasonId: "follow", patientName: "Ann Lee", patientUserId: "user-patient-demo", payNow }, 0);
}

describe("payments on a visit", () => {
  it("charges the fee at booking, and paying now records a demo card payment", async () => {
    const paid = await book("adeyemi", true);
    expect(paid.payment).toEqual({ amountPence: 4000, paid: true });
    const desk = await book("adeyemi", false, 1);
    expect(desk.payment).toEqual({ amountPence: 4000, paid: false });

    const store = await getStore();
    const charge = await store.getCharge(paid.visit.id);
    expect(charge?.entries).toHaveLength(1);
    expect(charge?.entries[0]).toMatchObject({ kind: "payment", method: "online_card", amountPence: 4000, byName: "Online" });
    expect(summarise(await store.getCharge(desk.visit.id), "booked").state).toBe("unpaid");
  });

  it("gives a demo card payment back when the visit is cancelled, and logs both", async () => {
    const booked = await book("reid", true);
    const patient = await account("user-patient-demo");
    expect(await changeAppointmentStatus(patient, booked.visit.id, "cancelled")).toBe("ok");
    const store = await getStore();
    const money = summarise(await store.getCharge(booked.visit.id), "cancelled");
    expect(money).toMatchObject({ state: "refunded", refundDuePence: 0, refundedPence: 4000 });
    const actions = (await store.listEvents(50)).filter((event) => event.subjectId === booked.visit.id).map((event) => event.action);
    expect(actions).toEqual(expect.arrayContaining(["appointment.cancelled", "payment.refunded"]));
  });

  it("takes desk payments in parts, refuses overpaying, and leaves desk money to refund by hand", async () => {
    const booked = await book("cho", false);
    const desk = actorOf(await account("user-desk"));
    await expect(recordPayment(desk, booked.visit.id, "cash", 5000)).rejects.toBeInstanceOf(BillingError);
    await expect(recordPayment(desk, booked.visit.id, "online_card", 1000)).rejects.toThrow(/card or cash/);
    await recordPayment(desk, booked.visit.id, "cash", 1500);
    const after = await recordPayment(desk, booked.visit.id, "desk_card", 2500);
    expect(summarise(after, "booked")).toMatchObject({ state: "paid", duePence: 0 });
    await expect(recordPayment(desk, booked.visit.id, "cash", 100)).rejects.toThrow(/Nothing is owed/);

    // Cancelled after paying at the desk: shown as a refund due until someone gives it back.
    expect(await changeAppointmentStatus(await account("user-desk"), booked.visit.id, "cancelled", "Patient called")).toBe("ok");
    const store = await getStore();
    expect(summarise(await store.getCharge(booked.visit.id), "cancelled")).toMatchObject({ state: "refund_due", refundDuePence: 4000 });
    await expect(refundPayment(desk, booked.visit.id, "cash", 2000, "Cancelled")).rejects.toThrow(/At most £15.00/);
    await expect(refundPayment(desk, booked.visit.id, "cash", 1500, "  ")).rejects.toThrow(/reason/);
    await refundPayment(desk, booked.visit.id, "cash", 1500, "Cancelled by phone");
    const settled = await refundPayment(desk, booked.visit.id, "desk_card", 2500, "Cancelled by phone");
    expect(summarise(settled, "cancelled")).toMatchObject({ state: "refunded", refundDuePence: 0, netPence: 0 });
  });

  it("waives a fee only when nothing is paid, and can put it back", async () => {
    const booked = await book("rahman", false);
    const admin = actorOf(await account("user-admin"));
    await expect(waiveFee(admin, booked.visit.id, "")).rejects.toThrow(/reason/);
    const waived = await waiveFee(admin, booked.visit.id, "Practice error");
    expect(summarise(waived, "booked").state).toBe("waived");
    await expect(recordPayment(admin, booked.visit.id, "cash", 4000)).rejects.toThrow(/waived/);
    const restored = await restoreFee(admin, booked.visit.id);
    expect(summarise(restored, "booked").state).toBe("unpaid");

    const paid = await book("rahman", true, 1);
    await expect(waiveFee(admin, paid.visit.id, "Goodwill")).rejects.toThrow(/Refund it instead/);
  });

  it("adds today's fee to a visit booked before fees started, once", async () => {
    setNow(MONDAY);
    const slot = (await getUpcoming(40))["reid"]![3]!;
    const store = await getStore();
    // A visit from before fees: stored without a charge.
    const old = {
      id: "visit-before-fees",
      reference: "HSP-999001",
      slotId: slot.id,
      doctorId: slot.doctorId,
      date: slot.date,
      time: slot.time,
      reasonId: "meds",
      patientName: "Old Booking",
      patientDob: "",
      patientMobile: "",
      patientChi: "",
      note: "",
      status: "booked" as const,
      patientUserId: null,
      createdAt: "2026-10-01T09:00:00.000Z",
    };
    expect(await store.createAppointment(old)).toBe("ok");
    const admin = actorOf(await account("user-admin"));
    const added = await addMissingFee(admin, old.id);
    expect(added).toMatchObject({ amountPence: 5500, entries: [] });
    expect(summarise(added, "booked")).toMatchObject({ state: "unpaid", duePence: 5500 });
    await expect(addMissingFee(admin, old.id)).rejects.toThrow(/already has a fee/);
    expect((await store.listEvents(5)).some((event) => event.action === "fee.added" && event.subjectId === old.id)).toBe(true);
  });
});

describe("the store keeps history", () => {
  it("never lets payments be removed through the app", async () => {
    const booked = await book("macleod", true);
    const store = await getStore();
    await expect(store.updateCharge(booked.visit.id, (charge) => ({ ...charge, entries: [] }))).rejects.toThrow(/can’t be removed/);
    expect((await store.getCharge(booked.visit.id))?.entries).toHaveLength(1);
    const events = await store.listEvents(5);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]!.at >= events[events.length - 1]!.at).toBe(true);
  });

  it("refuses edits and deletes to the activity log and payments in the database itself", async () => {
    const { SqliteClinicStore } = await import("./sqlite-store");
    const { DatabaseSync } = await import("node:sqlite");
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const dir = mkdtempSync(path.join(tmpdir(), "hsp-audit-"));
    const file = path.join(dir, "clinic.sqlite");
    try {
      const store = new SqliteClinicStore(file);
      await store.ensureReady();
      await store.appendEvent({
        id: "event-1",
        at: "2026-10-27T10:00:00.000Z",
        action: "signout",
        actorId: null,
        actorName: "Test",
        actorRole: "system",
        subjectType: null,
        subjectId: null,
        summary: "Test",
        reason: "",
      });
      await store.createCharge({
        appointmentId: "visit-1",
        reference: "HSP-100000",
        reasonId: "follow",
        amountPence: 4000,
        createdAt: "2026-10-27T10:00:00.000Z",
        entries: [
          { id: "pay-1", kind: "payment", method: "cash", amountPence: 4000, at: "2026-10-27T10:00:00.000Z", byUserId: null, byName: "Desk", note: "" },
        ],
        waiver: null,
      });
      const raw = new DatabaseSync(file);
      expect(() => raw.exec("UPDATE audit_events SET summary = 'changed'")).toThrow(/append-only/);
      expect(() => raw.exec("DELETE FROM audit_events")).toThrow(/append-only/);
      expect(() => raw.exec("UPDATE payment_entries SET amount_pence = 1")).toThrow(/append-only/);
      expect(() => raw.exec("DELETE FROM payment_entries")).toThrow(/append-only/);
      raw.close();
      expect((await store.listEvents(5)).map((event) => event.summary)).toEqual(["Test"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("admin rules", () => {
  it("creates staff who can only use a valid role, and logs it", async () => {
    const admin = asSession(await account("user-admin"));
    await expect(createStaff(admin, { name: "", email: "x@example.com", role: "reception", doctorId: null })).rejects.toThrow(/full name/);
    await expect(createStaff(admin, { name: "Sam", email: "not-an-email", role: "reception", doctorId: null })).rejects.toThrow(/valid email/);
    await expect(createStaff(admin, { name: "Sam", email: "sam@example.com", role: "patient", doctorId: null })).rejects.toThrow(/staff role/);
    await expect(createStaff(admin, { name: "Sam", email: "sam@example.com", role: "doctor", doctorId: null })).rejects.toThrow(/clinic book/);
    await expect(createStaff(admin, { name: "Sam", email: "desk@halden.example", role: "reception", doctorId: null })).rejects.toThrow(/already has an account/);

    const created = await createStaff(admin, { name: "Dr Sam Patel", email: "Sam.Patel@Example.com", role: "doctor", doctorId: "cho" });
    expect(created).toMatchObject({ email: "sam.patel@example.com", role: "doctor", doctorId: "cho", disabledAt: null });
    const store = await getStore();
    expect((await store.getUserByEmail("sam.patel@example.com"))?.passwordHash).toBe("");
    expect((await store.listEvents(10)).some((event) => event.action === "staff.created" && event.subjectId === created.id)).toBe(true);
  });

  it("changes a role, ends their sessions, and protects the last admin", async () => {
    const store = await getStore();
    const admin = asSession(await account("user-admin"));
    await store.createSession("hash-reid-1", "user-reid", "2099-01-01T00:00:00.000Z", "Chrome on Mac");
    await expect(changeRole(admin, "user-reid", "reception", null, "")).rejects.toThrow(/reason/);
    const moved = await changeRole(admin, "user-reid", "reception", null, "Covering the desk");
    expect(moved).toMatchObject({ role: "reception", doctorId: null });
    expect((await store.listSessions()).some((session) => session.userId === "user-reid")).toBe(false);
    expect((await account("user-reid")).sessionsRevokedAt).not.toBeNull();
    await changeRole(admin, "user-reid", "doctor", "reid", "Back on the clinic");

    await expect(changeRole(admin, admin.id, "reception", null, "Oops")).rejects.toThrow(/your own admin role/);
    await expect(setAccountDisabled(admin, admin.id, true, "Leaving")).rejects.toThrow(/your own account/);

    // A second admin can't demote the only other admin into nothing either.
    const second = await createStaff(admin, { name: "Second Admin", email: "second.admin@example.com", role: "admin", doctorId: null });
    const asSecond = asSession(second);
    await changeRole(asSecond, admin.id, "reception", null, "Testing the guard");
    await expect(changeRole(admin, second.id, "reception", null, "Not allowed")).rejects.toThrow();
    await expect(setAccountDisabled(asSecond, second.id, true, "Self")).rejects.toThrow(/your own account/);
    // Put things back for the other tests.
    await changeRole(asSecond, admin.id, "admin", null, "Restore");
    await setAccountDisabled(admin, second.id, true, "Test account");
    await expect(setAccountDisabled(asSecond, admin.id, true, "Lock out")).rejects.toThrow(/only admin/);
  });

  it("turns an account off: signed out, blocked, and back on again", async () => {
    const store = await getStore();
    const admin = asSession(await account("user-admin"));
    await store.createSession("hash-cho-1", "user-cho", "2099-01-01T00:00:00.000Z");
    await store.createSession("hash-cho-2", "user-cho", "2099-01-01T00:00:00.000Z");
    await expect(setAccountDisabled(admin, "user-cho", true, " ")).rejects.toThrow(/reason/);
    const off = await setAccountDisabled(admin, "user-cho", true, "Left the practice");
    expect(off.disabledAt).not.toBeNull();
    expect((await store.listSessions()).filter((session) => session.userId === "user-cho")).toHaveLength(0);
    await expect(setAccountDisabled(admin, "user-cho", true, "Again")).rejects.toThrow(/already off/);
    const on = await setAccountDisabled(admin, "user-cho", false, "");
    expect(on.disabledAt).toBeNull();
  });

  it("signs someone out everywhere but keeps the admin's own session", async () => {
    const store = await getStore();
    await store.createSession("hash-admin-a", "user-admin", "2099-01-01T00:00:00.000Z");
    await store.createSession("hash-admin-b", "user-admin", "2099-01-01T00:00:00.000Z");
    const mine = await store.getSession("hash-admin-a");
    const admin = asSession(await account("user-admin"), mine!.id);
    expect(await revokeSessions(admin, admin.id)).toBeGreaterThanOrEqual(1);
    const left = (await store.listSessions()).filter((session) => session.userId === "user-admin");
    expect(left.map((session) => session.id)).toEqual([mine!.id]);
    await expect(revokeOneSession(admin, mine!.id)).rejects.toBeInstanceOf(AdminError);

    await store.createSession("hash-desk-1", "user-desk", "2099-01-01T00:00:00.000Z", "Safari on iPhone");
    const desk = (await store.listSessions()).find((session) => session.userId === "user-desk")!;
    expect(desk.device).toBe("Safari on iPhone");
    await revokeOneSession(admin, desk.id);
    expect(await store.getSession("hash-desk-1")).toBeNull();
  });

  it("clears a pending sign-in code", async () => {
    const admin = asSession(await account("user-admin"));
    await issueCode("locked.out@example.com", new Date("2026-10-26T10:00:00Z"));
    await clearLoginCode(admin, "Locked.Out@example.com");
    expect(await (await getStore()).getLoginCode("locked.out@example.com")).toBeNull();
    await expect(clearLoginCode(admin, "locked.out@example.com")).rejects.toThrow(/no pending code/);
  });
});

describe("admin read model", () => {
  it("joins visits with their money and filters them", async () => {
    const booked = await book("adeyemi", false, 5);
    const snapshot = await loadSnapshot();
    const row = snapshot.visitsById.get(booked.visit.id);
    expect(row?.money.state).toBe("unpaid");
    expect(row?.doctorName).toBe("Dr Amara Adeyemi");
    const owed = filterVisits(snapshot.visits, readVisitFilters({ money: "owed", when: "all" }), snapshot.today);
    expect(owed.some((item) => item.visit.id === booked.visit.id)).toBe(true);
    const byReference = filterVisits(snapshot.visits, readVisitFilters({ q: booked.reference, when: "all" }), snapshot.today);
    expect(byReference.map((item) => item.visit.id)).toEqual([booked.visit.id]);
    // Unknown filter values are ignored rather than trusted.
    expect(readVisitFilters({ status: "deleted", doctor: "nobody", money: "<script>" })).toMatchObject({ status: "", doctor: "", money: "" });
    const bookedEvents = snapshot.events.filter((event) => matchesEvent(event, readEventFilters({ group: "payment" })));
    expect(bookedEvents.every((event) => event.action.startsWith("payment.") || event.action.startsWith("fee."))).toBe(true);
  });
});

describe("routing and sessions", () => {
  it("sends admins to the console and keeps everyone else out of it", () => {
    expect(destinationFor("admin", "/")).toBe("/admin");
    expect(destinationFor("admin", "/admin/payments")).toBe("/admin/payments");
    expect(destinationFor("admin", "/book/details")).toBe("/admin");
    expect(destinationFor("reception", "/admin")).toBe("/dashboard");
    expect(destinationFor("patient", "/admin/people")).toBe("/book");
  });

  it("names a device without keeping the user agent", () => {
    expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")).toBe(
      "Safari on iPhone",
    );
    expect(describeDevice("Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36")).toBe("Chrome on Android");
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/133.0")).toBe("Firefox on Windows");
    expect(describeDevice("")).toBe("");
  });

  it("refuses Supabase sessions that began before an admin signed someone out", () => {
    const payload = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.y`;
    const startedAt = Date.UTC(2026, 9, 27, 9, 0) / 1000;
    const token = payload({ amr: [{ method: "otp", timestamp: startedAt }], iat: startedAt + 3000 });
    expect(sessionStartedAt(token)).toBe(startedAt * 1000);
    expect(sessionStartedAt(payload({ iat: startedAt }))).toBe(startedAt * 1000);
    expect(sessionStartedAt("not a token")).toBeNull();
    expect(revokedSession({ sessionsRevokedAt: null }, null)).toBe(false);
    expect(revokedSession({ sessionsRevokedAt: "2026-10-27T10:00:00.000Z" }, startedAt * 1000)).toBe(true);
    expect(revokedSession({ sessionsRevokedAt: "2026-10-27T08:00:00.000Z" }, startedAt * 1000)).toBe(false);
    expect(revokedSession({ sessionsRevokedAt: "2026-10-27T08:00:00.000Z" }, null)).toBe(true);
  });
});
