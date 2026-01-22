"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { FDAAlert } from "./alert-card";

export interface AlertStatsProps {
  alerts: FDAAlert[];
  className?: string;
}

export function AlertStats({ alerts, className }: AlertStatsProps) {
  const stats = React.useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recentAlerts = alerts.filter((alert) => {
      if (!alert.date) return false;
      const alertDate = new Date(alert.date);
      return alertDate >= thirtyDaysAgo;
    });

    const previousAlerts = alerts.filter((alert) => {
      if (!alert.date) return false;
      const alertDate = new Date(alert.date);
      return alertDate >= sixtyDaysAgo && alertDate < thirtyDaysAgo;
    });

    const trend =
      previousAlerts.length === 0
        ? "neutral"
        : recentAlerts.length > previousAlerts.length
        ? "up"
        : recentAlerts.length < previousAlerts.length
        ? "down"
        : "neutral";

    const trendPercentage =
      previousAlerts.length === 0
        ? 0
        : Math.abs(
            ((recentAlerts.length - previousAlerts.length) / previousAlerts.length) * 100
          );

    return {
      total: alerts.length,
      recent: recentAlerts.length,
      trend,
      trendPercentage: Math.round(trendPercentage),
    };
  }, [alerts]);

  const TrendIcon =
    stats.trend === "up" ? TrendingUp : stats.trend === "down" ? TrendingDown : Minus;

  const trendColor =
    stats.trend === "up"
      ? "text-red-500"
      : stats.trend === "down"
      ? "text-green-500"
      : "text-muted-foreground";

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Alert Statistics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Alerts</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </div>
          <div className={cn("flex items-center gap-1", trendColor)}>
            <TrendIcon className="h-5 w-5" />
            {stats.trendPercentage > 0 && <span className="text-sm font-medium">{stats.trendPercentage}%</span>}
          </div>
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-1">Last 30 Days</p>
          <p className="text-2xl font-semibold">{stats.recent}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.trend === "up"
              ? "Increase in recent alerts"
              : stats.trend === "down"
              ? "Decrease in recent alerts"
              : "No significant change"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
