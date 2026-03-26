import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  useEffect(() => {
    const token = searchParams.get("token");
    const email = searchParams.get("email");
    const name = searchParams.get("name") || "";

    // If no token/email in URL, show normal login UI
    if (!token || !email) {
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    sessionStorage.setItem("token", token);

    (async () => {
      try {
        const res = await fetch(`${apiURL}/auth/check-role`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email,
            name,
            role: "organizer",
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to check role");
        }

        const data = await res.json();


        // CASE 1: Shopkeeper found, OTP sent
        if (data.found && data.data?.role === "organizer") {
          toast({
            duration: 5000,
            title: "Organizer Found",
            description: data.message,
          });
          navigate("/login", {
            replace: true,
            state: { email },
          });
          return;
        }

        // CASE 2: Shopkeeper found but OTP failed
        if (data.found && data.data?.role === "organizer") {
          toast({
            duration: 5000,
            title: "New Organizer",
            description: data.message,
          });
          setIsChecking(false);
          return;
        }

        // CASE 3: No shopkeeper yet -> go to registration
        if (!data.found) {
          toast({
            duration: 5000,
            title: "Complete Registration",
            description: data.message,
          });
          navigate("/register", {
            replace: true,
            state: { email, name },
          });
        }
      } catch (error: any) {
        console.error("Check role error:", error);
        toast({
          duration: 5000,
          title: "Error",
          description: "Could not verify Organizer availability.",
          variant: "destructive",
        });
        setIsChecking(false);
      }
    })();
  }, [searchParams, apiURL, navigate, toast]);

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
