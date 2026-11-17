"use client";

import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/button-styles";

export function RefreshQueue() {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.refresh()} className={buttonClass("secondary", "md")}>
      Refresh
    </button>
  );
}
