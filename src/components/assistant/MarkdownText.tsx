import type { ReactNode } from "react";

/**
 * Renders a tight subset of markdown as React elements: bold, italic, inline
 * code, safe links, bullet lists, numbered lists and line breaks. HTML in the
 * source is shown as text, never parsed. Only http(s) links are made clickable.
 */
export function MarkdownText({ text }: { text: string }) {
  return <div className="clinic-md">{renderBlocks(text)}</div>;
}

function renderBlocks(text: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] | null = null;
  let numbered: { start: number; items: string[] } | null = null;
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={key++}>
        {paragraph.map((line, index) => (
          <span key={index}>
            {index > 0 ? <br /> : null}
            {renderInline(line)}
          </span>
        ))}
      </p>,
    );
    paragraph = [];
  };

  const flushBullets = () => {
    if (!bullets) return;
    blocks.push(
      <ul key={key++}>
        {bullets.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    bullets = null;
  };

  const flushNumbered = () => {
    if (!numbered) return;
    blocks.push(
      <ol key={key++} start={numbered.start}>
        {numbered.items.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ol>,
    );
    numbered = null;
  };

  const flushLists = () => {
    flushBullets();
    flushNumbered();
  };

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const bullet = raw.match(/^\s*([*\-•])\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      flushNumbered();
      if (!bullets) bullets = [];
      bullets.push(bullet[2] ?? "");
      continue;
    }

    const ordered = raw.match(/^\s*(\d+)\.\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      flushBullets();
      const n = Number(ordered[1]);
      const item = ordered[2] ?? "";
      if (!numbered) numbered = { start: n, items: [item] };
      else numbered.items.push(item);
      continue;
    }

    if (raw.trim() === "") {
      flushParagraph();
      flushLists();
      continue;
    }

    flushLists();
    paragraph.push(raw);
  }

  flushParagraph();
  flushLists();
  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let buffer = "";
  let i = 0;
  let key = 0;

  const flush = () => {
    if (buffer) {
      nodes.push(buffer);
      buffer = "";
    }
  };

  while (i < text.length) {
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        nodes.push(<code key={key++}>{text.slice(i + 1, end)}</code>);
        i = end + 1;
        continue;
      }
    }

    if (text[i] === "[") {
      const link = text.slice(i).match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (link) {
        const href = safeHref(link[2] ?? "");
        flush();
        if (href) {
          nodes.push(
            <a key={key++} href={href} target="_blank" rel="noopener noreferrer">
              {renderInline(link[1] ?? "")}
            </a>,
          );
        } else {
          nodes.push(<span key={key++}>{renderInline(link[1] ?? "")}</span>);
        }
        i += link[0].length;
        continue;
      }
    }

    if (text.startsWith("**", i)) {
      const end = findClosing(text, i + 2, "**");
      if (end > i + 2) {
        flush();
        nodes.push(<strong key={key++}>{renderInline(text.slice(i + 2, end))}</strong>);
        i = end + 2;
        continue;
      }
    }

    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = findClosing(text, i + 1, "*");
      if (end > i + 1) {
        flush();
        nodes.push(<em key={key++}>{renderInline(text.slice(i + 1, end))}</em>);
        i = end + 1;
        continue;
      }
    }

    if (text[i] === "_" && !isWordChar(text[i - 1])) {
      const end = findUnderscoreClose(text, i + 1);
      if (end > i + 1) {
        flush();
        nodes.push(<em key={key++}>{renderInline(text.slice(i + 1, end))}</em>);
        i = end + 1;
        continue;
      }
    }

    buffer += text[i];
    i += 1;
  }

  flush();
  return nodes;
}

function findClosing(text: string, from: number, delimiter: string): number {
  let i = from;
  while (i < text.length) {
    if (delimiter === "*" && text.startsWith("**", i)) {
      i += 2;
      continue;
    }
    if (text.startsWith(delimiter, i)) return i;
    i += 1;
  }
  return -1;
}

function findUnderscoreClose(text: string, from: number): number {
  let i = from;
  while (i < text.length) {
    if (text[i] === "_" && !isWordChar(text[i + 1])) return i;
    i += 1;
  }
  return -1;
}

function isWordChar(char: string | undefined): boolean {
  return char != null && /[A-Za-z0-9]/.test(char);
}

/** Only absolute http(s) URLs are safe to follow from model-written text. */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href || /[\s<>"'`]/.test(href)) return null;
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}
