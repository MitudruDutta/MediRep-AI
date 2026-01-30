"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
    Users,
    UserCheck,
    AlertTriangle,
    TrendingUp,
    Calendar,
    DollarSign,
    ArrowUpRight,
    Loader2,
    RefreshCw,
    ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { adminApi, AdminStats } from "@/lib/admin-api";

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchStats = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            else setRefreshing(true);

            const data = await adminApi.getStats();
            setStats(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch dashboard stats");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
            </div>
        );
    }

    const statCards = [
        {
            title: "Total Users",
            value: stats?.total_users || 0,
            icon: Users,
            color: "from-blue-500 to-blue-600",
            bgColor: "bg-blue-500/10",
            textColor: "text-blue-400",
        },
        {
            title: "Pharmacists",
            value: stats?.total_pharmacists || 0,
            icon: UserCheck,
            color: "from-emerald-500 to-emerald-600",
            bgColor: "bg-emerald-500/10",
            textColor: "text-emerald-400",
        },
        {
            title: "Pending Verification",
            value: stats?.pending_verifications || 0,
            icon: AlertTriangle,
            color: "from-amber-500 to-amber-600",
            bgColor: "bg-amber-500/10",
            textColor: "text-amber-400",
            urgent: (stats?.pending_verifications || 0) > 0,
        },
        {
            title: "Consultations",
            value: stats?.total_consultations || 0,
            icon: Calendar,
            color: "from-purple-500 to-purple-600",
            bgColor: "bg-purple-500/10",
            textColor: "text-purple-400",
        },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Admin Dashboard
                    </h1>
                    <p className="text-slate-400 mt-1">
                        System overview and quick actions
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchStats(false)}
                    disabled={refreshing}
                    className="border-slate-700 hover:bg-slate-800"
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => (
                    <Card
                        key={stat.title}
                        className={`bg-slate-900 border-slate-800 ${stat.urgent ? 'ring-2 ring-amber-500/50' : ''
                            }`}
                    >
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400">
                                {stat.title}
                            </CardTitle>
                            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                                <stat.icon className={`h-4 w-4 ${stat.textColor}`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-white">
                                {stat.value.toLocaleString()}
                            </div>
                            {stat.urgent && (
                                <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Requires attention
                                </p>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Pending Verifications Card */}
                <Card className="bg-slate-900 border-slate-800 md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg text-white flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-amber-400" />
                            Pharmacist Verifications
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(stats?.pending_verifications || 0) > 0 ? (
                            <div className="space-y-4">
                                <p className="text-slate-400">
                                    You have{" "}
                                    <span className="text-amber-400 font-bold">
                                        {stats?.pending_verifications}
                                    </span>{" "}
                                    pharmacist application{stats?.pending_verifications === 1 ? '' : 's'} waiting for verification.
                                </p>
                                <Link href="/admin/verify">
                                    <Button className="bg-amber-600 hover:bg-amber-700">
                                        Review Applications
                                        <ArrowUpRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                                    <ShieldCheck className="h-6 w-6 text-emerald-400" />
                                </div>
                                <p className="text-slate-400">All caught up! No pending verifications.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Revenue Card */}
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-lg text-white flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-emerald-400" />
                            Platform Revenue
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-white">
                            {stats?.total_revenue || 0}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Total platform fees collected
                        </p>
                        <div className="mt-4 pt-4 border-t border-slate-800">
                            <Link href="/admin/payouts">
                                <Button variant="outline" size="sm" className="w-full border-slate-700 hover:bg-slate-800">
                                    Manage Payouts
                                    <ArrowUpRight className="ml-2 h-3 w-3" />
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* System Health */}
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-cyan-400" />
                        System Health
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-sm text-slate-400">API Status</span>
                            </div>
                            <p className="text-lg font-medium text-emerald-400">Operational</p>
                        </div>
                        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-sm text-slate-400">Database</span>
                            </div>
                            <p className="text-lg font-medium text-emerald-400">Connected</p>
                        </div>
                        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-sm text-slate-400">Payment Gateway</span>
                            </div>
                            <p className="text-lg font-medium text-emerald-400">Active</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
