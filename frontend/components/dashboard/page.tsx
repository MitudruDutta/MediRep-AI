"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Activity, Pill, AlertTriangle, FileText, User, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Card } from "@/components/ui/card";
import AppHeader from "./header";

const items = [
  {
    title: "AI Chat",
    url: "/dashboard/Chat",
    icon: MessageSquare,
    color: "text-cyan-500",
    description: "Ask questions about medications and get instant answers",
  },
  {
    title: "Drug Interactions",
    url: "/dashboard/InteractionGraph",
    icon: Activity,
    color: "text-purple-500",
    description: "Visualize and check drug interactions",
  },
  {
    title: "Pill Scanner",
    url: "/dashboard/PillScanner",
    icon: Pill,
    color: "text-green-500",
    description: "Identify pills using image recognition",
  },
  {
    title: "Safety Alerts",
    url: "/dashboard/SafetyAlert",
    icon: AlertTriangle,
    color: "text-yellow-500",
    description: "Check FDA alerts and recalls",
  },
  {
    title: "Patient Context",
    url: "/dashboard/PatientContext",
    icon: User,
    color: "text-blue-500",
    description: "Manage patient information",
  },
  {
    title: "Export Summary",
    url: "/dashboard/ExportSummary",
    icon: FileText,
    color: "text-pink-500",
    description: "Export consultation summaries",
  },
];

function AppSidebar({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-4">
          <Pill className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-lg font-bold">MediRep AI</h2>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="mb-2">Features</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} className="h-10">
                    <Link href={item.url}>
                      <item.icon className={item.color} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

interface DashboardProps {
  initialUserEmail?: string | null;
  initialUserAvatar?: string | null;
}

export default function Dashboard({ initialUserEmail, initialUserAvatar }: DashboardProps) {
  return (
    <SidebarProvider>
      <AppSidebar userEmail={initialUserEmail} />
      <SidebarInset>
        <AppHeader userEmail={initialUserEmail} userAvatar={initialUserAvatar} />
        <div className="bg-background px-6 py-4">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Your AI-powered medical representative assistant
          </p>
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <Link key={item.url} href={item.url}>
                <Card className="p-6 h-full hover:scale-105 transition-transform cursor-pointer hover:shadow-lg">
                  <item.icon className={`h-12 w-12 mb-4 ${item.color}`} />
                  <h2 className="text-xl font-bold mb-2">{item.title}</h2>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </Card>
              </Link>
            ))}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
