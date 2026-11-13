import type { ComponentProps, ReactNode } from "react";

interface AuroraBackgroundProps extends ComponentProps<"div"> {
  children?: ReactNode;
  className?: string;
}

export function AuroraBackground({ children, className = "", ...props }: AuroraBackgroundProps) {
  return (
    <div className={`relative bg-canvas text-ink ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
