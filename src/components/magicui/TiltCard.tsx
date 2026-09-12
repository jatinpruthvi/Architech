"use client";
/* Magic-UI-style 3D tilt card: rAF-throttled pointer tilt + mouse-tracking glare. Disabled on touch & reduced motion. */
import { useRef, type ReactNode } from "react";

export default function TiltCard({ children, className = "", max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number>(0);

  const onMove = (e: React.MouseEvent) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const node = ref.current;
      const glare = glareRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const px = (clientX - rect.left) / rect.width;
      const py = (clientY - rect.top) / rect.height;
      const rotX = (py - 0.5) * -max;
      const rotY = (px - 0.5) * max;
      
      node.style.transform = `perspective(1000px) rotateY(${rotY}deg) rotateX(${rotX}deg) translateY(-4px) scale3d(1.02, 1.02, 1.02)`;
      
      if (glare) {
        glare.style.opacity = "1";
        glare.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.1) 0%, transparent 60%)`;
      }
    });
  };
  const onLeave = () => {
    cancelAnimationFrame(frame.current);
    const node = ref.current;
    const glare = glareRef.current;
    if (node) node.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    if (glare) glare.style.opacity = "0";
  };

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={`tilt-card relative group ${className}`}>
      {children}
      <div 
        ref={glareRef} 
        className="pointer-events-none absolute inset-0 z-50 rounded-[1.5rem] opacity-0 mix-blend-soft-light transition-opacity duration-300"
      />
    </div>
  );
}
