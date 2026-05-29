import { useEffect, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

// Shared single-select category picker that draws its options from the
// `/categories` collection. Mirrors the multi-select used in the venue
// designer (Space Layout) so a category added in any of these surfaces
// — Space Layout, Add Exhibitor, the public stall form — shows up
// everywhere else next time.
//
// Adding a new category POSTs to /categories, appends it locally, and
// auto-selects it for the current row. Duplicates (case-insensitive)
// are recognised and re-used instead of double-posted.

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** Baseline options merged with the /categories fetch (case-insensitive
   *  dedupe). Lets each caller seed sensible defaults that show up before
   *  the network request resolves. */
  baseline?: string[];
  placeholder?: string;
  /** Width helpers — defaults to full-width to match Input's behaviour. */
  className?: string;
  disabled?: boolean;
}

const DEFAULT_BASELINE = [
  "Technology",
  "Music",
  "Food",
  "Sports",
  "Arts",
  "Fashion",
  "Electronics",
];

export function ExhibitorCategoryPicker({
  value,
  onChange,
  baseline,
  placeholder = "Select category",
  className,
  disabled,
}: Props) {
  const [options, setOptions] = useState<string[]>(
    baseline ?? DEFAULT_BASELINE,
  );
  const [newInput, setNewInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);

  // Hydrate from /categories on mount. Same case-insensitive merge the
  // venue designer uses so categories created by any organizer/exhibitor
  // appear in every dropdown.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${__API_URL__}/categories`);
        if (!res.ok) return;
        const data = await res.json();
        const names: string[] = Array.isArray(data)
          ? data
              .map((c: any) => c?.name)
              .filter((n: any) => typeof n === "string")
          : [];
        if (cancelled || names.length === 0) return;
        setOptions((prev) => {
          const seen = new Set(prev.map((c) => c.toLowerCase()));
          const extras = names.filter((n) => !seen.has(n.toLowerCase()));
          return extras.length ? [...prev, ...extras] : prev;
        });
      } catch {
        // non-fatal — baseline keeps working
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAdd = async () => {
    const name = newInput.trim();
    if (!name || adding) return;
    const existing = options.find(
      (c) => c.toLowerCase() === name.toLowerCase(),
    );
    const canonical = existing || name;
    setAdding(true);
    try {
      if (!existing) {
        try {
          const token = sessionStorage.getItem("token");
          await fetch(`${__API_URL__}/categories`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ name }),
          });
        } catch {
          // non-fatal — keep it local even if persist fails
        }
        setOptions((prev) => [...prev, name]);
      }
      onChange(canonical);
      setNewInput("");
      setOpen(false);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={`justify-between font-normal ${className || "w-full"}`}
        >
          <span className="truncate text-left">{value || placeholder}</span>
          <ChevronDown className="h-4 w-4 opacity-50 ml-2 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <div className="max-h-64 overflow-y-auto py-1">
          {options.map((cat) => {
            const selected = cat === value;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  onChange(cat);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-primary/10 hover:text-primary cursor-pointer ${
                  selected ? "font-semibold text-primary bg-primary/5" : ""
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
        <div className="border-t p-2 flex gap-2 bg-muted/30">
          <Input
            value={newInput}
            onChange={(e) => setNewInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Add new category"
            className="h-8 text-sm"
            disabled={adding}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={adding || !newInput.trim()}
            className="h-8 px-3 shrink-0"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
