import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaGoogle } from "react-icons/fa";
import {
  CalendarDays,
  Sparkles,
  Users,
  Trophy,
  MapPin,
  Star,
  Zap,
  Crown,
  Loader2,
  Building2,
  Ticket,
} from "lucide-react";
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

  useEffect(() => {
    const token = searchParams.get("token");
    const direct = searchParams.get("direct");
    const errorCode = searchParams.get("error");
    const selTokenParam = searchParams.get("selToken");

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
      navigate("/organizer-dashboard", { replace: true });
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
      navigate("/organizer-dashboard", { replace: true });
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
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-600" />
          <p className="text-slate-900 font-medium">
            Verifying your organizer profile...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 animate-bounce delay-1000">
          <CalendarDays className="h-8 w-8 text-white/10" />
        </div>
        <div className="absolute top-32 right-16 animate-pulse delay-2000">
          <Ticket className="h-10 w-10 text-white/10" />
        </div>
        <div className="absolute bottom-40 left-20 animate-bounce delay-500">
          <MapPin className="h-6 w-6 text-white/10" />
        </div>
        <div className="absolute top-1/2 right-10 animate-pulse delay-3000">
          <Users className="h-8 w-8 text-white/10" />
        </div>
        <div className="absolute bottom-20 right-32 animate-bounce delay-1500">
          <Trophy className="h-6 w-6 text-white/10" />
        </div>

        {/* Indigo/Purple Orbs */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-indigo-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-20 w-72 h-72 bg-blue-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.2'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-4xl align-center gap-12 items-center">
          <div className="flex justify-center items-center">
            <Card className="w-full max-w-md bg-white/95 backdrop-blur-lg border-slate-200 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 animate-fade-in-up">
              <CardHeader className="text-center pb-6">
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <Crown className="h-12 w-12 text-indigo-600 animate-pulse" />
                    <div className="absolute -top-2 -right-2 h-6 w-6 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full flex items-center justify-center animate-bounce">
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-indigo-700 bg-clip-text text-transparent">
                  Organizer Portal
                </CardTitle>
                <CardDescription className="text-lg text-slate-600 mt-2 leading-relaxed">
                  Manage your events, venues, and team seamlessly.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {accounts.length > 0 ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700">
                        Multiple accounts found — pick one to continue
                      </Label>
                      <Select
                        value={selectedAccountKey}
                        onValueChange={setSelectedAccountKey}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Choose an organization..." />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => {
                            const key = accountKey(a);
                            return (
                              <SelectItem
                                key={key}
                                value={key}
                                disabled={!a.approved}
                              >
                                <div className="flex items-center justify-between w-full gap-2">
                                  <span
                                    className={
                                      a.approved
                                        ? ""
                                        : "text-muted-foreground"
                                    }
                                  >
                                    {a.organizationName}
                                  </span>
                                  {!a.approved && (
                                    <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full whitespace-nowrap">
                                      Pending Approval
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleConfirmSelection}
                      disabled={!selectedAccountKey || isSubmittingSelection}
                      className="w-full h-12 text-base font-semibold"
                    >
                      {isSubmittingSelection && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Enter Dashboard
                    </Button>

                    <Button
                      variant="ghost"
                      type="button"
                      className="w-full h-10"
                      onClick={() => {
                        setSelToken(null);
                        setAccounts([]);
                        setSelectedAccountKey("");
                      }}
                    >
                      Use a different Google account
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Button
                      variant="outline"
                      onClick={handleGoogleLogin}
                      disabled={isLoading.google}
                      className="w-full h-14 text-lg font-semibold border-2 border-slate-300 hover:border-indigo-600 hover:bg-slate-50 transition-all duration-300 group relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
                      {isLoading.google ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
                      ) : (
                        <>
                          <FaGoogle className="mr-3 h-5 w-5 text-slate-700 group-hover:scale-110 transition-transform" />
                          Continue as Organizer
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Trust Indicators */}
                <div className="flex items-center justify-center space-x-6 pt-4 border-t border-slate-200">
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm text-slate-500">
                      Business Access
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-slate-500">
                      Real-time Analytics
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
