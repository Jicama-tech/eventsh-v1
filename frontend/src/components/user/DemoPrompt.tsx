// Shown when a visitor clicks an action inside a DEMO event page (an
// admin-curated showcase). Instead of performing the real action (buy ticket,
// RSVP, book a stall…), we invite them to register or get in touch.

import { Sparkles, X } from "lucide-react";

export default function DemoPrompt({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Full navigation so it resolves in any context (guest eventfront or the
  // organizer-role demo dashboard, where /register may not be mounted).
  const go = (path: string) => {
    window.location.href = path;
  };
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
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
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <Sparkles className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">This is a live demo</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          You're exploring an example event page. Want a page like this for your
          own event? Create your free account, or talk to us — we'll help you
          get set up.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => go("/register")}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Register free
          </button>
          <button
            onClick={() => go("/contact")}
            className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300"
          >
            Contact us
          </button>
        </div>
      </div>
    </div>
  );
}
