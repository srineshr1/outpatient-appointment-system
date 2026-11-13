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

// jsdom lacks IntersectionObserver, which Motion's useInView reads in CountUp / BlurText.
if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly scrollMargin = "0px";
    readonly thresholds = [0];
    constructor(private callback: IntersectionObserverCallback) {}
    observe(target: Element) {
      this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}
