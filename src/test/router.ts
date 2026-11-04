import { vi } from "vitest";

export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
  refresh: vi.fn(),
  forward: vi.fn(),
};

/** What usePathname() returns in tests. Reset to "/" after each test. */
export const navigation = { pathname: "/" };
