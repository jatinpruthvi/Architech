"use client";

/* Client provider stack for the App Router. */
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SessionProvider } from "@/contexts/SessionContext";
import { LangProvider } from "@/contexts/LangContext";
import { SavedProvider } from "@/contexts/SavedContext";
import { CompareProvider, useCompare } from "@/contexts/CompareContext";
import { CollectionsProvider } from "@/contexts/CollectionsContext";
import { TooltipProvider } from "@/components/ui/tooltip";

const CompareTray = dynamic(() => import("@/components/architech/CompareTray"), { ssr: false });
/* Audit F1: keep sonner out of the universal first-load shell (it rode every
   route via the root Toaster). sonner buffers toast() calls fired before the
   island hydrates, so UX is unchanged; CompareTray above sets the precedent. */
const Toaster = dynamic(() => import("@/components/ui/sonner").then((m) => m.Toaster), { ssr: false });

function LazyCompareTray() {
  const { compared } = useCompare();
  if (compared.length === 0) return null;
  return <CompareTray />;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
      <LangProvider>
        <SavedProvider>
          <CompareProvider>
            <CollectionsProvider>
              <TooltipProvider>
              <Toaster position="bottom-right" />
              {children}
              <LazyCompareTray />
              </TooltipProvider>
            </CollectionsProvider>
          </CompareProvider>
        </SavedProvider>
      </LangProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
