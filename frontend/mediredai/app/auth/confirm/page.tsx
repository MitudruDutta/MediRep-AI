import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Mail } from "lucide-react";
import Link from "next/link";

export default function ConfirmEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="glass-card p-8 max-w-md w-full text-center">
        <Mail className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
        <p className="text-muted-foreground mb-6">
          We've sent you a confirmation email. Please click the link in the email to verify your account.
        </p>
        
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3 text-left">
            <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold mb-1">Next Steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Check your email inbox</li>
                <li>Click the confirmation link</li>
                <li>Return here to log in</li>
              </ol>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Didn't receive the email? Check your spam folder or contact support.
        </p>

        <Button asChild className="w-full">
          <Link href="/auth/login">Go to Login</Link>
        </Button>
      </Card>
    </div>
  );
}
