"use client";

import Link from "next/link";
import { motion, type HTMLMotionProps } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { Magnet } from "@/components/reactbits/Magnet";
import { Spinner } from "@/components/ui/Spinner";
import { spring } from "@/lib/motion";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button-styles";

export { buttonClass, type ButtonSize, type ButtonVariant };

function MagneticWrap({
  enabled,
  fullWidth,
  disabled,
  children,
}: {
  enabled: boolean;
  fullWidth: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  if (!enabled) return children;
  return (
    <Magnet
      padding={24}
      magnetStrength={2}
      maxOffset={4}
      disabled={disabled}
      wrapperClassName={fullWidth ? "w-full" : undefined}
      innerClassName={fullWidth ? "w-full" : undefined}
    >
      {children}
    </Magnet>
  );
}

type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  magnetic?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel,
  magnetic = false,
  className = "",
  type = "button",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const inactive = Boolean(disabled) || loading;
  const fullWidth = className.split(/\s+/).includes("w-full");
  return (
    <MagneticWrap enabled={magnetic} fullWidth={fullWidth} disabled={inactive}>
      <motion.button
        type={type}
        disabled={disabled}
        aria-disabled={loading || undefined}
        aria-busy={loading || undefined}
        whileTap={inactive ? undefined : { scale: 0.98 }}
        transition={spring.press}
        className={buttonClass(variant, size, className)}
        {...props}
        onClick={loading ? (event) => event.preventDefault() : props.onClick}
      >
        {loading ? <Spinner /> : null}
        {loading && loadingLabel ? loadingLabel : children}
      </motion.button>
    </MagneticWrap>
  );
}

const MotionLink = motion.create(Link);

type ButtonLinkProps = Omit<ComponentProps<typeof MotionLink>, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  magnetic?: boolean;
  children: ReactNode;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  magnetic = false,
  className = "",
  children,
  ...props
}: ButtonLinkProps) {
  const fullWidth = className.split(/\s+/).includes("w-full");
  return (
    <MagneticWrap enabled={magnetic} fullWidth={fullWidth}>
      <MotionLink
        whileTap={{ scale: 0.98 }}
        transition={spring.press}
        className={buttonClass(variant, size, className)}
        {...props}
      >
        {children}
      </MotionLink>
    </MagneticWrap>
  );
}
