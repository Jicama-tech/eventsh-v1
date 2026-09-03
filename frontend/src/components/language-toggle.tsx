import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { LANG_LABELS, useI18n, type Lang } from "@/i18n";

const LANGS: Lang[] = ["en", "hi"];

// Same hover discipline as ThemeToggle: primary only, never the accent.
const HOVER =
  "hover:bg-primary/10 hover:text-primary focus-visible:text-primary";

/**
 * Language picker for the dashboard header. Shows the current code so the
 * state is readable at a glance without opening the menu.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(HOVER, "gap-1.5 px-2", className)}
          aria-label={t("hdr.lang")}
          title={t("hdr.lang")}
        >
          <Languages className="w-4 h-4" />
          <span className="text-xs font-semibold tracking-wide">
            {LANG_LABELS[lang].short}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => setLang(l)}
            className={cn(
              "flex items-center justify-between gap-4 cursor-pointer",
              // Radix drives DropdownMenuItem's focus state on hover too, so
              // both need pinning to primary rather than the theme accent.
              "focus:bg-primary/10 focus:text-primary",
              "hover:bg-primary/10 hover:text-primary",
              l === lang && "text-primary font-semibold",
            )}
          >
            {LANG_LABELS[l].name}
            <span className="text-[11px] text-muted-foreground">
              {LANG_LABELS[l].short}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
