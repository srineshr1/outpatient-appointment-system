import type { Doctor, HairStyle } from "@/lib/data";

interface Props {
  doctor: Pick<Doctor, "name" | "portrait">;
  /** Rendered size in CSS pixels. */
  size?: number;
  className?: string;
  /** Give the image an accessible name. Leave off when the name is already next to it. */
  labelled?: boolean;
  /** Square with rounded corners instead of a circle. */
  shape?: "circle" | "rounded";
}

/** Hair drawn behind the head (long hair, curls, bun). */
function HairBack({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case "curly":
      return (
        <g fill={color}>
          <circle cx="60" cy="44" r="27" />
          <circle cx="38" cy="50" r="12" />
          <circle cx="82" cy="50" r="12" />
          <circle cx="44" cy="28" r="12" />
          <circle cx="76" cy="28" r="12" />
          <circle cx="60" cy="20" r="13" />
        </g>
      );
    case "bob":
      return <path fill={color} d="M35 54C33 29 46 21 60 21s27 8 25 33l2 22c-6 3-12 1-15-3H48c-3 4-9 6-15 3Z" />;
    case "long":
      return <path fill={color} d="M35 50C33 28 46 21 60 21s27 7 25 29l6 47c-10 5-20 1-24-6H53c-4 7-14 11-24 6Z" />;
    case "bun":
      return <circle cx="60" cy="19" r="10" fill={color} />;
    default:
      return null;
  }
}

/** Hair drawn over the forehead. */
function HairFront({ style, color }: { style: HairStyle; color: string }) {
  if (style === "bob" || style === "long") {
    return <path fill={color} d="M38 49c1-16 11-22 22-22s21 6 22 22c-8-8-17-11-29-10-6 1-11 4-15 10Z" />;
  }
  return <path fill={color} d="M38 50C37 32 48 25 60 25s23 7 22 25c-4-9-11-13-22-13s-18 4-22 13Z" />;
}

/**
 * An illustrated doctor portrait. Pure SVG, so it is crisp at any size,
 * needs no network request and works under the strict image CSP.
 */
export function DoctorPortrait({ doctor, size = 56, className = "", labelled = false, shape = "circle" }: Props) {
  const { portrait: p } = doctor;

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`shrink-0 overflow-hidden ${shape === "circle" ? "rounded-full" : "rounded-[28%]"} ${className}`}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? `Portrait of ${doctor.name}` : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      <g>
        <rect width="120" height="120" fill={p.background} />
        <circle cx="96" cy="22" r="26" fill="#ffffff" opacity="0.35" />

        <HairBack style={p.hairStyle} color={p.hair} />

        {/* Coat, shirt and stethoscope */}
        <path d="M14 124c0-24 20-38 46-38s46 14 46 38Z" fill="#ffffff" />
        <path d="M49 87 60 104 71 87Z" fill={p.shirt} />
        <path d="M45 89 57 118M75 89 63 118" stroke="#d8dbe2" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M44 92c-3 14 4 22 9 24m23-24c3 14-4 22-9 24"
          fill="none"
          stroke="#4b5563"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle cx="60" cy="117" r="4.5" fill="#9ca3af" stroke="#4b5563" strokeWidth="2" />

        {/* Neck, ears, head */}
        <rect x="52" y="68" width="16" height="20" rx="7" fill={p.skin} />
        <path d="M52 82c5 4 11 4 16 0v6H52Z" fill="#000000" opacity="0.08" />
        <ellipse cx="39" cy="55" rx="4.5" ry="6.5" fill={p.skin} />
        <ellipse cx="81" cy="55" rx="4.5" ry="6.5" fill={p.skin} />
        <ellipse cx="60" cy="52" rx="21" ry="24" fill={p.skin} />

        {/* Cheeks, eyes, smile */}
        <circle cx="47" cy="62" r="4.5" fill="#f2725f" opacity="0.22" />
        <circle cx="73" cy="62" r="4.5" fill="#f2725f" opacity="0.22" />
        <circle cx="51.5" cy="54" r="2.6" fill="#1f2328" />
        <circle cx="68.5" cy="54" r="2.6" fill="#1f2328" />
        <circle cx="52.4" cy="53.1" r="0.8" fill="#ffffff" />
        <circle cx="69.4" cy="53.1" r="0.8" fill="#ffffff" />
        <path d="M47.5 47.5q4-2.5 8 0M64.5 47.5q4-2.5 8 0" fill="none" stroke={p.hair} strokeWidth="2" strokeLinecap="round" />

        {p.beard ? (
          <path d="M40 56c1 18 10 25 20 25s19-7 20-25c-4 8-9 11-20 11s-16-3-20-11Z" fill={p.beard} />
        ) : null}
        <path d="M53.5 65q6.5 5.5 13 0" fill="none" stroke="#7c3b2f" strokeWidth="2.4" strokeLinecap="round" />

        {p.glasses ? (
          <g fill="none" stroke="#1f2328" strokeWidth="1.8">
            <rect x="43.5" y="48" width="15" height="12" rx="5" />
            <rect x="61.5" y="48" width="15" height="12" rx="5" />
            <path d="M58.5 53h3M43.5 53l-4-1M76.5 53l4-1" />
          </g>
        ) : null}

        <HairFront style={p.hairStyle} color={p.hair} />
      </g>
    </svg>
  );
}
