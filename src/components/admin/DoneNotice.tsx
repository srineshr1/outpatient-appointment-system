"use client";

import { useEffect, useState } from "react";
import { CheckCircleIcon } from "@/components/admin/icons";

/**
 * What an action just did. The text is filled in a moment after the page appears, so screen
 * readers announce it, and `?done=` leaves the address so a reload doesn't show it again.
 */
export function DoneNotice({ message }: { message: string }) {
  const [announced, setAnnounced] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setAnnounced(message), 150);
    const url = new URL(window.location.href);
    if (url.searchParams.has("done")) {
      url.searchParams.delete("done");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <div className="mb-6 flex items-start gap-2 rounded-lg border border-[#b9dcc3] bg-[#e2f1e6] px-4 py-3 text-sm text-[#215631]">
      <CheckCircleIcon size={18} className="mt-px shrink-0" />
      <p aria-hidden="true">{message}</p>
      <output className="sr-only">{announced}</output>
    </div>
  );
}
