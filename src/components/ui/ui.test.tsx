import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Field } from "./Field";

describe("Field", () => {
  it("links the hint, and swaps it for the error", () => {
    const { rerender } = render(
      <Field id="name" label="Full name" hint="As on your record.">
        {(props) => <input id={props.id} aria-describedby={props.describedBy} aria-invalid={props.invalid} />}
      </Field>,
    );
    const input = screen.getByLabelText("Full name");
    expect(input).toHaveAccessibleDescription("As on your record.");

    rerender(
      <Field id="name" label="Full name" hint="As on your record." error="Enter a name.">
        {(props) => <input id={props.id} aria-describedby={props.describedBy} aria-invalid={props.invalid} />}
      </Field>,
    );
    expect(screen.getByLabelText("Full name")).toHaveAccessibleDescription("Enter a name.");
    expect(screen.getByLabelText("Full name")).toHaveAttribute("aria-invalid", "true");
  });

  it("marks optional fields in the label", () => {
    render(
      <Field id="chi" label="CHI number" optional>
        {(props) => <input id={props.id} />}
      </Field>,
    );
    expect(screen.getByLabelText("CHI number (optional)")).toBeInTheDocument();
  });
});

describe("Button", () => {
  it("does not fire while loading, and says why", async () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Booking…" onClick={onClick}>
        Book
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Booking…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("respects disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Book
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Book" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
