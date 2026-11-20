import type { ClinicStore, ConsultSession, ProfileRecord, UserAccount } from "./clinic-types";
import { isDoctorProfileComplete, missingDoctorFields, readDoctorProfile } from "./profiles";

export interface ChecklistStep {
  id: "profile" | "session";
  label: string;
  /** What is still missing, in words. Empty when the step is done. */
  detail: string;
  done: boolean;
  href: string;
}

export interface DoctorStatus {
  steps: ChecklistStep[];
  sessions: ConsultSession[];
  /** Patients can see and book this doctor. */
  visible: boolean;
}

/** Pure: what a doctor still has to do before patients can book them. */
export function doctorStatusOf(account: Pick<UserAccount, "name">, record: ProfileRecord | null, sessions: readonly ConsultSession[]): DoctorStatus {
  const live = sessions.filter((session) => !session.archivedAt);
  const profile = readDoctorProfile(record);
  const missing = missingDoctorFields(account.name, profile);
  const profileDone = Boolean(record) && isDoctorProfileComplete(account.name, profile);
  const steps: ChecklistStep[] = [
    {
      id: "profile",
      label: "Complete your profile",
      detail: profileDone ? "" : `Still needed: ${(missing.length ? missing.map((item) => item.label.toLowerCase()) : ["your details"]).join(", ")}.`,
      done: profileDone,
      href: "/dashboard/profile",
    },
    {
      id: "session",
      label: "Add a consulting session",
      detail: live.length > 0 ? "" : "Choose your days, hours and whether patients book a slot (stream) or a wave.",
      done: live.length > 0,
      href: "/dashboard/sessions",
    },
  ];
  return { steps, sessions: live, visible: steps.every((step) => step.done) };
}

export async function doctorStatus(store: ClinicStore, account: UserAccount): Promise<DoctorStatus> {
  const bookId = account.doctorId ?? account.id;
  const [record, sessions] = await Promise.all([store.getProfile(account.id), store.listConsultSessions(bookId)]);
  const status = doctorStatusOf(account, record, sessions);
  // Practice doctors are already on the public directory; they do not finish a self-signup profile.
  if (account.doctorId && account.doctorId !== account.id) {
    return {
      sessions: status.sessions,
      visible: status.sessions.length > 0,
      steps: status.steps.map((step) => (step.id === "profile" ? { ...step, done: true, detail: "" } : step)),
    };
  }
  return status;
}
