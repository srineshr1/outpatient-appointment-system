import { describe, expect, it } from "vitest";
import type { ClinicStore } from "./clinic-types";
import { DEMO_PASSWORD } from "./demo-accounts";
import { DEMO_LOGINS, ensureDemoLogin } from "./demo-login";
import { hashPassword, verifyPassword } from "./passwords";

type Row = { id: string; email: string; role: string; doctorId: string | null; name: string; passwordHash: string; mobile?: string; disabledAt?: string | null };

function fakeStore(rows: Row[]) {
  const profiles = new Map<string, unknown>();
  const sessions = new Map<string, { id: string; doctorId: string }>();
  const store = {
    async getProfile(id: string) {
      return profiles.get(id) ?? null;
    },
    async putProfile(record: { userId: string }) {
      profiles.set(record.userId, record);
    },
    async listConsultSessions(doctorId?: string) {
      return [...sessions.values()].filter((session) => !doctorId || session.doctorId === doctorId);
    },
    async createConsultSessionIfAbsent(session: { id: string; doctorId: string }) {
      if (sessions.has(session.id)) return "exists";
      sessions.set(session.id, session);
      return "ok";
    },
    async getUserByEmail(email: string) {
      return rows.find((row) => row.email === email) ?? null;
    },
    async createUser(user: Row) {
      rows.push({ ...user });
      return "ok";
    },
    async updateUser(id: string, patch: Partial<Row>) {
      const row = rows.find((entry) => entry.id === id);
      if (!row) return null;
      Object.assign(row, patch);
      return row;
    },
  } as unknown as ClinicStore;
  return { store, rows, profiles, sessions };
}

const OWNER = { id: "user-rudraksha", email: "rudraksha.srinesh@gmail.com", role: "admin", doctorId: null, name: "Dr Rudraksha Srinesh", passwordHash: "scrypt$owner" };

describe("one-click demo accounts", () => {
  it("creates the demo patient with the demo password, booking details, and leaves other accounts alone", async () => {
    const { store, rows } = fakeStore([{ ...OWNER }]);
    const account = await ensureDemoLogin(store, "patient");
    expect(account).toMatchObject({ id: "user-patient-demo", email: "ann.lee@halden.example", role: "patient", doctorId: null, mobile: "07700 900123", dob: "1980-03-14" });
    expect(verifyPassword(DEMO_PASSWORD, rows.find((row) => row.id === "user-patient-demo")!.passwordHash)).toBe(true);
    expect(rows.find((row) => row.id === "user-rudraksha")).toEqual(OWNER);
  });

  it("gives the demo doctor its own book with a profile and one session, once", async () => {
    const { store, rows, profiles, sessions } = fakeStore([{ ...OWNER }]);
    const first = await ensureDemoLogin(store, "doctor", "2026-11-16T12:00:00.000Z");
    await ensureDemoLogin(store, "doctor", "2026-11-16T12:05:00.000Z");
    expect(first).toMatchObject({ id: "user-demo-doctor", role: "doctor", doctorId: "user-demo-doctor" });
    expect(rows.filter((row) => row.email === DEMO_LOGINS.doctor.email)).toHaveLength(1);
    expect(profiles.has("user-demo-doctor")).toBe(true);
    expect([...sessions.values()].filter((session) => session.doctorId === "user-demo-doctor")).toHaveLength(1);
    // Never the owner's or an admin's account.
    expect(DEMO_LOGINS.doctor.email).not.toBe(OWNER.email);
    expect(rows.find((row) => row.id === "user-rudraksha")).toEqual(OWNER);
  });

  it("puts a demo account's role, book and password back if they drifted", async () => {
    const { store, rows } = fakeStore([
      { id: "user-demo-doctor", email: "demo.doctor@halden.example", role: "admin", doctorId: null, name: "Dr Demo", passwordHash: hashPassword("something-else") },
    ]);
    const account = await ensureDemoLogin(store, "doctor");
    expect(account).toMatchObject({ role: "doctor", doctorId: "user-demo-doctor" });
    expect(verifyPassword(DEMO_PASSWORD, rows[0]!.passwordHash)).toBe(true);
  });

  it("refuses when another account holds the demo email", async () => {
    const { store, rows } = fakeStore([{ id: "someone", email: "ann.lee@halden.example", role: "patient", doctorId: null, name: "Someone", passwordHash: "" }]);
    expect(await ensureDemoLogin(store, "patient")).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.passwordHash).toBe("");
  });
});
