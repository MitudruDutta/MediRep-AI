"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message") || "There was a problem signing you in. Please try again.";

  return (
    <Card className="glass-card p-8 max-w-md w-full text-center">
      <AlertTriangle className="h-12 w-12 text-danger mx-auto mb-4" />
      <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
      <p className="text-muted-foreground mb-6">
        {message}
      </p>
      <div className="flex gap-2">
        <Button asChild className="flex-1">
          <Link href="/auth/login">Back to Login</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href="/auth/signup">Sign Up</Link>
        </Button>
      </div>
    </Card>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={
        <Card className="glass-card p-8 max-w-md w-full text-center">
          <AlertTriangle className="h-12 w-12 text-danger mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
          <p className="text-muted-foreground mb-6">Loading...</p>
        </Card>
      }>
        <ErrorContent />
      </Suspense>
    </div>
  );
}
