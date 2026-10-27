import { router, renderWithProviders, MONDAY_1340 } from "@/test/utils";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DoctorDirectory } from "@/components/directory/DoctorDirectory";
import { DetailsView } from "@/components/details/DetailsView";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { STORAGE_KEY } from "@/lib/booking-state";
import { setNow } from "@/lib/clock";
import { doctors } from "@/lib/data";
import { getSlots, getUpcoming } from "@/lib/repository";
import { getCurrentUser } from "@/lib/session";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { RegisterForm } from "@/components/auth/RegisterForm";

// The booking action reads the session cookie. Here the sample patient is signed in.
vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  return {
    ...actual,
    getCurrentUser: vi.fn(async () => ({
      id: "user-patient-demo",
      email: "ann.lee@halden.example",
      name: "Ann Lee",
      role: "patient" as const,
      doctorId: null,
      mobile: "07700 900123",
      dob: "1980-03-14",
      expiresAt: "2099-01-01T00:00:00.000Z",
    })),
  };
});

const account = { name: "", dob: "", mobile: "", email: "ann.lee@halden.example" };

beforeEach(() => {
  router.push.mockReset();
  router.replace.mockReset();
  setNow(MONDAY_1340);
});

describe("DoctorDirectory", () => {
  async function setup() {
    renderWithProviders(<DoctorDirectory doctors={doctors} upcoming={await getUpcoming()} />);
  }

  it("lists every doctor with a portrait, bio and next time", async () => {
    await setup();
    const list = screen.getByRole("list", { name: "Doctors" });
    expect(within(list).getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: /Dr Helen Cho/ })).toHaveAttribute("href", "/doctors/cho");
    expect(screen.getByRole("link", { name: /Dr Helen Cho/ })).toHaveAccessibleDescription(/Next available/);
    expect(screen.getByText(/Contraception, menopause/)).toBeInTheDocument();
  });

  it("finds a doctor by language", async () => {
    await setup();
    await userEvent.type(screen.getByRole("searchbox"), "korean");
    await waitFor(() => expect(screen.getByText("1 doctor")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Dr Helen Cho/ })).toBeInTheDocument();
  });

  it("searches by name or specialty and announces the count", async () => {
    await setup();
    await userEvent.type(screen.getByRole("searchbox"), "diabetes");
    await waitFor(() => expect(screen.getByText("1 doctor")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Dr Callum Reid/ })).toBeInTheDocument();
  });

  it("filters by specialty chip with arrow keys", async () => {
    await setup();
    await userEvent.click(screen.getByRole("radio", { name: "All doctors" }));
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "General practice" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("1 doctor in general practice")).toBeInTheDocument();
  });

  it("shows a helpful empty state and clears filters", async () => {
    await setup();
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(await screen.findByText("No doctors found")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(screen.getByText("5 doctors")).toBeInTheDocument());
  });
});

