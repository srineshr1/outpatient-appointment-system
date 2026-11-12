/**
 * Tools the model may call. The list depends on the signed-in role, and every handler checks
 * the role again. Write tools only prepare a confirmation.
 */
import type { PublicUser } from "../clinic-types";
import { proposeBook, proposeCancel, proposePay, proposeReschedule, suggestMove } from "./act";
import {
  doctorAppointments,
  doctorStats,
  moneyForPatient,
  nextFree,
  openTimes,
  patientAppointments,
  prescriptions,
  schedulingConflicts,
  searchDoctors,
  suggestTimes,
  visitReasons,
  workingHours,
} from "./read";
import type { PendingCard } from "./confirm-token";
import { SLOT_TOOLS, slotLinksFrom, type SlotLink } from "./slot-links";

export interface ToolResult {
  forModel: unknown;
  pending?: PendingCard;
  /** Open times in the result, for the dock to show as links. Never sent to the model. */
  slots?: SlotLink[];
}

interface ToolSpec {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const date = { type: "string", description: "Clinic date YYYY-MM-DD. 'today' and 'tomorrow' are accepted." };
const time = { type: "string", description: "Clinic time HH:MM, 24-hour." };
const slotId = { type: "string", description: "Slot id returned by an availability tool." };
const visitId = { type: "string", description: "Visit id returned by an appointment tool." };

const doctorTools: ToolSpec[] = [
  { type: "function", name: "list_appointments", description: "Appointments on this doctor's book for one date, including who is coming. Never another doctor's book.", parameters: { type: "object", properties: { date }, required: ["date"] } },
  { type: "function", name: "appointment_stats", description: "Counts of confirmed, completed, cancelled, awaiting-payment and expired visits between two dates.", parameters: { type: "object", properties: { from: date, to: date }, required: ["from"] } },
  { type: "function", name: "working_hours", description: "Consulting sessions (shifts and working hours). Omit date for the weekly pattern. Leave is not stored.", parameters: { type: "object", properties: { date } } },
  { type: "function", name: "find_conflicts", description: "Overlapping sessions or overlapping appointments on one date.", parameters: { type: "object", properties: { date }, required: ["date"] } },
  { type: "function", name: "list_open_slots", description: "This doctor's open appointment slots. Optionally one date.", parameters: { type: "object", properties: { date } } },
  { type: "function", name: "suggest_slots", description: "Whether a time is free, and the nearest open alternatives for rescheduling.", parameters: { type: "object", properties: { date, time }, required: ["date", "time"] } },
  { type: "function", name: "next_available", description: "The next open slot on this doctor's book.", parameters: { type: "object", properties: {} } },
  { type: "function", name: "suggest_reschedule", description: "Open times a specific visit can move to.", parameters: { type: "object", properties: { visitId }, required: ["visitId"] } },
  { type: "function", name: "propose_reschedule", description: "Prepare moving a visit. Does not move it until the user confirms.", parameters: { type: "object", properties: { visitId, slotId, reason: { type: "string" } }, required: ["visitId", "slotId"] } },
  { type: "function", name: "propose_cancel", description: "Prepare cancelling a visit on this doctor's book. Does not cancel it until the user confirms.", parameters: { type: "object", properties: { visitId }, required: ["visitId"] } },
];

const patientTools: ToolSpec[] = [
  { type: "function", name: "list_appointments", description: "This patient's upcoming or previous appointments. No one else's.", parameters: { type: "object", properties: { which: { type: "string", enum: ["upcoming", "previous", "all"] } } } },
  { type: "function", name: "search_doctors", description: "Find bookable doctors by name, special interest or language.", parameters: { type: "object", properties: { query: { type: "string" } } } },
  { type: "function", name: "list_visit_reasons", description: "Reasons a visit can be booked for, with their ids.", parameters: { type: "object", properties: {} } },
  { type: "function", name: "list_open_slots", description: "Open slots for one doctor, optionally on one date.", parameters: { type: "object", properties: { doctorId: { type: "string" }, date }, required: ["doctorId"] } },
  { type: "function", name: "suggest_slots", description: "Check a requested time and suggest the nearest open alternatives when it is taken.", parameters: { type: "object", properties: { doctorId: { type: "string" }, date, time }, required: ["doctorId", "date", "time"] } },
  { type: "function", name: "next_available", description: "The next open slot for one doctor.", parameters: { type: "object", properties: { doctorId: { type: "string" } }, required: ["doctorId"] } },
  { type: "function", name: "propose_book", description: "Prepare a booking from the patient's profile. Does not book until the user confirms. Re-checks the slot at confirmation. payOnline holds the time and opens the real payment page.", parameters: { type: "object", properties: { slotId, reasonId: { type: "string", description: "new, follow, meds or bp" }, payOnline: { type: "boolean" }, note: { type: "string" } }, required: ["slotId", "reasonId"] } },
  { type: "function", name: "propose_reschedule", description: "Prepare moving one of the patient's visits to another slot with the same doctor. Does not move it until the user confirms.", parameters: { type: "object", properties: { visitId, slotId }, required: ["visitId", "slotId"] } },
  { type: "function", name: "propose_cancel", description: "Prepare cancelling one of the patient's visits. Does not cancel it until the user confirms.", parameters: { type: "object", properties: { visitId }, required: ["visitId"] } },
  { type: "function", name: "propose_pay", description: "Prepare the real online payment page for a visit that is already held for payment. Does not take money in the chat.", parameters: { type: "object", properties: { visitId }, required: ["visitId"] } },
  { type: "function", name: "payment_history", description: "This patient's fees, payments and refund statuses.", parameters: { type: "object", properties: { reference: { type: "string" } } } },
  { type: "function", name: "list_prescriptions", description: "Prescriptions stored for this patient. This practice does not store prescriptions; call this rather than inventing any.", parameters: { type: "object", properties: {} } },
];

export function toolSpecs(user: PublicUser): ToolSpec[] {
  if (user.role === "doctor") return doctorTools;
  if (user.role === "patient") return patientTools;
  return [];
}

function text(args: unknown, key: string): string {
  if (!args || typeof args !== "object") return "";
  const value = (args as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function flag(args: unknown, key: string): boolean {
  if (!args || typeof args !== "object") return false;
  return (args as Record<string, unknown>)[key] === true;
}

export async function runTool(user: PublicUser, name: string, args: unknown): Promise<ToolResult> {
  const result = await dispatchTool(user, name, args);
  if (!SLOT_TOOLS.has(name)) return result;
  const slots = slotLinksFrom(user, result.forModel);
  return slots.length ? { ...result, slots } : result;
}

async function dispatchTool(user: PublicUser, name: string, args: unknown): Promise<ToolResult> {
  const allowed = new Set(toolSpecs(user).map((tool) => tool.name));
  if (!allowed.has(name)) return { forModel: { error: "That action isn't available to this account." } };

  if (user.role === "doctor") {
    if (name === "list_appointments") return { forModel: await doctorAppointments(user, text(args, "date")) };
    if (name === "appointment_stats") return { forModel: await doctorStats(user, text(args, "from"), text(args, "to") || undefined) };
    if (name === "working_hours") return { forModel: await workingHours(user, text(args, "date") || undefined) };
    if (name === "find_conflicts") return { forModel: await schedulingConflicts(user, text(args, "date")) };
    if (name === "list_open_slots") return { forModel: await openTimes(user, undefined, text(args, "date") || undefined) };
    if (name === "suggest_slots") return { forModel: await suggestTimes(user, undefined, text(args, "date"), text(args, "time")) };
    if (name === "next_available") return { forModel: await nextFree(user) };
    if (name === "suggest_reschedule") return { forModel: await suggestMove(user, text(args, "visitId")) };
    if (name === "propose_reschedule") return proposeReschedule(user, text(args, "visitId"), text(args, "slotId"), text(args, "reason"));
    if (name === "propose_cancel") return proposeCancel(user, text(args, "visitId"));
  }

  if (user.role === "patient") {
    if (name === "list_appointments") return { forModel: await patientAppointments(user, text(args, "which") || "upcoming") };
    if (name === "search_doctors") return { forModel: searchDoctors(user, text(args, "query")) };
    if (name === "list_visit_reasons") return { forModel: visitReasons() };
    if (name === "list_open_slots") return { forModel: await openTimes(user, text(args, "doctorId"), text(args, "date") || undefined) };
    if (name === "suggest_slots") return { forModel: await suggestTimes(user, text(args, "doctorId"), text(args, "date"), text(args, "time")) };
    if (name === "next_available") return { forModel: await nextFree(user, text(args, "doctorId")) };
    if (name === "propose_book") return proposeBook(user, text(args, "slotId"), text(args, "reasonId"), flag(args, "payOnline"), text(args, "note"));
    if (name === "propose_reschedule") return proposeReschedule(user, text(args, "visitId"), text(args, "slotId"), "");
    if (name === "propose_cancel") return proposeCancel(user, text(args, "visitId"));
    if (name === "propose_pay") return proposePay(user, text(args, "visitId"));
    if (name === "payment_history") return { forModel: await moneyForPatient(user, text(args, "reference") || undefined) };
    if (name === "list_prescriptions") return { forModel: prescriptions() };
  }

  return { forModel: { error: "That action isn't available to this account." } };
}
