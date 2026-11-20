// Shown when a visitor tries to book while the organizer has switched bookings
// off ("Bookings open" in the event form). Carries the organizer's own message.

import { CalendarOff, X } from "lucide-react";

export default function BookingsClosedDialog({
  open,
  onClose,
  message,
}: {
  open: boolean;
  onClose: () => void;
  message: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <CalendarOff className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Bookings are closed</h3>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">
          {message}
        </p>
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
