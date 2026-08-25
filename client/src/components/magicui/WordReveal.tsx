"use client";
/* Magic-UI-style scroll-driven word reveal — rAF-throttled scroll handler. */
import { useEffect, useRef, useState } from "react";

export default function WordReveal({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [progress, setProgress] = useState(0);
  const words = text.split(" ");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setProgress(1); return; }
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const node = ref.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const vh = window.innerHeight;
        setProgress(Math.min(Math.max((vh * 0.85 - rect.top) / (vh * 0.55), 0), 1));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); };
  }, []);

  return (
    <p ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <span key={i} className="inline-block transition-opacity duration-300" style={{ opacity: i / words.length <= progress ? 1 : 0.18 }}>
            {word}&nbsp;
          </span>
        ))}
      </span>
    </p>
  );
}
