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
    Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { pharmacistApi, PharmacistStats, PharmacistConsultation } from "@/lib/pharmacist-api";

export default function PharmacistDashboard() {
    const [stats, setStats] = useState<PharmacistStats | null>(null);
    const [consultations, setConsultations] = useState<PharmacistConsultation[]>([]);
    const [isAvailable, setIsAvailable] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const [statsData, consultationsData] = await Promise.all([
                    pharmacistApi.getDashboardStats(),
                    pharmacistApi.getMyConsultations("upcoming")
                ]);
                setStats(statsData);
                setConsultations(consultationsData);
            } catch (error) {
                console.error(error);
                toast.error("Failed to load dashboard");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const handleAvailabilityChange = async (checked: boolean) => {
        try {
            await pharmacistApi.toggleAvailability(checked);
            setIsAvailable(checked);
            toast.success(checked ? "You are now ONLINE" : "You are now OFFLINE");
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    if (loading) {
        return <div className="p-8 text-slate-400">Loading dashboard...</div>;
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <p className="text-slate-400">Welcome back, Dr. Pharmacist</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-2 rounded-lg">
                    <span className={`text-sm font-medium ${isAvailable ? "text-green-400" : "text-slate-500"}`}>
                        {isAvailable ? "Available for Calls" : "Offline"}
                    </span>
                    <Switch
                        checked={isAvailable}
                        onCheckedChange={handleAvailabilityChange}
                        className="data-[state=checked]:bg-green-500"
                    />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Total Revenue</CardTitle>
                        <Wallet className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-400">₹{stats?.total_earnings || 0}</div>
                        <p className="text-xs text-slate-500">+20.1% from last month</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Consultations</CardTitle>
                        <Users className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-400">{stats?.completed_consultations || 0}</div>
                        <p className="text-xs text-slate-500">Completed Success</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Rating</CardTitle>
                        <Star className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-400">{stats?.rating_avg || 0}</div>
                        <p className="text-xs text-slate-500">Based on {stats?.rating_count || 0} reviews</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Pending Payout</CardTitle>
                        <CalendarDays className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-200">₹{stats?.pending_payout || 0}</div>
                        <p className="text-xs text-slate-500">Processing on Monday</p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Consultations / Upcoming */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle>Upcoming Consultations</CardTitle>
                        <CardDescription>
                            You have {stats?.upcoming_consultations || 0} consultations scheduled for today.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {consultations.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-50" />
                                    <p>No upcoming consultations</p>
                                    <p className="text-xs mt-1">Set your availability to receive bookings</p>
                                </div>
                            ) : (
                                consultations.slice(0, 5).map((consultation) => {
                                    const isJoinable = consultation.status === "confirmed" || consultation.status === "in_progress";
                                    return (
                                        <div key={consultation.id} className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <Avatar className="h-10 w-10 border border-slate-700">
                                                    <AvatarFallback>
                                                        {consultation.patient_name?.slice(0, 2).toUpperCase() || "PT"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium leading-none text-slate-200">
                                                        {consultation.patient_name || `Patient #${consultation.patient_id.slice(0, 8)}`}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {format(new Date(consultation.scheduled_at), "PPP p")} • {consultation.duration_minutes} Mins
                                                    </p>
                                                    {consultation.patient_concern && (
                                                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                                                            "{consultation.patient_concern}"
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <Link href={`/pharmacist/consultations/${consultation.id}`}>
                                                    <Button
                                                        size="sm"
                                                        className={isJoinable
                                                            ? "bg-green-600 hover:bg-green-700 text-white"
                                                            : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                                                        }
                                                    >
                                                        {isJoinable ? (
                                                            <>
                                                                <Phone className="mr-2 h-3 w-3" /> Join
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Play className="mr-2 h-3 w-3" /> View
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
                <Card className="col-span-3 bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                        <CardDescription>Latest notifications and updates</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                    <Wallet className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-200">Payout Processed</p>
                                    <p className="text-xs text-slate-500">Your weekly payout of ₹12,400 has been processed.</p>
                                    <p className="text-[10px] text-slate-600 mt-1">2 hours ago</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                                    <Star className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-200">New 5-Star Review</p>
                                    <p className="text-xs text-slate-500">"Dr. Pharmacist was very helpful explaining the dosage..."</p>
                                    <p className="text-[10px] text-slate-600 mt-1">Yesterday</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
