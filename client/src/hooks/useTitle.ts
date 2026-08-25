/* Per-route document titles. */
import { useEffect } from "react";

export default function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Architech` : "Architech — Find the place before the address.";
  }, [title]);
}
