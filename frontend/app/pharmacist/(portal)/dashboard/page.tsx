"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import {
    Users,
    Wallet,
    Star,
    CalendarDays,
    Play,
    Phone,
    BadgeCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { pharmacistApi, PharmacistStats, PharmacistConsultation, PharmacistProfile } from "@/lib/pharmacist-api";

import { ModeToggle } from "@/components/mode-toggle";

export default function PharmacistDashboard() {
    const [stats, setStats] = useState<PharmacistStats | null>(null);
    const [consultations, setConsultations] = useState<PharmacistConsultation[]>([]);
    const [profile, setProfile] = useState<PharmacistProfile | null>(null);
    const [isAvailable, setIsAvailable] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const [statsData, consultationsData, profileData] = await Promise.all([
                    pharmacistApi.getDashboardStats(),
                    pharmacistApi.getMyConsultations("upcoming"),
                    pharmacistApi.getProfile()
                ]);
                setStats(statsData);
                setConsultations(consultationsData);
                setProfile(profileData);
                // Set availability from database
                setIsAvailable(profileData.is_available);
            } catch (error) {
                console.error(error);
                // Silently fail - no popup
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const handleAvailabilityChange = async (checked: boolean) => {
        // Optimistic update - toggle immediately without API
        setIsAvailable(checked);
        try {
            await pharmacistApi.toggleAvailability(checked);
        } catch (error) {
            console.error(error);
            // Silently fail - no popup
        }
    };

    if (loading) {
        return <div className="p-8 text-muted-foreground">Loading dashboard...</div>;
    }

    // Get pharmacist initials for avatar
    const getInitials = (name: string) => {
        const parts = name.split(" ");
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    return (
        <div className="space-y-8 p-1 px-4 lg:px-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 border-2 border-indigo-500/30 shadow-lg">
                        {profile?.profile_image_url && (
                            <AvatarImage src={profile.profile_image_url} alt={profile?.full_name} />
                        )}
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-lg font-bold">
                            {profile?.full_name ? getInitials(profile.full_name) : "Ph"}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold tracking-tight">
                                Welcome, {profile?.full_name || "Pharmacist"}
                            </h2>
                            {profile?.verification_status === "approved" && (
                                <BadgeCheck className="h-5 w-5 text-indigo-500" />
                            )}
                        </div>
                        <p className="text-muted-foreground text-sm">
                            {profile?.specializations?.join(", ") || "Pharmacist"} • {profile?.experience_years || 0} years experience
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-4 bg-background/50 border border-border p-3 rounded-xl backdrop-blur-md shadow-sm">
                        <span className={`text-sm font-medium transition-colors ${isAvailable ? "text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "text-muted-foreground"}`}>
                            {isAvailable ? "Available for Calls" : "Offline"}
                        </span>
                        <Switch
                            checked={isAvailable}
                            onCheckedChange={handleAvailabilityChange}
                            className="data-[state=checked]:bg-emerald-500"
                        />
                    </div>
                    <ModeToggle />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-background via-muted/50 to-muted border-border shadow-lg hover:shadow-emerald-500/10 transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Wallet className="h-5 w-5 text-emerald-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">₹{stats?.total_earnings || 0}</div>
                        <p className="text-xs text-emerald-500 mt-1 font-medium">+20.1% from last month</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-background via-muted/50 to-muted border-border shadow-lg hover:shadow-blue-500/10 transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Consultations</CardTitle>
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Users className="h-5 w-5 text-blue-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{stats?.completed_consultations || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Completed successfully</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-background via-muted/50 to-muted border-border shadow-lg hover:shadow-amber-500/10 transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Average Rating</CardTitle>
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                            <Star className="h-5 w-5 text-amber-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{stats?.rating_avg || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Based on {stats?.rating_count || 0} reviews</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-background via-muted/50 to-muted border-border shadow-lg hover:shadow-purple-500/10 transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payout</CardTitle>
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <CalendarDays className="h-5 w-5 text-purple-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">₹{stats?.pending_payout || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Processing on Monday</p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Consultations / Upcoming */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 bg-background/50 border-border shadow-xl backdrop-blur-sm">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl">Upcoming Consultations</CardTitle>
                                <CardDescription className="text-muted-foreground">
                                    You have {stats?.upcoming_consultations || 0} bookings scheduled.
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm" className="bg-background hover:bg-muted transition-all">
                                View All
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {consultations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
                                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                        <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
                                    </div>
                                    <p className="text-lg font-medium">No upcoming consultations</p>
                                    <p className="text-sm mt-1 max-w-xs mx-auto">Set your availability to 'Available' to start receiving new bookings from patients.</p>
                                </div>
                            ) : (
                                consultations.slice(0, 5).map((consultation) => {
                                    const isJoinable = consultation.status === "confirmed" || consultation.status === "in_progress";
                                    return (
                                        <div key={consultation.id} className="group flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:border-primary/20 hover:bg-muted/50 transition-all duration-200">
                                            <div className="flex items-center gap-4">
                                                <Avatar className="h-12 w-12 border-2 border-border shadow-sm">
                                                    <AvatarFallback className="bg-muted text-foreground font-semibold">
                                                        {consultation.patient_name?.slice(0, 2).toUpperCase() || "PT"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                                        {consultation.patient_name || `Patient #${consultation.patient_id.slice(0, 8)}`}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                                                            {format(new Date(consultation.scheduled_at), "h:mm a")}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            • {consultation.duration_minutes} Mins
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <Link href={`/pharmacist/consultations/${consultation.id}`}>
                                                    <Button
                                                        size="sm"
                                                        className={`transition-all duration-300 shadow-lg ${isJoinable
                                                            ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20"
                                                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
                                                            }`}
                                                    >
                                                        {isJoinable ? (
                                                            <>
                                                                <Phone className="mr-2 h-3.5 w-3.5 animate-pulse" /> Join Call
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Play className="mr-2 h-3.5 w-3.5" /> View
                                                            </>
                                                        )}
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Activity / Notifications */}
                <Card className="col-span-3 bg-background/50 border-border shadow-xl backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-xl">Recent Activity</CardTitle>
                        <CardDescription>Latest notifications and updates</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            <div className="flex gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="h-10 w-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                                    <Wallet className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Payout Processed</p>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Your weekly payout of <span className="text-foreground font-medium">₹12,400</span> has been successfully processed to your account.</p>
                                    <p className="text-[10px] text-muted-foreground mt-2 font-medium">2 hours ago</p>
                                </div>
                            </div>

                            <div className="flex gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="h-10 w-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                                    <Star className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">New 5-Star Review</p>
                                    <p className="text-xs text-muted-foreground mt-1 italic leading-relaxed">"Dr. Pharmacist was very helpful explaining the dosage..."</p>
                                    <p className="text-[10px] text-muted-foreground mt-2 font-medium">Yesterday</p>
                                </div>
                            </div>

                            <div className="flex gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors opacity-60">
                                <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                                    <Users className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">New Profile Visit</p>
                                    <p className="text-xs text-muted-foreground mt-1">Your profile was viewed 12 times today.</p>
                                    <p className="text-[10px] text-muted-foreground mt-2 font-medium">2 days ago</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
