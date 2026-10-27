import type { Role } from "./clinic-types";

/** Shared password for the sample clinic accounts. This is a demo, not a live practice. */
export const DEMO_PASSWORD = "Halden-demo-2026";

export interface DemoAccount {
  id: string;
  email: string;
  name: string;
  role: Role;
  doctorId: string | null;
  mobile: string;
  dob: string;
  blurb: string;
}

export const demoAccounts: DemoAccount[] = [
  {
    id: "user-patient-demo",
    email: "ann.lee@halden.example",
    name: "Ann Lee",
    role: "patient",
    doctorId: null,
    mobile: "07700 900123",
    dob: "1980-03-14",
    blurb: "Patient. Book a visit, then look under Appointments.",
  },
  {
    id: "user-cho",
    email: "helen.cho@halden.example",
    name: "Dr Helen Cho",
    role: "doctor",
    doctorId: "cho",
    mobile: "",
    dob: "",
    blurb: "Doctor. Her clinic book lists the visits patients book with her.",
  },
  {
    id: "user-rudraksha",
    email: "rudraksha.srinesh@gmail.com",
    name: "Dr Rudraksha Srinesh",
    role: "doctor",
    doctorId: "cho",
    mobile: "",
    dob: "",
    blurb: "Doctor. Shares Dr Cho’s clinic book while the admin console is being built.",
  },
  {
    id: "user-adeyemi",
    email: "amara.adeyemi@halden.example",
    name: "Dr Amara Adeyemi",
    role: "doctor",
    doctorId: "adeyemi",
    mobile: "",
    dob: "",
    blurb: "Doctor. General practice, and Dr MacLeod’s supervisor.",
  },
  {
    id: "user-reid",
    email: "callum.reid@halden.example",
    name: "Dr Callum Reid",
    role: "doctor",
    doctorId: "reid",
    mobile: "",
    dob: "",
    blurb: "Doctor. Diabetes clinic on Friday mornings.",
  },
  {
    id: "user-rahman",
    email: "yusuf.rahman@halden.example",
    name: "Dr Yusuf Rahman",
    role: "doctor",
    doctorId: "rahman",
    mobile: "",
    dob: "",
    blurb: "Doctor. Joint injections on Tuesday afternoons.",
  },
  {
    id: "user-macleod",
    email: "iona.macleod@halden.example",
    name: "Dr Iona MacLeod",
    role: "doctor",
    doctorId: "macleod",
    mobile: "",
    dob: "",
    blurb: "Registrar. Teaching sessions stay closed.",
  },
  {
    id: "user-desk",
    email: "desk@halden.example",
    name: "Westbrook reception desk",
    role: "reception",
    doctorId: null,
    mobile: "",
    dob: "",
    blurb: "Reception. Sees every doctor’s book and can update a visit.",
  },
  {
    id: "user-admin",
    email: "admin@halden.example",
    name: "Fiona Grant",
    role: "admin",
    doctorId: null,
    mobile: "",
    dob: "",
    blurb: "Practice manager. Opens the admin console: visits, payments, people and activity.",
  },
];
