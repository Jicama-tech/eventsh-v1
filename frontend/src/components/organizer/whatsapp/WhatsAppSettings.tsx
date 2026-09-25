import { useCallback, useEffect, useRef, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import {
  AlertCircle,
  Info,
  Loader2,
  PowerOff,
  QrCode,
  RefreshCw,
  Send,
  Unlink,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PhoneField from "@/components/ui/PhoneField";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ModuleGate } from "@/components/ui/ModuleGate";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { t as i18nT } from "@/i18n/t";
import {
  apiURL,
  authHeaders,
  isWhatsappState,
  nestMessage,
  WhatsappState,
  WhatsappStatus,
} from "./whatsappCampaignApi";

type Action = "enable" | "disable" | "connect" | "disconnect";

const STATUS_LABEL: Record<WhatsappStatus, string> = {
  off: "Off",
  disconnected: "Not connected",
  connecting: "Connecting…",
  "awaiting-scan": "Waiting for you to scan",
  connected: "Connected",
};

// Coloured badges carry an explicit dark pair: the light tints read as glare
// on the dark card, and the dark ones vanish on the light one.
const STATUS_CLASS: Record<WhatsappStatus, string> = {
  off: "border-border bg-muted text-muted-foreground",
  disconnected: "border-border bg-muted text-muted-foreground",
  connecting:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "awaiting-scan":
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  connected:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
};

// The send DTO's limit, so the browser stops the typing instead of the API
// answering with a class-validator sentence.
const MESSAGE_MAX = 1000;

/** The red "Unlink this phone" button; it only opens the confirm dialog. */
function UnlinkButton({
  busy,
  onClick,
}: {
  busy: string | null;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
      disabled={busy !== null}
      onClick={onClick}
    >
      {busy === "disconnect" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Unlink className="h-4 w-4" />
      )}
      {i18nT("Unlink this phone")}
    </Button>
  );
}

function UnlinkDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{i18nT("Unlink this phone?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {i18nT(
              "Your events stop sending WhatsApp messages from this number until a phone is scanned again. To pause sending instead, switch WhatsApp off — that keeps the link.",
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{i18nT("Cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
            onClick={onConfirm}
          >
            {i18nT("Unlink")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Settings › Profile › WhatsApp.
 *
 * `locked` is for an organizer whose plan does not include the add-on: the
 * upgrade card, plus a way to switch off or unlink a phone that is still
 * linked from before. The two modes are separate components rather than a
 * branch inside one, so that when the plan lands (or changes) while the tab
 * is open and the parent flips `locked`, React mounts the other panel fresh
 * instead of carrying one mode's state, refs and running poll into the other.
 */
export function WhatsAppSettings({ locked = false }: { locked?: boolean }) {
  return locked ? <LockedWhatsAppPanel /> : <WhatsAppPanel />;
}

/**
 * The full panel: link the organizer's own WhatsApp number by scanning a QR,
 * then watch the session.
 *
 * Ported from kioscart-v1's WhatsAppSettings, with one session per organizer
 * instead of one per shop. The server keeps the pairing on disk and
 * reconnects on its own after drops and restarts, so the QR here only ever
 * answers a click on this page — it is never regenerated in the background,
 * and a code nobody scans stops instead of cycling. Once linked it does not
 * come back unless the phone is unlinked.
 */
function WhatsAppPanel() {
  const { toast } = useToast();
  const [state, setState] = useState<WhatsappState | null>(null);
  /**
   * Set when there is nothing to show: the first status read failed, or the
   * server refused this account outright. A later poll failing for any other
   * reason is ignored — the next one is seconds away and the state on screen
   * is still the best thing to show.
   */
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState(() =>
    i18nT("Hello! This is a test message from our events team."),
  );
  const [now, setNow] = useState(() => Date.now());

  // Refs rather than state for everything the poll consults, so a tick reads
  // the live value instead of the one its interval closure captured.
  const mountedRef = useRef(false);
  const loadingRef = useRef(false);
  const busyRef = useRef(false);
  /**
   * Bumped by every action. A status read that was already in flight when
   * the organizer flipped the switch answers for the world BEFORE the flip;
   * applying it after the action's own answer would put "off" back on screen
   * — and `off` stops polling, so the panel would stay wrong until a reload.
   */
  const epochRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    // One request at a time. A slow server must not collect a queue of
    // two-second polls, and an action already has its own answer coming.
    if (loadingRef.current || busyRef.current) return;
    loadingRef.current = true;
    const epoch = epochRef.current;
    try {
      const res = await fetch(`${apiURL}/whatsapp/status`, {
        headers: authHeaders(),
      });
      const body = await res.json().catch(() => null);
      if (!mountedRef.current || epoch !== epochRef.current) return;

      if (res.status === 403) {
        // The ordinary refusal: an operator may hold the Settings tab without
        // the WhatsApp one, or lose it while this page is open. Every button
        // would 403 too, so drop the panel and say why; clearing the state
        // also stops the poll.
        setState(null);
        setUnavailable(
          nestMessage(body) ??
            i18nT("Your account does not have access to WhatsApp."),
        );
        return;
      }
      if (!res.ok || !isWhatsappState(body)) {
        setUnavailable(
          (current) =>
            current ??
            i18nT("WhatsApp could not be reached. Try again in a moment."),
        );
        return;
      }
      setUnavailable(null);
      setState(body);
    } catch {
      if (mountedRef.current) {
        setUnavailable(
          (current) =>
            current ??
            i18nT("WhatsApp could not be reached. Try again in a moment."),
        );
      }
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Two speeds, because there are two different questions. While a QR is up,
   * or the socket is opening, the answer changes every few seconds and
   * somebody is watching, so poll fast. Once connected nothing on screen
   * changes for hours — but the session can still drop, or be unlinked from
   * the phone itself. `off` is the one state that cannot change behind our
   * back, so it stops entirely. A hidden tab skips its ticks and catches up
   * the moment it is shown.
   */
  const pollStatus = state?.status;
  useEffect(() => {
    if (!pollStatus || pollStatus === "off") return;
    const fast = pollStatus === "awaiting-scan" || pollStatus === "connecting";
    const id = window.setInterval(
      () => {
        if (document.hidden) return;
        void load();
      },
      fast ? 2000 : 30000,
    );
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollStatus, load]);

  // A one-second clock for the QR countdown, running only while a code is up.
  const awaitingScan = state?.status === "awaiting-scan";
  useEffect(() => {
    if (!awaitingScan) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [awaitingScan]);

  const act = async (action: Action) => {
    if (busyRef.current) return;
    busyRef.current = true;
    epochRef.current += 1;
    setBusy(action);
    try {
      const res = await fetch(`${apiURL}/whatsapp/${action}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const body = await res.json().catch(() => null);
      if (!mountedRef.current) return;
      if (!res.ok) {
        toast({
          duration: 5000,
          variant: "destructive",
          title: i18nT("That did not work"),
          description: nestMessage(body) ?? i18nT("Please try again."),
        });
        return;
      }
      if (isWhatsappState(body)) setState(body);
      if (action === "disconnect") {
        toast({ duration: 3000, title: i18nT("Phone unlinked") });
      }
    } catch {
      if (mountedRef.current) {
        toast({
          duration: 5000,
          variant: "destructive",
          title: i18nT("That did not work"),
          description: i18nT(
            "Could not reach the server. Check your internet connection and try again.",
          ),
        });
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setBusy(null);
        // Re-read on success AND failure. The state an action returns is the
        // state at that instant — a QR usually arrives a beat later, and this
        // read (then the fast poll) picks it up.
        void load();
      }
    }
  };

  const sendTest = async () => {
    const phone = testPhone.trim();
    const message = testMessage.trim();
    if (!phone || !message || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${apiURL}/whatsapp/send`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ phone, message }),
      });
      const body = await res.json().catch(() => null);
      if (!mountedRef.current) return;
      if (res.ok) {
        toast({
          duration: 3000,
          title: i18nT("Test message sent"),
          description: i18nT("Sent to {phone}.", { phone }),
        });
      } else {
        toast({
          duration: 5000,
          variant: "destructive",
          title: i18nT("Test message not sent"),
          description: nestMessage(body) ?? i18nT("Please try again."),
        });
        // The usual cause is a session that dropped since the last poll;
        // refresh now rather than leave "Connected" up for thirty seconds.
        void load();
      }
    } catch {
      if (mountedRef.current) {
        toast({
          duration: 5000,
          variant: "destructive",
          title: i18nT("Test message not sent"),
          description: i18nT(
            "Could not reach the server. Check your internet connection and try again.",
          ),
        });
      }
    } finally {
      if (mountedRef.current) setSending(false);
    }
  };

  const header = (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <FaWhatsapp className="h-5 w-5 text-green-600 dark:text-green-400" />
        {i18nT("WhatsApp Connection")}
      </CardTitle>
      <CardDescription>
        {i18nT(
          "Send tickets, booking updates, approvals and campaigns to your attendees and vendors from your own WhatsApp number.",
        )}
      </CardDescription>
    </CardHeader>
  );

  if (!state) {
    return (
      <Card>
        {header}
        <CardContent>
          {unavailable ? (
            <div className="flex flex-col items-start gap-3" role="status">
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {unavailable}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" />
                {i18nT("Try Again")}
              </Button>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {i18nT("Loading WhatsApp connection…")}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const { enabled, status, number } = state;
  const secondsLeft = state.qrExpiresAt
    ? // Clamped: the expiry is server time, and a skewed client clock should
      // show a short wait or "getting a fresh code", never minutes or minus.
      Math.min(
        60,
        Math.max(0, Math.ceil((Date.parse(state.qrExpiresAt) - now) / 1000)),
      )
    : null;

  return (
    <Card>
      {header}
      <CardContent className="space-y-6">
        {/* What linking means, said once. */}
        <div className="flex gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            <li>
              {i18nT(
                "Every message your events send — tickets, stall and booking confirmations, approvals, reminders — goes out from the number you link here. Email keeps going out as well.",
              )}
            </li>
            <li>
              {i18nT(
                "Your phone does not need to stay open, but it must go online every few days — WhatsApp unlinks a device whose phone stays offline for about two weeks.",
              )}
            </li>
            <li>
              {i18nT(
                "Only send messages your attendees expect. Bulk or promotional spam can get this number blocked by WhatsApp.",
              )}
            </li>
          </ul>
        </div>

        {/* The switch itself. */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="wa-enabled" className="cursor-pointer">
                {i18nT("Send messages from my WhatsApp")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {i18nT(
                  "Links your account to your WhatsApp as a device, the same way WhatsApp Web does. Replies arrive on your phone.",
                )}
              </p>
            </div>
            <Switch
              id="wa-enabled"
              checked={enabled}
              disabled={busy !== null}
              onCheckedChange={(checked) =>
                void act(checked ? "enable" : "disable")
              }
            />
          </div>

          {enabled ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={STATUS_CLASS[status]}>
                {i18nT(STATUS_LABEL[status])}
              </Badge>
              {number && (
                <span className="text-sm text-muted-foreground">
                  {i18nT("Linked as +{number}", { number })}
                </span>
              )}
            </div>
          ) : (
            number && (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">
                  {i18nT(
                    "Paused. Your account is still linked to +{number}, so switching back on needs no new scan.",
                    { number },
                  )}
                </p>
                {/* Unlinking must not require switching back on first: that
                    would reconnect and start sending from the very phone the
                    organizer is trying to get rid of. */}
                <UnlinkButton busy={busy} onClick={() => setConfirmUnlink(true)} />
              </div>
            )
          )}
        </div>

        {/* Pairing. The QR sits on white in both themes: phone cameras read
            dark-on-light, and an inverted code does not scan. */}
        {enabled && status === "awaiting-scan" && state.qr && (
          <div className="flex flex-col items-start gap-4 rounded-lg border border-border bg-muted/30 p-5 sm:flex-row sm:gap-6">
            <img
              src={state.qr}
              alt={i18nT("WhatsApp pairing QR code")}
              width={200}
              height={200}
              className="h-[200px] w-[200px] shrink-0 rounded-lg bg-white p-2"
            />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-foreground">
                {i18nT("Scan this with the phone you want to send from")}
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
                <li>{i18nT("Open WhatsApp on that phone")}</li>
                <li>{i18nT("Tap Settings › Linked devices › Link a device")}</li>
                <li>{i18nT("Point the phone at this code")}</li>
              </ol>
              {secondsLeft !== null && (
                <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
                  {secondsLeft > 0
                    ? i18nT(
                        "A fresh code appears in {seconds}s if this one is not scanned.",
                        { seconds: secondsLeft },
                      )
                    : i18nT("Getting a fresh code…")}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {i18nT(
                  "If nobody scans for a few minutes the codes stop. Click Show QR code again when you are ready.",
                )}
              </p>
            </div>
          </div>
        )}

        {enabled &&
          (status === "connecting" ||
            (status === "awaiting-scan" && !state.qr)) && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-5 py-6">
              <p className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                {status === "connecting"
                  ? i18nT("Opening the connection…")
                  : i18nT("Preparing the QR code…")}
              </p>
              {state.lastError && (
                <p className="text-xs text-muted-foreground">
                  {i18nT(state.lastError)}
                </p>
              )}
            </div>
          )}

        {enabled && (status === "disconnected" || status === "off") && (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-muted/30 px-5 py-6">
            {state.lastError ? (
              <p className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {i18nT(state.lastError)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {number
                  ? i18nT(
                      "Your account was linked to +{number} but is not connected right now.",
                      { number },
                    )
                  : i18nT(
                      "No phone is linked yet. Show a QR code and scan it with the phone you want to send from.",
                    )}
              </p>
            )}
            {/* An organizer that was linked before usually still holds its
                pairing, so "Reconnect" is the honest label — most of the time
                no scan follows. The server shows a QR only if the pairing is
                gone. */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => void act("connect")}
              >
                {busy === "connect" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : number ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <QrCode className="h-4 w-4" />
                )}
                {number ? i18nT("Reconnect") : i18nT("Show QR code")}
              </Button>
              {/* Unlinking must not require a working connection. */}
              {number && (
                <UnlinkButton busy={busy} onClick={() => setConfirmUnlink(true)} />
              )}
            </div>
          </div>
        )}

        {/* Connected: prove it works, then get out of the way. */}
        {enabled && status === "connected" && (
          <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-5">
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                {i18nT("Send a test message")}
              </p>
              <div className="space-y-1">
                <Label htmlFor="wa-test-phone">{i18nT("Phone number")}</Label>
                <PhoneField
                  id="wa-test-phone"
                  format="e164"
                  placeholder="+91 98765 43210"
                  value={testPhone}
                  onChange={setTestPhone}
                />
                <p className="text-xs text-muted-foreground">
                  {i18nT(
                    "Include the country code, e.g. +91 98765 43210. Numbers without one use your organization's country.",
                  )}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="wa-test-message">{i18nT("Message")}</Label>
                  <Input
                    id="wa-test-message"
                    maxLength={MESSAGE_MAX}
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={sending || !testPhone.trim() || !testMessage.trim()}
                  onClick={() => void sendTest()}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {i18nT("Send test")}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <UnlinkButton busy={busy} onClick={() => setConfirmUnlink(true)} />
              <span className="text-xs text-muted-foreground">
                {i18nT(
                  "Switching WhatsApp off keeps the link, so turning it back on needs no new scan.",
                )}
              </span>
            </div>
          </div>
        )}
      </CardContent>

      <UnlinkDialog
        open={confirmUnlink}
        onOpenChange={setConfirmUnlink}
        onConfirm={() => void act("disconnect")}
      />
    </Card>
  );
}

/**
 * The panel for an organizer whose plan does not include the add-on.
 *
 * Mostly the upgrade card. But a plan can lose the add-on while a phone is
 * still linked — the server keeps the pairing so that upgrading again
 * reconnects without a scan — and without this the organizer could neither
 * see that link nor get rid of it. So the status is read once, and if
 * anything is left the two ways out are offered: switch off, and unlink. The
 * server answers exactly those three routes without the plan.
 */
function LockedWhatsAppPanel() {
  const { toast } = useToast();
  const { isModuleEnabled, loading: planLoading } = useSubscription();
  const planIncludesIt = isModuleEnabled("whatsappConnect");

  const [state, setState] = useState<WhatsappState | null>(null);
  const [busy, setBusy] = useState<"disable" | "disconnect" | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const startedRef = useRef(false);
  const epochRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Every failure, 403 included, simply leaves the upgrade card on its own. */
  const load = useCallback(async () => {
    const epoch = epochRef.current;
    try {
      const res = await fetch(`${apiURL}/whatsapp/status`, {
        headers: authHeaders(),
      });
      const body = await res.json().catch(() => null);
      if (!mountedRef.current || epoch !== epochRef.current) return;
      if (res.ok && isWhatsappState(body)) setState(body);
    } catch {
      // Deliberately silent; see above.
    }
  }, []);

  // Read once, and only when the plan is KNOWN to lack the add-on — reading
  // before the plan has loaded would flash "not part of your current plan"
  // over an organizer that has it.
  const planKnownOff = !planLoading && !planIncludesIt;
  useEffect(() => {
    if (!planKnownOff || startedRef.current) return;
    startedRef.current = true;
    void load();
  }, [planKnownOff, load]);

  const act = async (action: "disable" | "disconnect") => {
    if (busyRef.current) return;
    busyRef.current = true;
    epochRef.current += 1;
    setBusy(action);
    try {
      const res = await fetch(`${apiURL}/whatsapp/${action}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const body = await res.json().catch(() => null);
      if (!mountedRef.current) return;
      if (!res.ok) {
        toast({
          duration: 5000,
          variant: "destructive",
          title: i18nT("That did not work"),
          description: nestMessage(body) ?? i18nT("Please try again."),
        });
        return;
      }
      if (isWhatsappState(body)) setState(body);
      toast({
        duration: 3000,
        title:
          action === "disconnect"
            ? i18nT("Phone unlinked")
            : i18nT("WhatsApp switched off"),
      });
    } catch {
      if (mountedRef.current) {
        toast({
          duration: 5000,
          variant: "destructive",
          title: i18nT("That did not work"),
          description: i18nT(
            "Could not reach the server. Check your internet connection and try again.",
          ),
        });
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setBusy(null);
        void load();
      }
    }
  };

  const upgradeCard = (
    <ModuleGate
      moduleKey="whatsappConnect"
      hideWhenLocked
      fallbackText={i18nT("Upgrade your plan to connect your own WhatsApp number")}
    >
      {null}
    </ModuleGate>
  );

  if (!planKnownOff || !state || (!state.enabled && !state.number)) {
    return upgradeCard;
  }

  const { enabled, number } = state;
  return (
    <div className="space-y-4">
      {upgradeCard}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FaWhatsapp className="h-5 w-5 text-green-600 dark:text-green-400" />
            {i18nT("Your linked WhatsApp number")}
          </CardTitle>
          <CardDescription>
            {number
              ? enabled
                ? i18nT(
                    "WhatsApp Connection is not part of your current plan, so nothing is sent from +{number}. You can switch it off or unlink the phone here.",
                    { number },
                  )
                : i18nT(
                    "WhatsApp Connection is not part of your current plan, so nothing is sent from +{number}. You can unlink the phone here.",
                    { number },
                  )
              : i18nT(
                  "WhatsApp Connection is not part of your current plan, so nothing is sent from your number. You can switch it off here.",
                )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {enabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => void act("disable")}
              >
                {busy === "disable" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PowerOff className="h-4 w-4" />
                )}
                {i18nT("Switch off")}
              </Button>
            )}
            {number && (
              <UnlinkButton busy={busy} onClick={() => setConfirmUnlink(true)} />
            )}
          </div>
        </CardContent>
      </Card>

      <UnlinkDialog
        open={confirmUnlink}
        onOpenChange={setConfirmUnlink}
        onConfirm={() => void act("disconnect")}
      />
    </div>
  );
}
