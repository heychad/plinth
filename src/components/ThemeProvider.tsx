"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, ReactNode } from "react";

const DEFAULT_THEME = {
  primaryColor: "#2563EB",
  secondaryColor: "#1E40AF",
  accentColor: "#3B82F6",
  backgroundColor: "#FFFFFF",
  textColor: "#111827",
  fontFamily: "Inter",
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useQuery(api.themes.getThemeForCurrentUser);

  useEffect(() => {
    const root = document.documentElement;
    const t = theme ?? DEFAULT_THEME;

    root.style.setProperty("--color-primary", t.primaryColor);
    root.style.setProperty("--color-secondary", t.secondaryColor);
    root.style.setProperty("--color-accent", t.accentColor);
    root.style.setProperty("--color-background", t.backgroundColor);
    root.style.setProperty("--color-foreground", t.textColor);
    root.style.setProperty("--font-family", t.fontFamily);
  }, [theme]);

  return <>{children}</>;
}
