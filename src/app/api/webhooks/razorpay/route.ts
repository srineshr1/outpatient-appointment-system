import { NextResponse } from "next/server";
import { handleWebhook } from "@/lib/payments/service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Razorpay webhooks. The signature is computed over the exact bytes sent, so the body is read as text and
 * handed over untouched. 503 until RAZORPAY_WEBHOOK_SECRET is set, 400 for a wrong signature, 200 once the event
 * is stored (a repeat is acknowledged and ignored), 500 if processing failed so Razorpay delivers it again.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const result = await handleWebhook(rawBody, request.headers);
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}

export function GET(): NextResponse {
  return NextResponse.json({ error: "POST only" }, { status: 405, headers: { Allow: "POST" } });
}
