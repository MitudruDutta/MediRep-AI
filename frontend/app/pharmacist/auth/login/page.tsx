"use client";

import { useState } from "react";
import Link from "next/link";
import { Pill, Mail, Lock, Loader2, AlertCircle, Eye, EyeOff, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ModeToggle } from "@/components/mode-toggle";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

function PharmacistLoginForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const router = useRouter();

    const searchParams = useSearchParams();
    const redirectTo = searchParams.get("redirect") || "/pharmacist/dashboard";

    async function handleEmailSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const supabase = createClient();

            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                setError(authError.message);
                setIsLoading(false);
                return;
            }

            if (data.user) {
                // Check if user is a registered pharmacist
                const { data: pharmaProfile } = await supabase
                    .from("pharmacist_profiles")
                    .select("id")
                    .eq("user_id", data.user.id)
                    .maybeSingle();

                if (pharmaProfile) {
                    // Is a pharmacist, redirect to pharmacist dashboard
                    toast.success("Welcome back!");
                    router.push(redirectTo);
                } else {
                    // Not a pharmacist - redirect to registration
                    toast.info("Complete your pharmacist registration to continue.");
                    router.push("/pharmacist/register");
                }
            }
        } catch (e) {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }

    async function handleGoogleSignIn() {
        setIsGoogleLoading(true);
        setError(null);

        try {
            const supabase = createClient();
            const origin = window.location.origin;

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${origin}/pharmacist/auth/callback?next=${encodeURIComponent(redirectTo)}`,
                    queryParams: {
                        access_type: "offline",
                        prompt: "consent",
                    },
                },
            });

            if (error) {
                setError(error.message);
                setIsGoogleLoading(false);
            }
        } catch (e: unknown) {
            console.error("Google sign in error:", e);
            const message = e instanceof Error ? e.message : "Failed to connect to Google.";
            setError(message);
            setIsGoogleLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex">
            {/* Left side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 p-12 flex-col justify-between relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />

                <div className="relative z-10">
                    <Link href="/" className="flex items-center gap-3 text-white">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <Stethoscope className="h-8 w-8" />
                        </div>
                        <span className="text-2xl font-bold">Pharmacist Portal</span>
                    </Link>
                </div>

                <div className="relative z-10 space-y-6">
                    <h1 className="text-4xl font-bold text-white leading-tight">
                        Welcome Back,<br />Healthcare Professional
                    </h1>
                    <p className="text-white/80 text-lg max-w-md">
                        Access your pharmacist dashboard to manage consultations,
                        connect with patients, and grow your practice.
                    </p>
                    <div className="flex gap-6 pt-4">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-white">₹500+</div>
                            <div className="text-white/70 text-sm">Avg. per Consultation</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-white">1000+</div>
                            <div className="text-white/70 text-sm">Pharmacists</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-white">24/7</div>
                            <div className="text-white/70 text-sm">Support</div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 text-white/60 text-sm">
                    MediRep AI Partner Program
                </div>
            </div>

            {/* Right side - Login form */}
            <div className="flex-1 flex flex-col">
                <header className="p-4 flex justify-between items-center lg:justify-end">
                    <Link href="/" className="flex items-center gap-2 lg:hidden">
                        <Stethoscope className="h-6 w-6 text-indigo-500" />
                        <span className="font-bold">Pharmacist Portal</span>
                    </Link>
                    <ModeToggle />
                </header>

                <main className="flex-1 flex items-center justify-center p-6">
                    <div className="w-full max-w-md space-y-6">
                        <div className="text-center space-y-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-sm font-medium mb-4">
                                <Stethoscope className="h-4 w-4" />
                                Pharmacist Login
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
                            <p className="text-muted-foreground">
                                Sign in to your pharmacist account
                            </p>
                        </div>

                        {error && (
                            <Alert variant="destructive" className="animate-in fade-in-0 slide-in-from-top-1">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <Card className="border-0 shadow-lg">
                            <CardContent className="pt-6 space-y-4">
                                <form onSubmit={handleEmailSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email address</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="email"
                                                name="email"
                                                type="email"
                                                placeholder="you@example.com"
                                                required
                                                autoComplete="email"
                                                className="pl-10 h-11"
                                                disabled={isLoading || isGoogleLoading}
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="password">Password</Label>
                                            <Link
                                                href="/forgot-password"
                                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                                            >
                                                Forgot password?
                                            </Link>
                                        </div>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="password"
                                                name="password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="Enter your password"
                                                required
                                                autoComplete="current-password"
                                                className="pl-10 pr-10 h-11"
                                                disabled={isLoading || isGoogleLoading}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                tabIndex={-1}
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full h-11 text-base font-medium bg-indigo-600 hover:bg-indigo-700"
                                        disabled={isLoading || isGoogleLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Signing in...
                                            </>
                                        ) : (
                                            "Sign in"
                                        )}
                                    </Button>
                                </form>

                                <div className="relative my-6">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-card px-2 text-muted-foreground">
                                            or continue with
                                        </span>
                                    </div>
                                </div>

                                <div className="w-full">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full h-11"
                                        onClick={handleGoogleSignIn}
                                        disabled={isLoading || isGoogleLoading}
                                    >
                                        {isGoogleLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Connecting...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                                                    <path
                                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                                        fill="#4285F4"
                                                    />
                                                    <path
                                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                        fill="#34A853"
                                                    />
                                                    <path
                                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                                        fill="#FBBC05"
                                                    />
                                                    <path
                                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                                        fill="#EA4335"
                                                    />
                                                </svg>
                                                Continue with Google
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <p className="text-center text-sm text-muted-foreground">
                            Not a pharmacist yet?{" "}
                            <Link
                                href="/pharmacist/auth/signup"
                                className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                            >
                                Join as Pharmacist
                            </Link>
                        </p>

                        <p className="text-center text-xs text-muted-foreground">
                            Looking for patient portal?{" "}
                            <Link
                                href="/auth/login"
                                className="text-primary font-medium hover:underline"
                            >
                                Sign in as Patient
                            </Link>
                        </p>
                    </div>
                </main>

                <footer className="p-4 text-center text-xs text-muted-foreground">
                    By continuing, you agree to our{" "}
                    <Link href="/terms" className="underline hover:text-foreground">
                        Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="underline hover:text-foreground">
                        Privacy Policy
                    </Link>
                </footer>
            </div>
        </div>
    );
}

export default function PharmacistLoginPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        }>
            <PharmacistLoginForm />
        </Suspense>
    );
}
