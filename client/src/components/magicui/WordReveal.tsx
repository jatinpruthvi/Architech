/* Magic-UI-style scroll-driven word reveal: words ink in as the paragraph crosses the viewport. */
import { useEffect, useRef, useState } from "react";

export default function WordReveal({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [progress, setProgress] = useState(0);
  const words = text.split(" ");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setProgress(1); return; }
    const onScroll = () => {
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(Math.max((vh * 0.85 - rect.top) / (vh * 0.55), 0), 1);
      setProgress(p);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <p ref={ref} className={className} aria-label={text}>
      {words.map((word, i) => (
        <span key={i} aria-hidden="true" className="inline-block transition-opacity duration-300" style={{ opacity: i / words.length <= progress ? 1 : 0.18 }}>
          {word}&nbsp;
        </span>
      ))}
    </p>
  );
}
