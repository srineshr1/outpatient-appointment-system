import { NextResponse } from "next/server";
import { cronAuthorised, runCron } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request): Promise<NextResponse> {
  if (!(await cronAuthorised(request.headers.get("authorization")))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(await runCron(), { headers: { "Cache-Control": "no-store" } });
}

/** pg_cron + pg_net call this every five minutes with `Authorization: Bearer <secret>`. */
export const POST = handle;
export const GET = handle;
