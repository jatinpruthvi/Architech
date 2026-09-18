"use client";
import { MessageCircle } from "lucide-react";

export default function WhatsAppFab() {
  return (
    <a
      href="https://wa.me/919876543210?text=Hi%2C%20I%20need%20help%20with%20my%20Architech%20workspace"
      target="_blank"
      rel="noreferrer"
      className="tp-fab-whatsapp"
      aria-label="Chat on WhatsApp"
      title="Chat with support"
    >
      <MessageCircle size={26} />
    </a>
  );
}
