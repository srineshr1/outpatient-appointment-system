import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { setNow } from "@/lib/clock";
import { navigation } from "./router";

afterEach(() => {
  cleanup();
  setNow(null);
  window.sessionStorage.clear();
  navigation.pathname = "/";
});

vi.mock("next/navigation", async () => {
  const { router, navigation } = await import("./router");
  return {
    useRouter: () => router,
    usePathname: () => navigation.pathname,
    useSearchParams: () => new URLSearchParams(),
    notFound: () => {
      throw new Error("NEXT_NOT_FOUND");
    },
  };
});

// jsdom lacks matchMedia, which Motion's reduced-motion support reads.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
