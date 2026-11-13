"use client";

import type { ComponentProps } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import {
  SpotlightCard as ReactBitsSpotlightCard,
  type SpotlightCardProps as ReactBitsSpotlightCardProps,
} from "@/components/reactbits/SpotlightCard";

interface SpotlightCardProps extends ComponentProps<"div"> {
  spotlightColor?: string;
  glowColor?: string;
  intensity?: number;
  borderGlow?: number;
  proximity?: number;
  as?: "div" | "li" | "article" | "section";
}

export function SpotlightCard({
  className = "",
  spotlightColor,
  glowColor: _glowColor,
  intensity = 0.04,
  borderGlow = 0.14,
  proximity = 0,
  as = "div",
  style,
  ...props
}: SpotlightCardProps) {
  const { theme } = useTheme();
  const rbProps = props as Omit<
    ReactBitsSpotlightCardProps,
    "as" | "theme" | "spotlightColor" | "intensity" | "borderGlow" | "proximity" | "className" | "style"
  >;
  return (
    <ReactBitsSpotlightCard
      as={as}
      theme={theme}
      spotlightColor={spotlightColor}
      intensity={intensity}
      borderGlow={borderGlow}
      proximity={proximity}
      flare={false}
      smoothing={0.25}
      className={`rounded-sheet border border-hairline bg-surface shadow-card ${className}`.trim()}
      style={{
        ["--spotlight-card-surface" as string]: "var(--v-surface)",
        ["--spotlight-card-border" as string]: "var(--v-hairline)",
        ["--spotlight-card-shadow" as string]: "var(--v-shadow-card)",
        ...style,
      }}
      {...rbProps}
    />
  );
}
