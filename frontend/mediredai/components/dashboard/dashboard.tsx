"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MessageSquare, Activity, Pill, AlertTriangle, FileText, User } from "lucide-react";

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
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">MediRep AI Dashboard</h1>
        <p className="text-muted-foreground">
          Your AI-powered medical representative assistant
        </p>
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
