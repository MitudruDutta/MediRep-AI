"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, X, Search } from "lucide-react";
import { getFDAAlerts } from "@/lib/api";
import { FDAAlert } from "@/types";

const severityColors = {
  info: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  warning: "bg-warning/20 text-warning border-warning/30",
  recall: "bg-danger/20 text-danger border-danger/30",
};

export default function SafetyAlertWidget() {
  const [drugName, setDrugName] = useState("");
  const [alerts, setAlerts] = useState<FDAAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const searchAlerts = async () => {
    if (!drugName.trim()) return;

    setIsLoading(true);
    try {
      const response = await getFDAAlerts(drugName);
      setAlerts(response.alerts || []);
      setDismissedAlerts(new Set());
    } catch (error) {
      console.error("Error fetching alerts:", error);
      alert("Failed to fetch alerts. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const dismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set(prev).add(alertId));
  };

  const visibleAlerts = alerts.filter(alert => !dismissedAlerts.has(alert.id));

  return (
    <Card className="glass-card p-6">
      <h2 className="text-2xl font-bold mb-6">FDA Safety Alerts</h2>

      <div className="flex gap-2 mb-6">
        <Input
          value={drugName}
          onChange={(e) => setDrugName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchAlerts()}
          placeholder="Enter drug name to check alerts"
        />
        <Button onClick={searchAlerts} disabled={isLoading}>
          <Search className="h-4 w-4 mr-2" />
          {isLoading ? "Searching..." : "Search"}
        </Button>
      </div>

      <div className="space-y-4">
        {visibleAlerts.length === 0 && !isLoading && (
          <div className="text-center text-muted-foreground py-8">
            {alerts.length === 0
              ? "Enter a drug name to check for FDA alerts"
              : "All alerts dismissed"}
          </div>
        )}

        {visibleAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-4 border-2 rounded-lg animate-in slide-in-from-top ${
              severityColors[alert.severity]
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3 flex-1">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold">{alert.title}</h3>
                    <Badge variant="outline" className={severityColors[alert.severity]}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm mb-2">{alert.description}</p>
                  {alert.date && (
                    <p className="text-xs text-muted-foreground">
                      Date: {new Date(alert.date).toLocaleDateString()}
                    </p>
                  )}
                  {alert.lot_numbers && alert.lot_numbers.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold mb-1">Affected Lot Numbers:</p>
                      <div className="flex flex-wrap gap-1">
                        {alert.lot_numbers.map((lot, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {lot}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                onClick={() => dismissAlert(alert.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
