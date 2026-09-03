import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/t";

const HOVER =
  "hover:bg-primary/10 hover:text-primary focus-visible:text-primary";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Stable-sized placeholder until mounted, so the first paint never shows the
  // wrong icon before the stored theme resolves.
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn(HOVER, className)}
        disabled
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === "dark";
  const label = isDark ? t("hdr.theme.toLight") : t("hdr.theme.toDark");

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(HOVER, className)}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </Button>
  );
}
