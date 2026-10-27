import { describe, expect, it } from "vitest";
import type { ClinicStore } from "./clinic-types";
import { seedDemoUsers } from "./seed";

type Row = { id: string; email: string; role: string; doctorId: string | null; name: string };

function fakeStore(rows: Row[]) {
  const events: unknown[] = [];
  const store = {
    async getUserByEmail(email: string) {
      return rows.find((row) => row.email === email) ?? null;
    },
    async createUser(user: Row) {
      rows.push({ ...user });
      return "created";
    },
    async updateUser(id: string, patch: Partial<Row>) {
      const row = rows.find((entry) => entry.id === id);
      if (!row) return null;
      Object.assign(row, patch);
      return row;
    },
    async listUsers() {
      return rows;
    },
    async appendEvent(event: unknown) {
      events.push(event);
    },
  } as unknown as ClinicStore;
  return { store, rows, events };
}

const EMAIL = "rudraksha.srinesh@gmail.com";

describe("seedDemoUsers", () => {
  it("gives a new seeded doctor account its own book", async () => {
    const { store, rows } = fakeStore([]);
    await seedDemoUsers(store);
    expect(rows.find((row) => row.email === EMAIL)).toMatchObject({ id: "user-rudraksha", role: "doctor", doctorId: "user-rudraksha" });
  });

  it("moves an account an older seed linked to Dr Cho's book to its own", async () => {
    const { store, rows, events } = fakeStore([{ id: "user-rudraksha", email: EMAIL, role: "doctor", doctorId: "cho", name: "Dr Rudraksha Srinesh" }]);
    await seedDemoUsers(store);
    expect(rows.find((row) => row.email === EMAIL)).toMatchObject({ role: "doctor", doctorId: "user-rudraksha" });
    expect(events).toHaveLength(1);
  });

  it("leaves a link an admin chose, and never makes a patient a doctor", async () => {
    const { store, rows } = fakeStore([
      { id: "user-rudraksha", email: EMAIL, role: "doctor", doctorId: "reid", name: "Dr Rudraksha Srinesh" },
    ]);
    await seedDemoUsers(store);
    expect(rows.find((row) => row.email === EMAIL)?.doctorId).toBe("reid");

    const second = fakeStore([{ id: "other", email: EMAIL, role: "patient", doctorId: null, name: "R" }]);
    await seedDemoUsers(second.store);
    expect(second.rows.find((row) => row.email === EMAIL)).toMatchObject({ role: "patient", doctorId: null });
  });

  it("moves Dr Someone off Dr Cho's book once, and leaves deliberate shares alone", async () => {
    const { store, rows, events } = fakeStore([
      { id: "acct-someone", email: "someone@example.com", role: "doctor", doctorId: "cho", name: "Dr Someone" },
      { id: "acct-locum", email: "locum@example.com", role: "doctor", doctorId: "cho", name: "Dr Locum" },
    ]);
    await seedDemoUsers(store);
    expect(rows.find((row) => row.id === "acct-someone")?.doctorId).toBe("acct-someone");
    expect(rows.find((row) => row.id === "acct-locum")?.doctorId).toBe("cho");
    const repairs = events.length;
    await seedDemoUsers(store);
    expect(events.length).toBe(repairs);
  });
});
