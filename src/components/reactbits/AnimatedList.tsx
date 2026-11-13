'use client';

import { motion, useReducedMotion } from 'motion/react';
import { type ReactNode } from 'react';

export interface AnimatedListProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
}

export interface AnimatedListItemProps {
  children: ReactNode;
  index?: number;
  className?: string;
  selected?: boolean;
  stagger?: number;
}

export function AnimatedList({ children, className = '' }: AnimatedListProps) {
  return <ul className={`grid w-full min-w-0 gap-3 ${className}`.trim()}>{children}</ul>;
}

export function AnimatedListItem({
  children,
  index = 0,
  className = '',
  selected = false,
  stagger = 0.035,
}: AnimatedListItemProps) {
  const reduce = useReducedMotion();
  const delay = reduce ? 0 : Math.min(index, 12) * stagger;

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] }}
      data-selected={selected ? 'true' : undefined}
      className={`min-w-0 w-full ${className}`.trim()}
    >
      {children}
    </motion.li>
  );
}

export default AnimatedList;
