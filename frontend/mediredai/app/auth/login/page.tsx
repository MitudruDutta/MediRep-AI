import { login } from "../action";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LoginWithGoogle from "@/components/login-form";
import Link from "next/link";
import { Pill } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10 bg-gradient-to-l from-[#022B16] via-30% via-black to-black">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Pill className="h-5 w-5" />
            </div>
            MediRep AI
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            {/* Login Page */}
            <div className={cn("flex flex-col gap-6")}>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold text-white">Login to your account</h1>
                <p className="text-gray-300 text-sm text-balance">
                  Enter your email below to login to your account
                </p>
              </div>

              <div className="grid gap-6">
                <form>
                  <div className="flex flex-col gap-3">
                    <div className="grid gap-3">
                      <Label htmlFor="email" className="text-gray-200">Email</Label>
                      <Input 
                        id="email" 
                        name="email" 
                        type="email" 
                        required 
                        className="bg-black/40 border-gray-600 text-white placeholder:text-gray-400 focus:border-emerald-500"
                      />
                    </div>
                    <div className="grid gap-3">
                      <div className="flex items-center">
                        <Label htmlFor="password" className="text-gray-200">Password</Label>
                        {/* <a
                          href="#"
                          className="ml-auto text-sm underline-offset-4 hover:underline"
                        >
                          Forgot your password?
                        </a> */}
                      </div>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        required
                        className="bg-black/40 border-gray-600 text-white placeholder:text-gray-400 focus:border-emerald-500"
                      />
                    </div>

                    <Button 
                      formAction={login} 
                      className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white"
                    >
                      Login
                    </Button>
                    {/* <Button formAction={signup} className="w-full">
                      Sign Up
                    </Button> */}
                  </div>
                </form>

                <div className="after:border-gray-600 relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                  <span className="bg-gradient-to-br from-emerald-900/20 via-green-900/10 to-black text-gray-300 relative z-10 px-2">
                    Or continue with
                  </span>
                </div>

                {/* Google login with its own form */}
                <LoginWithGoogle className="w-full bg-white/10 hover:bg-white/20 text-white border-gray-600" />
              </div>

              <div className="text-center text-sm text-gray-300">
                Don&apos;t have an account?{" "}
                <Link
                  href="/auth/signup"
                  className="underline underline-offset-4 text-emerald-400 hover:text-emerald-300"
                >
                  Sign up
                </Link>
              </div>
            </div>
            {/* End of Login Page */}
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