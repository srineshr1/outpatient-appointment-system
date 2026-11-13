import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MorphSurface } from "./morph-surface";
import MorphSurfaceDemo from "./morph-surface-demo";

describe("MorphSurface", () => {
  it("renders collapsed dock by default with dockLabel and triggerLabel", () => {
    render(
      <MorphSurface
        dockLabel="Clinic assistant"
        triggerLabel="Ask"
        placeholder="Type a message..."
      />,
    );

    expect(screen.getByText("Clinic assistant")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeInTheDocument();
  });

  it("calls onDockClick when dock button is clicked", () => {
    const handleDockClick = vi.fn();
    render(
      <MorphSurface
        dockLabel="Clinic assistant"
        triggerLabel="Ask"
        triggerAriaLabel="Ask the clinic assistant"
        onDockClick={handleDockClick}
      />,
    );

    const dockBtn = screen.getByRole("button", { name: "Ask the clinic assistant" });
    fireEvent.click(dockBtn);
    expect(handleDockClick).toHaveBeenCalledTimes(1);
  });

  it("expands surface and allows submitting a message", async () => {
    const handleSubmit = vi.fn();
    render(
      <MorphSurface
        dockLabel="Clinic assistant"
        triggerLabel="Ask"
        placeholder="How can we help?"
        onSubmit={handleSubmit}
      />,
    );

    // Click trigger to expand
    const triggerBtn = screen.getByRole("button", { name: "Ask" });
    fireEvent.click(triggerBtn);

    const textarea = screen.getByLabelText("Message");
    expect(textarea).toBeInTheDocument();

    await userEvent.type(textarea, "What times are free tomorrow?");
    const submitBtn = screen.getByRole("button", { name: "Enter" });
    fireEvent.click(submitBtn);

    await waitFor(() => expect(handleSubmit).toHaveBeenCalledTimes(1));
    const formData = handleSubmit.mock.calls[0]![0] as FormData;
    expect(formData.get("message")).toBe("What times are free tomorrow?");
  });

  it("calls onExpand when Full chat button is clicked", () => {
    const handleExpand = vi.fn();
    render(
      <MorphSurface
        dockLabel="Clinic assistant"
        triggerLabel="Ask"
        onExpand={handleExpand}
      />,
    );

    // Expand surface
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    const fullChatBtn = screen.getByRole("button", { name: /Full chat/i });
    fireEvent.click(fullChatBtn);
    expect(handleExpand).toHaveBeenCalledTimes(1);
  });

  it("supports controlled state via isOpen and onOpenChange", () => {
    const handleOpenChange = vi.fn();
    const { rerender } = render(
      <MorphSurface
        isOpen={false}
        onOpenChange={handleOpenChange}
        triggerLabel="Controlled"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Controlled" }));
    expect(handleOpenChange).toHaveBeenCalledWith(true);

    rerender(
      <MorphSurface
        isOpen={true}
        onOpenChange={handleOpenChange}
        triggerLabel="Controlled"
      />,
    );

    expect(screen.getByLabelText("Message")).toBeInTheDocument();
  });

  it("MorphSurfaceDemo renders all example sections", () => {
    render(<MorphSurfaceDemo />);
    expect(screen.getByRole("heading", { name: "Default Usage" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Custom Labels & Content" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Custom Dimensions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Custom Trigger Icon" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Controlled State" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Custom Animation Speed" })).toBeInTheDocument();
  });
});
