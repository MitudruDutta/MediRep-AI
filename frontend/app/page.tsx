"use client";

import { useEffect, useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Pill, ArrowRight, Shield, Zap, Users, Loader2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const GL = dynamic(() => import("@/components/gl").then((mod) => mod.GL), {
  ssr: false,
});

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      {/* GL Background */}
      <div className="fixed inset-0 z-0">
        <GL hovering={false} />
      </div>

      {/* Navbar - Transforms on scroll */}
      <nav className="fixed z-50 w-full px-2 pt-2">
        <div
          className={cn(
            "mx-auto px-6 transition-all duration-500 ease-out lg:px-5",
            scrolled
              ? "max-w-4xl rounded-[20px] border border-white/20 bg-white/10 dark:bg-black/20 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] ring-1 ring-white/10"
              : "max-w-6xl bg-transparent"
          )}
          style={scrolled ? {
            background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
          } : {}}
        >
          <div className="relative flex items-center justify-between py-3 lg:py-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <Pill className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">MediRep AI</h1>
            </Link>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
              <ModeToggle />
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : user ? (
                <div className="flex items-center gap-2">
                  <Link href="/pharmacist/dashboard">
                    <Button variant="ghost" size={scrolled ? "sm" : "default"}>Pharmacist</Button>
                  </Link>
                  <Link href="/dashboard">
                    <Button size={scrolled ? "sm" : "default"}>
                      Dashboard
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/auth/login">
                    <Button variant="ghost" size={scrolled ? "sm" : "default"}>Sign In</Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button size={scrolled ? "sm" : "default"}>Get Started</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Spacer for fixed navbar */}
      <div className="h-20" />

      {/* Hero Section */}
      <main className="flex-1 relative z-10">
        <section className="py-20 px-4">
          <div className="container mx-auto text-center space-y-8 max-w-4xl">
            {/* Hero Content - Floating freely */}
            <div className="relative z-10 space-y-8 py-10">
              {/* Subtle ambient glow - Blue in dark mode, Purple in light mode */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 dark:bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

              <div className="relative">
                <div className="inline-flex items-center rounded-full border border-zinc-200 dark:border-white/20 bg-white/50 dark:bg-white/5 px-4 py-1.5 text-sm font-medium text-zinc-800 dark:text-white/90 backdrop-blur-md shadow-sm ring-1 ring-black/5 dark:ring-white/10 mb-8">
                  <Shield className="mr-2 h-4 w-4 text-primary" />
                  Trusted by healthcare professionals
                </div>

                <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight text-foreground drop-shadow-sm leading-[1.1]">
                  MediRep <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">AI</span> Medical<br />
                  <span className="italic block mt-2">Assistant</span>
                </h1>

                <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light tracking-wide mt-8">
                  Get instant access to drug information, interaction checks, and
                  safety alerts. Built for medical representatives who need accurate
                  information fast.
                </p>
              </div>
            </div>

            <div className="flex gap-6 justify-center items-center flex-wrap pt-8">
              {user ? (
                <>
                  <Link href="/dashboard">
                    <Button size="lg" className="h-14 px-10 text-lg rounded-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-xl transition-all hover:scale-105 duration-300 font-medium">
                      Go to Dashboard
                    </Button>
                  </Link>
                  <Link href="/pharmacist/dashboard">
                    <Button variant="ghost" className="text-lg text-zinc-600 hover:text-black hover:bg-zinc-100 dark:text-white/80 dark:hover:text-white dark:hover:bg-white/10 font-medium px-4 h-14 rounded-full">
                      Pharmacist Portal
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/auth/signup?role=patient">
                    <Button size="lg" className="h-14 px-10 text-lg rounded-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-xl transition-all hover:scale-105 duration-300 font-medium">
                      Get Started
                    </Button>
                  </Link>
                  <Link href="/pharmacist/auth/signup">
                    <Button variant="ghost" className="text-lg text-zinc-600 hover:text-black hover:bg-zinc-100 dark:text-white/80 dark:hover:text-white dark:hover:bg-white/10 font-medium px-4 h-14 rounded-full">
                      Join as Pharmacist
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-4 relative">
          <div className="container mx-auto">
            <h3 className="text-3xl font-bold text-center mb-12">
              Everything you need for drug information
            </h3>
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* Feature 1 */}
              <div className="bg-white/20 dark:bg-black/20 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 dark:border-white/5 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 w-14 h-14 flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/20">
                  <Zap className="h-7 w-7 text-primary" />
                </div>
                <h4 className="text-xl font-bold mb-3">Instant Answers</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Get accurate drug information in seconds. Ask about dosages,
                  contraindications, and more with AI precision.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white/20 dark:bg-black/20 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 dark:border-white/5 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                <div className="rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 w-14 h-14 flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/20">
                  <Shield className="h-7 w-7 text-blue-500" />
                </div>
                <h4 className="text-xl font-bold mb-3">Safety Alerts</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Automatic drug interaction checks and safety warnings to keep
                  your patients safe and informed.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white/20 dark:bg-black/20 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 dark:border-white/5 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                <div className="rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 w-14 h-14 flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/20">
                  <Users className="h-7 w-7 text-indigo-500" />
                </div>
                <h4 className="text-xl font-bold mb-3">Patient Context</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Personalized recommendations based on patient history,
                  medications, and specific needs.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 relative z-10">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built for better healthcare information access</p>
        </div>
      </footer>
    </div>
  );
}
