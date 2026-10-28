"use client";

import Link from "next/link";
import { motion, type HTMLMotionProps } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { spring } from "@/lib/motion";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button-styles";

export { buttonClass, type ButtonSize, type ButtonVariant };

type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel,
  className = "",
  type = "button",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const inactive = Boolean(disabled) || loading;
  return (
    <motion.button
      type={type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      whileTap={inactive ? undefined : { scale: 0.97 }}
      transition={spring.press}
      className={buttonClass(variant, size, className)}
      {...props}
      onClick={loading ? (event) => event.preventDefault() : props.onClick}
    >
      {loading ? <Spinner /> : null}
      {loading && loadingLabel ? loadingLabel : children}
    </motion.button>
  );
}

const MotionLink = motion.create(Link);

type ButtonLinkProps = Omit<ComponentProps<typeof MotionLink>, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function ButtonLink({ variant = "primary", size = "md", className = "", children, ...props }: ButtonLinkProps) {
  return (
    <MotionLink
      whileTap={{ scale: 0.97 }}
      transition={spring.press}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {children}
    </MotionLink>
  );
}
