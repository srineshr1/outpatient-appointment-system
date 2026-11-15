import { NextResponse } from "next/server";
import { confirmPending, rejectPending } from "@/lib/assistant/act";
import { allowTurn, readAssistantJson } from "@/lib/assistant/turn";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The confirmation buttons. A click is the user's explicit yes or no, with no model in between. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Sign in to use the assistant." }, { status: 401 });
  if (user.role !== "patient" && user.role !== "doctor") {
    return NextResponse.json({ message: "The assistant is for patients and doctors." }, { status: 403 });
  }
  if (!allowTurn(user.id)) return NextResponse.json({ message: "Too many requests. Wait a minute and try again." }, { status: 429 });

  const read = await readAssistantJson(request);
  if (!read.ok) return NextResponse.json({ message: read.message }, { status: read.status });
  const record = read.value && typeof read.value === "object" ? (read.value as Record<string, unknown>) : {};
  const token = typeof record.token === "string" ? record.token : "";
  if (!token) return NextResponse.json({ message: "Missing confirmation." }, { status: 400 });
  const outcome = record.decision === "reject" ? await rejectPending(user, token) : await confirmPending(user, token);
  return NextResponse.json({ reply: outcome.summary, pending: null, ok: outcome.ok, ...(outcome.payUrl ? { payUrl: outcome.payUrl } : {}) });
}
