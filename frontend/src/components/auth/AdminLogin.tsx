import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { FaGoogle, FaInstagram } from "react-icons/fa";
import {
  Calendar,
  ShoppingBag,
  Sparkles,
  Users,
  TrendingUp,
  Gift,
  Star,
  Zap,
  Heart,
  Crown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function AdminLogin() {
  const { toast } = useToast();
  const { login } = useAuth();
  const apiURL = __API_URL__;
  const [isLoading, setIsLoading] = useState({
    google: false,
    instagram: false,
  });

  const handleGoogleLogin = async () => {
    setIsLoading({ ...isLoading, google: true });
    try {
      window.location.href = `${apiURL}/auth/google`;
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

  const handleInstagramLogin = async () => {
    setIsLoading({ ...isLoading, instagram: true });
    try {
      window.location.href = `${apiURL}/auth/instagram`;
    } catch (error) {
      toast({
        duration: 5000,
        title: "Login Error",
        description: "Failed to connect with Instagram",
        variant: "destructive",
      });
      setIsLoading({ ...isLoading, instagram: false });
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-black via-gray-900 to-gray-800">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        {/* Floating Icons */}
        <div className="absolute top-20 left-10 animate-bounce delay-1000">
          <Calendar className="h-8 w-8 text-white/20" />
        </div>
        <div className="absolute top-32 right-16 animate-pulse delay-2000">
          <ShoppingBag className="h-10 w-10 text-white/15" />
        </div>
        <div className="absolute bottom-40 left-20 animate-bounce delay-500">
          <Gift className="h-6 w-6 text-white/25" />
        </div>
        <div className="absolute top-1/2 right-10 animate-pulse delay-3000">
          <Users className="h-8 w-8 text-white/20" />
        </div>
        <div className="absolute bottom-20 right-32 animate-bounce delay-1500">
          <Star className="h-6 w-6 text-white/30" />
        </div>
        <div className="absolute top-16 left-1/2 animate-pulse delay-4000">
          <Crown className="h-7 w-7 text-white/15" />
        </div>

        {/* Animated Gradient Orbs - Black & White */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-gradient-to-r from-white/10 to-gray-300/10 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-r from-gray-400/10 to-white/10 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-20 w-72 h-72 bg-gradient-to-r from-gray-600/10 to-gray-300/10 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Branding & Features */}
          <div className="text-center lg:text-left space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-center lg:justify-start space-x-3">
                <div className="relative">
                  <Sparkles className="h-10 w-10 text-white animate-pulse" />
                  <div className="absolute -top-1 -right-1 h-4 w-4 bg-gray-300 rounded-full animate-ping" />
                </div>
                <h1 className="text-4xl lg:text-5xl font-bold text-white">
                  EventSH
                </h1>
              </div>
              <p className="text-xl lg:text-2xl text-gray-200 font-light">
                Where Events Meet E-commerce
              </p>
              <p className="text-gray-300 text-lg">
                Create memorable experiences and build your online empire
              </p>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-2 gap-4 mt-12">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 hover:bg-white/20 transition-all duration-300 group border border-white/10">
                <Calendar className="h-8 w-8 text-gray-200 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-white font-semibold text-sm">
                  Event Management
                </h3>
                <p className="text-gray-300 text-xs mt-1">
                  Plan & Execute Perfectly
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 hover:bg-white/20 transition-all duration-300 group border border-white/10">
                <ShoppingBag className="h-8 w-8 text-gray-200 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-white font-semibold text-sm">
                  Online Store
                </h3>
                <p className="text-gray-300 text-xs mt-1">
                  Sell Products Seamlessly
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 hover:bg-white/20 transition-all duration-300 group border border-white/10">
                <TrendingUp className="h-8 w-8 text-gray-200 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-white font-semibold text-sm">Analytics</h3>
                <p className="text-gray-300 text-xs mt-1">Track Your Growth</p>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 hover:bg-white/20 transition-all duration-300 group border border-white/10">
                <Heart className="h-8 w-8 text-gray-200 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-white font-semibold text-sm">Community</h3>
                <p className="text-gray-300 text-xs mt-1">Connect & Engage</p>
              </div>
            </div>
          </div>

          {/* Right Side - Login Card */}
          <div className="flex justify-center">
            <Card className="w-full max-w-md bg-white/95 backdrop-blur-lg border-gray-200 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 animate-fade-in-up">
              <CardHeader className="text-center pb-8">
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <Zap className="h-12 w-12 text-black animate-pulse" />
                    <div className="absolute -top-2 -right-2 h-6 w-6 bg-gradient-to-r from-gray-600 to-gray-800 rounded-full flex items-center justify-center animate-bounce">
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-black to-gray-700 bg-clip-text text-transparent">
                  Welcome Back!
                </CardTitle>
                <CardDescription className="text-lg text-gray-600 mt-2">
                  Sign in to access your dashboard and start creating amazing
                  experiences
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Social Login Buttons */}
                <div className="space-y-4">
                  <Button
                    variant="buttonOutline"
                    onClick={handleGoogleLogin}
                    disabled={isLoading.google}
                    className="w-full h-14 text-lg font-semibold border-2 border-gray-300 hover:border-gray-600 hover:bg-gray-50 transition-all duration-300 group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-600 to-black opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
                    {isLoading.google ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600" />
                    ) : (
                      <>
                        <FaGoogle className="mr-3 h-5 w-5 text-gray-700 group-hover:scale-110 transition-transform" />
                        Continue with Google
                      </>
                    )}
                  </Button>

                  <Button
                    variant="buttonOutline"
                    onClick={handleInstagramLogin}
                    disabled={isLoading.instagram}
                    className="w-full h-14 text-lg font-semibold border-2 border-gray-300 hover:border-gray-600 hover:bg-gray-50 transition-all duration-300 group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-black to-gray-700 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
                    {isLoading.instagram ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600" />
                    ) : (
                      <>
                        <FaInstagram className="mr-3 h-5 w-5 text-gray-700 group-hover:scale-110 transition-transform" />
                        Continue with Instagram
                      </>
                    )}
                  </Button>
                </div>

                {/* Trust Indicators */}
                <div className="flex items-center justify-center space-x-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-gray-600 rounded-full animate-pulse" />
                    <span className="text-sm text-gray-500">Secure Login</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Star className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-500">
                      Trusted Platform
                    </span>
                  </div>
                </div>

                {/* Footer Links */}
                <div className="text-center pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    New to EventSH?{" "}
                    <Link
                      to="/register"
                      className="font-semibold text-black hover:text-gray-700 transition-colors hover:underline"
                    >
                      Create Account
                    </Link>
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    By continuing, you agree to our{" "}
                    <Link to="/terms" className="underline hover:text-gray-700">
                      Terms & Services
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
