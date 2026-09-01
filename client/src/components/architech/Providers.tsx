"use client";

/* Client provider stack for the App Router. */
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LangProvider } from "@/contexts/LangContext";
import { SavedProvider } from "@/contexts/SavedContext";
import { CompareProvider, useCompare } from "@/contexts/CompareContext";
import { CollectionsProvider } from "@/contexts/CollectionsContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const CompareTray = dynamic(() => import("@/components/architech/CompareTray"), { ssr: false });

function LazyCompareTray() {
  const { compared } = useCompare();
  if (compared.length === 0) return null;
  return <CompareTray />;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}
