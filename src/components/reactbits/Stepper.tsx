'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Children, isValidElement, useState, type ReactNode } from 'react';
import { Check } from '@/components/icons';

export interface StepItem {
  id: string;
  title: string;
  subtitle?: string;
  done?: boolean;
}

export interface StepperProps {
  steps?: StepItem[];
  activeStep?: number;
  defaultStep?: number;
  onStepChange?: (stepIndex: number) => void;
  children?: ReactNode;
  className?: string;
  allowClickAhead?: boolean;
}

export function Step({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function Stepper({
  steps,
  activeStep,
  defaultStep = 0,
  onStepChange,
  children,
  className = '',
  allowClickAhead = true,
}: StepperProps) {
  const [internalStep, setInternalStep] = useState(defaultStep);
  const current = activeStep !== undefined ? activeStep : internalStep;
  const reduce = useReducedMotion();

  const childArray = Children.toArray(children).filter(isValidElement);
  const stepCount = steps ? steps.length : childArray.length;

  const selectStep = (next: number) => {
    if (next < 0 || next >= stepCount) return;
    if (!allowClickAhead && next > current && !steps?.[next - 1]?.done) return;
    if (activeStep === undefined) setInternalStep(next);
    onStepChange?.(next);
  };

  return (
    <div className={`w-full ${className}`}>
      {steps && steps.length > 0 ? (
        <ol className="flex flex-wrap items-center gap-2 sm:gap-3" aria-label="Steps">
          {steps.map((step, index) => {
            const isActive = index === current;
            const isComplete = Boolean(step.done) || index < current;
            return (
              <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => selectStep(index)}
                  aria-current={isActive ? 'step' : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'border-accent bg-accent-soft text-ink shadow-card'
                      : isComplete
                        ? 'border-success/40 bg-success-soft/60 text-ink hover:bg-success-soft'
                        : 'border-hairline bg-surface-2 text-ink-2 hover:bg-fill'
                  }`}
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-caption font-bold tabular transition-colors ${
                      isActive
                        ? 'bg-accent text-accent-ink'
                        : isComplete
                          ? 'bg-success text-white'
                          : 'bg-fill-strong text-ink-2'
                    }`}
                  >
                    {isComplete && !isActive ? <Check size={14} /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-callout font-semibold text-ink">{step.title}</span>
                    {step.subtitle ? (
                      <span className="block truncate text-caption text-muted">{step.subtitle}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}

      {childArray.length > 0 ? (
        <div className="mt-4 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current}
              initial={reduce ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {childArray[current] ?? null}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  );
}

export default Stepper;
