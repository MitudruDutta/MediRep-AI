"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FDAAlert } from "./alert-card";

const severityConfig = {
  recall: {
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/50",
    icon: AlertTriangle,
    label: "Recall",
  },
  warning: {
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/50",
    icon: AlertCircle,
    label: "Warning",
  },
  info: {
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/50",
    icon: Info,
    label: "Info",
  },
};

export interface AlertCompactProps {
  alert: FDAAlert;
  onClick?: () => void;
  className?: string;
}

export function AlertCompact({ alert, onClick, className }: AlertCompactProps) {
  const config = severityConfig[alert.severity];
  const Icon = config.icon;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  return (
    <Card
      className={cn(
        "border-l-4 cursor-pointer hover:shadow-md transition-shadow",
        config.borderColor,
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("rounded-lg p-2 mt-0.5", config.bgColor)}>
            <Icon className={cn("h-4 w-4", config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={cn("text-xs", config.color, config.borderColor)}>
                {config.label}
              </Badge>
              {alert.date && (
                <span className="text-xs text-muted-foreground">{formatDate(alert.date)}</span>
              )}
            </div>
            <h4 className="text-sm font-semibold line-clamp-1 mb-1">{alert.title}</h4>
            <p className="text-xs text-muted-foreground line-clamp-2">{alert.description}</p>
            {alert.lot_numbers && alert.lot_numbers.length > 0 && (
              <div className="mt-2 flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Lots:</span>
                <Badge variant="secondary" className="text-xs font-mono">
                  {alert.lot_numbers[0]}
                </Badge>
                {alert.lot_numbers.length > 1 && (
                  <span className="text-xs text-muted-foreground">
                    +{alert.lot_numbers.length - 1}
                  </span>
                )}
              </div>
            )}
          </div>
          {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
        </div>
      </CardContent>
    </Card>
  );
}
