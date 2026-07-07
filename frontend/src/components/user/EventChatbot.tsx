import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Loader2, X, MessageCircle } from "lucide-react";

const apiURL = __API_URL__;

interface QuickAction {
  label: string;
  action: string;
  /** Optional client-side intent. When set, clicking the pill runs a local
   *  handler instead of sending `action` to the bot — e.g. "book_stall" opens
   *  the vendor sign-in dialog, "buy_ticket" starts the ticket flow. */
  intent?:
    | "book_stall"
    | "buy_ticket"
    | "select_ticket"
    | "apply_speaker"
    | "book_round_table";
  /** Index into the event's visitor types, carried by "select_ticket" pills. */
  ticketIndex?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  quickActions?: QuickAction[];
  ts: number;
}

interface EventChatResponse {
  text: string;
  chatbotName?: string;
  quickActions?: QuickAction[];
  disabled?: boolean;
}

interface EventChatbotProps {
  eventId: string;
  /** Organizer-chosen display name; falls back to "Event Assistant". */
  chatbotName?: string;
  /** Optional accent color (hex) pulled from the event/storefront theme. */
  accentColor?: string;
  /** Data-driven opening quick-reply pills (computed by the eventfront from
   *  the event's own data — tickets/stalls/speakers/past-vs-upcoming). When
   *  omitted, a single safe fallback pill is shown. */
  greetingActions?: QuickAction[];
  /** Called when a pill with intent "book_stall" is clicked — the eventfront
   *  wires this to open the vendor Rent-a-Stall dialog. */
  onBookStall?: () => void;
  /** Active visitor ticket types (name + formatted price) for the in-chat
   *  ticket picker. When there's more than one, "Buy tickets" asks which one
   *  right here in the chat before redirecting to the cart. */
  ticketTypes?: { name: string; priceLabel: string }[];
  /** Proceed to the ticket cart for the visitor type at this index. */
  onSelectTicket?: (index: number) => void;
  /** Open the "Apply to Speak" dialog. */
  onApplySpeaker?: () => void;
  /** Open the round-table booking flow (venue layout). */
  onBookRoundTable?: () => void;
}

/**
 * Floating AI assistant shown on the public eventfront. Answers questions
 * grounded strictly in this one event's data (schedule, tickets, stalls,
 * speakers, round tables, policies, organizer contact) for visitors, vendors,
 * speakers and round-table guests. Talks to the unauthenticated
 * POST /chatbot/event-message endpoint, which enforces the organizer's
 * per-event enable toggle server-side.
 */
