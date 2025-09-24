"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

// This is the new root landing page for the application.
// It provides a welcoming message and navigation to login or signup.
export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white text-center p-4">
      <div className="mb-8">
        <Zap className="h-16 w-16 text-sky-400 mx-auto" />
      </div>
      <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
        Welcome to the Smart Grid Monitor
      </h1>
      <p className="max-w-2xl text-lg text-slate-400 mb-8">
        The future of energy management. Monitor, analyze, and ensure the
        reliability of your electrical grid with real-time data and intelligent
        fault detection.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/login">
          <Button className="w-48 bg-blue-600 hover:bg-blue-700">
            Sign In
          </Button>
        </Link>
        <Link href="/signup">
          <Button
            variant="outline"
            className="w-48 bg-transparent border-slate-700 hover:bg-slate-800 hover:text-white"
          >
            Create Account
          </Button>
        </Link>
      </div>
    </div>
  );
}
