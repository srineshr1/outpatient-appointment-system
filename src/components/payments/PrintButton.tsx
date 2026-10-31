"use client";

import { Button } from "@/components/ui/Button";

export function PrintButton() {
  return (
    <Button size="md" variant="secondary" onClick={() => window.print()}>
      Print receipt
    </Button>
  );
}
