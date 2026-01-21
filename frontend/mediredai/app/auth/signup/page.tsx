import { signup } from "../action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Pill } from "lucide-react";

export default function SignupPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10 bg-gradient-to-l from-[#022B16] via-30% via-black to-black">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Pill className="h-5 w-5" />
            </div>
            MediRep AI
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            {/* SignUp Page */}
            <div className={cn("flex flex-col gap-6")}>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">
                  SignUp your account for DAVA
                </h1>
                <p className="text-muted-foreground text-sm text-balance">
                  Enter your email below to Signup
                </p>
              </div>

              <div className="grid gap-6">
                <form>
                  <div className="flex flex-col gap-3">
                    <div className="grid gap-3">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" type="email" required />
                    </div>
                    <div className="grid gap-3">
                      <div className="flex items-center">
                        <Label htmlFor="password">Password</Label>
                      </div>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        required
                      />
                    </div>

                    <Button
                      formAction={signup}
                      type="submit"
                      className="w-full"
                    >
                      Signup
                    </Button>
                  </div>
                </form>
              </div>

              <div className="text-center text-sm">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4 text-emerald-400 hover:text-emerald-300"
                >
                  Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <Pill className="h-24 w-24 mx-auto text-primary" />
            <h2 className="text-3xl font-bold">MediRep AI</h2>
            <p className="text-muted-foreground max-w-md">
              Your AI-powered medical representative assistant
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}