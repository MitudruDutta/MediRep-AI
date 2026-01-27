"use client";

import { useEffect, useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Pill, ArrowRight, Shield, Zap, Users, Loader2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import dynamic from "next/dynamic";

const GL = dynamic(() => import("@/components/gl").then((mod) => mod.GL), {
  ssr: false,
});

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      {/* GL Background */}
      <div className="fixed inset-0 z-0">
        <GL hovering={false} />
      </div>
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pill className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">MediRep AI</h1>
          </div>
          <div className="flex items-center gap-4">
            <ModeToggle />
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : user ? (
              <Link href="/dashboard">
                <Button>
                  Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/login">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link href="/auth/signup">
                  <Button>Get Started</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 relative z-10">
        <section className="py-20 px-4">
          <div className="container mx-auto text-center space-y-8 max-w-4xl">
            <div className="inline-flex items-center rounded-full border px-3 py-1 text-sm text-muted-foreground">
              <Shield className="mr-2 h-4 w-4" />
              Trusted by healthcare professionals
            </div>

            <h2 className="text-4xl md:text-6xl font-bold tracking-tight">
              Your AI-Powered{" "}
              <span className="text-primary">Medical Assistant</span>
            </h2>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get instant access to drug information, interaction checks, and
              safety alerts. Built for medical representatives who need accurate
              information fast.
            </p>

            <div className="flex gap-4 justify-center flex-wrap">
              {user ? (
                <Link href="/dashboard">
                  <Button size="lg" className="text-lg px-8">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                    <Link href="/auth/signup?role=patient">
                      <Button size="lg" className="text-lg px-8 w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                        Get Started as Patient
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                    <Link href="/pharmacist/register">
                      <Button size="lg" variant="outline" className="text-lg px-8 w-full sm:w-auto border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-400">
                        Join as Pharmacist
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                  </div>
                  <div className="mt-4">
                    <Link href="/auth/login">
                      <Button variant="link" className="text-slate-400 hover:text-white">
                        Already have an account? Sign In
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-4 bg-muted/50">
          <div className="container mx-auto">
            <h3 className="text-3xl font-bold text-center mb-12">
              Everything you need for drug information
            </h3>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="bg-background rounded-lg p-6 border shadow-sm">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h4 className="text-xl font-semibold mb-2">Instant Answers</h4>
                <p className="text-muted-foreground">
                  Get accurate drug information in seconds. Ask about dosages,
                  contraindications, and more.
                </p>
              </div>

              <div className="bg-background rounded-lg p-6 border shadow-sm">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h4 className="text-xl font-semibold mb-2">Safety Alerts</h4>
                <p className="text-muted-foreground">
                  Automatic drug interaction checks and safety warnings to keep
                  patients safe.
                </p>
              </div>

              <div className="bg-background rounded-lg p-6 border shadow-sm">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h4 className="text-xl font-semibold mb-2">Patient Context</h4>
                <p className="text-muted-foreground">
                  Personalized recommendations based on patient history and
                  current medications.
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
