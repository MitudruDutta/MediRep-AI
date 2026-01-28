"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Activity, Pill, AlertTriangle, FileText, User, Sparkles, ArrowRight, Layers, Palette, Zap, Scale } from "lucide-react";
import { motion, Variants } from "framer-motion";
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
import AppHeader from "./header";
import { cn } from "@/lib/utils";


interface BentoGridItemProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  className?: string;
  url: string;
}

const BentoGridItem = ({
  title,
  description,
  icon,
  className,
  url,
}: BentoGridItemProps) => {
  const variants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", damping: 25 },
    },
  };

  return (
    <motion.div
      variants={variants}
      className={cn(
        "group border-border/50 bg-background hover:border-primary/30 relative flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-xl border px-6 pt-6 pb-10 shadow-sm transition-all duration-500",
        "dark:bg-black/40 dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/5",
        className
      )}
    >
      <Link href={url} className="absolute inset-0 z-20" />

      <div className="absolute top-0 -right-1/2 z-0 size-full cursor-pointer bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] bg-[size:24px_24px]"></div>

      <div className="text-primary/5 group-hover:text-primary/10 absolute right-1 bottom-3 scale-[6] transition-all duration-700 group-hover:scale-[6.2] dark:text-white/5 dark:group-hover:text-white/10">
        {icon}
      </div>

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div>
          <div className="bg-primary/10 text-primary shadow-primary/10 group-hover:bg-primary/20 group-hover:shadow-primary/20 mb-4 flex h-12 w-12 items-center justify-center rounded-full shadow-sm transition-all duration-500 dark:bg-white/10 dark:text-white dark:shadow-none dark:group-hover:bg-white/20">
            {icon}
          </div>
          <h3 className="mb-2 text-xl font-semibold tracking-tight text-foreground dark:text-white">{title}</h3>
          <p className="text-muted-foreground text-sm dark:text-white/60">{description}</p>
        </div>
        <div className="text-primary mt-4 flex items-center text-sm dark:text-white/80">
          <span className="mr-1">Open</span>
          <ArrowRight className="size-4 transition-all duration-500 group-hover:translate-x-2" />
        </div>
      </div>
      <div className="from-primary to-primary/30 absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r blur-2xl transition-all duration-500 group-hover:blur-lg dark:from-white dark:to-white/30" />
    </motion.div>
  );
};


const items = [
  {
    title: "AI Chat",
    url: "/dashboard/Chat",
    icon: <MessageSquare className="size-6" />,
    description: "Ask questions about medications and get instant answers",
    colSpan: "md:col-span-2",
  },
  {
    title: "Drug Interactions",
    url: "/dashboard/InteractionGraph",
    icon: <Activity className="size-6" />,
    description: "Visualize and check drug interactions",
    colSpan: "md:col-span-1",
  },
  {
    title: "Pill Scanner",
    url: "/dashboard/PillScanner",
    icon: <Pill className="size-6" />,
    description: "Identify pills using image recognition",
    colSpan: "md:col-span-1",
  },
  {
    title: "Safety Alerts",
    url: "/dashboard/SafetyAlert",
    icon: <AlertTriangle className="size-6" />,
    description: "Check FDA alerts and recalls",
    colSpan: "md:col-span-2",
  },
  {
    title: "Patient Context",
    url: "/dashboard/PatientContext",
    icon: <User className="size-6" />,
    description: "Manage patient information",
    colSpan: "md:col-span-1",
  },
  {
    title: "Export Summary",
    url: "/dashboard/ExportSummary",
    icon: <FileText className="size-6" />,
    description: "Export consultation summaries",
    colSpan: "md:col-span-1",
  },
  {
    title: "Price Compare",
    url: "/compare",
    icon: <Scale className="size-6" />,
    description: "Compare medicine prices across 13+ pharmacies",
    colSpan: "md:col-span-1",
  },
];


function AppSidebar({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();

  return (
    <Sidebar className="border-r border-border/50 bg-background/60 backdrop-blur-xl dark:bg-black/40">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-4">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Pill className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent dark:from-white dark:to-white/60">
              MediRep AI
            </h2>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/70 dark:text-white/40">Features</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className={cn(
                      "h-10 transition-all duration-200 relative overflow-hidden group",
                      pathname === item.url
                        ? "bg-primary/10 text-primary shadow-sm dark:bg-white/10 dark:text-white dark:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5"
                    )}
                  >
                    <Link href={item.url}>
                      <span className={cn("h-4 w-4 flex items-center justify-center relative z-10", pathname === item.url ? "text-cyan-500 dark:text-cyan-400" : "opacity-70")}>
                        {item.icon}
                      </span>
                      <span className="relative z-10">{item.title}</span>


                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

interface DashboardProps {
  initialUserEmail?: string | null;
  initialUserName?: string | null;
  initialUserAvatar?: string | null;
}

export default function Dashboard({ initialUserEmail, initialUserName, initialUserAvatar }: DashboardProps) {
  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1,
      },
    },
  };

  return (
    <SidebarProvider>
      <div className="fixed inset-0 z-[-1] bg-background">

        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-background/0 via-background/50 to-background/90" />
      </div>

      <AppSidebar userEmail={initialUserEmail} />

      <SidebarInset className="bg-transparent">
        <div className="bg-background/20 backdrop-blur-sm border-b border-border/50">
          <AppHeader userEmail={initialUserEmail} userAvatar={initialUserAvatar} />
        </div>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <h1 className="text-4xl font-bold text-foreground mb-2 tracking-tight dark:text-white">
                Welcome back, {initialUserName || initialUserEmail}
              </h1>
              <p className="text-muted-foreground text-lg dark:text-white/60">
                Your AI-powered medical assistant is ready to help.
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {items.map((item, i) => (
                <BentoGridItem
                  key={i}
                  title={item.title}
                  description={item.description}
                  icon={item.icon}
                  url={item.url}
                  className={item.colSpan}
                />
              ))}
            </motion.div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
