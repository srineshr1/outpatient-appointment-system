import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTitle } from "@/components/admin/AdminTitle";
import { TABS } from "@/components/admin/nav";
import { Badge, TableWrap, Td, Th, tableClass, tbodyClass, theadClass, type Tone } from "@/components/admin/ui";
import { isActiveAdmin } from "@/lib/admin";
import { loadSnapshot, navCounts, type SearchParams } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/admin-page";
import { pluralise } from "@/lib/format";
import { googleConfigured } from "@/lib/google";
import { devCodesAllowed } from "@/lib/mailer";
import { adminEmailsFromEnv } from "@/lib/seed";
import { supabaseConfigured } from "@/lib/supabase";

export const metadata: Metadata = { title: "Setup" };

interface Check {
  name: string;
  setting: string;
  state: string;
  tone: Tone;
  detail: string;
}

export default async function SetupPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdminPage("/admin/security/setup");
  await searchParams;
  const snapshot = await loadSnapshot();
  const counts = navCounts(snapshot);
  const production = process.env.NODE_ENV === "production";
  const supabase = supabaseConfigured();
  const resend = Boolean(process.env.RESEND_API_KEY);
  const admins = snapshot.users.filter(isActiveAdmin).length;
  const bootstrap = adminEmailsFromEnv().length;

  // Only whether each setting is there. Values are never shown.
  const checks: Check[] = [
    {
      name: "Code key",
      setting: "AUTH_SECRET",
      state: process.env.AUTH_SECRET ? "Set" : "Not set",
      tone: process.env.AUTH_SECRET ? "success" : production ? "danger" : "warn",
      detail: process.env.AUTH_SECRET ? "Stored sign-in codes are keyed with it." : "Codes use a development key. Set this in production.",
    },
    {
      name: "Email sign-in",
      setting: supabase ? "Supabase" : resend ? "RESEND_API_KEY, MAIL_FROM" : "SHOW_LOGIN_CODES",
      state: supabase ? "Supabase sends codes" : resend ? "Resend sends codes" : devCodesAllowed() ? "Codes shown on screen" : "Can’t send codes",
      tone: supabase || resend ? "success" : devCodesAllowed() ? "warn" : "danger",
      detail: supabase || resend ? "Codes go to the person’s inbox." : devCodesAllowed() ? "Demo mode: anyone at the screen can see the code." : "Email sign-in fails until mail is set up.",
    },
    {
      name: "Google sign-in",
      setting: supabase ? "Supabase provider" : "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET",
      state: supabase ? "Through Supabase" : googleConfigured() ? "On" : "Off",
      tone: supabase || googleConfigured() ? "success" : "neutral",
      detail: supabase ? "On when the Google provider is enabled in Supabase." : googleConfigured() ? "Only Google-verified emails are accepted." : "The button explains it isn’t set up.",
    },
    {
      name: "Where records live",
      setting: "BLOB_READ_WRITE_TOKEN",
      state: process.env.BLOB_READ_WRITE_TOKEN ? "Vercel Blob (private)" : "SQLite on this server",
      tone: "info",
      detail: process.env.BLOB_READ_WRITE_TOKEN ? "Survives across serverless instances." : "data/clinic.sqlite, or CLINIC_DB.",
    },
    {
      name: "First admins",
      setting: "ADMIN_EMAILS",
      state: bootstrap > 0 ? pluralise(bootstrap, "email") : "Not set",
      tone: bootstrap > 0 ? "success" : "neutral",
      detail: "Accounts for these emails become admins when the app starts.",
    },
    {
      name: "Admins who can sign in",
      setting: "—",
      state: pluralise(admins, "admin"),
      tone: admins > 1 ? "success" : "warn",
      detail: admins > 1 ? "More than one, so no one is locked out if an admin leaves." : "Add a second admin so the practice can’t be locked out.",
    },
    {
      name: "Payments",
      setting: "—",
      state: "Demo only",
      tone: "info",
      detail: "No payment provider is connected. Card payments are simulated and no money moves.",
    },
  ];

  return (
    <AdminShell
      admin={admin}
      section="security"
      crumb="Setup"
      tabs={TABS.security}
      activeTab="/admin/security/setup"
      counts={counts}
    >
      <AdminTitle
        title="Setup"
        today={snapshot.today}
        description="How sign-in, email and storage are set up on this server. Only whether a setting is present is shown, never its value."
      />
      <TableWrap label="Setup">
        <table className={tableClass}>
          <caption className="sr-only">Server settings</caption>
          <thead className={theadClass}>
            <tr>
              <Th>What</Th>
              <Th>Setting</Th>
              <Th>State</Th>
              <Th>What it means</Th>
            </tr>
          </thead>
          <tbody className={tbodyClass}>
            {checks.map((check) => (
              <tr key={check.name}>
                <Td className="font-medium whitespace-nowrap">{check.name}</Td>
                <Td>
                  <code className="font-mono text-xs text-ink-2">{check.setting}</code>
                </Td>
                <Td>
                  <Badge tone={check.tone}>{check.state}</Badge>
                </Td>
                <Td className="min-w-56 text-ink-2">{check.detail}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </AdminShell>
  );
}
