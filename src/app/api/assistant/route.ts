import { NextResponse } from "next/server";
import { lockedLanguage } from "@/lib/assistant/language";
import { beginModelTurn, endModelTurn, handleTurn, parseMessages, readAssistantJson } from "@/lib/assistant/turn";
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
  const quota = beginModelTurn(user.id);
  if (!quota.ok) return NextResponse.json({ message: quota.message }, { status: 429 });

  const read = await readAssistantJson(request);
  if (!read.ok) {
    endModelTurn(user.id);
    return NextResponse.json({ message: read.message }, { status: read.status });
  }
  const record = read.value && typeof read.value === "object" ? (read.value as Record<string, unknown>) : {};
  const messages = parseMessages(record.messages);
  if (!messages || messages.at(-1)?.role !== "user") {
    endModelTurn(user.id);
    return NextResponse.json({ message: "Send your question as the latest message." }, { status: 400 });
  }
  const pendingToken = typeof record.pendingToken === "string" && record.pendingToken ? record.pendingToken : null;
  // "auto" (or nothing) keeps automatic detection; a tag from the dock's menu locks the reply language.
  const locked = typeof record.language === "string" ? lockedLanguage(record.language) : null;
  try {
    const result = await handleTurn(user, messages, pendingToken, locked);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The assistant couldn't answer.";
    return NextResponse.json({ message }, { status: 502 });
  } finally {
    endModelTurn(user.id);
  }
}
