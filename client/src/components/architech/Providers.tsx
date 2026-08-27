"use client";

/* Client provider stack for the App Router. */
import type { ReactNode } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LangProvider } from "@/contexts/LangContext";
import { SavedProvider } from "@/contexts/SavedContext";
import { CompareProvider } from "@/contexts/CompareContext";
import { CollectionsProvider } from "@/contexts/CollectionsContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import CompareTray from "@/components/architech/CompareTray";

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
              <CompareTray />
              </TooltipProvider>
            </CollectionsProvider>
          </CompareProvider>
        </SavedProvider>
      </LangProvider>
    </ThemeProvider>
  );
}
