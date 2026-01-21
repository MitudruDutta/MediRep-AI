"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function DebugAuthPage() {
  const [status, setStatus] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const results: any = {};

      try {
        // Check session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        results.session = {
          exists: !!sessionData.session,
          error: sessionError?.message,
          data: sessionData.session ? {
            user: sessionData.session.user.email,
            expiresAt: sessionData.session.expires_at,
          } : null,
        };

        // Check user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        results.user = {
          exists: !!userData.user,
          error: userError?.message,
          data: userData.user ? {
            id: userData.user.id,
            email: userData.user.email,
            emailConfirmed: userData.user.email_confirmed_at,
          } : null,
        };

        // Check environment variables
        results.env = {
          supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          apiUrl: !!process.env.NEXT_PUBLIC_API_URL,
        };

      } catch (error: any) {
        results.error = error.message;
      }

      setStatus(results);
      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  const StatusIcon = ({ condition }: { condition: boolean }) => {
    return condition ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Authentication Debug</h1>
        <p className="text-muted-foreground">
          Check your authentication status and configuration
        </p>
      </div>

      <div className="space-y-4">
        {/* Environment Variables */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Environment Variables
          </h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>NEXT_PUBLIC_SUPABASE_URL</span>
              <StatusIcon condition={status.env?.supabaseUrl} />
            </div>
            <div className="flex items-center justify-between">
              <span>NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
              <StatusIcon condition={status.env?.supabaseKey} />
            </div>
            <div className="flex items-center justify-between">
              <span>NEXT_PUBLIC_API_URL</span>
              <StatusIcon condition={status.env?.apiUrl} />
            </div>
          </div>
        </Card>

        {/* Session Status */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <StatusIcon condition={status.session?.exists} />
            Session Status
          </h2>
          {status.session?.error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded">
              <p className="text-sm text-red-500">{status.session.error}</p>
            </div>
          )}
          {status.session?.data && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-mono">{status.session.data.user}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expires:</span>
                <span className="font-mono">
                  {new Date(status.session.data.expiresAt * 1000).toLocaleString()}
                </span>
              </div>
            </div>
          )}
          {!status.session?.exists && !status.session?.error && (
            <p className="text-sm text-muted-foreground">No active session found</p>
          )}
        </Card>

        {/* User Status */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <StatusIcon condition={status.user?.exists} />
            User Status
          </h2>
          {status.user?.error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded">
              <p className="text-sm text-red-500">{status.user.error}</p>
            </div>
          )}
          {status.user?.data && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">User ID:</span>
                <span className="font-mono text-xs">{status.user.data.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-mono">{status.user.data.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email Confirmed:</span>
                <StatusIcon condition={!!status.user.data.emailConfirmed} />
              </div>
            </div>
          )}
          {!status.user?.exists && !status.user?.error && (
            <p className="text-sm text-muted-foreground">No user found</p>
          )}
        </Card>

        {/* Actions */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Actions</h2>
          <div className="flex gap-2">
            <Button asChild>
              <a href="/auth/login">Go to Login</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/auth/signup">Go to Signup</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/dashboard">Go to Dashboard</a>
            </Button>
          </div>
        </Card>

        {/* Raw Data */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Raw Debug Data</h2>
          <pre className="text-xs bg-secondary/20 p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(status, null, 2)}
          </pre>
        </Card>
      </div>
    </div>
  );
}
