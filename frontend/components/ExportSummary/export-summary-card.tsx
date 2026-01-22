"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, AlertCircle, Info, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DrugInteraction, FDAAlert } from "@/types";

export interface ExportSummaryCardProps {
  drugs: string[];
  interactions: DrugInteraction[];
  alerts: FDAAlert[];
  className?: string;
}

export function ExportSummaryCard({ drugs, interactions, alerts, className }: ExportSummaryCardProps) {
  const interactionCounts = {
    major: interactions.filter(i => i.severity === "major").length,
    moderate: interactions.filter(i => i.severity === "moderate").length,
    minor: interactions.filter(i => i.severity === "minor").length,
  };

  const alertCounts = {
    recall: alerts.filter(a => a.severity === "recall").length,
    warning: alerts.filter(a => a.severity === "warning").length,
    info: alerts.filter(a => a.severity === "info").length,
  };

  const hasIssues = interactionCounts.major > 0 || alertCounts.recall > 0;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Summary</CardTitle>
          {hasIssues ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Action Required
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-green-500 border-green-500">
              <CheckCircle className="h-3 w-3" />
              All Clear
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drugs */}
        <div>
          <p className="text-sm font-medium mb-2">Drugs ({drugs.length})</p>
          <div className="flex flex-wrap gap-2">
            {drugs.slice(0, 5).map((drug) => (
              <Badge key={drug} variant="secondary">
                {drug}
              </Badge>
            ))}
            {drugs.length > 5 && (
              <Badge variant="outline">+{drugs.length - 5} more</Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Interactions */}
        <div>
          <p className="text-sm font-medium mb-2">Interactions ({interactions.length})</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-lg font-bold text-red-500">{interactionCounts.major}</p>
                <p className="text-xs text-muted-foreground">Major</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-lg font-bold text-yellow-500">{interactionCounts.moderate}</p>
                <p className="text-xs text-muted-foreground">Moderate</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-lg font-bold text-blue-500">{interactionCounts.minor}</p>
                <p className="text-xs text-muted-foreground">Minor</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Alerts */}
        <div>
          <p className="text-sm font-medium mb-2">FDA Alerts ({alerts.length})</p>
          <div className="space-y-2">
            {alertCounts.recall > 0 && (
              <div className="flex items-center justify-between p-2 bg-red-500/10 rounded-lg">
                <span className="text-sm text-red-500">Recalls</span>
                <Badge variant="destructive">{alertCounts.recall}</Badge>
              </div>
            )}
            {alertCounts.warning > 0 && (
              <div className="flex items-center justify-between p-2 bg-yellow-500/10 rounded-lg">
                <span className="text-sm text-yellow-500">Warnings</span>
                <Badge className="bg-yellow-500 text-white">{alertCounts.warning}</Badge>
              </div>
            )}
            {alertCounts.info > 0 && (
              <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded-lg">
                <span className="text-sm text-blue-500">Info</span>
                <Badge className="bg-blue-500">{alertCounts.info}</Badge>
              </div>
            )}
            {alerts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">No alerts found</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
