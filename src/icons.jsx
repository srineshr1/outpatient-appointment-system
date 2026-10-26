const stroke = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  "aria-hidden": true,
};

function Glyph({ className, children }) {
  return (
    <svg {...stroke} className={className}>
      {children}
    </svg>
  );
}

export function IconPrev() {
  return (
    <Glyph>
      <path d="M10 3 L5 8 L10 13" stroke="currentColor" strokeWidth="1.5" />
    </Glyph>
  );
}

export function IconNext() {
  return (
    <Glyph>
      <path d="M6 3 L11 8 L6 13" stroke="currentColor" strokeWidth="1.5" />
    </Glyph>
  );
}

export function IconCheck({ className }) {
  return (
    <Glyph className={className}>
      <path d="M3.5 8.25 L6.5 11.25 L12.5 4.75" stroke="currentColor" strokeWidth="1.5" />
    </Glyph>
  );
}

export function IconCalendar() {
  return (
    <Glyph>
      <rect x="2.25" y="3.25" width="11.5" height="10.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.25 6.75 H13.75 M5 1.75 V4.25 M11 1.75 V4.25" stroke="currentColor" strokeWidth="1.5" />
    </Glyph>
  );
}
