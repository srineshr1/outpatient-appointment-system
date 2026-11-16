import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownText, safeHref } from "./MarkdownText";

const dockCss = readFileSync(join(process.cwd(), "src/components/assistant/AssistantDock.css"), "utf8");

describe("MarkdownText", () => {
  it("renders bold text", () => {
    render(<MarkdownText text="See **Dr Anjali Mehta** today." />);
    const name = screen.getByText("Dr Anjali Mehta");
    expect(name.tagName).toBe("STRONG");
    expect(screen.queryByText(/\*\*/)).toBeNull();
  });

  it("renders asterisk, dash and bullet lists", () => {
    const { rerender, container } = render(
      <MarkdownText text={"* **Dr Anjali Mehta** (General Physician)\n* **Dr Doom** (Magic)"} />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(container.querySelector("ul")).not.toBeNull();
    expect(items[0]?.querySelector("strong")?.textContent).toBe("Dr Anjali Mehta");
    expect(items[1]?.querySelector("strong")?.textContent).toBe("Dr Doom");
    expect(items[0]?.textContent).toBe("Dr Anjali Mehta (General Physician)");
    expect(screen.queryByText(/^\*/)).toBeNull();

    rerender(<MarkdownText text={"- First\n- Second"} />);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["First", "Second"]);

    rerender(<MarkdownText text={"• One\n• Two"} />);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["One", "Two"]);
  });

  it("renders numbered lists, including a start other than 1", () => {
    const { container } = render(<MarkdownText text={"1. Book\n2. Confirm\n3. Visit"} />);
    const list = container.querySelector("ol");
    expect(list).not.toBeNull();
    expect(list?.getAttribute("start")).toBe("1");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Book", "Confirm", "Visit"]);

    const { container: started } = render(<MarkdownText text={"3. Third"} />);
    expect(started.querySelector("ol")?.getAttribute("start")).toBe("3");
  });

  it("keeps line breaks and separate paragraphs", () => {
    const { container } = render(<MarkdownText text={"Hello\nthere\n\nNext para"} />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.querySelector("br")).not.toBeNull();
    expect(paragraphs[0]?.textContent).toBe("Hellothere");
    expect(paragraphs[1]?.textContent).toBe("Next para");
  });

  it("renders italic, inline code and safe links", () => {
    render(
      <MarkdownText text={"A *short* visit, _please_, code `HSP-100000`, and [the site](https://example.com/clinic)."} />,
    );
    expect(screen.getByText("short").tagName).toBe("EM");
    expect(screen.getByText("please").tagName).toBe("EM");
    expect(screen.getByText("HSP-100000").tagName).toBe("CODE");
    const link = screen.getByRole("link", { name: "the site" });
    expect(link).toHaveAttribute("href", "https://example.com/clinic");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not treat snake_case names as italic", () => {
    render(<MarkdownText text="patient_chi_number stays plain." />);
    expect(screen.getByText("patient_chi_number stays plain.")).toBeTruthy();
    expect(document.querySelector("em")).toBeNull();
  });

  it("does not inject HTML from the source text", () => {
    const { container } = render(
      <MarkdownText text={'<script>alert("xss")</script> and <img src=x onerror=alert(1)> and <b>bold</b>'} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain('<script>alert("xss")</script>');
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(container.textContent).toContain("<b>bold</b>");
  });

  it("does not follow javascript or other unsafe links", () => {
    const { container } = render(
      <MarkdownText text={"[click](javascript:alert(1)) then [data](data:text/html;base64,aaaa) then [ok](https://clinic.example)"} />,
    );
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "https://clinic.example/");
    expect(container.textContent).toContain("click");
    expect(container.textContent).toContain("data");
    expect(container.querySelector("a[href^='javascript']")).toBeNull();
  });
});

describe("safeHref", () => {
  it("allows only absolute http(s) URLs", () => {
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("http://example.com")).toBe("http://example.com/");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,hi")).toBeNull();
    expect(safeHref("/relative")).toBeNull();
    expect(safeHref("https://example.com/a b")).toBeNull();
  });
});

describe("assistant markdown styles", () => {
  it("styles lists compactly in the dock typeface for light and dark", () => {
    expect(dockCss).toMatch(/\.clinic-md ul/);
    expect(dockCss).toMatch(/\.clinic-md ol/);
    expect(dockCss).toMatch(/padding-inline-start:/);
    expect(dockCss).toMatch(/var\(--color-accent\)/);
    expect(dockCss).toMatch(/var\(--color-fill\)/);
  });
});
