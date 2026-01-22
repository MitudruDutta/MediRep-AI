"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Download } from "lucide-react";
import { checkInteractions } from "@/lib/api";
import { DrugInteraction } from "@/types";
import dynamic from "next/dynamic";
import {
  DrugSearchInput,
  DrugList,
  InteractionCard,
  InteractionList,
  InteractionSummary,
} from "@/components/InteractionGraph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const severityColors = {
  major: "#ef4444",
  moderate: "#eab308",
  minor: "#3b82f6",
};

export default function InteractionGraphWidget() {
  const [drugs, setDrugs] = useState<string[]>([]);
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [selectedInteraction, setSelectedInteraction] = useState<DrugInteraction | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const addDrug = (drug: string) => {
    if (drug.trim() && !drugs.includes(drug.trim())) {
      setDrugs([...drugs, drug.trim()]);
    }
  };

  const removeDrug = (index: number) => {
    setDrugs(drugs.filter((_, i) => i !== index));
    setSelectedInteraction(null);
  };

  const fetchInteractions = useCallback(async () => {
    if (drugs.length < 2) {
      setInteractions([]);
      setSelectedInteraction(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await checkInteractions(drugs);
      setInteractions(response.interactions || []);
    } catch (error) {
      console.error("Error fetching interactions:", error);
      setInteractions([]);
    } finally {
      setIsLoading(false);
    }
  }, [drugs]);

  useEffect(() => {
    fetchInteractions();
  }, [fetchInteractions]);

  const handleRefresh = async () => {
    console.log("Refresh clicked, drugs:", drugs);
    if (drugs.length >= 2) {
      await fetchInteractions();
    }
  };

  const exportData = () => {
    console.log("Export clicked, drugs:", drugs, "interactions:", interactions);
    try {
      const data = {
        drugs,
        interactions,
        timestamp: new Date().toISOString(),
        summary: {
          total: interactions.length,
          major: interactions.filter(i => i.severity === "major").length,
          moderate: interactions.filter(i => i.severity === "moderate").length,
          minor: interactions.filter(i => i.severity === "minor").length,
        }
      };
      
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `drug-interactions-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log("Export successful");
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("Failed to export data. Please try again.");
    }
  };

  const graphData = {
    nodes: drugs.map((drug) => ({ id: drug, name: drug })),
    links: interactions.map((interaction) => ({
      source: interaction.drug1,
      target: interaction.drug2,
      color: severityColors[interaction.severity],
      severity: interaction.severity,
      description: interaction.description,
      recommendation: interaction.recommendation,
    })),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Drug Interaction Checker</h2>
          <p className="text-muted-foreground mt-1">
            Visualize and analyze potential drug-drug interactions
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={isLoading || drugs.length < 2}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportData} 
            disabled={drugs.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {interactions.length > 0 && <InteractionSummary interactions={interactions} />}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph Visualization */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Interaction Network</CardTitle>
          </CardHeader>
          <CardContent>
            {drugs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <div className="rounded-full bg-muted p-6 mb-4">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Drugs Added</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Add at least 2 drugs to visualize their interactions in the network graph
                </p>
              </div>
            ) : drugs.length === 1 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <div className="rounded-full bg-primary/10 p-6 mb-4">
                  <AlertTriangle className="h-12 w-12 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Add More Drugs</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Add at least one more drug to check for interactions
                </p>
              </div>
            ) : (
              <div className="h-[400px] border border-border rounded-lg overflow-hidden bg-background">
                <ForceGraph2D
                  graphData={graphData}
                  nodeLabel="name"
                  nodeColor={() => "#3b82f6"}
                  nodeRelSize={8}
                  linkColor={(link: any) => link.color}
                  linkWidth={3}
                  linkDirectionalParticles={2}
                  linkDirectionalParticleWidth={2}
                  onLinkClick={(link: any) => {
                    setSelectedInteraction({
                      drug1: link.source.id,
                      drug2: link.target.id,
                      severity: link.severity,
                      description: link.description,
                      recommendation: link.recommendation,
                    });
                  }}
                  backgroundColor="transparent"
                />
              </div>
            )}

            {selectedInteraction && (
              <div className="mt-4">
                <InteractionCard
                  interaction={selectedInteraction}
                  onClose={() => setSelectedInteraction(null)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Drug Management */}
          <Card>
            <CardHeader>
              <CardTitle>Manage Drugs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DrugSearchInput
                onAddDrug={addDrug}
                existingDrugs={drugs}
                isLoading={isLoading}
              />
              <DrugList drugs={drugs} onRemove={removeDrug} />
            </CardContent>
          </Card>

          {/* Interactions List */}
          {drugs.length >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Interactions ({interactions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InteractionList
                  interactions={interactions}
                  onSelect={setSelectedInteraction}
                  selectedInteraction={selectedInteraction}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
