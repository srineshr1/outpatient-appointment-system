"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Card";
import { reportPaymentFailureAction, startCheckoutAction, verifyPaymentAction } from "@/server/payment-actions";

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (response: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
    script.addEventListener("error", () => resolve(false));
    if (!existing) {
      script.src = SCRIPT_URL;
      script.async = true;
      document.head.append(script);
    }
  });
}

function remaining(until: string | null): number | null {
  if (!until) return null;
  return Math.max(0, Math.floor((new Date(until).getTime() - Date.now()) / 1000));
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

type Phase = "idle" | "starting" | "open" | "confirming" | "waiting";

/**
 * Opens Razorpay Checkout for a held visit. The amount and order come from the server; this component only
 * shows the countdown and hands the browser's proof back to the server to verify.
 */
export function PayButton({
  visitId,
  holdExpiresAt,
  amountLabel,
  autoStart = false,
}: {
  visitId: string;
  holdExpiresAt: string | null;
  amountLabel: string;
  autoStart?: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [seconds, setSeconds] = useState<number | null>(() => remaining(holdExpiresAt));
  const started = useRef(false);

  useEffect(() => {
    if (holdExpiresAt === null) return;
    const timer = setInterval(() => {
      const left = remaining(holdExpiresAt);
      setSeconds(left);
      if (left === 0) {
        clearInterval(timer);
        // The server releases the place; reload to show it.
        if (phase !== "open" && phase !== "confirming") router.refresh();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [holdExpiresAt, router, phase]);

  // A payment the bank is still confirming: look again every few seconds.
  useEffect(() => {
    if (phase !== "waiting") return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [phase, router]);

  const pay = useCallback(async () => {
    setMessage(null);
    setPhase("starting");
    const started$ = await startCheckoutAction(visitId).catch(() => null);
    if (!started$ || !started$.ok) {
      setPhase("idle");
      if (started$ && ["paid", "expired", "not-pending"].includes(started$.code)) router.refresh();
      setMessage(started$ ? started$.message : "We couldn’t reach the payment system. Please try again.");
      return;
    }
    const { session } = started$;
    if (!(await loadCheckoutScript()) || !window.Razorpay) {
      setPhase("idle");
      setMessage("We couldn’t load the payment window. Check your connection and try again.");
      return;
    }
    const checkout = new window.Razorpay({
      key: session.publicKey,
      order_id: session.orderId,
      amount: session.amountMinor,
      currency: session.currency,
      name: "Westbrook Medical Practice",
      description: session.description,
      prefill: { name: session.patientName },
      notes: { reference: session.reference },
      theme: { color: "#0066cc" },
      modal: {
        ondismiss: () => {
          setPhase((current) => (current === "open" ? "idle" : current));
        },
      },
      handler: async (response: RazorpaySuccess) => {
        setPhase("confirming");
        const result = await verifyPaymentAction({
          visitId,
          orderId: response.razorpay_order_id,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        }).catch(() => null);
        if (!result) {
          setPhase("waiting");
          setMessage("We’re confirming your payment. This page will update on its own.");
          return;
        }
        if (!result.ok) {
          setPhase("idle");
          setMessage(result.message);
          return;
        }
        if (result.status === "pending") {
          setPhase("waiting");
          setMessage(result.message);
          return;
        }
        router.refresh();
      },
    });
    checkout.on("payment.failed", (response) => {
      const reason = response.error?.description ?? "The payment did not go through.";
      setMessage(`${reason} Your place is still held. You can try again.`);
      void reportPaymentFailureAction(visitId, reason);
    });
    setPhase("open");
    checkout.open();
  }, [router, visitId]);

  useEffect(() => {
    if (autoStart && !started.current && (seconds === null || seconds > 0)) {
      started.current = true;
      void pay();
    }
  }, [autoStart, pay, seconds]);

  const expired = seconds === 0;
  return (
    <div className="grid gap-4">
      {seconds !== null && !expired ? (
        <p className="text-callout text-ink-2" role="timer" aria-live="off">
          Your place is held for <span className="tabular font-semibold text-ink">{clock(seconds)}</span>. After that it is released.
        </p>
      ) : null}
      {message ? (
        <Notice tone={phase === "waiting" ? "info" : "danger"} role={phase === "waiting" ? "status" : "alert"} className="flex items-start gap-2">
          {phase === "waiting" ? null : <Alert size={20} className="mt-px shrink-0 text-danger" />}
          {message}
        </Notice>
      ) : null}
      <div>
        <Button
          size="lg"
          onClick={() => void pay()}
          disabled={expired || phase === "confirming" || phase === "waiting"}
          loading={phase === "starting" || phase === "confirming"}
          loadingLabel={phase === "confirming" ? "Confirming…" : "Opening payment…"}
          className="w-full sm:w-auto sm:min-w-56"
        >
          Pay {amountLabel}
        </Button>
      </div>
    </div>
  );
}
