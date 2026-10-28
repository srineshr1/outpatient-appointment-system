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
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/book"));
  });

  it("summarises errors and focuses the first problem", async () => {
    await setupHeld();
    await userEvent.click(screen.getByRole("button", { name: "Book appointment" }));
    expect(screen.getByRole("alert", { name: /There are 4 things to fix/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveFocus();
    expect(screen.getByLabelText("Mobile number")).toHaveAccessibleDescription("Enter a mobile number.");
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
  it("asks for an email, then turns the box into four code boxes", async () => {
    renderWithProviders(<SignInPanel nextPath="/" mode="patient" doctors={doctors} />);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome to Westbrook" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in with Google" })).toHaveAttribute("href", "/auth/google");
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter your email address.");

    await userEvent.type(screen.getByLabelText("Email"), "Sam.Patel@Example.com");
    await userEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    const first = await screen.findByLabelText("Digit 1 of 4", {}, { timeout: 3000 });
    expect(screen.getByText(/Code sent to/)).toHaveTextContent("sam.patel@example.com");
    expect(screen.queryByRole("link", { name: "Sign in with Google" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("textbox", { name: /Digit \d of 4/ })).toHaveLength(4);
    await waitFor(() => expect(first).toHaveFocus());
    expect(screen.getByText(/Demo code/)).toHaveTextContent(/\d{4}/);
  });

  it("says when the code is wrong, then signs a new patient up with their name", async () => {
    renderWithProviders(<SignInPanel nextPath="/book" mode="patient" doctors={doctors} />);
    await userEvent.type(screen.getByLabelText("Email"), `new.${Date.now()}@example.com`);
    await userEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    const demo = await screen.findByText(/Demo code/, {}, { timeout: 3000 });
    const code = demo.textContent!.match(/\d{4}/)![0];
    const wrong = code === "0000" ? "1111" : "0000";

    await waitFor(() => expect(screen.getByLabelText("Digit 1 of 4")).toHaveFocus());
    await userEvent.keyboard(wrong);
    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent("That code isn’t right. 4 tries left.");
    expect(screen.getByLabelText("Digit 4 of 4")).toHaveValue("");
    await waitFor(() => expect(screen.getByLabelText("Digit 1 of 4")).toHaveFocus());

    // Pasting the whole code into the first box works too.
    await userEvent.click(screen.getByLabelText("Digit 1 of 4"));
    await userEvent.paste(code);
    expect(await screen.findByRole("heading", { name: "One last thing" }, { timeout: 3000 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter your full name.");
  });

  it("can go back and use a different email", async () => {
    renderWithProviders(<SignInPanel nextPath="/" mode="patient" doctors={doctors} />);
    await userEvent.type(screen.getByLabelText("Email"), "back.test@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    await screen.findByLabelText("Digit 1 of 4", {}, { timeout: 3000 });
    expect(screen.getByText(/Send again in \d+s/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(await screen.findByLabelText("Email")).toHaveValue("back.test@example.com");
  });

  it("staff sign-in only accepts staff emails and links back to patients", async () => {
    renderWithProviders(<SignInPanel nextPath="/" mode="staff" doctors={doctors} />);
    expect(screen.getByText("Clinic staff sign-in")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in with Google" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Patient sign-in" })).toHaveAttribute("href", "/sign-in");
    await userEvent.type(screen.getByLabelText("Practice email"), "ann.lee@halden.example");
    await userEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent("isn’t a staff account");
  });

  it("links patients to doctor sign-in, keeping where they were going", () => {
    renderWithProviders(<SignInPanel nextPath="/book/details" mode="patient" doctors={doctors} />);
    expect(screen.getByRole("link", { name: "Sign in as a doctor" })).toHaveAttribute(
      "href",
      "/sign-in?as=staff&next=%2Fbook%2Fdetails",
    );
  });

  it("shows the held time when signing in to book", async () => {
    const open = (await getUpcoming())["cho"]![0]!;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ held: open, booking: null, flash: null }));
    renderWithProviders(<SignInPanel nextPath="/book/details" mode="patient" doctors={doctors} />);
    expect(await screen.findByText("Holding your time")).toBeInTheDocument();
  });
});
