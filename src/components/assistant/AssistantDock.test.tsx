import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantDock } from "./AssistantDock";

const doctor = { name: "Dr Doom", role: "doctor" as const };

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AssistantDock", () => {
  it("sends the draft when Enter is pressed, but not when Shift+Enter is pressed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "You have two sessions today." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AssistantDock user={doctor} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask the clinic assistant" }));
    const box = screen.getByLabelText("Message");
    fireEvent.change(box, { target: { value: "How many sessions today?" } });

    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/assistant");
    const body = JSON.parse((init as { body: string }).body) as {
      messages: { role: string; content: string }[];
    };
    expect(body.messages[0]).toEqual({ role: "user", content: "How many sessions today?" });
  });
});
