"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertSeverity = "recall" | "warning" | "info" | "all";

export interface AlertFiltersProps {
  selectedSeverity: AlertSeverity;
  onSeverityChange: (severity: AlertSeverity) => void;
  counts?: {
    recall: number;
    warning: number;
    info: number;
  };
  className?: string;
}

const filterOptions = [
  {
    value: "all" as AlertSeverity,
    label: "All Alerts",
    icon: null,
    color: "text-foreground",
  },
  {
    value: "recall" as AlertSeverity,
    label: "Recalls",
    icon: AlertTriangle,
    color: "text-red-500",
  },
  {
    value: "warning" as AlertSeverity,
    label: "Warnings",
    icon: AlertCircle,
    color: "text-yellow-500",
  },
  {
    value: "info" as AlertSeverity,
    label: "Info",
    icon: Info,
    color: "text-blue-500",
  },
];

export function AlertFilters({
  selectedSeverity,
  onSeverityChange,
  counts,
  className,
}: AlertFiltersProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {filterOptions.map((option) => {
        const Icon = option.icon;
        const isSelected = selectedSeverity === option.value;
        const count = counts && option.value !== "all" ? counts[option.value] : null;

        return (
          <Button
            key={option.value}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onSeverityChange(option.value)}
            className={cn(
              "gap-2",
              !isSelected && option.color
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {option.label}
            {count !== null && count > 0 && (
              <Badge variant={isSelected ? "secondary" : "outline"} className="ml-1">
                {count}
              </Badge>
            )}
          </Button>
        );
      })}
      {selectedSeverity !== "all" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSeverityChange("all")}
          className="gap-1"
        >
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
