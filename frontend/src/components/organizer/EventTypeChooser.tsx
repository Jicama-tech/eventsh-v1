import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Briefcase, PartyPopper, ChevronRight } from "lucide-react";
import {
  EVENT_TYPE_LIST,
  EVENT_TYPE_GROUPS,
  type EventTypeKey,
} from "@/lib/eventTypes";

interface EventTypeChooserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Fires once the organizer has picked a top-level type and a sub-type.
  // The parent then opens the full Create Event form pre-filled with these.
  onConfirm: (selection: { eventType: EventTypeKey; subtype: string }) => void;
}

const GROUP_ICON: Record<EventTypeKey, typeof Briefcase> = {
  commercial: Briefcase,
  personal: PartyPopper,
};

/**
 * Pre-step shown when the organizer clicks "Create Event". Step 1 asks
 * whether the event is Commercial or Personal; step 2 narrows it to a
 * fixed sub-type for that group. On confirm the parent opens the real
 * form with `eventType` + `category` (= sub-type) already set.
 */
export function EventTypeChooser({
  open,
  onOpenChange,
  onConfirm,
}: EventTypeChooserProps) {
  const [eventType, setEventType] = useState<EventTypeKey | null>(null);

  // Reset back to step 1 every time the dialog is (re)opened so a previous
  // pick doesn't leak into the next "Create Event" click.
  useEffect(() => {
    if (open) setEventType(null);
  }, [open]);

  const group = eventType ? EVENT_TYPE_GROUPS[eventType] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {group && (
              <button
                type="button"
                onClick={() => setEventType(null)}
                className="inline-flex items-center justify-center rounded-md p-1 hover:bg-muted"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {group ? `What kind of ${group.label} event?` : "What type of event?"}
          </DialogTitle>
          <DialogDescription>
            {group
              ? "Pick the option that best describes your event."
              : "Choose a category to get started — this sets up the right options for your event."}
          </DialogDescription>
        </DialogHeader>

        {!group ? (
          // Step 1 — Commercial vs Personal
          <div className="grid gap-4 sm:grid-cols-2">
            {EVENT_TYPE_LIST.map((g) => {
              const Icon = GROUP_ICON[g.key];
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setEventType(g.key)}
                  className="group flex flex-col items-start gap-3 rounded-xl border-2 border-muted bg-card p-5 text-left transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="text-lg font-semibold">{g.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {g.description}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          // Step 2 — sub-type for the chosen group
          <div className="grid max-h-[50vh] gap-2 overflow-y-auto py-1 sm:grid-cols-2">
            {group.subtypes.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => onConfirm({ eventType: group.key, subtype: sub })}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-left text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
              >
                <span>{sub}</span>
                <ChevronRight className="h-4 w-4 opacity-50" />
              </button>
            ))}
          </div>
        )}

        {group && (
          <div className="flex justify-start pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEventType(null)}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default EventTypeChooser;
