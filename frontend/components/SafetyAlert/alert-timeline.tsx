"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { FDAAlert } from "./alert-card";

export interface AlertTimelineProps {
  alerts: FDAAlert[];
  className?: string;
}

const severityConfig = {
  recall: {
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500",
    icon: AlertTriangle,
    label: "Recall",
  },
  warning: {
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500",
    icon: AlertCircle,
    label: "Warning",
  },
  info: {
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500",
    icon: Info,
    label: "Info",
  },
};

export function AlertTimeline({ alerts, className }: AlertTimelineProps) {
  const sortedAlerts = React.useMemo(() => {
    return [...alerts].sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [alerts]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Date unknown";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Date unknown";
    }
  };

  if (alerts.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Alert Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border" />

          {sortedAlerts.map((alert, index) => {
            const config = severityConfig[alert.severity];
            const Icon = config.icon;

            return (
              <div key={alert.id} className="relative flex gap-4">
                {/* Timeline dot */}
                <div
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                    config.borderColor,
                    config.bgColor
                  )}
                >
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>

                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={cn(config.color, config.borderColor)}>
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(alert.date)}</span>
                  </div>
                  <h4 className="text-sm font-semibold mb-1">{alert.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">{alert.description}</p>
                  {alert.lot_numbers && alert.lot_numbers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {alert.lot_numbers.slice(0, 3).map((lot, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs font-mono">
                          {lot}
                        </Badge>
                      ))}
                      {alert.lot_numbers.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{alert.lot_numbers.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
