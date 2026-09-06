"use client";
/* The filter sheet is the only consumer of the gesture-drawer library (vaul)
   on the /search first load, and it is only needed after a tap — so the whole
   sheet ships as a dynamic chunk. Keeping it out of the route's first-load JS
   is what holds /search under its performance budget (performance/budgets.json);
   the other drawer consumers (CompareTray, SearchQuickView) are already
   dynamic imports. The footer is built here (not passed in) because
   DrawerClose must be rendered inside the Drawer's context, and importing
   just that primitive from @/components/ui/drawer would drag vaul back into
   the static bundle. */
import type { ReactNode } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";

export default function FilterSheet({
  open,
  onOpenChange,
  title,
  children,
  showLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  showLabel: string;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-t-2 border-brick bg-paper">
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-display text-2xl font-medium tracking-[-0.02em]">{title}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-2">{children}</div>
        <div className="safe-bottom sticky bottom-0 border-t border-ink/12 bg-paper px-4 py-3">
          <DrawerClose asChild>
            <button className="clay-fill touch-44 w-full bg-brick py-3.5 stamp font-semibold text-cream">{showLabel}</button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
