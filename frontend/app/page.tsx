"use client";

import { useEffect, useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  Pill,
  ArrowRight,
  Shield,
  Zap,
  Users,
  Loader2,
  MessageSquareText,
  Search,
  IndianRupee,
  ShieldCheck,
  BadgeCheck,
  PhoneCall,
  ChevronRight,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import Image from "next/image";
import BlurText from "@/components/ui/blur-text";
import ScrambledText from "@/components/ui/scrambled-text";
import ScrollFloat from "@/components/ui/scroll-float";

const GL = dynamic(() => import("@/components/gl").then((mod) => mod.GL), {
  ssr: false,
});

// --- Helper Components ---

const DotGrid = () => {
  return (
    <div
      className="absolute inset-0 z-0 opacity-[0.4]"
      style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, var(--landing-muted-2) 1px, transparent 0)`,
        backgroundSize: "24px 24px",
      }}
    />
  );
};

interface FeatureTileProps {
  tone: "clay" | "marigold" | "moss";
  icon: React.ReactNode;
  title: string;
  body: string;
}

const FeatureTile = ({ tone, icon, title, body }: FeatureTileProps) => {
  const colors = {
    clay: {
      bg: "var(--landing-clay)",
      rgb: "var(--landing-clay-rgb)",
    },
    marigold: {
      bg: "var(--landing-marigold, #F5A623)",
      rgb: "245, 166, 35",
    },
    moss: {
      bg: "var(--landing-moss)",
      rgb: "var(--landing-moss-rgb)",
    },
  };

  const color = colors[tone] || colors.clay;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border p-4 transition-colors hover:bg-[color:var(--landing-card-strong)]"
      style={{ borderColor: "var(--landing-border)", backgroundColor: "var(--landing-card)" }}
    >
      <div className="mb-3 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `rgba(${color.rgb}, 0.1)`,
            color: color.bg,
          }}
        >
          {icon}
        </div>
        <div className="font-bold text-[color:var(--landing-ink)]">{title}</div>
      </div>
      <div className="text-sm leading-relaxed text-[color:var(--landing-muted)]">
        {body}
      </div>
    </div>
  );
};

interface SectionProps {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
}

const Section = ({ id, eyebrow, title, subtitle, children }: SectionProps) => {
  return (
    <section id={id} className="py-20 md:py-32 relative z-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-12 md:text-center">
          <div
            className="mb-4 text-xs font-bold uppercase tracking-widest text-[color:var(--landing-clay)]"
          >
            {eyebrow}
          </div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-[color:var(--landing-ink)] md:text-5xl font-[family-name:var(--font-display)]">
            {title}
          </h2>
          {subtitle && (
            <p className="mx-auto max-w-2xl text-lg text-[color:var(--landing-muted)]">
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
};

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

  const scrollToHash = (hash: string) => {
    const el = document.querySelector(hash);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden bg-[color:var(--landing-paper)] text-[color:var(--landing-ink)] font-sans selection:bg-[color:var(--landing-clay)] selection:text-white">
      {/* GL Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
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
              <Image src="/logo.png" alt="MediRep AI" width={32} height={32} className="h-8 w-8 dark:invert" />
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

                <p className="text-xl text-zinc-900 dark:text-zinc-300 max-w-2xl mx-auto leading-relaxed font-light tracking-wide mt-8">
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

        {/* Existing Features Section */}
        <section className="py-20 px-4 relative">
          <div className="container mx-auto">
            <h3 className="text-3xl font-bold text-center mb-12">
              Everything you need for drug information
            </h3>
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* Feature 1 */}
              <div className="bg-white/20 dark:bg-zinc-900/50 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 dark:border-white/10 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 w-14 h-14 flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/20">
                  <Zap className="h-7 w-7 text-primary" />
                </div>
                <h4 className="text-xl font-bold mb-3">Instant Answers</h4>
                <p className="text-zinc-800 dark:text-zinc-300 leading-relaxed">
                  Get accurate drug information in seconds. Ask about dosages,
                  contraindications, and more with AI precision.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white/20 dark:bg-zinc-900/50 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 dark:border-white/10 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                <div className="rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 w-14 h-14 flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/20">
                  <Shield className="h-7 w-7 text-blue-500" />
                </div>
                <h4 className="text-xl font-bold mb-3">Safety Alerts</h4>
                <p className="text-zinc-800 dark:text-zinc-300 leading-relaxed">
                  Automatic drug interaction checks and safety warnings to keep
                  your patients safe and informed.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white/20 dark:bg-zinc-900/50 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 dark:border-white/10 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                <div className="rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 w-14 h-14 flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/20">
                  <Users className="h-7 w-7 text-indigo-500" />
                </div>
                <h4 className="text-xl font-bold mb-3">Patient Context</h4>
                <p className="text-zinc-800 dark:text-zinc-300 leading-relaxed">
                  Personalized recommendations based on patient history,
                  medications, and specific needs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --- Rendered v2 Sections --- */}

        <Section
          id="product"
          eyebrow="Product"
          title={
            <>
              A workflow built for{" "}
              <span className="text-primary font-bold">
                clinical speed
              </span>
              , not demo vibes.
            </>
          }
          subtitle="We optimized for clarity, speed, and escalation — the parts users actually feel."
        >
          <div className="relative overflow-hidden rounded-[32px] border p-6 backdrop-blur"
            style={{ borderColor: "var(--landing-border)", backgroundColor: "var(--landing-card)" }}
          >
            <div aria-hidden className="absolute inset-0">
              <DotGrid />
            </div>

            <div className="relative z-10">
              <ScrollFloat containerClassName="mb-6" textClassName="opacity-90">
                Evidence
              </ScrollFloat>

              <div className="grid gap-4 md:grid-cols-2">
                <FeatureTile
                  tone="clay"
                  icon={<MessageSquareText className="h-5 w-5" />}
                  title="Cited answers"
                  body="We bias toward source trails. If evidence is missing, we say so."
                />
                <FeatureTile
                  tone="marigold"
                  icon={<Search className="h-5 w-5" />}
                  title="Hybrid retrieval"
                  body="Structured drug DB + semantic search + guardrails, merged by intent."
                />
                <FeatureTile
                  tone="moss"
                  icon={<IndianRupee className="h-5 w-5" />}
                  title="Price & reimbursement"
                  body="Compare options, surface coverage constraints, and reduce surprises."
                />
                <FeatureTile
                  tone="moss"
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="Hard boundaries"
                  body="Role-based portals, payment-state gating, RLS, and signature checks."
                />
              </div>

              <div className="mt-6 rounded-2xl border p-4"
                style={{ borderColor: "var(--landing-border)", backgroundColor: "var(--landing-card-strong)" }}
              >
                <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--landing-muted-2)" }}>
                  Demo prompt
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold" style={{ color: "var(--landing-ink)" }}>
                  <span className="rounded-full border px-3 py-1" style={{ borderColor: "var(--landing-border)" }}>
                    warfarin + aspirin
                  </span>
                  <span className="opacity-50">→</span>
                  <span className="rounded-full border px-3 py-1" style={{ borderColor: "var(--landing-border)" }}>
                    interaction + mitigation
                  </span>
                  <span className="opacity-50">→</span>
                  <span className="rounded-full border px-3 py-1" style={{ borderColor: "var(--landing-border)" }}>
                    cite sources
                  </span>
                  <span className="opacity-50">→</span>
                  <span className="rounded-full border px-3 py-1" style={{ borderColor: "var(--landing-border)" }}>
                    escalate if uncertain
                  </span>
                </div>

                <div className="mt-3 text-sm leading-relaxed" style={{ color: "var(--landing-muted)" }}>
                  <BlurText
                    text="Brutal truth: AI isn’t the product unless the workflow is checkable. We designed for receipts, not confidence."
                    delay={90}
                    animateBy="words"
                    direction="top"
                    className="leading-relaxed"
                  />
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="marketplace"
          eyebrow="Marketplace"
          title={
            <>
              When AI shouldn’t answer,{" "}
              <span className="text-primary font-bold">
                a verified pharmacist
              </span>{" "}
              should.
            </>
          }
          subtitle="Browse pharmacists, pay securely, then start chat/voice — unlocked only after confirmation."
        >
          <div className="relative overflow-hidden rounded-[32px] border p-6 backdrop-blur"
            style={{ borderColor: "var(--landing-border)", backgroundColor: "var(--landing-card)" }}
          >
            <div aria-hidden className="absolute inset-0">
              <DotGrid />
            </div>

            <div className="relative z-10 grid gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-start">
              <div className="rounded-3xl border p-5"
                style={{ borderColor: "var(--landing-border)", backgroundColor: "var(--landing-card-strong)" }}
              >
                <div className="text-sm font-extrabold tracking-tight" style={{ color: "var(--landing-ink)" }}>
                  Flow
                </div>
                <div className="mt-4 grid gap-3">
                  {[
                    {
                      icon: <Search className="h-5 w-5" />,
                      title: "Discover",
                      body: "Browse verified pharmacist profiles and availability.",
                    },
                    {
                      icon: <IndianRupee className="h-5 w-5" />,
                      title: "Pay",
                      body: "Pay securely and get an instant confirmation.",
                    },
                    {
                      icon: <PhoneCall className="h-5 w-5" />,
                      title: "Consult",
                      body: "Start chat or voice call only after payment is confirmed.",
                    },
                  ].map((s) => (
                    <div
                      key={s.title}
                      className="rounded-2xl border p-4"
                      style={{ borderColor: "var(--landing-border)", backgroundColor: "var(--landing-card)" }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-2xl border"
                          style={{ borderColor: "var(--landing-border)", backgroundColor: "var(--landing-card-strong)" }}
                        >
                          {s.icon}
                        </div>
                        <div>
                          <div className="text-sm font-bold" style={{ color: "var(--landing-ink)" }}>
                            {s.title}
                          </div>
                          <div className="mt-1 text-sm" style={{ color: "var(--landing-muted)" }}>
                            {s.body}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border p-4"
                  style={{ borderColor: "var(--landing-border)", backgroundColor: "var(--landing-card)" }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--landing-muted-2)" }}>
                    Brutal honesty
                  </div>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--landing-muted)" }}>
                    The marketplace lives or dies on real availability and verification. We built the flow; production would need stronger onboarding and quality enforcement.
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border p-5"
                style={{ borderColor: "var(--landing-border)", backgroundColor: "var(--landing-card-strong)" }}
              >
                <div className="text-sm font-extrabold tracking-tight" style={{ color: "var(--landing-ink)" }}>
                  Marketplace CTA
                </div>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--landing-muted)" }}>
                  If you want to judge the product, judge the escalation. This is where it becomes real.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <Link href="/dashboard/BookPharmacist">
                    <Button className="w-full rounded-2xl bg-[color:var(--landing-moss)] text-[color:var(--landing-bone)] hover:brightness-95">
                      Open marketplace <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/pharmacist/register">
                    <Button
                      variant="outline"
                      className="w-full rounded-2xl bg-[color:var(--landing-card)] hover:bg-[color:var(--landing-card-strong)]"
                      style={{ borderColor: "var(--landing-border)", color: "var(--landing-ink)" }}
                    >
                      Register as pharmacist <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="how"
          eyebrow="How it works"
          title="Three steps. No guessing."
          subtitle="Get the answer. See options. Escalate to a human when it matters."
        >
          <div
            className="relative overflow-hidden rounded-[32px] border p-6 backdrop-blur"
            style={{ borderColor: "var(--landing-border)", backgroundColor: "var(--landing-card)" }}
          >
            <div aria-hidden className="absolute inset-0">
              <DotGrid />
            </div>

            <div className="relative z-10 grid gap-4 md:grid-cols-3">
              <FeatureTile
                tone="clay"
                icon={<MessageSquareText className="h-5 w-5" />}
                title="Ask"
                body="Type a medication question. Get a short answer you can verify."
              />
              <FeatureTile
                tone="marigold"
                icon={<Search className="h-5 w-5" />}
                title="Check"
                body="See citations and key warnings so you don’t rely on blind confidence."
              />
              <FeatureTile
                tone="moss"
                icon={<PhoneCall className="h-5 w-5" />}
                title="Escalate"
                body="Book a verified pharmacist for chat or voice if you need a human."
              />
            </div>

            <div
              className="mt-6 rounded-2xl border p-4"
              style={{ borderColor: "var(--landing-border)", backgroundColor: "var(--landing-card-strong)" }}
            >
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--landing-muted-2)" }}>
                What users actually want
              </div>
              <div className="mt-2 text-sm leading-relaxed" style={{ color: "var(--landing-muted)" }}>
                <BlurText
                  text="Less searching. Fewer surprises. Clear next steps when the answer is uncertain."
                  delay={90}
                  animateBy="words"
                  direction="top"
                  className="leading-relaxed"
                />
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="trust"
          eyebrow="Trust"
          title="No ghost consults. No surprise access."
          subtitle="We keep the experience simple: you unlock chat/voice only after payment is confirmed, and pharmacist profiles go through verification."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <FeatureTile
              tone="moss"
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Verified access"
              body="Chat and voice unlock only after payment is confirmed."
            />
            <FeatureTile
              tone="clay"
              icon={<BadgeCheck className="h-5 w-5" />}
              title="Verified profiles"
              body="Marketplace listings are reviewed before they go live."
            />
            <FeatureTile
              tone="marigold"
              icon={<Lock className="h-5 w-5" />}
              title="Private by default"
              body="Sensitive documents stay private and aren't shown publicly."
            />
          </div>

          <div className="mt-6">
            <ScrambledText radius={110} duration={0.9} speed={0.35} scrambleChars=".:/[]{}<>" className="mx-auto">
              Trust is built into the flow: show the source, admit uncertainty, escalate to a human, and unlock consults only
              after payment clears. Private documents stay private.
            </ScrambledText>
          </div>
        </Section>
      </main>

      {/* Footer */}
      <footer className="px-4 pb-14 pt-10">
        <div className="mx-auto w-full max-w-6xl">
          <div
            className="flex flex-col gap-5 rounded-3xl border bg-[color:var(--landing-card)] p-6 backdrop-blur sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "var(--landing-border)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl border"
                style={{ borderColor: "var(--landing-border)", backgroundColor: "var(--landing-card-strong)" }}
              >
                <Pill className="h-5 w-5" style={{ color: "var(--landing-ink)" }} />
              </div>
              <div>
                <div className="text-base font-extrabold tracking-tight" style={{ color: "var(--landing-ink)" }}>
                  MediRep AI
                </div>
                <div className="text-xs" style={{ color: "var(--landing-muted-2)" }}>
                  Evidence-first drug intelligence + pharmacist marketplace
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold" style={{ color: "var(--landing-muted)" }}>
              <a href="#product" onClick={(e) => { e.preventDefault(); scrollToHash("#product"); }} className="hover:text-[color:var(--landing-ink)] hover:underline">
                Product
              </a>
              <a href="#marketplace" onClick={(e) => { e.preventDefault(); scrollToHash("#marketplace"); }} className="hover:text-[color:var(--landing-ink)] hover:underline">
                Marketplace
              </a>
              <a href="#how" onClick={(e) => { e.preventDefault(); scrollToHash("#how"); }} className="hover:text-[color:var(--landing-ink)] hover:underline">
                How it works
              </a>
              <Link href="/compare" className="hover:text-[color:var(--landing-ink)] hover:underline">
                Price compare
              </Link>
              <Link href="/auth/login" className="hover:text-[color:var(--landing-ink)] hover:underline">
                Sign in
              </Link>
            </div>
          </div>

          <div className="mt-4 text-xs" style={{ color: "var(--landing-muted-2)" }}>
            © 2026 MediRep AI. Prototype built for a hackathon; not medical advice.
          </div>
        </div>
      </footer>
    </div>
  );
}
