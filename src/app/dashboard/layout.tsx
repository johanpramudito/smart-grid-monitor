"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, ReactNode } from "react";
import { Bell, Gauge, History, Network, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

// This layout wraps all dashboard pages. It provides the persistent sidebar,
// header, and checks for user authentication.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // --- Firebase Auth Protection Logic Placeholder ---
    // In a real app, you'd use onAuthStateChanged here.
    // const unsubscribe = onAuthStateChanged(auth, (user) => {
    //   if (!user) {
    //     router.push("/");
    //   } else {
    //     setLoading(false);
    //   }
    // });
    // return () => unsubscribe();

    // Simulating the auth check
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, [router]);

  const navItems = [
    { href: "/dashboard", icon: Gauge, label: "Dashboard" },
    { href: "/dashboard/topology", icon: Network, label: "Grid Topology" },
    { href: "/dashboard/logs", icon: History, label: "Log & History" },
  ];

  const handleSignOut = () => {
    // Placeholder for Firebase signOut
    console.log("Signing out...");
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <p>Verifying authentication...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-900 text-white">
      <aside className="w-64 bg-slate-800 p-4 flex flex-col justify-between">
        <div>
          <h1 className="text-xl font-bold mb-8 text-center tracking-wider">
            Smart Grid Monitor
          </h1>
          <nav className="flex flex-col space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center p-3 rounded-lg transition-colors text-sm ${
                  pathname === item.href
                    ? "bg-blue-600 text-white font-semibold"
                    : "text-slate-300 hover:bg-slate-700"
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <Button
          onClick={handleSignOut}
          variant="ghost"
          className="w-full flex justify-start items-center p-3 text-slate-300 hover:bg-slate-700 hover:text-white"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sign Out
        </Button>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-end p-4 h-16 border-b border-slate-700">
          <button className="relative p-2 rounded-full hover:bg-slate-700">
            <Bell className="w-6 h-6 text-slate-300" />
            <span className="absolute top-2 right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </button>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
