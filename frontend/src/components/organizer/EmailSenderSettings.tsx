import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, Mail, Send } from "lucide-react";

const apiURL = __API_URL__;

interface EmailCfg {
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
}

const EMPTY: EmailCfg = {
  enabled: false,
  fromName: "",
  fromEmail: "",
  smtpHost: "",
  smtpPort: 465,
  smtpSecure: true,
  smtpUser: "",
  smtpPass: "",
};

/**
 * Self-contained "send from my own email" settings card. Reads/writes the same
 * `/organizers/:id/email-config` endpoints the organizer settings screen uses,
 * so it works for Individuals too (their JWT `sub` is their organizer id, and
 * the backend exempts Individual accounts from the plan gate). Guest-facing
 * mail (e.g. RSVP confirmations) then sends from this address.
 */
export default function EmailSenderSettings() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<EmailCfg>(EMPTY);
  const [hasPassword, setHasPassword] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState("");

  const orgId = (() => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return null;
      const decoded: any = jwtDecode(token);
      return decoded?.sub || decoded?.organizerId || decoded?.userId || null;
    } catch {
      return null;
    }
  })();

  const set = <K extends keyof EmailCfg>(k: K, v: EmailCfg[K]) =>
    setCfg((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!orgId) return;
    const token = sessionStorage.getItem("token");
    fetch(`${apiURL}/organizers/${orgId}/email-config`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const d = j?.data;
        if (!d) return;
        setCfg({
          enabled: !!d.enabled,
          fromName: d.fromName || "",
          fromEmail: d.fromEmail || "",
          smtpHost: d.smtpHost || "",
          smtpPort: d.smtpPort || 465,
          smtpSecure: d.smtpSecure ?? true,
          smtpUser: d.smtpUser || "",
          smtpPass: d.smtpPass || "",
        });
        setHasPassword(!!d.hasPassword);
        if (d.fromEmail) setTestTo((t) => t || d.fromEmail);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const save = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${apiURL}/organizers/${orgId}/email-config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(cfg),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 404) {
        throw new Error(
          "Create and publish your event first, then add your email here.",
        );
      }
      if (!res.ok) throw new Error(j?.message || "Could not save");
      setHasPassword(!!j?.data?.hasPassword);
      toast({ title: "Saved", description: "Email settings updated." });
    } catch (e: any) {
      toast({
        title: "Couldn't save",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!orgId) return;
    const to = testTo || cfg.fromEmail;
    if (!to) {
      toast({ title: "Enter a test recipient", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(
        `${apiURL}/organizers/${orgId}/email-config/test`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ ...cfg, to }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "Test failed");
      toast({ title: "Test sent", description: j?.message || `Sent to ${to}` });
    } catch (e: any) {
      toast({
        title: "Test failed",
        description: e?.message || "Check your SMTP details.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50/50 p-4">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-500" />
          <div>
            <p className="text-sm font-semibold text-stone-800">
              Send from your own email
            </p>
            <p className="mt-1 text-xs text-stone-500">
              When on, RSVP confirmations and other guest emails are sent from
              your address using your own mail server (SMTP), so they land in the
              inbox — not spam. When off, they come from EventSH.
            </p>
          </div>
        </div>
        <Switch
          checked={cfg.enabled}
          onCheckedChange={(v) => set("enabled", v)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">From name</Label>
          <Input
            value={cfg.fromName}
            onChange={(e) => set("fromName", e.target.value)}
            placeholder="e.g. Aisha & Dev"
          />
        </div>
        <div>
          <Label className="text-xs">From email</Label>
          <Input
            type="email"
            value={cfg.fromEmail}
            onChange={(e) => set("fromEmail", e.target.value)}
            placeholder="you@yourdomain.com"
          />
        </div>
        <div>
          <Label className="text-xs">SMTP host</Label>
          <Input
            value={cfg.smtpHost}
            onChange={(e) => set("smtpHost", e.target.value)}
            placeholder="smtp.gmail.com"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Port</Label>
            <Input
              type="number"
              value={cfg.smtpPort}
              onChange={(e) => set("smtpPort", Number(e.target.value) || 465)}
              placeholder="465"
            />
          </div>
          <div className="flex flex-col justify-end pb-1">
            <Label className="text-xs">SSL</Label>
            <div className="flex h-10 items-center">
              <Switch
                checked={cfg.smtpSecure}
                onCheckedChange={(v) => set("smtpSecure", v)}
              />
            </div>
          </div>
        </div>
        <div>
          <Label className="text-xs">SMTP username</Label>
          <Input
            value={cfg.smtpUser}
            onChange={(e) => set("smtpUser", e.target.value)}
            placeholder="you@yourdomain.com"
          />
        </div>
        <div>
          <Label className="text-xs">
            SMTP password{" "}
            {hasPassword && (
              <span className="text-emerald-600">(saved)</span>
            )}
          </Label>
          <div className="relative">
            <Input
              type={showPass ? "text" : "password"}
              value={cfg.smtpPass}
              onChange={(e) => set("smtpPass", e.target.value)}
              placeholder={hasPassword ? "•••••••• (unchanged)" : "App password"}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              tabIndex={-1}
            >
              {showPass ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-stone-400">
        Tip: with Gmail, use an{" "}
        <a
          href="https://support.google.com/accounts/answer/185833"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          App Password
        </a>{" "}
        (not your normal password) and host <code>smtp.gmail.com</code>, port{" "}
        <code>465</code>.
      </p>

      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label className="text-xs">Send a test email to</Label>
          <Input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="your@email.com"
          />
        </div>
        <Button
          variant="outline"
          onClick={sendTest}
          disabled={testing}
          className="sm:w-auto"
        >
          {testing ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1 h-4 w-4" />
          )}
          Send test
        </Button>
        <Button onClick={save} disabled={saving} className="sm:w-auto">
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}
