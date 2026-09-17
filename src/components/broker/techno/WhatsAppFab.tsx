"use client";
import { MessageCircle } from "lucide-react";

export default function WhatsAppFab() {
  return (
    <a
      href="https://wa.me/919999999999?text=Hi%20Techno%20Support"
      target="_blank"
      rel="noreferrer"
      className="tp-fab-whatsapp"
      aria-label="Chat on WhatsApp"
      title="Chat with Techno support"
    >
      <MessageCircle size={26} />
    </a>
  );
}
