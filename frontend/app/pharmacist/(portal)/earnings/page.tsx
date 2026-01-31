"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
    Wallet,
    Loader2,
    RefreshCw,
    CheckCircle2,
    Clock,
    XCircle,
    AlertCircle,
    Calendar,
    IndianRupee,
    TrendingUp,
    Hash,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { pharmacistApi, PayoutSummary, PayoutStats } from "@/lib/pharmacist-api";

const statusConfig = {
    pending: { label: "Pending", icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
    processing: { label: "Processing", icon: AlertCircle, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
    completed: { label: "Completed", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" },
    failed: { label: "Failed", icon: XCircle, color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30" },
};

export default function EarningsPage() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [payouts, setPayouts] = useState<PayoutSummary[]>([]);
    const [stats, setStats] = useState<PayoutStats | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const fetchData = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            else setRefreshing(true);

            const [payoutsData, statsData] = await Promise.all([
                pharmacistApi.getPayoutHistory(statusFilter === "all" ? undefined : statusFilter),
                pharmacistApi.getPayoutStats(),
            ]);

            setPayouts(payoutsData);
            setStats(statsData);
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to fetch earnings data");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [statusFilter]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-[color:var(--landing-clay)]" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-[color:var(--landing-ink)] font-[family-name:var(--font-display)]">
                        Earnings & Payouts
                    </h1>
                    <p className="text-[color:var(--landing-muted)] mt-1">
                        Track your consultation earnings and payout history
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchData(false)}
                    disabled={refreshing}
                    className="border-[color:var(--landing-border-strong)] hover:bg-[rgb(var(--landing-dot-rgb)/0.06)]"
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-[color:var(--landing-card)] border-[color:var(--landing-border)]">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-[color:var(--landing-muted)]">
                            Total Earned
                        </CardTitle>
                        <div className="p-2 rounded-lg bg-[rgb(var(--landing-moss-rgb)/0.12)]">
                            <TrendingUp className="h-4 w-4 text-[color:var(--landing-moss)]" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-[color:var(--landing-moss)]">
                            {formatCurrency(stats?.total_earned || 0)}
                        </div>
                        <p className="text-xs text-[color:var(--landing-muted)] mt-1">
                            Lifetime earnings (paid out)
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-[color:var(--landing-card)] border-[color:var(--landing-border)]">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-[color:var(--landing-muted)]">
                            Pending Payout
                        </CardTitle>
                        <div className="p-2 rounded-lg bg-[rgb(var(--landing-clay-rgb)/0.12)]">
                            <IndianRupee className="h-4 w-4 text-[color:var(--landing-clay)]" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-[color:var(--landing-clay)]">
                            {formatCurrency(stats?.pending_payout || 0)}
                        </div>
                        <p className="text-xs text-[color:var(--landing-muted)] mt-1">
                            Awaiting next payout cycle
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-[color:var(--landing-card)] border-[color:var(--landing-border)]">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-[color:var(--landing-muted)]">
                            Last Payout
                        </CardTitle>
                        <div className="p-2 rounded-lg bg-[rgb(var(--landing-dot-rgb)/0.12)]">
                            <Wallet className="h-4 w-4 text-[color:var(--landing-muted)]" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-[color:var(--landing-ink)]">
                            {stats?.last_payout?.amount ? formatCurrency(stats.last_payout.amount) : "---"}
                        </div>
                        <p className="text-xs text-[color:var(--landing-muted)] mt-1">
                            {stats?.last_payout?.date ? formatDate(stats.last_payout.date) : "No payouts yet"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Info Card */}
            <Card className="bg-gradient-to-r from-[rgb(var(--landing-moss-rgb)/0.08)] to-[rgb(var(--landing-clay-rgb)/0.08)] border-[color:var(--landing-border)]">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-[rgb(var(--landing-moss-rgb)/0.12)]">
                            <AlertCircle className="h-5 w-5 text-[color:var(--landing-moss)]" />
                        </div>
                        <div>
                            <h3 className="font-medium text-[color:var(--landing-ink)]">Payout Information</h3>
                            <p className="text-sm text-[color:var(--landing-muted)] mt-1">
                                Payouts are processed weekly. Completed consultations are aggregated and paid out via UPI/Bank transfer.
                                A 20% platform fee is deducted from each consultation. TDS (2%) may be applicable for annual earnings above Rs. 20,000.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Payout History */}
            <Card className="bg-[color:var(--landing-card)] border-[color:var(--landing-border)]">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg text-[color:var(--landing-ink)] flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-[color:var(--landing-moss)]" />
                            Payout History
                        </CardTitle>
                        <CardDescription>
                            Your payment records and transaction history
                        </CardDescription>
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px] bg-[rgb(var(--landing-dot-rgb)/0.04)] border-[color:var(--landing-border)]">
                            <SelectValue placeholder="Filter status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent>
                    {payouts.length === 0 ? (
                        <div className="text-center py-12 text-[color:var(--landing-muted)]">
                            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-30" />
                            <p className="font-medium">No payouts yet</p>
                            <p className="text-sm mt-1">Complete consultations to start earning!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {payouts.map((payout) => {
                                const config = statusConfig[payout.status];
                                const StatusIcon = config.icon;

                                return (
                                    <div
                                        key={payout.id}
                                        className="flex items-center justify-between p-4 rounded-lg bg-[rgb(var(--landing-dot-rgb)/0.04)] border border-[color:var(--landing-border)]"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${config.bg}`}>
                                                <StatusIcon className={`h-5 w-5 ${config.color}`} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-[color:var(--landing-ink)]">
                                                        Payout #{payout.id.slice(0, 8)}
                                                    </p>
                                                    <Badge variant="outline" className={`text-xs ${config.color}`}>
                                                        {config.label}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 text-sm text-[color:var(--landing-muted)] mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {formatDate(payout.period_start)} - {formatDate(payout.period_end)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Hash className="h-3 w-3" />
                                                        {payout.consultation_count} consultation{payout.consultation_count !== 1 ? "s" : ""}
                                                    </span>
                                                </div>
                                                {payout.transfer_reference && (
                                                    <p className="text-xs text-[color:var(--landing-muted)] mt-1">
                                                        UTR: {payout.transfer_reference}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg text-[color:var(--landing-ink)]">
                                                {formatCurrency(payout.net_amount)}
                                            </p>
                                            {payout.tds_deducted > 0 && (
                                                <p className="text-xs text-[color:var(--landing-muted)]">
                                                    TDS: {formatCurrency(payout.tds_deducted)}
                                                </p>
                                            )}
                                            {payout.processed_at && (
                                                <p className="text-xs text-[color:var(--landing-moss)] mt-1">
                                                    Paid on {formatDate(payout.processed_at)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
