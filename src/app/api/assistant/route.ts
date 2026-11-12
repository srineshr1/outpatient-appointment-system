import { NextResponse } from "next/server";
import { allowTurn, handleTurn, parseMessages } from "@/lib/assistant/turn";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const messages = parseMessages(record.messages);
  if (!messages || messages.at(-1)?.role !== "user") {
    return NextResponse.json({ message: "Send your question as the latest message." }, { status: 400 });
  }
  const pendingToken = typeof record.pendingToken === "string" && record.pendingToken ? record.pendingToken : null;
  try {
    const result = await handleTurn(user, messages, pendingToken);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The assistant couldn't answer.";
    return NextResponse.json({ message }, { status: 502 });
  }
}
