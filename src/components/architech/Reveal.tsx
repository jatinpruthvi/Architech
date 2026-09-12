"use client";
/* ARCHITECH — Amdavad Modern reveal primitive.
   Server content stays visible and crawlable; CSS handles the optional entrance. */
import type { ReactNode } from "react";
import { motion } from "motion/react";

type RevealProps = { children: ReactNode; className?: string; delay?: number };

export default function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  const safeDelay = Math.min(Math.max(delay, 0), 400) / 1000;
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: safeDelay, ease: [0.2, 0.8, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
