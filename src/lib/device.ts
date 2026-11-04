/**
 * "Chrome on Android", from a user agent. Only this short label is stored with a session,
 * never the full user agent or an IP address.
 */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  if (!ua.trim()) return "";
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\/|FxiOS\//.test(ua)
        ? "Firefox"
        : /HeadlessChrome/.test(ua)
          ? "Headless Chrome"
          : /Chrome\/|CriOS\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : /^curl\//i.test(ua)
                ? "curl"
                : "A browser";
  // Order matters: iPhones say "Mac OS X" and Android says "Linux".
  const system = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Mac OS X|Macintosh/.test(ua)
              ? "Mac"
              : /Linux/.test(ua)
                ? "Linux"
                : "";
  return system ? `${browser} on ${system}` : browser;
}
