import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AppointmentRecord, ConsultSession } from "@/lib/clinic-types";
import { navigation, renderWithProviders } from "@/test/utils";
import { ClinicBookView } from "./ClinicBookView";
import { DoctorDock } from "./DoctorDock";
import { DoctorNotificationsWorkspace } from "./DoctorNotificationsWorkspace";
import { DoctorProfileWorkspace } from "./DoctorProfileWorkspace";
import { SessionStudio } from "./SessionStudio";
import { SessionsViewer } from "./SessionsViewer";

vi.mock("@/server/booking-actions", () => ({ updateVisit: vi.fn() }));
vi.mock("@/server/inbox-actions", () => ({
  markAllReadAction: vi.fn(),
  openInboxItemAction: vi.fn(),
}));
vi.mock("@/server/profile-actions", () => ({
  saveSession: vi.fn(),
  archiveSession: vi.fn(),
  saveDoctorProfile: vi.fn(),
}));
vi.mock("@/server/notification-actions", () => ({
  saveNotificationPrefs: vi.fn(),
}));

const SESSION_STREAM: ConsultSession = {
  id: "s-morning",
  doctorId: "doc-1",
  label: "Morning clinic",
  weekdays: [1, 3, 5],
  startTime: "09:00",
  endTime: "11:00",
  room: "Room 6",
  mode: "stream",
  slotMinutes: 30,
  waveMinutes: null,
  waveCapacity: null,
  startDate: "2026-10-01",
  endDate: "2026-12-31",
  onDate: null,
  archivedAt: null,
  createdAt: "2026-10-01T08:00:00Z",
  updatedAt: "2026-10-01T08:00:00Z",
};

const VISIT_TODAY: AppointmentRecord = {
  id: "v-1",
  reference: "WB-101",
  doctorId: "doc-1",
  slotId: "doc-1-2026-10-26-09:00",
  sessionId: "s-morning",
  date: "2026-10-26",
  time: "09:00",
  endTime: null,
  token: null,
  waveCapacity: null,
  reasonId: "checkup",
  patientName: "Priya Nair",
  patientMobile: "+919876543210",
  patientDob: "1990-05-10",
  patientChi: "CHI-42",
  note: "Follow-up blood pressure check",
  status: "booked",
  createdAt: "2026-10-25T09:00:00Z",
  patientUserId: "user-p1",
};

