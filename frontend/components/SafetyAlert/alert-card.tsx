"use client";

import * as React from "react";
import { AlertTriangle, AlertCircle, Info, Calendar, Package, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FDAAlert } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

export type { FDAAlert };

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

export interface AlertCardProps {
  alert: FDAAlert;
  className?: string;
  defaultExpanded?: boolean;
}

export function AlertCard({ alert, className, defaultExpanded = false }: AlertCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const config = severityConfig[alert.severity];
  const Icon = config.icon;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Date not available";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "Date not available";
    }
  };

  return (
    <Card className={cn("border-2", config.borderColor, className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className={cn("rounded-lg p-2 mt-1", config.bgColor)}>
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={cn(config.color, config.borderColor)}>
                  {config.label}
                </Badge>
                <span className="text-xs text-muted-foreground">#{alert.id}</span>
              </div>
              <CardTitle className="text-base leading-tight">{alert.title}</CardTitle>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <CardContent className="space-y-4 pt-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(alert.date)}</span>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Reason for Alert</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{alert.description}</p>
              </div>

              {alert.lot_numbers && alert.lot_numbers.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Affected Lot Numbers
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {alert.lot_numbers.map((lot, index) => (
                      <Badge key={index} variant="secondary" className="font-mono text-xs">
                        {lot}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className={cn("rounded-lg p-3 text-sm", config.bgColor)}>
                <p className={cn("font-medium", config.color)}>
                  {alert.severity === "recall"
                    ? "⚠️ This product has been recalled. Do not use and consult your healthcare provider."
                    : alert.severity === "warning"
                      ? "⚠️ Exercise caution. Consult your healthcare provider if you have concerns."
                      : "ℹ️ Stay informed about this product. Monitor for updates."}
                </p>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
