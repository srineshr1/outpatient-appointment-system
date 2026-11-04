#!/usr/bin/env node
/**
 * Promote a clinic user to doctor, or create their clinic profile.
 *
 * Supabase only proves who the person is. The role and doctorId the app uses come
 * from the clinic account in Vercel Blob, so changing anything in Supabase has no
 * effect on the clinic book.
 *
 * Usage:
 *   BLOB_READ_WRITE_TOKEN=... node scripts/make-doctor.mjs you@example.com cho "Dr Your Name"
 *
 * Or pull the production environment first:
 *   vercel env pull .env.production.local --environment=production
 *   node --env-file=.env.production.local scripts/make-doctor.mjs you@example.com cho "Dr Your Name"
 */
import { createHash, randomUUID } from "node:crypto";
import { get, put } from "@vercel/blob";

const DOCTOR_IDS = ["adeyemi", "reid", "cho", "rahman", "macleod"];
const ACCESS = "private";

const [rawEmail, doctorId, ...nameParts] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();
const name = nameParts.join(" ").trim();

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!email || !doctorId) {
  fail(
    `Usage: node scripts/make-doctor.mjs <email> <doctorId> ["Dr Name"]\n\nDoctor IDs: ${DOCTOR_IDS.join(", ")}`,
  );
}
if (!DOCTOR_IDS.includes(doctorId)) {
  fail(`Unknown doctorId "${doctorId}". Use one of: ${DOCTOR_IDS.join(", ")}`);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fail(`"${email}" does not look like an email address.`);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  fail(
    "BLOB_READ_WRITE_TOKEN is not set.\n" +
      "Use the production Blob token from Vercel → Settings → Environment Variables.\n" +
      "If the deployment uses SQLite instead, this script cannot update it.",
  );
}

const emailPath = `hsp/users/email/${createHash("sha256").update(email).digest("base64url")}.json`;

async function readJson(pathname) {
  const result = await get(pathname, { access: ACCESS, useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const text = await new Response(result.stream).text();
  return text ? JSON.parse(text) : null;
}

async function writeJson(pathname, value, allowOverwrite) {
  await put(pathname, JSON.stringify(value), {
    access: ACCESS,
    addRandomSuffix: false,
    allowOverwrite,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

try {
  const existing = await readJson(emailPath);
  const now = new Date().toISOString();
  const user = existing
    ? {
        ...existing,
        email,
        name: name || existing.name || email.split("@")[0],
        role: "doctor",
        doctorId,
        createdAt: existing.createdAt || now,
        disabledAt: existing.disabledAt ?? null,
        sessionsRevokedAt: existing.sessionsRevokedAt ?? null,
      }
    : {
        id: randomUUID(),
        email,
        passwordHash: "",
        name: name || `Dr ${email.split("@")[0]}`,
        role: "doctor",
        doctorId,
        mobile: "",
        dob: "",
        createdAt: now,
        disabledAt: null,
        sessionsRevokedAt: null,
      };

  // The app has two records per user: the id lookup and the email lookup.
  // Write the id record first, matching ClinicStore.updateUser().
  await writeJson(`hsp/users/id/${user.id}.json`, user, true);
  await writeJson(emailPath, user, Boolean(existing));

  console.log(`\n${existing ? "Promoted" : "Created"} ${email}`);
  if (existing) console.log(`  was:      ${existing.role ?? "unknown"}`);
  console.log(`  role:     doctor`);
  console.log(`  doctorId: ${doctorId}`);
  console.log(`  userId:   ${user.id}`);
  if (existing?.role === "patient") {
    console.log("\nThis account was a patient. It can no longer book as a patient; use a different email for that.");
  }
  console.log("Refresh the deployment. The account is read on every request, so signing out is usually not needed.\n");
} catch (error) {
  console.error("\nCould not update the clinic account:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
