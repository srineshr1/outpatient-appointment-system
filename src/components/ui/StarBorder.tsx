import type { ElementType, ReactNode } from "react";

interface StarBorderProps {
  as?: ElementType;
  className?: string;
  color?: string;
  trailColor?: string;
  children: ReactNode;
  href?: string;
}

export function StarBorder({ as: Component = "div", className = "", children, ...rest }: StarBorderProps) {
  return (
    <Component className={`inline-flex ${className}`.trim()} {...rest}>
      {children}
    </Component>
  );
}
