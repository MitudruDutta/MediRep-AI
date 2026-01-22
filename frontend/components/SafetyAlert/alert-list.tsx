"use client";

import * as React from "react";
import { AlertCard, FDAAlert } from "./alert-card";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

export interface AlertListProps {
  alerts: FDAAlert[];
  className?: string;
  emptyMessage?: string;
}

export function AlertList({ alerts, className, emptyMessage }: AlertListProps) {
  if (alerts.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <div className="rounded-full bg-muted p-6 mb-4">
          <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Alerts Found</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {emptyMessage || "No FDA alerts or recalls found for this drug. This is good news!"}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
    </div>
  );
}
