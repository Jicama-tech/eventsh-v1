import type { ReactNode } from "react";

import { DialogTitle } from "@/components/ui/dialog";
import { t } from "@/i18n/t";

interface EventFormShellProps {
  title: string;
  children: ReactNode;
}

/**
 * Chrome for the big event forms when they run full-screen.
 *
 * Deliberately thin. Both CreateEventForm and MarriageEventForm already carry
 * their own sticky title bar with Cancel and Save, so a visible header here
 * would just repeat it — the same thing kioscart-v1 ran into, whose
 * ProductManagement notes "No header here: ProductForm carries its own sticky
 * title bar with the Cancel / Save actions, and a second one just repeated
 * it."
 *
 * What is left is the part the forms cannot supply: a DialogTitle, which
 * Radix needs to announce the dialog and which neither mount point had
 * (MyEvents even carried an empty DialogHeader with its title commented out).
 * It is screen-reader-only, so it names the dialog without drawing a second
 * heading.
 *
 * The scroll container is a flex child of the full-screen DialogContent, so
 * the body is the only thing that scrolls and the form's own sticky bar stays
 * pinned to the top of it.
 */
export function EventFormShell({ title, children }: EventFormShellProps) {
  return (
    <>
      <DialogTitle className="sr-only">{title}</DialogTitle>
      <div className="app-scroll flex-1 min-h-0 overflow-y-auto">{children}</div>
    </>
  );
}

/** Title for the form, given which form is showing and whether it is an edit. */
export function eventFormTitle(isMarriage: boolean, isEdit: boolean): string {
  if (isMarriage) {
    return isEdit
      ? t("form.marriage.edit.title")
      : t("form.marriage.create.title");
  }
  return isEdit ? t("form.edit.title") : t("form.create.title");
}
