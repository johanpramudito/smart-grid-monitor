"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import Link from "next/link";

// This new page at `/login` now handles user authentication.
export default function LoginPage() {
  const [email, setEmail] = useState("operator@smartgrid.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // --- Firebase Authentication Logic Placeholder ---
    // In a real application, you would replace this with:
    // await signInWithEmailAndPassword(auth, email, password);
    if (email && password) {
      console.log("Simulating successful sign-in for:", email);
      // On success, redirect to the main dashboard
      router.push("/dashboard");
    } else {
      setError("Please provide valid credentials.");
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
      <Card className="w-full max-w-sm mx-4 bg-slate-800 border-slate-700 text-white">
        <CardHeader>
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription className="text-slate-400">
            Access the Smart Grid Monitor dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn}>
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
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Sign In
              </Button>
            </div>
          </form>
          <div className="mt-4 text-center text-sm text-slate-400">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="underline hover:text-blue-400">
              Sign Up
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
