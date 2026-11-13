import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GlideSelect from "./GlideSelect";

const css = readFileSync(join(process.cwd(), "src/components/assistant/GlideSelect.css"), "utf8");

const formats = [
  { value: "png", label: "PNG", tag: "Lossless" },
  { value: "jpg", label: "JPG", tag: "Smallest" },
  { value: "webp", label: "WebP", tag: "Modern" },
];

function chip() {
  return screen.getByRole("combobox", { name: "Export format" });
}

describe("GlideSelect", () => {
  it("shows the default value and opens a listbox from the keyboard", () => {
    render(<GlideSelect options={formats} defaultValue="png" ariaLabel="Export format" />);
    expect(chip()).toHaveTextContent("PNG");
    expect(chip()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.keyDown(chip(), { key: "Enter" });
    expect(chip()).toHaveAttribute("aria-expanded", "true");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Lossless")).toBeInTheDocument();
  });

  it("opens on a primary pointer press on the chip", () => {
    render(<GlideSelect options={formats} defaultValue="png" ariaLabel="Export format" />);
    fireEvent.pointerDown(chip(), { button: 0 });
    expect(screen.getByRole("listbox", { name: "Export format" })).toBeInTheDocument();
  });

  it("moves with the arrow keys and picks with Enter, calling onChange once", () => {
    const onChange = vi.fn();
    render(<GlideSelect options={formats} defaultValue="png" ariaLabel="Export format" onChange={onChange} />);
    fireEvent.keyDown(chip(), { key: "ArrowDown" });
    fireEvent.keyDown(chip(), { key: "ArrowDown" });
    fireEvent.keyDown(chip(), { key: "ArrowDown" });
    expect(chip()).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[2]!.id);
    fireEvent.keyDown(chip(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("webp", formats[2]);
    expect(chip()).toHaveTextContent("WebP");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not call onChange when the current value is picked again", () => {
    const onChange = vi.fn();
    render(<GlideSelect options={formats} defaultValue="png" ariaLabel="Export format" onChange={onChange} />);
    fireEvent.keyDown(chip(), { key: "Enter" });
    fireEvent.keyDown(chip(), { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("supports Home, End, typeahead and Escape", () => {
    const onChange = vi.fn();
    render(<GlideSelect options={formats} defaultValue="png" ariaLabel="Export format" onChange={onChange} />);
    fireEvent.keyDown(chip(), { key: "Enter" });
    const options = screen.getAllByRole("option");
    fireEvent.keyDown(chip(), { key: "End" });
    expect(chip()).toHaveAttribute("aria-activedescendant", options[2]!.id);
    fireEvent.keyDown(chip(), { key: "Home" });
    expect(chip()).toHaveAttribute("aria-activedescendant", options[0]!.id);
    fireEvent.keyDown(chip(), { key: "j" });
    expect(chip()).toHaveAttribute("aria-activedescendant", options[1]!.id);
    fireEvent.keyDown(chip(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stays controlled: the chip follows the value prop", () => {
    const onChange = vi.fn();
    const { rerender } = render(<GlideSelect options={formats} value="png" ariaLabel="Export format" onChange={onChange} />);
    fireEvent.keyDown(chip(), { key: "ArrowDown" });
    fireEvent.keyDown(chip(), { key: "ArrowDown" });
    fireEvent.keyDown(chip(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("jpg", formats[1]);
    expect(chip()).toHaveTextContent("PNG");
    rerender(<GlideSelect options={formats} value="jpg" ariaLabel="Export format" onChange={onChange} />);
    expect(chip()).toHaveTextContent("JPG");
  });

  it("shows the placeholder, and ignores input when disabled", () => {
    render(<GlideSelect options={formats} ariaLabel="Export format" placeholder="Pick one" disabled />);
    expect(chip()).toHaveTextContent("Pick one");
    expect(chip()).toBeDisabled();
    fireEvent.keyDown(chip(), { key: "Enter" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("passes colours and sizes through CSS variables", () => {
    render(<GlideSelect options={formats} ariaLabel="Export format" surfaceColor="var(--color-fill)" size="sm" radius={12} menuWidth={196} />);
    const root = chip().closest(".glide-select") as HTMLElement;
    expect(root.style.getPropertyValue("--gs-surface")).toBe("var(--color-fill)");
    expect(root.style.getPropertyValue("--gs-chip")).toBe("28px");
    expect(root.style.getPropertyValue("--gs-inner-radius")).toBe("8px");
    expect(root.style.getPropertyValue("--gs-menu-w")).toBe("196px");
  });

  it("ships the published CSS with its reduced-motion fallback", () => {
    expect(css).toContain("@keyframes gs-swap");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".glide-select__pill");
  });
});