export function EventChatbot({
  eventId,
  chatbotName,
  accentColor = "#2563eb",
  greetingActions,
  onBookStall,
  ticketTypes,
  onSelectTicket,
  onApplySpeaker,
  onBookRoundTable,
}: EventChatbotProps) {
  const name = (chatbotName || "").trim() || "Event Assistant";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      ts: Date.now(),
      content: `Hi! I'm **${name}**. Ask me anything about this event — timings, details, the organizer, or how to get in touch.`,
      quickActions:
        greetingActions && greetingActions.length
          ? greetingActions
          : [
              {
                label: "When & where?",
                action: "When and where is this event?",
              },
            ],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, open]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmed, ts: Date.now() },
      ]);
      setInput("");
      setLoading(true);
      try {
        const res = await fetch(`${apiURL}/chatbot/event-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, message: trimmed }),
        });
        const data: EventChatResponse = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.text || "Sorry, I missed that.",
            quickActions: data.quickActions,
            ts: Date.now(),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "I had trouble reaching the server. Please try again in a moment.",
            ts: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [eventId, loading],
  );

  // Pill click — an intent pill runs a local handler (open a booking flow)
  // instead of sending its text to the bot. Booking flows close the chat so
  // the dialog / cart takes over; the ticket picker stays open to ask which
  // type first.
  const handlePill = useCallback(
    (qa: QuickAction) => {
      switch (qa.intent) {
        case "book_stall":
          if (onBookStall) {
            setOpen(false);
            onBookStall();
            return;
          }
          break;
        case "apply_speaker":
          if (onApplySpeaker) {
            setOpen(false);
            onApplySpeaker();
            return;
          }
          break;
        case "book_round_table":
          if (onBookRoundTable) {
            setOpen(false);
            onBookRoundTable();
            return;
          }
          break;
        case "select_ticket":
          if (onSelectTicket) {
            setOpen(false);
            onSelectTicket(qa.ticketIndex ?? 0);
            return;
          }
          break;
        case "buy_ticket": {
          const types = ticketTypes || [];
          if (types.length > 1) {
            // Ask which ticket right here in the chat, showing each price.
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                ts: Date.now(),
                content: "Which ticket would you like?",
                quickActions: types.map((t, i) => ({
                  label: `${t.name} — ${t.priceLabel}`,
                  action: t.name,
                  intent: "select_ticket" as const,
                  ticketIndex: i,
                })),
              },
            ]);
            return;
          }
          // 0 or 1 type → straight to the cart.
          if (onSelectTicket) {
            setOpen(false);
            onSelectTicket(0);
            return;
          }
          break;
        }
      }
      send(qa.action);
    },
    [
      onBookStall,
      onApplySpeaker,
      onBookRoundTable,
      onSelectTicket,
      ticketTypes,
      send,
    ],
  );

  return (
    <>
      {/* Launcher bubble */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open ${name}`}
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full px-4 py-3 text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: accentColor }}
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline text-sm font-semibold">
            Ask {name}
          </span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-[60] flex w-[calc(100vw-2.5rem)] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 text-white"
            style={{ backgroundColor: accentColor }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold leading-tight">{name}</div>
              <div className="text-[11px] text-white/80">Event assistant</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-full p-1 hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="h-[380px] space-y-3 overflow-y-auto bg-[#f7f7f9] px-4 py-4"
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "text-white"
                      : "border border-gray-200 bg-white text-gray-800"
                  }`}
                  style={
                    msg.role === "user"
                      ? { backgroundColor: accentColor }
                      : undefined
                  }
                >
                  <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {formatMarkdown(msg.content)}
                  </div>
                  {msg.role === "assistant" &&
                    msg.quickActions &&
                    msg.quickActions.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {msg.quickActions.map((qa, j) => (
                          <button
                            key={j}
                            onClick={() => handlePill(qa)}
                            disabled={loading}
                            className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
                          >
                            {qa.label}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5">
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    style={{ color: accentColor }}
                  />
                  <span className="text-sm text-gray-500">Thinking…</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-gray-200 bg-white px-3 py-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this event…"
              disabled={loading}
              className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm text-gray-800 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: accentColor }}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

// Tiny markdown shim — handles **bold**, `code`, [label](url) links and bare
// URLs. Links matter: the bot often surfaces the organizer's Instagram/socials,
// and without link handling the raw "[label](https://…long-url)" markup (and the
// long URL) leaked into the bubble and forced a horizontal scrollbar.
function formatMarkdown(text: string): JSX.Element {
  const parts: (string | JSX.Element)[] = [];
  // Order matters: match [label](url) BEFORE a bare url so the url inside a
  // markdown link isn't caught twice.
  const regex =
    /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)\s]+\)|(?:https?:\/\/)[^\s)]+)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  const linkEl = (label: string, href: string) => (
    <a
      key={`l${key++}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline decoration-1 underline-offset-2 [overflow-wrap:anywhere]"
      style={{ color: "inherit" }}
    >
      {label}
    </a>
  );

  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={`b${key++}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`")) {
      parts.push(
        <code
          key={`c${key++}`}
          className="rounded bg-gray-100 px-1.5 py-0.5 text-xs"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[")) {
      // [label](url) — show only the label, link to the url.
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (mm) parts.push(linkEl(mm[1], mm[2]));
      else parts.push(token);
    } else {
      // Bare URL — render as a link, but display a compact label (drop the
      // scheme + trailing slash) so a long URL doesn't blow out the bubble.
      const label = token.replace(/^https?:\/\//, "").replace(/\/$/, "");
      parts.push(linkEl(label, token));
    }
    lastIndex = m.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

export default EventChatbot;
