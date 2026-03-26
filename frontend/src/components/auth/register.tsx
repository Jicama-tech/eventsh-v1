import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useAuth } from "@/hooks/useAuth"; // Import the useAuth hook

export function RegistrationPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const apiURL = __API_URL__;
  const { toast } = useToast();
  const { login } = useAuth(); // Use the login function from the hook

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // 1. Send the form data to a new backend registration endpoint
      const response = await fetch(`${apiURL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // 2. If registration is successful, the backend should return a token
        if (data.token) {
          login(data.token); // 3. Use the token to log in the auth on the frontend
        }
        toast({
          duration: 5000,
          title: "Registration Successful",
          description: "You have been registered and logged in.",
        });
      } else {
        throw new Error(data.message || "Registration failed.");
      }
    } catch (error) {
      toast({
        duration: 5000,
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleGoogleSignUp = () => {
    // CORRECT: Point to the initial Google auth endpoint, not the callback URL.
    window.location.href = `${__API_URL__}/auth/google`;
  };

  const handleInstagramSignUp = () => {
    window.location.href = `${__API_URL__}/auth/instagram`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
      {" "}
      <Card className="w-full max-w-md">
        {" "}
        <CardHeader className="text-center">
          {" "}
          <CardTitle className="text-2xl">Create Your Account</CardTitle>{" "}
          <CardDescription>
            Join the Event Platform to get started.{" "}
          </CardDescription>{" "}
        </CardHeader>{" "}
        <CardContent>
          {" "}
          <form onSubmit={handleRegistration} className="space-y-4">
            {" "}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>{" "}
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
              />{" "}
            </div>{" "}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>{" "}
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />{" "}
            </div>{" "}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>{" "}
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password"
                required
              />{" "}
            </div>{" "}
            <Button type="submit" className="w-full">
              Register{" "}
            </Button>{" "}
          </form>{" "}
          <div className="relative my-6">
            {" "}
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />{" "}
            </div>{" "}
            <div className="relative flex justify-center text-xs uppercase">
              {" "}
              <span className="bg-background px-2 text-muted-foreground">
                Or sign up with{" "}
              </span>{" "}
            </div>{" "}
          </div>{" "}
          <div className="grid grid-cols-2 gap-4">
            {" "}
            <Button variant="buttonOutline" onClick={handleGoogleSignUp}>
              <FaGoogle className="mr-2" />
              Google{" "}
            </Button>{" "}
            <Button variant="buttonOutline" onClick={handleInstagramSignUp}>
              <FaInstagram className="mr-2" />
              Instagram{" "}
            </Button>{" "}
          </div>{" "}
          <div className="mt-6 text-center text-sm">
            Already have an account?{" "}
            <Link to="/login" className="underline">
              Log in{" "}
            </Link>{" "}
          </div>{" "}
        </CardContent>{" "}
      </Card>{" "}
    </div>
  );
}
