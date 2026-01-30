"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import {
  MessageSquare, Activity, Pill, AlertTriangle, User, ArrowRight, Scale,
  LayoutDashboard, LogOut, Stethoscope, Camera
} from "lucide-react";
import { motion, Variants } from "framer-motion";
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  SidebarLogo,
} from "@/components/ui/animated-sidebar";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface BentoGridItemProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  className?: string;
  url: string;
  accent?: string;
}

const BentoGridItem = ({
  title,
  description,
  icon,
  className,
  url,
  accent = "bg-[color:var(--landing-clay)]",
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
      whileHover={{ y: -5, scale: 1.02 }}
      className={cn(
        "group relative flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl p-6",
        "bg-[color:var(--landing-card)] backdrop-blur-xl",
        "border border-[color:var(--landing-border)]",
        "shadow-xl shadow-black/5 dark:shadow-black/20",
        "hover:shadow-2xl hover:border-[color:var(--landing-border-strong)]",
        "transition-all duration-500",
        className
      )}
    >
      <Link href={url} className="absolute inset-0 z-20" />

      {/* Large background icon */}
      <div className="absolute -right-4 -bottom-4 opacity-[0.05] dark:opacity-[0.08] scale-[4] group-hover:scale-[4.5] transition-transform duration-700">
        {icon}
      </div>

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div>
          <div className={cn(
            "mb-4 flex h-12 w-12 items-center justify-center rounded-xl",
            "shadow-lg shadow-black/10 dark:shadow-black/30",
            accent,
            "group-hover:shadow-xl transition-shadow duration-500"
          )}>
            <span className="text-white">{icon}</span>
          </div>
          <h3 className="mb-2 text-xl font-bold tracking-tight text-[color:var(--landing-ink)] font-[family-name:var(--font-display)]">
            {title}
          </h3>
          <p className="text-[color:var(--landing-muted)] text-sm leading-relaxed">
            {description}
          </p>
        </div>
        <div className="mt-4 flex items-center text-sm font-medium text-[color:var(--landing-moss)]">
          <span className="mr-2">Open</span>
          <ArrowRight className="size-4 transition-all duration-300 group-hover:translate-x-2" />
        </div>
      </div>

      {/* Hover overlay (solid, no gradient) */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[rgb(var(--landing-dot-rgb)/0.03)]" />
    </motion.div>
  );
};

type DashboardItem = {
  title: string;
  url: string;
  icon: React.ReactNode;
  description: string;
  colSpan: string;
  accent: string;
};

const items: DashboardItem[] = [
  {
    title: "AI Chat",
    url: "/dashboard/Chat",
    icon: <MessageSquare className="size-6" />,
    description: "Ask questions about medications and get instant AI-powered answers",
    colSpan: "md:col-span-2",
    accent: "bg-[color:var(--landing-clay)]",
  },
  {
    title: "Drug Interactions",
    url: "/dashboard/InteractionGraph",
    icon: <Activity className="size-6" />,
    description: "Visualize and check drug interactions",
    colSpan: "md:col-span-1",
    accent: "bg-[color:var(--landing-moss)]",
  },
  {
    title: "Pill Scanner",
    url: "/dashboard/PillScanner",
    icon: <Camera className="size-6" />,
    description: "Identify pills using image recognition",
    colSpan: "md:col-span-1",
    accent: "bg-[color:var(--landing-clay)]",
  },
  {
    title: "Safety Alerts",
    url: "/dashboard/SafetyAlert",
    icon: <AlertTriangle className="size-6" />,
    description: "Check FDA alerts and recalls for medications",
    colSpan: "md:col-span-2",
    accent: "bg-[color:var(--landing-clay)]",
  },
  {
    title: "Patient Context",
    url: "/dashboard/PatientContext",
    icon: <User className="size-6" />,
    description: "Manage patient health information",
    colSpan: "md:col-span-1",
    accent: "bg-[color:var(--landing-moss)]",
  },
  {
    title: "Book Pharmacist",
    url: "/dashboard/BookPharmacist",
    icon: <Stethoscope className="size-6" />,
    description: "Connect with expert pharmacists",
    colSpan: "md:col-span-1",
    accent: "bg-[color:var(--landing-moss)]",
  },
  {
    title: "Price Compare",
    url: "/compare",
    icon: <Scale className="size-6" />,
    description: "Compare medicine prices across pharmacies",
    colSpan: "md:col-span-1",
    accent: "bg-[color:var(--landing-clay)]",
  },
];

const sidebarLinks = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    label: "AI Chat",
    href: "/dashboard/Chat",
    icon: <MessageSquare className="h-5 w-5" />,
  },
  {
    label: "Drug Interactions",
    href: "/dashboard/InteractionGraph",
    icon: <Activity className="h-5 w-5" />,
  },
  {
    label: "Pill Scanner",
    href: "/dashboard/PillScanner",
    icon: <Camera className="h-5 w-5" />,
  },
  {
    label: "Safety Alerts",
    href: "/dashboard/SafetyAlert",
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  {
    label: "Patient Context",
    href: "/dashboard/PatientContext",
    icon: <User className="h-5 w-5" />,
  },
  {
    label: "Book Pharmacist",
    href: "/dashboard/BookPharmacist",
    icon: <Stethoscope className="h-5 w-5" />,
  },
  {
    label: "Price Compare",
    href: "/compare",
    icon: <Scale className="h-5 w-5" />,
  },
];

