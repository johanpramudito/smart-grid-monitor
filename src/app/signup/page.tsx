"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// This new page at `/signup` handles new user registration.
export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // --- Firebase Authentication Logic Placeholder ---
    // In a real application, you would replace this with:
    // await createUserWithEmailAndPassword(auth, email, password);
    if (email && password) {
      console.log("Simulating account creation for:", email);
      // On success, redirect to the dashboard
      router.push("/dashboard");
    } else {
      setError("Please fill out all fields.");
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
      <Card className="w-full max-w-sm mx-4 bg-slate-800 border-slate-700 text-white">
        <CardHeader>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription className="text-slate-400">
            Enter your details to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-700 placeholder:text-slate-400 border-slate-600 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-700 placeholder:text-slate-400 border-slate-600 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="********"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-slate-700 placeholder:text-slate-400 border-slate-600 focus:ring-sky-500"
                />
              </div>
              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Sign Up
              </Button>
            </div>
          </form>
          <div className="mt-4 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="underline hover:text-blue-400">
              Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
