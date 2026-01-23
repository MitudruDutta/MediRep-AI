"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Shield } from "lucide-react";
import { getFDAAlerts } from "@/lib/api";
import {
  AlertSearchInput,
  AlertList,
  AlertSummary,
  AlertFilters,
  AlertTimeline,
  AlertExport,
  AlertStats,
  FDAAlert,
  AlertSeverity,
} from "@/components/SafetyAlert";
import type { FDAAlertResponse } from "@/types";

export default function SafetyAlertWidget() {
  const [drugName, setDrugName] = useState<string>("");
  const [alerts, setAlerts] = useState<FDAAlert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<FDAAlert[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<AlertSeverity>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchAlerts = useCallback(async (drug: string) => {
    if (!drug.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    setDrugName(drug);

    try {
      const response: FDAAlertResponse = await getFDAAlerts(drug);
      setAlerts(response.alerts || []);
      setFilteredAlerts(response.alerts || []);
      setSelectedSeverity("all");
    } catch (error) {
      console.error("Error fetching FDA alerts:", error);
      setAlerts([]);
      setFilteredAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    if (drugName) {
      await fetchAlerts(drugName);
    }
  };

  const handleSeverityChange = (severity: AlertSeverity) => {
    setSelectedSeverity(severity);
    if (severity === "all") {
      setFilteredAlerts(alerts);
    } else {
      setFilteredAlerts(alerts.filter((alert) => alert.severity === severity));
    }
  };



  const severityCounts = {
    recall: alerts.filter((a) => a.severity === "recall").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8" />
            FDA Safety Alerts
          </h2>
          <p className="text-muted-foreground mt-1">
            Check for FDA recalls, warnings, and safety alerts for medications
          </p>
        </div>
        {hasSearched && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || !drugName}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <AlertExport
              alerts={filteredAlerts}
              drugName={drugName}
              disabled={alerts.length === 0}
            />
          </div>
        )}
      </div>

      {/* Search Input */}
      <Card>
        <CardHeader>
          <CardTitle>Search Drug Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertSearchInput onSearch={fetchAlerts} isLoading={isLoading} />
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {hasSearched && alerts.length > 0 && (
        <AlertSummary alerts={alerts} drugName={drugName} />
      )}

      {/* Main Content */}
      {hasSearched && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Alerts List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {drugName ? `Alerts for ${drugName}` : "Alerts"}
                  {filteredAlerts.length > 0 && ` (${filteredAlerts.length})`}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {alerts.length > 0 && (
                <div className="mb-4">
                  <AlertFilters
                    selectedSeverity={selectedSeverity}
                    onSeverityChange={handleSeverityChange}
                    counts={severityCounts}
                  />
                </div>
              )}
              <AlertList
                alerts={filteredAlerts}
                emptyMessage={
                  selectedSeverity !== "all"
                    ? `No ${selectedSeverity} alerts found for this drug.`
                    : undefined
                }
              />
            </CardContent>
          </Card>

          {/* Timeline & Stats Sidebar */}
          {alerts.length > 0 && (
            <div className="space-y-6">
              <AlertStats alerts={alerts} />
              <AlertTimeline alerts={filteredAlerts} />
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!hasSearched && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/10 p-6 mb-4">
              <Shield className="h-16 w-16 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Search for Drug Safety Alerts</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Enter a drug name above to check for FDA recalls, warnings, and safety alerts.
              Stay informed about medication safety.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span>Product Recalls</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <span>Safety Warnings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span>Information Updates</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span>Lot Number Tracking</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
