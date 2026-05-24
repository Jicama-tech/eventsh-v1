import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Send, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const apiURL = __API_URL__;

interface QuickAction {
  label: string;
  action: string;
}

interface PublicMessage {
  role: "user" | "assistant";
  content: string;
  quickActions?: QuickAction[];
  publicAction?: { type: "trigger_google_auth" };
  ts: number;
}

interface PublicResponse {
  text: string;
  quickActions?: QuickAction[];
  publicAction?: { type: "trigger_google_auth" };
}

const INITIAL_GREETING: PublicMessage = {
  role: "assistant",
  ts: Date.now(),
  content:
    "Hi! I'm EventSH's assistant. I can answer questions about pricing, tickets, attendees, or get you started right now. **Click \"Create my first event\"** and I'll sign you in and take you straight to your dashboard.",
  quickActions: [
    { label: "Create my first event", action: "I want to create my first event" },
    { label: "Pricing", action: "How much does it cost?" },
    { label: "How tickets work", action: "How do tickets work?" },
    { label: "Individual vs Organizer", action: "What's the difference between individual and organizer?" },
  ],
};

export function PublicChatbot() {
  const [messages, setMessages] = useState<PublicMessage[]>([INITIAL_GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // Hand off to the existing Organizer Login page, which already owns
  // the working Google OAuth flow (server-side redirect + multi-account
  // picker for users with several memberships). After sign-in, the auth
  // controller routes to /organizer-dashboard — Individuals land in the
  // chatbot-only mode where they can publish their first event.
  const redirectToOrganizerLogin = useCallback(() => {
    toast({
      title: "Taking you to sign-in",
      description:
        "Pick your Google account on the next screen — you'll land on your dashboard.",
    });
    navigate("/organizer/login");
  }, [navigate, toast]);

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
        const res = await fetch(`${apiURL}/chatbot/public-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });
        const data: PublicResponse = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.text || "Sorry, I missed that.",
            quickActions: data.quickActions,
            publicAction: data.publicAction,
            ts: Date.now(),
          },
        ]);
        // The "create event" intent hands off to the existing Organizer
        // Login page (server-side Google OAuth). Brief pause so the user
        // can read the bot's intro line before the navigation.
        if (data.publicAction?.type === "trigger_google_auth") {
          setTimeout(redirectToOrganizerLogin, 600);
        }
      } catch (err) {
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
    [loading, redirectToOrganizerLogin],
  );

  const onPillClick = (action: QuickAction) => {
    // "Create my first event" routes directly to the Organizer Login page
    // (server-side Google OAuth, multi-account picker, etc. — the flow
    // that already works). We still echo the intent into the chat so the
    // transcript reflects the action.
    if (/create.*(my\s+)?(first\s+)?event/i.test(action.action)) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: action.action, ts: Date.now() },
        {
          role: "assistant",
          content:
            "Awesome — taking you to sign-in. Pick your Google account and you'll land on your dashboard.",
          ts: Date.now(),
        },
      ]);
      setTimeout(redirectToOrganizerLogin, 400);
      return;
    }
    send(action.action);
  };

  return (
    <section className="py-20 md:py-28 bg-[#0a0a0c] relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-blue-500/5 pointer-events-none" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            Talk to EventSH AI
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Ask anything, or start your first event
          </h2>
          <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto">
            New here? Just chat. Ready to publish? Say "create my first event" — I'll
            sign you in with Google and take you straight to your dashboard.
          </p>
        </div>

        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-[#13131a] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-[#1a1a22]">
            <div className="h-9 w-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-white font-semibold">EventSH AI</div>
              <div className="text-xs text-slate-500">Always here, no sign-up to chat</div>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="px-5 py-6 h-[420px] overflow-y-auto space-y-4 bg-[#0f0f15]"
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-white"
                      : "bg-[#1f1f28] text-slate-200 border border-white/5"
                  }`}
                >
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {formatMarkdown(msg.content)}
                  </div>
                  {msg.role === "assistant" && msg.quickActions && msg.quickActions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.quickActions.map((qa, j) => {
                        const isCreate = /create.*(my\s+)?(first\s+)?event/i.test(
                          qa.action,
                        );
                        return (
                          <button
                            key={j}
                            onClick={() => onPillClick(qa)}
                            disabled={loading}
                            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all disabled:opacity-50 ${
                              isCreate
                                ? "bg-primary text-white hover:bg-primary/90"
                                : "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10"
                            }`}
                          >
                            {qa.label}
                            {isCreate && (
                              <ArrowRight className="inline h-3 w-3 ml-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#1f1f28] border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-slate-400">Thinking…</span>
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
            className="flex items-center gap-2 px-5 py-4 border-t border-white/10 bg-[#1a1a22]"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about pricing, tickets, or just say hi…"
              disabled={loading}
              className="bg-[#0f0f15] border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-primary/50"
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading || !input.trim()}
              className="bg-primary hover:bg-primary/90 flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}

// Tiny markdown shim: handles **bold** and `code`. The public bot's
// replies are simple enough that pulling in a full markdown lib is
// overkill — we only need a couple of inline styles.
function formatMarkdown(text: string): JSX.Element {
  const parts: (string | JSX.Element)[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={`b${key++}`} className="text-white font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <code
          key={`c${key++}`}
          className="px-1.5 py-0.5 rounded bg-white/10 text-primary text-xs"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    lastIndex = m.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}
