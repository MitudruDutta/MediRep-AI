"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Pill,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Shield,
  Zap,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ModeToggle } from "@/components/mode-toggle";
import { PasswordStrength } from "@/components/auth/password-strength";
import { signUpWithEmail, signInWithGoogle } from "@/app/auth/actions";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SignUpForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");

  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || searchParams.get("next") || "/dashboard";

  async function handleEmailSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // Add redirect to formData
    formData.append("redirectTo", redirectTo);

    try {
      const result = await signUpWithEmail(formData);

      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        setSuccess(result.success);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    setError(null);

    try {
      await signInWithGoogle(redirectTo);
    } catch (e: any) {
      console.error("Google sign in error:", e);
      setError(e.message || "Failed to connect to Google.");
      setIsGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-primary/90 via-primary to-primary/80 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Pill className="h-8 w-8" />
            </div>
            <span className="text-2xl font-bold">MediRep AI</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Start Your Journey<br />With MediRep AI
          </h1>

          <div className="space-y-4">
            <div className="flex items-start gap-4 text-white">
              <div className="p-2 bg-white/20 rounded-lg">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Instant Drug Information</h3>
                <p className="text-white/70 text-sm">
                  Get accurate data in seconds, not minutes
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 text-white">
              <div className="p-2 bg-white/20 rounded-lg">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Safety First</h3>
                <p className="text-white/70 text-sm">
                  Automatic interaction checks and FDA alerts
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 text-white">
              <div className="p-2 bg-white/20 rounded-lg">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Patient-Centered</h3>
                <p className="text-white/70 text-sm">
                  Personalized recommendations for better care
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-white/60 text-sm">
          Join thousands of healthcare professionals
        </div>
      </div>

      {/* Right side - Signup form */}
      <div className="flex-1 flex flex-col">
        <header className="p-4 flex justify-between items-center lg:justify-end">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <Pill className="h-6 w-6 text-primary" />
            <span className="font-bold">MediRep AI</span>
          </Link>
          <ModeToggle />
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">
                Create your account
              </h2>
              <p className="text-muted-foreground">
                Get started with MediRep AI today
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/30 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-sm text-green-700 dark:text-green-300">
                  {success}
                </AlertDescription>
              </Alert>
            )}

            <Card className="border-0 shadow-lg">
              <CardContent className="pt-6 space-y-4">
                <form action={handleEmailSubmit} className="space-y-4">
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
                        disabled={isLoading || isGoogleLoading || !!success}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        className="pl-10 pr-10 h-11"
                        disabled={isLoading || isGoogleLoading || !!success}
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
                    <PasswordStrength password={password} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        className="pl-10 pr-10 h-11"
                        disabled={isLoading || isGoogleLoading || !!success}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 text-base font-medium"
                    disabled={isLoading || isGoogleLoading || !!success}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create account"
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
                    disabled={isLoading || isGoogleLoading || !!success}
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
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="text-primary font-medium hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </main>

        <footer className="p-4 text-center text-xs text-muted-foreground">
          By creating an account, you agree to our{" "}
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

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SignUpForm />
    </Suspense>
  );
}
