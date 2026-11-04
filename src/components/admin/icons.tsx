import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const GridIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Icon>
);

export const CalendarIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icon>
);

export const PoundIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M17 6.5A4 4 0 0 0 9.5 8v4.5c0 3-1 5.5-3 7h11.5M6.5 12.5h8" />
  </Icon>
);

export const PeopleIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
    <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.3a5.5 5.5 0 0 1 3 5.2" />
  </Icon>
);

export const ActivityIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 12h4l2.5-6 4 12 2.5-6h4" />
  </Icon>
);

export const ShieldIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.5 19 6v5.5c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

export const MenuIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
  </Icon>
);

export const PrintIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 9V4h10v5M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2" />
    <path d="M7 14h10v6H7z" />
  </Icon>
);

export const UserPlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="10" cy="8.5" r="3.5" />
    <path d="M3.5 19.5a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" />
  </Icon>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12h14m-5-5 5 5-5 5" />
  </Icon>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);

export const AlertIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4 21 19.5H3z" />
    <path d="M12 10v4" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" />
  </Icon>
);

export const BookIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 4.5h10.5A3.5 3.5 0 0 1 19 8v11.5H8.5A3.5 3.5 0 0 1 5 16z" />
    <path d="M5 16a3.5 3.5 0 0 1 3.5-3.5H19" />
  </Icon>
);

export const ExternalIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </Icon>
);

export const CheckCircleIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.2 2.4 2.4 4.6-5" />
  </Icon>
);
