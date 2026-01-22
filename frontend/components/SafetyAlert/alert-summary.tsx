"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { FDAAlert } from "./alert-card";

export interface AlertSummaryProps {
  alerts: FDAAlert[];
  drugName?: string;
  className?: string;
}

export function AlertSummary({ alerts, drugName, className }: AlertSummaryProps) {
  const recallCount = alerts.filter((a) => a.severity === "recall").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;
  const infoCount = alerts.filter((a) => a.severity === "info").length;

  const stats = [
    {
      label: "Recalls",
      count: recallCount,
      icon: AlertTriangle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      label: "Warnings",
      count: warningCount,
      icon: AlertCircle,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      label: "Info",
      count: infoCount,
      icon: Info,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
  ];

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4", className)}>
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.count}</p>
                </div>
                <div className={cn("rounded-lg p-3", stat.bgColor)}>
                  <Icon className={cn("h-6 w-6", stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
