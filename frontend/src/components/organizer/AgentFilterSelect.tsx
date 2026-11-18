import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n/t";
import type { AgentOption } from "@/lib/participants";

/**
 * Agent filter for a Participants table, shown beside the Status dropdown.
 * Values: "all", "direct" (booked with no agent) or an agent id. Renders
 * nothing when the event has no agents.
 */
export function AgentFilterSelect({
  options,
  value,
  onChange,
  className = "w-44",
}: {
  options: AgentOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  if (options.length === 0) return null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className} title={t("Filter by agent")}>
        <SelectValue placeholder={t("Agent")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t("All agents")}</SelectItem>
        <SelectItem value="direct">{t("Direct (no agent)")}</SelectItem>
        {options.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name}
            {a.code ? ` · ${a.code}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The same filter as a plain <select>, for tables built with native selects. */
export function AgentFilterNative({
  options,
  value,
  onChange,
}: {
  options: AgentOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border px-3 py-2 text-sm"
      title={t("Filter by agent")}
    >
      <option value="all">{t("All agents")}</option>
      <option value="direct">{t("Direct (no agent)")}</option>
      {options.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
          {a.code ? ` · ${a.code}` : ""}
        </option>
      ))}
    </select>
  );
}
