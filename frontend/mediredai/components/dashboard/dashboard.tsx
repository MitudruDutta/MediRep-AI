"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MessageSquare, Activity, Pill, AlertTriangle, FileText, User, LogOut } from "lucide-react";

const features = [
  {
    title: "AI Chat",
    description: "Ask questions about medications and get instant answers",
    icon: MessageSquare,
    href: "/dashboard/Chat",
    color: "text-cyan-500",
  },
  {
    title: "Drug Interactions",
    description: "Visualize and check drug interactions",
    icon: Activity,
    href: "/dashboard/InteractionGraph",
    color: "text-purple-500",
  },
  {
    title: "Pill Scanner",
    description: "Identify pills using image recognition",
    icon: Pill,
    href: "/dashboard/PillScanner",
    color: "text-green-500",
  },
  {
    title: "Safety Alerts",
    description: "Check FDA alerts and recalls",
    icon: AlertTriangle,
    href: "/dashboard/SafetyAlert",
    color: "text-yellow-500",
  },
  {
    title: "Patient Context",
    description: "Manage patient information",
    icon: User,
    href: "/dashboard/PatientContext",
    color: "text-blue-500",
  },
  {
    title: "Export Summary",
    description: "Export consultation summaries",
    icon: FileText,
    href: "/dashboard/ExportSummary",
    color: "text-pink-500",
  },
];

export default function Dashboard() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || null);
        } else {
          router.push('/auth/login');
        }
      } catch (error) {
        console.error("Error checking user:", error);
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [router, supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">MediRep AI Dashboard</h1>
          <p className="text-muted-foreground">
            Your AI-powered medical representative assistant
          </p>
          {userEmail && (
            <p className="text-sm text-muted-foreground mt-2">
              Logged in as: {userEmail}
            </p>
          )}
        </div>
        <Button onClick={handleLogout} variant="outline" className="gap-2">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => (
          <Link key={feature.href} href={feature.href}>
            <Card className="glass-card p-6 h-full hover:scale-105 transition-transform cursor-pointer">
              <feature.icon className={`h-12 w-12 mb-4 ${feature.color}`} />
              <h2 className="text-xl font-bold mb-2">{feature.title}</h2>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
