import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plug, RefreshCw, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";

const apiURL = __API_URL__;

type KeyStatus =
  | { active: false }
  | {
      active: true;
      prefix: string;
      maskedKey?: string;
      createdAt?: string | null;
      lastUsedAt?: string | null;
    };

function authHeaders(): Record<string, string> {
  // Read per request: the token can be replaced by a re-login in another tab.
  return { Authorization: `Bearer ${sessionStorage.getItem("token")}` };
}

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Settings > ComBox. The organizer makes the key ComBox connects with, as
 * KiosCart's shopkeepers do. Shown once; making a new one stops the old one.
 */
export function ComboxConnector() {
  const { toast } = useToast();
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [busy, setBusy] = useState<"generate" | "revoke" | null>(null);
  const [confirm, setConfirm] = useState<"regenerate" | "revoke" | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<"key" | "url" | null>(null);
  const mountedRef = useRef(false);
  // The address to type into ComBox: the site, without /api
  const siteUrl = apiURL.replace(/\/api\/?$/, "");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiURL}/integration/combox/api-key`, { headers: authHeaders() });
      const body = await res.json().catch(() => null);
      if (!mountedRef.current) return;
      if (!res.ok || !body || typeof body.active !== "boolean") {
        setUnavailable("The ComBox connection could not be reached. Try again in a moment.");
        return;
      }
      setUnavailable(null);
      setStatus(body as KeyStatus);
    } catch {
      if (mountedRef.current) setUnavailable("The ComBox connection could not be reached. Try again in a moment.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setBusy("generate");
    try {
      const res = await fetch(`${apiURL}/integration/combox/api-key`, { method: "POST", headers: authHeaders() });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.apiKey) {
        toast({ title: "Could not create the key", description: body?.message || "Try again.", variant: "destructive" });
        return;
      }
      setNewKey(body.apiKey);
      await load();
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const revoke = async () => {
    setBusy("revoke");
    try {
      const res = await fetch(`${apiURL}/integration/combox/api-key`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) {
        toast({ title: "Could not turn the key off", variant: "destructive" });
        return;
      }
      setNewKey(null);
      await load();
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const copy = async (what: "key" | "url", text: string) => {
    if (await copyText(text)) {
      setCopied(what);
      setTimeout(() => mountedRef.current && setCopied(null), 1500);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="w-5 h-5" /> Connect ComBox
        </CardTitle>
        <CardDescription>
          Connect your ComBox workspace to this organizer account: your events and ticket buyers go into ComBox Contacts,
          ready for campaigns, flows and the AI. Create a key here and paste it, with the address below, into ComBox &gt; Events.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {unavailable && <p className="text-sm text-destructive">{unavailable}</p>}

        <div className="space-y-1.5">
          <Label>eventsh address</Label>
          <div className="flex gap-2">
            <Input readOnly value={siteUrl} className="font-mono text-sm" />
            <Button type="button" variant="outline" onClick={() => copy("url", siteUrl)}>
              {copied === "url" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {newKey && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 space-y-2">
            <p className="text-sm font-medium">Copy your key now. It is shown only once.</p>
            <div className="flex gap-2">
              <Input readOnly value={newKey} className="font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" onClick={() => copy("key", newKey)}>
                {copied === "key" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setNewKey(null)}>
              I have copied it
            </Button>
          </div>
        )}

        {status === null && !unavailable ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : status?.active ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary" className="gap-1"><KeyRound className="w-3 h-3" /> Key on</Badge>
              <span className="font-mono">{status.maskedKey}</span>
              {formatDate(status.createdAt) && <span className="text-muted-foreground">made {formatDate(status.createdAt)}</span>}
              <span className="text-muted-foreground">
                {formatDate(status.lastUsedAt) ? `last used ${formatDate(status.lastUsedAt)}` : "not used yet"}
              </span>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => setConfirm("regenerate")}>
                <RefreshCw className="w-4 h-4 mr-2" /> Make a new key
              </Button>
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => setConfirm("revoke")}>
                <Trash2 className="w-4 h-4 mr-2" /> Turn off
              </Button>
            </div>
          </div>
        ) : status ? (
          <Button type="button" disabled={busy !== null} onClick={generate}>
            {busy === "generate" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
            Create key
          </Button>
        ) : null}
      </CardContent>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "revoke" ? "Turn the key off?" : "Make a new key?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "revoke"
                ? "ComBox stops receiving your events and ticket buyers until you make a new key."
                : "The current key stops working at once. Paste the new one into ComBox to keep it connected."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const what = confirm;
                setConfirm(null);
                if (what === "revoke") revoke();
                else generate();
              }}
            >
              {confirm === "revoke" ? "Turn off" : "Make new key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
