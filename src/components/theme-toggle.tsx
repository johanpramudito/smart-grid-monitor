"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-card border border-border">
      <Sun className="h-4 w-4 text-muted-foreground" />
      <div className="flex items-center gap-2">
        <Switch
          id="theme-toggle"
          checked={theme === "dark"}
          onCheckedChange={toggleTheme}
          aria-label="Toggle theme"
        />
        <Label
          htmlFor="theme-toggle"
          className="text-sm font-medium cursor-pointer select-none"
        >
          {theme === "dark" ? "Dark" : "Light"}
        </Label>
      </div>
      <Moon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
