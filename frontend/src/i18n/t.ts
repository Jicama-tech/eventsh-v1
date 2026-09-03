import { en } from "./en";
import { hi } from "./hi";
import type { Lang } from "./index";

/**
 * Hook-free translator, ported from kioscart-v1.
 *
 * The dashboard's strings are spread over dozens of files and many inline
 * sub-components. Requiring `useT()` in scope at every call site would mean
 * threading a hook through all of them; instead the current language lives in
 * module state and `t()` reads it directly, so a call site only needs this
 * import.
 *
 * Re-rendering on a language change is handled by I18nProvider, which remounts
 * its subtree via `key={lang}` — the module state is always set before that
 * render happens.
 *
 * Unknown keys fall back to English, then to the key itself.
 */
let current: Lang = "en";

const DICTS: Record<Lang, Record<string, string>> = { en, hi };

export function setCurrentLang(l: Lang) {
  current = l;
}

export function getCurrentLang(): Lang {
  return current;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = DICTS[current] || en;
  let out = dict[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return out;
}
