import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { Providers } from "@/components/providers/Providers";
import { setNow } from "@/lib/clock";

export { router } from "./router";

/** Monday 26 October 2026, 13:40 in Edinburgh (GMT). */
export const MONDAY_1340 = Date.UTC(2026, 9, 26, 13, 40);

export function renderWithProviders(ui: ReactElement, now = MONDAY_1340, options?: RenderOptions) {
  setNow(now);
  const Wrapper = ({ children }: { children: ReactNode }) => <Providers initialNow={now}>{children}</Providers>;
  return render(ui, { wrapper: Wrapper, ...options });
}
