"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
    LayoutDashboard,
    Calendar,
    History,
    Settings,
    LogOut,
    User,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function PharmacistPortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isPharmacist, setIsPharmacist] = useState(false);

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
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
                    <p className="mt-4 text-muted-foreground">Verifying pharmacist access...</p>
                </div>
            </div>
        );
    }

    // Only render portal if user is a pharmacist
    if (!isPharmacist) {
        return null;
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            {/* Sidebar */}
            <aside className="w-64 border-r border-border bg-card flex flex-col fixed h-full z-10">
                <div className="p-6 border-b border-border flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-white">
                        Rx
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-foreground">Pharmacist Portal</h1>
                        <p className="text-xs text-muted-foreground">MediRep Partner</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = item.exact
                            ? pathname === item.href
                            : pathname.startsWith(item.href);

                        return (
                            <Link key={item.href} href={item.href}>
                                <Button
                                    variant="ghost"
                                    className={`w-full justify-start gap-3 ${isActive
                                        ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                        }`}
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.label}
                                </Button>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-border space-y-2">
                    <div className="px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
                        <span>Status</span>
                        <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                            Online
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
                        onClick={handleLogout}
                    >
                        <LogOut className="h-4 w-4" />
                        Logout
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 bg-background">
                <div className="p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}

