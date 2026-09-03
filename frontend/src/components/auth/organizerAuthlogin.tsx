import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FaGoogle } from "react-icons/fa";
import { Loader2, Ticket, Users } from "lucide-react";
import { AuthStyles } from "./AuthStyles";
import { useAuth } from "@/hooks/useAuth";
import { jwtDecode } from "jwt-decode";

type AccountChoice = {
  accountId: string;
  accountType: "organizer" | "operator";
  organizationName: string;
  approved: boolean;
};

type SelectionTokenPayload = {
  typ: "organizer-select";
  email: string;
  name?: string;
  accounts: AccountChoice[];
  exp?: number;
};

export function OrganizerEShopLogin() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const apiURL = __API_URL__;
  const { login } = useAuth();

  const [isLoading, setIsLoading] = useState({
    google: false,
  });
  const [isChecking, setIsChecking] = useState(false);
  const [searchParams] = useSearchParams();

  // Multi-account selection state (post-Google sign-in path).
  const [selToken, setSelToken] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountChoice[]>([]);
  const [selectedAccountKey, setSelectedAccountKey] = useState<string>("");
  const [isSubmittingSelection, setIsSubmittingSelection] = useState(false);

  // Where to land after a successful sign-in. Email links (e.g. the stall
  // review notification) hit /organizer/login?redirect=/organizer-dashboard so
  // a logged-out reviewer is sent through login first. We stash it in
  // sessionStorage because the Google OAuth round-trip drops the query string.
  const resolvePostLogin = () => {
    const dest = sessionStorage.getItem("postLoginRedirect");
    sessionStorage.removeItem("postLoginRedirect");
    // Only honour internal paths to avoid an open-redirect.
    return dest && dest.startsWith("/") ? dest : "/organizer-dashboard";
  };

  useEffect(() => {
    const token = searchParams.get("token");
    const direct = searchParams.get("direct");
    const errorCode = searchParams.get("error");
    const selTokenParam = searchParams.get("selToken");

    // Capture the post-login redirect before any early-return / OAuth hop.
    const redirectParam = searchParams.get("redirect");
    if (redirectParam && redirectParam.startsWith("/")) {
      sessionStorage.setItem("postLoginRedirect", redirectParam);
    }

    if (errorCode === "auth_failed") {
      toast({
        duration: 6000,
        title: "Sign-in failed",
        description: "Couldn't sign you in with Google. Please try again.",
        variant: "destructive",
      });
      setIsChecking(false);
      return;
    }
    if (errorCode === "pending_approval") {
      toast({
        duration: 8000,
        title: "Approval pending",
        description:
          "Your organizer account is awaiting admin approval. You'll be able to sign in once it's approved.",
        variant: "destructive",
      });
      setIsChecking(false);
      return;
    }

    // Backend has already minted the organizer JWT — log in directly.
    if (token && direct === "1") {
      sessionStorage.setItem("token", token);
      login(token);
      toast({
        duration: 3000,
        title: "Welcome back!",
        description: "Signed in via Google.",
      });
      navigate(resolvePostLogin(), { replace: true });
      return;
    }

    // Multi-account path — backend redirected here with a short-lived
    // selection token. Decode locally to render the dropdown.
    if (selTokenParam) {
      try {
        const decoded = jwtDecode<SelectionTokenPayload>(selTokenParam);
        if (decoded?.typ !== "organizer-select" || !Array.isArray(decoded.accounts)) {
          throw new Error("malformed selection token");
        }
        setSelToken(selTokenParam);
        setAccounts(decoded.accounts);
      } catch {
        toast({
          duration: 6000,
          title: "Selection link invalid",
          description: "Please sign in with Google again.",
          variant: "destructive",
        });
      }
      setIsChecking(false);
      return;
    }

    // No token, no error → show the normal login screen.
    setIsChecking(false);
  }, [searchParams, navigate, toast, login]);

  const accountKey = (a: AccountChoice) => `${a.accountType}:${a.accountId}`;

  const handleConfirmSelection = async () => {
    if (!selToken || !selectedAccountKey) return;
    const chosen = accounts.find((a) => accountKey(a) === selectedAccountKey);
    if (!chosen || !chosen.approved) return;

    setIsSubmittingSelection(true);
    try {
      const response = await fetch(`${apiURL}/auth/select-organizer-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selToken,
          accountId: chosen.accountId,
          accountType: chosen.accountType,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.message || "Could not complete sign-in");
      }
      sessionStorage.setItem("token", result.token);
      login(result.token);
      toast({
        duration: 3000,
        title: "Welcome back!",
        description: `Signed in to ${chosen.organizationName}`,
      });
      navigate(resolvePostLogin(), { replace: true });
    } catch (err: any) {
      toast({
        duration: 6000,
        title: "Sign-in failed",
        description: err?.message || "Please try signing in again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingSelection(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading({ ...isLoading, google: true });
    try {
      // Redirect to organizer-specific google auth
      window.location.href = `${apiURL}/auth/google-organizer`;
    } catch (error) {
      toast({
        duration: 5000,
        title: "Login Error",
        description: "Failed to connect with Google",
        variant: "destructive",
      });
      setIsLoading({ ...isLoading, google: false });
    }
  };

  // Show loading while checking role
  if (isChecking) {
    return (
      <div className="ehl">
        <AuthStyles />
        <span className="ehl-blob b1" aria-hidden="true" />
        <span className="ehl-blob b2" aria-hidden="true" />
        <div className="ehl-grain" aria-hidden="true" />
        <div className="ehl-checking">
          <Loader2 className="ehl-spin w-8 h-8 animate-spin" />
          <p>Verifying your profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ehl">
      <AuthStyles />

      {/* Same backdrop as the landing hero: drifting blobs, a masked grid and
          the grain that keeps the flat gradients from looking like plastic. */}
      <span className="ehl-blob b1" aria-hidden="true" />
      <span className="ehl-blob b2" aria-hidden="true" />
      <div className="ehl-grid" aria-hidden="true" />
      <div className="ehl-grain" aria-hidden="true" />

      <div className="ehl-wrap">
        {/* ---------- pitch ---------- */}
        <div className="ehl-pitch">
          <Link to="/" className="ehl-back">
            ← Back to site
          </Link>
          <span className="ehl-kick">
            {accounts.length > 0 ? "Almost there" : "Free to start"}
          </span>
          <h1>
            Run the whole event.
            <br />
            <span className="ehl-swoon">One login.</span>
          </h1>
          <p className="ehl-lede">
            Floor plans, registrations, payments, suppliers and profit — all
            behind the same account, on your own domain.
          </p>
          <ul className="ehl-points">
            <li>One link that sells, registers, charges and checks people in</li>
            <li>Eleven event formats, configured out of the box</li>
            <li>Income and expenses in one ledger, live as the event runs</li>
          </ul>
        </div>

        {/* ---------- card ---------- */}
        <div className="ehl-card">
          <div className="ehl-card-head">
            <div className="ehl-brand">
              <span className="ehl-bulb" aria-hidden="true" />
              Eventsh
            </div>
            {accounts.length > 0 ? (
              <>
                <h2>Pick your organization.</h2>
                <p>
                  This Google account manages more than one. Choose the one you
                  want to open.
                </p>
              </>
            ) : (
              <>
                <h2>Welcome back.</h2>
                <p>
                  Sign in to create and manage your events — whether you are
                  going solo or running an organization.
                </p>
              </>
            )}
          </div>

          {accounts.length > 0 ? (
            <div className="ehl-stack">
              <div>
                <span className="ehl-label">Organization</span>
                <Select
                  value={selectedAccountKey}
                  onValueChange={setSelectedAccountKey}
                >
                  <SelectTrigger className="ehl-select">
                    <SelectValue placeholder="Choose an organization…" />
                  </SelectTrigger>
                  <SelectContent className="ehl-menu">
                    {accounts.map((a) => {
                      const key = accountKey(a);
                      return (
                        <SelectItem
                          key={key}
                          value={key}
                          disabled={!a.approved}
                        >
                          <div className="flex items-center justify-between w-full gap-3">
                            <span>{a.organizationName}</span>
                            {!a.approved && (
                              <span className="ehl-pending">
                                Pending approval
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <button
                type="button"
                className="ehl-btn ehl-btn-p"
                onClick={handleConfirmSelection}
                disabled={!selectedAccountKey || isSubmittingSelection}
              >
                {isSubmittingSelection && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Enter dashboard
              </button>

              <button
                type="button"
                className="ehl-btn ehl-btn-t"
                onClick={() => {
                  setSelToken(null);
                  setAccounts([]);
                  setSelectedAccountKey("");
                }}
              >
                Use a different Google account
              </button>
            </div>
          ) : (
            <div className="ehl-stack">
              <button
                type="button"
                className="ehl-btn ehl-btn-p"
                onClick={handleGoogleLogin}
                disabled={isLoading.google}
              >
                {isLoading.google ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <FaGoogle className="h-4 w-4" />
                    Continue with Google
                  </>
                )}
              </button>
              <p className="ehl-note">
                New here? Start as an individual and upgrade to a full organizer
                account any time.
              </p>
            </div>
          )}

          <div className="ehl-trust">
            <span className="ehl-chip lime">
              <Users className="h-3.5 w-3.5" />
              Individuals &amp; organizers
            </span>
            <span className="ehl-chip pink">
              <Ticket className="h-3.5 w-3.5" />
              Create &amp; sell tickets
            </span>
            <span className="ehl-chip">No card required</span>
          </div>
        </div>
      </div>
    </div>
  );
}
