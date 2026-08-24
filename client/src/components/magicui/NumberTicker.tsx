/* Magic-UI-style Number Ticker: counts up when scrolled into view. Respects reduced motion. */
import { useEffect, useRef, useState } from "react";

export default function NumberTicker({ value, suffix = "", prefix = "", duration = 1600, className = "" }: { value: number; suffix?: string; prefix?: string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setDisplay(value); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started.current) return;
      started.current = true;
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min((t - t0) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        setDisplay(Math.round(eased * value));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      observer.disconnect();
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, duration]);

  return <span ref={ref} className={className}>{prefix}{display.toLocaleString("en-IN")}{suffix}</span>;
}
