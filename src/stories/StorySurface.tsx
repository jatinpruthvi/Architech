import type { ReactNode } from "react";
import Providers from "@/components/architech/Providers";
import type { Lang } from "@/lib/i18n";

export function StorySurface({ children, lang = "en", theme = "light", padded = true }: { children: ReactNode; lang?: Lang; theme?: "light" | "dark"; padded?: boolean }) {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.lang = lang === "hi" ? "hi" : "en";
    window.localStorage.setItem("architech.lang", lang);
    window.localStorage.setItem("architech.theme", theme);
  }

  return (
    <Providers>
      <div className={`${theme === "dark" ? "dark bg-night text-cream" : "bg-paper text-ink"} min-h-screen ${padded ? "p-6 md:p-10" : ""}`}>
        {children}
      </div>
    </Providers>
  );
}
