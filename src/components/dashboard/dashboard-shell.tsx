"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, ReactNode, useEffect } from "react";
import { Bell, Gauge, History, Network, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type DashboardShellProps = {
  children: ReactNode;
  userEmail: string;
};

export function DashboardShell({ children, userEmail }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  const navItems = [
    { href: "/dashboard", icon: Gauge, label: "Dashboard" },
    { href: "/dashboard/topology", icon: Network, label: "Grid Topology" },
    { href: "/dashboard/logs", icon: History, label: "Log & History" },
  ];

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      router.push("/login");
    } catch (error) {
      console.error("Failed to sign out:", error);
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-900 text-white">
      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Hidden on mobile, drawer on mobile when open, always visible on desktop */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-slate-800 p-4 flex flex-col justify-between
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Close button for mobile */}
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-700 text-slate-300"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-xl font-bold mb-8 text-center tracking-wider pr-8 lg:pr-0">
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
        <div className="space-y-2">
          <p className="text-xs text-slate-400 truncate">{userEmail}</p>
          <Button
            onClick={handleSignOut}
            variant="ghost"
            className="w-full flex justify-start items-center p-3 text-slate-300 hover:bg-slate-700 hover:text-white"
            disabled={isSigningOut}
          >
            <LogOut className="w-5 h-5 mr-3" />
            {isSigningOut ? "Signing Out..." : "Sign Out"}
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between lg:justify-end p-4 h-16 border-b border-slate-700 gap-4">
          {/* Hamburger menu for mobile */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-700 text-slate-300"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden sm:block truncate">
              Logged in as {userEmail}
            </span>
            <button className="relative p-2 rounded-full hover:bg-slate-700 flex-shrink-0">
              <Bell className="w-6 h-6 text-slate-300" />
              <span className="absolute top-2 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