describe("ScheduleView", () => {
  it("shows the week, disables unavailable times, and holds a choice", async () => {
    const cho = doctors.find((doctor) => doctor.id === "cho")!;
    renderWithProviders(<ScheduleView doctor={cho} slots={await getSlots("cho")} initialWeek="2026-10-26" signedIn />);

    expect(screen.getByRole("button", { name: "Previous week" })).toBeDisabled();
    // 09:20 today has passed at 13:40.
    expect(screen.getAllByRole("radio", { name: /09:20, closed/ })[0]).toBeDisabled();

    const open = screen.getAllByRole("radio").find((radio) => !(radio as HTMLInputElement).disabled)!;
    await userEvent.click(open);
    expect(await screen.findByRole("button", { name: "Continue" })).toBeInTheDocument();
    await waitFor(() => expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain((open as HTMLInputElement).value));

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(router.push).toHaveBeenCalledWith("/book/details");
  });

  it("asks a signed-out patient to sign in, keeping the time", async () => {
    const cho = doctors.find((doctor) => doctor.id === "cho")!;
    renderWithProviders(<ScheduleView doctor={cho} slots={await getSlots("cho")} initialWeek="2026-10-26" />);
    const open = screen.getAllByRole("radio").find((radio) => !(radio as HTMLInputElement).disabled)!;
    await userEvent.click(open);
    expect(await screen.findByText(/Next, sign in/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(router.push).toHaveBeenCalledWith("/sign-in?next=%2Fbook%2Fdetails");
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain((open as HTMLInputElement).value);
  });

  it("moves between weeks", async () => {
    const cho = doctors.find((doctor) => doctor.id === "cho")!;
    renderWithProviders(<ScheduleView doctor={cho} slots={await getSlots("cho")} initialWeek="2026-10-26" />);
    await userEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(await screen.findByText(/2–6 November 2026 · \d+ times? available/)).toBeInTheDocument();
  });
});

describe("DetailsView", () => {
  async function setupHeld() {
    const open = (await getUpcoming())["cho"]![0]!;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ held: open, booking: null, flash: null }));
    renderWithProviders(<DetailsView doctors={doctors} account={account} />);
    await screen.findByRole("heading", { name: "Your details" });
    return open;
  }

  it("sends people with nothing held back to the start", async () => {
    renderWithProviders(<DetailsView doctors={doctors} account={account} />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("summarises errors and focuses the first problem", async () => {
    await setupHeld();
    await userEvent.click(screen.getByRole("button", { name: "Book appointment" }));
    expect(screen.getByRole("alert", { name: /There are 4 things to fix/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveFocus();
    expect(screen.getByLabelText("Mobile number")).toHaveAccessibleDescription("Enter a UK mobile number.");
  });

  it("blocks unregistered patients and points them to the phone", async () => {
    await setupHeld();
    await userEvent.click(screen.getByRole("switch", { name: /not registered/ }));
    expect(screen.getByRole("button", { name: "Book appointment" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Please register first");
  });

  it("books and moves to the confirmation", async () => {
    await setupHeld();
    await userEvent.type(screen.getByLabelText("Full name"), "Ann Lee");
    await userEvent.type(screen.getByLabelText("Date of birth"), "1980-03-14");
    await userEvent.type(screen.getByLabelText("Mobile number"), "07700 900123");
    await userEvent.click(screen.getByRole("radio", { name: /A follow-up/ }));
    expect(screen.getByLabelText("Date of birth")).toHaveAccessibleDescription("46 years old");
    await userEvent.click(screen.getByRole("button", { name: "Book appointment" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/book/confirmed"), { timeout: 2000 });
    const stored = window.sessionStorage.getItem(STORAGE_KEY)!;
    expect(stored).toContain("HSP-");
    expect(stored).not.toContain("Ann Lee");
  });

  it("returns to the schedule with a message when the time is gone", async () => {
    const open = await setupHeld();
    await userEvent.type(screen.getByLabelText("Full name"), "Ann Lee");
    await userEvent.type(screen.getByLabelText("Date of birth"), "1980-03-14");
    await userEvent.type(screen.getByLabelText("Mobile number"), "07700 900123");
    await userEvent.click(screen.getByRole("radio", { name: /A follow-up/ }));
    // The clock moves past the appointment while the form is open.
    act(() => setNow(Date.UTC(2026, 11, 1, 12, 0)));
    await userEvent.click(screen.getByRole("button", { name: "Book appointment" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/doctors/cho?week=${"2026-10-26"}`), { timeout: 2000 });
    const stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY)!);
    expect(stored.held).toBeNull();
    expect(stored.flash).toMatchObject({ doctorId: open.doctorId });
  });

  it("sends a signed-out patient to sign in instead of booking", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    await setupHeld();
    await userEvent.type(screen.getByLabelText("Full name"), "Ann Lee");
    await userEvent.type(screen.getByLabelText("Date of birth"), "1980-03-14");
    await userEvent.type(screen.getByLabelText("Mobile number"), "07700 900123");
    await userEvent.click(screen.getByRole("radio", { name: /A follow-up/ }));
    await userEvent.click(screen.getByRole("button", { name: "Book appointment" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/sign-in?next=%2Fbook%2Fdetails"), { timeout: 2000 });
  });
});

describe("SignInPanel", () => {
  it("switches between patient and staff sign-in", async () => {
    renderWithProviders(<SignInPanel nextPath="/" initialRole="patient" doctors={doctors} />);
    expect(screen.getByRole("tab", { name: "I’m a patient" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sample patient, Ann Lee/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "I work here" }));
    expect(await screen.findByRole("heading", { name: "Clinic staff" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in as Dr Helen Cho" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in as Halden Street desk" })).toBeInTheDocument();
  });

  it("keeps the email after a wrong password and says what went wrong", async () => {
    renderWithProviders(<SignInPanel nextPath="/" initialRole="patient" doctors={doctors} />);
    await userEvent.type(screen.getByLabelText("Email"), "ann.lee@halden.example");
    await userEvent.type(screen.getByLabelText("Password"), "not-the-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent("don’t match");
    expect(screen.getByLabelText("Email")).toHaveValue("ann.lee@halden.example");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveFocus();
  });

  it("can show the password", async () => {
    renderWithProviders(<SignInPanel nextPath="/" initialRole="patient" doctors={doctors} />);
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
  });

  it("shows the held time when signing in to book", async () => {
    const open = (await getUpcoming())["cho"]![0]!;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ held: open, booking: null, flash: null }));
    renderWithProviders(<SignInPanel nextPath="/book/details" initialRole="patient" doctors={doctors} />);
    expect(await screen.findByText("We’re holding your time")).toBeInTheDocument();
    expect(screen.getByText(/Dr Cho, .*Sign in to finish booking/)).toBeInTheDocument();
  });
});

describe("RegisterForm", () => {
  it("keeps everything typed when one field is wrong", async () => {
    renderWithProviders(<RegisterForm nextPath="/appointments" />);
    await userEvent.type(screen.getByLabelText("Full name"), "Sam Patel");
    await userEvent.type(screen.getByLabelText("Email"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "long-enough-pw");
    await userEvent.type(screen.getByLabelText("Date of birth"), "1990-05-01");
    await userEvent.type(screen.getByLabelText("Mobile number"), "12345");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent("There’s 1 thing to fix.");
    expect(screen.getByLabelText("Mobile number")).toHaveAccessibleDescription(/UK mobile/);
    expect(screen.getByLabelText("Mobile number")).toHaveFocus();
    expect(screen.getByLabelText("Full name")).toHaveValue("Sam Patel");
    expect(screen.getByLabelText("Email")).toHaveValue("sam@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("long-enough-pw");
    expect(screen.getByLabelText("Date of birth")).toHaveValue("1990-05-01");
  });
});
