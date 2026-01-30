"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
    LayoutDashboard,
    Calendar,
    History,
    LogOut,
    User,
    Loader2
} from "lucide-react";
import { Pill } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sidebar, SidebarBody, SidebarLink, SidebarLogo } from "@/components/ui/animated-sidebar";
import { motion } from "framer-motion";

export default function PharmacistPortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isPharmacist, setIsPharmacist] = useState(false);
    const [open, setOpen] = useState(false);

    // Check if user is a registered pharmacist
    useEffect(() => {
        async function checkPharmacistStatus() {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push("/pharmacist/auth/login");
                return;
            }

            // Check if user has a pharmacist profile
            const { data: pharmacistProfile } = await supabase
                .from("pharmacist_profiles")
                .select("id, verification_status")
                .eq("user_id", user.id)
                .maybeSingle();

            if (!pharmacistProfile) {
                // Not a registered pharmacist - redirect to registration
                toast.error("You need to register as a pharmacist first");
                router.push("/pharmacist/register");
                return;
            }

            setIsPharmacist(true);
            setIsLoading(false);
        }

        checkPharmacistStatus();
    }, [router]);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        toast.success("Logged out");
        router.push("/pharmacist/auth/login");
    };

    const navItems = [
        {
            href: "/pharmacist/dashboard",
            label: "Dashboard",
            icon: LayoutDashboard,
            exact: true
        },
        {
            href: "/pharmacist/schedule",
            label: "Availability",
            icon: Calendar
        },
        {
            href: "/pharmacist/consultations",
            label: "Consultations",
            icon: History
        },
        {
            href: "/pharmacist/profile",
            label: "Profile",
            icon: User
        }
    ];

    // Show loading while checking pharmacist status
    if (isLoading) {
        return (
            <div className="min-h-screen bg-[color:var(--landing-paper)] text-[color:var(--landing-ink)] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-[color:var(--landing-clay)]" />
                    <p className="mt-4 text-[color:var(--landing-muted)]">Verifying pharmacist access...</p>
                </div>
            </div>
        );
    }

    // Only render portal if user is a pharmacist
    if (!isPharmacist) {
        return null;
    }

    return (
        <div className="flex h-screen bg-[color:var(--landing-paper)] text-[color:var(--landing-ink)] overflow-hidden">
            <Sidebar open={open} setOpen={setOpen}>
                <SidebarBody className="justify-between gap-10 relative z-10">
                    <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                        <SidebarLogo
                            open={open}
                            icon={<Pill className="h-5 w-5 text-white" />}
                            title="MediRep AI"
                            subtitle="Pharmacist Portal"
                        />

                        <div className="mt-8 flex flex-col gap-1">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = item.exact
                                    ? pathname === item.href
                                    : pathname.startsWith(item.href);
                                return (
                                    <SidebarLink
                                        key={item.href}
                                        link={{
                                            label: item.label,
                                            href: item.href,
                                            icon: <Icon className="h-5 w-5" />,
                                        }}
                                        isActive={isActive}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    <div className="border-t border-[color:var(--landing-border)] pt-4 space-y-2">
                        <div className="px-3 py-2 text-xs text-[color:var(--landing-muted)] flex items-center justify-between">
                            <span>Status</span>
                            <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-[color:var(--landing-moss)] animate-pulse"></span>
                                Online
                            </span>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 py-3 px-3 rounded-xl text-[color:var(--landing-muted)] hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200"
                        >
                            <LogOut className="h-5 w-5 flex-shrink-0" />
                            {open && (
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-sm font-medium whitespace-pre"
                                >
                                    Logout
                                </motion.span>
                            )}
                        </button>
                    </div>
                </SidebarBody>
            </Sidebar>

            <main className="flex-1 overflow-y-auto relative z-10">
                <div className="p-6 md:p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
