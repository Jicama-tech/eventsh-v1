import { useState, useRef, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  Send,
  ChevronDown,
  Bot,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VenueConfigLite {
  id: string;
  name: string;
  width: number;
  height: number;
  scale: number;
  gridSize: number;
}

interface TemplatesLite {
  stalls: any[];
  roundTables: any[];
  speakerZones: any[];
}

interface GenerateResult {
  ok: boolean;
  summary: string;
  hasMainStage: boolean;
  positionedTables: any[];
  positionedRoundTables: any[];
  positionedSpeakerZones: any[];
  warnings: string[];
}

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  layout?: GenerateResult;
};

export function AIVenueDesignerDialog({
  open,
  onOpenChange,
  venueConfig,
  templates,
  existingCounts,
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  venueConfig: VenueConfigLite;
  templates: TemplatesLite;
  existingCounts: { tables: number; rounds: number; zones: number };
  onApply: (result: GenerateResult) => void;
}) {
  const { toast } = useToast();
  const buildGreeting = () => {
    const stallNames = templates.stalls.map((s: any) => s.name).filter(Boolean);
    const roundNames = templates.roundTables
      .map((r: any) => `${r.name} (${r.numberOfChairs} chairs)`)
      .filter(Boolean);
    const stageNames = templates.speakerZones
      .map((s: any) => (s.isMainStage ? `${s.name} (Main Stage)` : s.name))
      .filter(Boolean);
    const lines: string[] = [];
    lines.push(
      `Venue **${venueConfig.name}** (${venueConfig.width}×${venueConfig.height}). Here's what you've set up:`,
    );
    if (stallNames.length)
      lines.push(`• Stalls: ${stallNames.join(", ")}`);
    if (roundNames.length)
      lines.push(`• Round tables: ${roundNames.join(", ")}`);
    if (stageNames.length)
      lines.push(`• Speaker zones: ${stageNames.join(", ")}`);
    lines.push(
      "",
      "Tell me how to place them — counts per wall, stage side, round-table zone. I'll ask if anything's unclear.",
    );
    return lines.join("\n");
  };

  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: buildGreeting() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Stored as meters; converted to px on submit (1m = 100px).
  const [wallMargin, setWallMargin] = useState("0.5");
  const [stallGap, setStallGap] = useState("0.1");
  const [stallOrientation, setStallOrientation] = useState<
    "horizontal" | "vertical"
  >("horizontal");
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasTemplates =
    templates.stalls.length +
      templates.roundTables.length +
      templates.speakerZones.length >
    0;

  const totalExisting =
    existingCounts.tables + existingCounts.rounds + existingCounts.zones;

  // Latest layout (most recent assistant message that has one).
  const latestLayout = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].layout) return messages[i].layout!;
    }
    return null;
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const close = () => onOpenChange(false);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg: ChatMsg = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      // Strip layout payloads — backend doesn't need them, only role+content.
      const wireMessages = nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await fetch(`${__API_URL__}/venue-designer/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: wireMessages,
          wallMargin: Math.round((Number(wallMargin) || 0.5) * 100),
          stallGap: Math.round((Number(stallGap) || 0.1) * 100),
          stallOrientation,
          venueConfig: {
            id: venueConfig.id,
            width: venueConfig.width,
            height: venueConfig.height,
            name: venueConfig.name,
            gridSize: venueConfig.gridSize,
          },
          templates,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || `Request failed (${res.status})`);
      }
      const data = await res.json();
      const reply: ChatMsg = {
        role: "assistant",
        content: data.text || "(no reply)",
      };
      if (data.type === "layout" && data.layout) {
        reply.layout = data.layout as GenerateResult;
      }
      setMessages((prev) => [...prev, reply]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${e?.message || "something went wrong"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const apply = () => {
    if (!latestLayout) return;
    if (totalExisting > 0) {
      const ok = window.confirm(
        `This will replace your current layout (${totalExisting} item${
          totalExisting === 1 ? "" : "s"
        }) for "${venueConfig.name}". Continue?`,
      );
      if (!ok) return;
    }
    onApply(latestLayout);
    toast({
      title: "Layout applied",
      description: "All placed items are draggable on the canvas.",
    });
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            AI Venue Designer
          </DialogTitle>
          <DialogDescription>
            Chat with the designer for{" "}
            <span className="font-semibold">{venueConfig.name}</span> (
            {venueConfig.width}×{venueConfig.height}). Items are editable
            after Apply.
          </DialogDescription>
        </DialogHeader>

        {!hasTemplates ? (
          <div className="px-6 py-6">
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                Add at least one template (stall, round table, or speaker
                zone) before the AI can design a layout.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 min-h-0 bg-slate-50/50"
            >
              {messages.map((m, i) => (
                <ChatBubble
                  key={i}
                  role={m.role}
                  content={m.content}
                  layout={m.layout}
                  templates={templates}
                  venueConfig={venueConfig}
                />
              ))}
              {loading && (
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm shadow-sm px-3 py-2">
                    <div className="flex gap-1">
                      <span
                        className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: "120ms" }}
                      />
                      <span
                        className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: "240ms" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Settings (collapsible) */}
            <div className="border-t bg-white px-4 sm:px-6">
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                className="w-full flex items-center justify-between py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
              >
                <span>Spacing & orientation</span>
                <ChevronDown
                  className={`h-3 w-3 transition ${showSettings ? "rotate-180" : ""}`}
                />
              </button>
              {showSettings && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-3">
                  <div className="space-y-1">
                    <Label htmlFor="ai-wall" className="text-xs">
                      Wall margin (m)
                    </Label>
                    <Input
                      id="ai-wall"
                      type="number"
                      min={0}
                      max={5}
                      step={0.05}
                      value={wallMargin}
                      onChange={(e) => setWallMargin(e.target.value)}
                      disabled={loading}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ai-gap" className="text-xs">
                      Gap between stalls (m)
                    </Label>
                    <Input
                      id="ai-gap"
                      type="number"
                      min={0}
                      max={2}
                      step={0.05}
                      value={stallGap}
                      onChange={(e) => setStallGap(e.target.value)}
                      disabled={loading}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <Label className="text-xs">Stall orientation</Label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => setStallOrientation("horizontal")}
                        className={`flex-1 text-xs px-2 py-1.5 rounded-md border transition ${
                          stallOrientation === "horizontal"
                            ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                        } disabled:opacity-50`}
                      >
                        ▭ Horiz.
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => setStallOrientation("vertical")}
                        className={`flex-1 text-xs px-2 py-1.5 rounded-md border transition ${
                          stallOrientation === "vertical"
                            ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                        } disabled:opacity-50`}
                      >
                        ▯ Vert.
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Apply bar (only when there's a layout) */}
            {latestLayout && (
              <div className="border-t bg-emerald-50/40 px-4 sm:px-6 py-2 flex items-center justify-between gap-2">
                <span className="text-xs text-emerald-800">
                  Layout ready — preview shown above. Reply to refine, or Apply
                  to place on the canvas.
                </span>
                <Button size="sm" onClick={apply} disabled={loading}>
                  Apply layout
                </Button>
              </div>
            )}

            {/* Input bar */}
            <form
              onSubmit={handleSubmit}
              className="p-3 sm:p-4 border-t bg-white flex gap-2 items-center flex-shrink-0"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  latestLayout
                    ? "Refine the layout (e.g. 'move stage to top')"
                    : "Describe the venue setup…"
                }
                disabled={loading}
                className="flex-1 h-10 rounded-full bg-slate-100 border-0 focus-visible:ring-1 focus-visible:ring-blue-500 text-sm"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || loading}
                className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 shrink-0"
                title="Send"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={close}
                disabled={loading}
              >
                Close
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChatBubble({
  role,
  content,
  layout,
  templates,
  venueConfig,
}: {
  role: "user" | "assistant";
  content: string;
  layout?: GenerateResult;
  templates: TemplatesLite;
  venueConfig: VenueConfigLite;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
          isUser
            ? "bg-slate-200 text-slate-600"
            : "bg-gradient-to-br from-amber-500 to-orange-600"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>
      <div
        className={`max-w-[85%] sm:max-w-[78%] px-3 py-2 text-sm leading-relaxed break-words ${
          isUser
            ? "bg-blue-600 text-white rounded-2xl rounded-br-sm"
            : "bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-sm shadow-sm"
        }`}
      >
        <span className="whitespace-pre-wrap">{content}</span>
        {layout && (
          <div className="mt-2 -mx-1">
            <PreviewCanvas
              venueConfig={venueConfig}
              result={layout}
              templates={templates}
            />
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
              <Stat label="Stalls" value={layout.positionedTables.length} />
              <Stat
                label="Round tables"
                value={layout.positionedRoundTables.length}
              />
              <Stat
                label="Zones"
                value={layout.positionedSpeakerZones.length}
              />
            </div>
            {layout.warnings && layout.warnings.length > 0 && (
              <ul className="mt-2 text-[11px] text-amber-700 list-disc ml-4">
                {layout.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-slate-50 border border-slate-200 px-2 py-1 text-center">
      <div className="font-bold text-sm text-slate-900">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  );
}

function PreviewCanvas({
  venueConfig,
  result,
  templates,
}: {
  venueConfig: VenueConfigLite;
  result: GenerateResult;
  templates: TemplatesLite;
}) {
  const maxW = 460;
  const previewScale = useMemo(
    () => Math.min(maxW / venueConfig.width, 260 / venueConfig.height),
    [venueConfig.width, venueConfig.height],
  );

  const W = venueConfig.width * previewScale;
  const H = venueConfig.height * previewScale;

  const stallTplById = new Map(templates.stalls.map((t) => [t.id, t]));

  return (
    <div className="rounded-md border bg-slate-50 p-2 overflow-auto">
      <div
        className="relative bg-white border border-gray-200 rounded shadow-inner mx-auto"
        style={{ width: W, height: H }}
      >
        {result.positionedSpeakerZones.map((z) => (
          <div
            key={z.positionId}
            style={{
              position: "absolute",
              left: z.x * previewScale,
              top: z.y * previewScale,
              width: z.width * previewScale,
              height: z.height * previewScale,
              background: "linear-gradient(135deg,#a855f7,#8b5cf6)",
              border: "1px solid #7c3aed",
              borderRadius: 4,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
              fontWeight: 700,
            }}
          >
            {z.isMainStage ? "STAGE" : z.name}
          </div>
        ))}
        {result.positionedTables.map((t) => {
          const tpl = stallTplById.get((t as any).id);
          const color = (tpl as any)?.color || "#6b7280";
          return (
            <div
              key={t.positionId}
              style={{
                position: "absolute",
                left: t.x * previewScale,
                top: t.y * previewScale,
                width: t.width * previewScale,
                height: t.height * previewScale,
                background: color + "33",
                border: `1px solid ${color}`,
                borderRadius: 2,
                transform: t.rotation ? `rotate(${t.rotation}deg)` : undefined,
                transformOrigin: "center center",
              }}
              title={t.name}
            />
          );
        })}
        {result.positionedRoundTables.map((rt) => {
          const d = (rt.tableDiameter || 120) * previewScale;
          return (
            <div
              key={rt.positionId}
              style={{
                position: "absolute",
                left: rt.x * previewScale,
                top: rt.y * previewScale,
                width: d,
                height: d,
                background: (rt.color || "#8B5CF6") + "33",
                border: `1px solid ${rt.color || "#8B5CF6"}`,
                borderRadius: "50%",
              }}
              title={rt.name}
            />
          );
        })}
      </div>
    </div>
  );
}
