"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function TestConnectionPage() {
  const [backendStatus, setBackendStatus] = useState<"loading" | "success" | "error">("loading");
  const [supabaseStatus, setSupabaseStatus] = useState<"loading" | "success" | "error">("loading");
  const [backendMessage, setBackendMessage] = useState("");
  const [supabaseMessage, setSupabaseMessage] = useState("");

  useEffect(() => {
    // Test backend connection
    fetch(process.env.NEXT_PUBLIC_API_URL + "/health")
      .then((res) => res.json())
      .then((data) => {
        setBackendStatus("success");
        setBackendMessage(JSON.stringify(data, null, 2));
      })
      .catch((err) => {
        setBackendStatus("error");
        setBackendMessage(err.message);
      });

    // Test Supabase connection
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getSession()
        .then(({ data, error }) => {
          if (error) {
            setSupabaseStatus("error");
            setSupabaseMessage(error.message);
          } else {
            setSupabaseStatus("success");
            setSupabaseMessage(data.session ? "Session active" : "No active session");
          }
        })
        .catch((err) => {
          setSupabaseStatus("error");
          setSupabaseMessage(err.message);
        });
    });
  }, []);

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "loading") return <Loader2 className="h-5 w-5 animate-spin" />;
    if (status === "success") return <CheckCircle className="h-5 w-5 text-success" />;
    return <XCircle className="h-5 w-5 text-danger" />;
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Connection Test</h1>
      
      <div className="grid gap-4">
        <Card className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Backend API</h2>
            <div className="flex items-center gap-2">
              <StatusIcon status={backendStatus} />
              <Badge variant={backendStatus === "success" ? "default" : "destructive"}>
                {backendStatus}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            URL: {process.env.NEXT_PUBLIC_API_URL}
          </p>
          <pre className="text-xs bg-secondary/20 p-3 rounded overflow-auto">
            {backendMessage || "Testing..."}
          </pre>
        </Card>

        <Card className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Supabase</h2>
            <div className="flex items-center gap-2">
              <StatusIcon status={supabaseStatus} />
              <Badge variant={supabaseStatus === "success" ? "default" : "destructive"}>
                {supabaseStatus}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}
          </p>
          <pre className="text-xs bg-secondary/20 p-3 rounded overflow-auto">
            {supabaseMessage || "Testing..."}
          </pre>
        </Card>
      </div>
    </div>
  );
}