describe("Doctor Dashboard Redesign", () => {
  it("DoctorDock links to all 5 distinct workspace destinations and marks the active route", () => {
    navigation.pathname = "/dashboard/sessions";
    renderWithProviders(<DoctorDock counts={{ todayVisits: 3, activeSessions: 2, pendingAlerts: 1 }} />);

    const docks = screen.getAllByRole("navigation", { name: "Doctor workspace dock" });
    expect(docks.length).toBeGreaterThan(0);

    const desktopDock = docks[0]!;
    const links = within(desktopDock).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/dashboard",
      "/dashboard/sessions",
      "/dashboard/sessions/manage",
      "/dashboard/profile",
      "/dashboard/notifications",
    ]);
    expect(within(desktopDock).getByRole("link", { name: /View schedule/ })).toHaveAttribute("aria-current", "page");
    expect(within(desktopDock).getByRole("link", { name: /Clinic book/ })).not.toHaveAttribute("aria-current");
  });

  it("ClinicBookView renders greeting, clickable Calendar -> edit page, Notifications panel, and live queue", () => {
    renderWithProviders(
      <ClinicBookView
        userName="Asha Rao"
        userRole="doctor"
        room="Room 6"
        expiresAt="2026-10-26T18:00:00Z"
        expiresLabel="26 Oct 2026, 23:30"
        setup={{
          visible: true,
          sessions: [SESSION_STREAM],
          steps: [
            { id: "profile", label: "Complete your profile", detail: "", done: true, href: "/dashboard/profile" },
            { id: "session", label: "Add a consulting session", detail: "", done: true, href: "/dashboard/sessions" },
          ],
        }}
        sessions={[SESSION_STREAM]}
        trims={[]}
        inboxItems={[
          {
            id: "inb-1",
            userId: "doc-1",
            kind: "doctor_booking",
            title: "New booking from Priya Nair",
            body: "Mon 26 Oct at 09:00",
            href: "/dashboard",
            appointmentId: "v-1",
            readAt: null,
            createdAt: "2026-10-26T08:00:00Z",
          },
        ]}
        wholeBook={false}
        filterDoctorId=""
        doctorOptions={[]}
        doctorNames={{ "doc-1": "Dr Asha Rao" }}
        visits={[VISIT_TODAY]}
        today="2026-10-26"
        returnTo="/dashboard"
        payments={{ "v-1": "Paid ₹400" }}
        moves={{}}
        pendingDisplacedCount={0}
      />,
    );

    expect(screen.getByRole("heading", { name: "Hello Dr Asha Rao" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText("New booking from Priya Nair")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Morning clinic/ })[0]).toHaveAttribute(
      "href",
      "/dashboard/sessions/manage?session=s-morning",
    );
    expect(screen.getByText("Priya Nair")).toBeInTheDocument();
    expect(screen.getByText("WB-101")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View sessions/ })).toHaveAttribute("href", "/dashboard/sessions");
    expect(screen.getByRole("link", { name: /Edit sessions/ })).toHaveAttribute("href", "/dashboard/sessions/manage");
    expect(screen.getByRole("button", { name: /Mark complete/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Add / Edit panel" })).not.toBeInTheDocument();
    expect(screen.queryByText("Visible to patients")).not.toBeInTheDocument();
  });

  it("SessionsViewer renders read-only schedule controls and Session Directory switcher", async () => {
    renderWithProviders(
      <SessionsViewer
        doctorName="Dr Asha Rao"
        today="2026-10-26"
        nowMinutes={600}
        sessions={[SESSION_STREAM]}
        visits={[
          {
            id: "v-1",
            sessionId: "s-morning",
            slotId: VISIT_TODAY.slotId,
            date: "2026-10-26",
            time: "09:00",
            endTime: null,
            token: null,
            reason: "Check-up",
            patientName: "Priya Nair",
            status: "booked",
            reference: "WB-101",
          },
        ]}
        trims={[]}
        room="Room 6"
        visible
      />,
    );

    expect(screen.getByRole("link", { name: /Edit in Session Studio/ })).toHaveAttribute("href", "/dashboard/sessions/manage");
    expect(screen.queryByText("Visible to patients")).not.toBeInTheDocument();

    // Inspector is rendered below with booked visits and session stats
    expect(screen.getByRole("region", { name: /Session and patient inspector/ })).toBeInTheDocument();
    expect(screen.getByText("Priya Nair")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: /Session Directory/ }));
    expect(screen.getByText("Morning clinic")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Edit in Studio/ })).toHaveAttribute(
      "href",
      "/dashboard/sessions/manage?session=s-morning",
    );
  });

  it("SessionStudio renders Add / Edit panel and toggles Until date when Recurring is clicked", async () => {
    renderWithProviders(
      <SessionStudio
        doctorId="doc-1"
        doctorName="Dr Asha Rao"
        sessions={[SESSION_STREAM]}
        visits={[]}
        trims={[]}
        today="2026-10-26"
        nowMinutes={600}
        room="Room 6"
        initialSessionId={null}
        startInCreateMode
        profileComplete
        notice={null}
        noticeTone="info"
        removingSession={null}
        removingCount={0}
      />,
    );

    const returnInputs = document.querySelectorAll('input[name="returnTo"]') as NodeListOf<HTMLInputElement>;
    expect(returnInputs.length).toBeGreaterThan(0);
    expect(Array.from(returnInputs).every((el) => el.value === "/dashboard/sessions/manage")).toBe(true);
    expect(screen.getByRole("heading", { name: "Add / Edit panel" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Calendar Preview" })).not.toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Week days" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Mon/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Tue/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Wed/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Thu/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Fri/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Sat/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Sun/i })).toBeInTheDocument();

    // Clicking a week day tab shows sessions on that date
    const fridayTab = screen.getByRole("tab", { name: /Fri/i });
    await userEvent.click(fridayTab);
    expect(screen.getByText(/Sessions on Fri/i)).toBeInTheDocument();

    expect(screen.getByText("Affected bookings & schedule check")).toBeInTheDocument();
    expect(screen.queryByLabelText("Until date")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: "Recurring" }));
    expect(screen.getByLabelText("From date")).toBeInTheDocument();
    expect(screen.getByLabelText("Until date")).toBeInTheDocument();
    expect(screen.queryByText(/Dashed blocks are the hours you just chose/)).not.toBeInTheDocument();
  });

  it("SessionStudio allows expanding a stream session into an adjacent wave session", async () => {
    const wave = {
      id: "s-wave",
      doctorId: "doc-1",
      label: "Afternoon Wave",
      weekdays: [1],
      startTime: "11:00",
      endTime: "15:00",
      room: "Room 6",
      mode: "wave" as const,
      slotMinutes: null,
      waveMinutes: null,
      waveCapacity: 6,
      startDate: "2026-10-26",
      endDate: "2026-10-26",
      onDate: null,
      archivedAt: null,
      createdAt: "2026-10-20T00:00:00.000Z",
      updatedAt: "2026-10-20T00:00:00.000Z",
    };

    renderWithProviders(
      <SessionStudio
        doctorId="doc-1"
        doctorName="Dr Asha Rao"
        sessions={[SESSION_STREAM, wave]}
        visits={[]}
        trims={[]}
        today="2026-10-26"
        nowMinutes={480}
        room="Room 6"
        initialSessionId="s-morning"
        startInCreateMode={false}
        profileComplete
        notice={null}
        noticeTone="info"
        removingSession={null}
        removingCount={0}
      />,
    );

    const endInput = screen.getByLabelText("Ends");
    await userEvent.clear(endInput);
    await userEvent.type(endInput, "13:00");

    expect(screen.queryByText(/so you don't cut a slot/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit changes" })).toBeEnabled();
  });

  it("DoctorProfileWorkspace updates live patient card preview as fields change", async () => {
    renderWithProviders(
      <DoctorProfileWorkspace
        initial={{
          name: "Asha Rao",
          specialty: "General practice",
          qualification: "MBBS, MD",
          years: "10",
          room: "Room 6",
          fee: "500",
          bio: "Family medicine.",
          languages: "English, Hindi",
        }}
        welcome={false}
        saved={false}
        visible
        missingCount={0}
        sessionsCount={1}
      />,
    );

    const roomInput = screen.getByLabelText("Room or clinic");
    await userEvent.clear(roomInput);
    await userEvent.type(roomInput, "Suite 12");
    expect(screen.getByText("Suite 12")).toBeInTheDocument();
  });

  it("DoctorNotificationsWorkspace syncs SquishSwitch toggles with form checkboxes", async () => {
    renderWithProviders(
      <DoctorNotificationsWorkspace
        initial={{ booked: true, cancelled: true, rescheduled: false, dailySummary: true }}
        email="asha@example.com"
        saved={false}
      />,
    );

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(4);
    expect(switches[0]).toHaveAttribute("aria-checked", "true");
    expect(switches[2]).toHaveAttribute("aria-checked", "false");

    await userEvent.click(switches[2]!);
    expect(switches[2]).toHaveAttribute("aria-checked", "true");

    const hiddenCheckbox = document.querySelector('input[name="rescheduled"]') as HTMLInputElement;
    expect(hiddenCheckbox.checked).toBe(true);
  });
});
