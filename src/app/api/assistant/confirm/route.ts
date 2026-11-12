import { NextResponse } from "next/server";
import { confirmPending, rejectPending } from "@/lib/assistant/act";
import { allowTurn } from "@/lib/assistant/turn";
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Send a JSON message." }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const token = typeof record.token === "string" ? record.token : "";
  if (!token) return NextResponse.json({ message: "Missing confirmation." }, { status: 400 });
  const outcome = record.decision === "reject" ? await rejectPending(user, token) : await confirmPending(user, token);
  return NextResponse.json({ reply: outcome.summary, pending: null, ok: outcome.ok, ...(outcome.payUrl ? { payUrl: outcome.payUrl } : {}) });
}