interface DashboardProps {
  initialUserEmail?: string | null;
  initialUserName?: string | null;
  initialUserAvatar?: string | null;
}

export default function Dashboard({ initialUserEmail, initialUserName, initialUserAvatar }: DashboardProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  return (
    <div className="flex h-screen bg-[color:var(--landing-paper)] text-[color:var(--landing-ink)] overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        {/* Keep it clean (no gradients) */}
      </div>

      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10 relative z-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            <SidebarLogo
              open={open}
              icon={<Pill className="h-5 w-5 text-white" />}
              title="MediRep AI"
              subtitle="Medical Assistant"
            />

            <div className="mt-8 flex flex-col gap-1">
              {sidebarLinks.map((link, idx) => (
                <SidebarLink
                  key={idx}
                  link={link}
                  isActive={pathname === link.href}
                />
              ))}
            </div>
          </div>

          {/* User section at bottom */}
          <div className="border-t border-[color:var(--landing-border)] pt-4">
            <SidebarLink
              link={{
                label: "Profile",
                href: "/dashboard/settings",
                icon: <User className="h-5 w-5" />,
              }}
              isActive={pathname === "/dashboard/settings"}
            />
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 py-3 px-3 rounded-xl text-[color:var(--landing-muted)] hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {open && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm font-medium whitespace-pre"
                >
                  Sign Out
                </motion.span>
              )}
            </button>

            {/* User info */}
            <Link
              href="/dashboard/settings"
              className="mt-4 flex items-center gap-3 px-2 rounded-xl hover:bg-[rgb(var(--landing-dot-rgb)/0.06)] transition-colors"
              title="Edit profile"
            >
              {initialUserAvatar ? (
                <Image
                  src={initialUserAvatar}
                  className="h-9 w-9 flex-shrink-0 rounded-full border-2 border-[rgb(var(--landing-moss-rgb)/0.45)]"
                  width={36}
                  height={36}
                  alt="Avatar"
                />
              ) : (
                <div className="h-9 w-9 flex-shrink-0 rounded-full bg-[color:var(--landing-clay)] flex items-center justify-center text-white font-bold text-sm">
                  {(initialUserName || initialUserEmail || "U")[0].toUpperCase()}
                </div>
              )}
              {open && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col overflow-hidden"
                >
                  <span className="text-sm font-medium text-[color:var(--landing-ink)] truncate">
                    {initialUserName || "User"}
                  </span>
                  <span className="text-xs text-[color:var(--landing-muted)] truncate">
                    {initialUserEmail}
                  </span>
                </motion.div>
              )}
            </Link>
          </div>
        </SidebarBody>
      </Sidebar>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative z-10">
                <div className="p-6 md:p-8 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-[color:var(--landing-ink)] mb-2 tracking-tight font-[family-name:var(--font-display)]">
              Welcome back, {initialUserName || initialUserEmail?.split('@')[0] || 'User'}
            </h1>
            <p className="text-[color:var(--landing-muted)] text-lg">
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
                accent={item.accent}
              />
            ))}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
