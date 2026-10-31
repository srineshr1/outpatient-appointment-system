import { sendNotice } from "../mailer";
import type { ChannelName, NotificationChannel, RenderedMessage, SendResult } from "./types";

export const emailChannel: NotificationChannel = {
  name: "email",
  send: (recipient, message) => sendNotice(recipient, message),
};

/**
 * Stubs for text messages. They record that a message would go out and report it as skipped, so
 * the outbox flow is exercised end to end. Plugging in a provider (Twilio, Meta WhatsApp Cloud API)
 * means replacing `send` here; nothing else changes.
 */
function stub(name: "sms" | "whatsapp"): NotificationChannel {
  return {
    name,
    async send(_recipient: string, message: RenderedMessage): Promise<SendResult> {
      console.info(`[notice] ${name} is not connected yet; would send: ${message.subject}`);
      return "skipped";
    },
  };
}

const channels: Record<ChannelName, NotificationChannel> = {
  email: emailChannel,
  sms: stub("sms"),
  whatsapp: stub("whatsapp"),
};

export function channelFor(name: string): NotificationChannel | null {
  return name in channels ? channels[name as ChannelName] : null;
}
