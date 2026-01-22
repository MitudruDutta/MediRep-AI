"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, AlertTriangle } from "lucide-react";
import { checkInteractions } from "@/lib/api";
import { DrugInteraction } from "@/types";
import dynamic from "next/dynamic";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const severityColors = {
  major: "#ff4444",
  moderate: "#ffaa00",
  minor: "#00ff88",
};

export default function InteractionGraphWidget() {
  const [drugs, setDrugs] = useState<string[]>([]);
  const [drugInput, setDrugInput] = useState("");
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [selectedInteraction, setSelectedInteraction] = useState<DrugInteraction | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const addDrug = () => {
    if (drugInput.trim() && !drugs.includes(drugInput.trim())) {
      setDrugs([...drugs, drugInput.trim()]);
      setDrugInput("");
    }
  };

  const removeDrug = (index: number) => {
    setDrugs(drugs.filter((_, i) => i !== index));
  };

  const fetchInteractions = useCallback(async () => {
    if (drugs.length < 2) {
      setInteractions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await checkInteractions(drugs);
      setInteractions(response.interactions || []);
    } catch (error) {
      console.error("Error fetching interactions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [drugs]);

  useEffect(() => {
    fetchInteractions();
  }, [fetchInteractions]);

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="glass-card p-6 lg:col-span-2">
        <h2 className="text-2xl font-bold mb-4">Drug Interaction Graph</h2>
        
        {drugs.length === 0 ? (
          <div className="flex items-center justify-center h-100 text-muted-foreground">
            <p>Add drugs to visualize interactions</p>
          </div>
        ) : drugs.length === 1 ? (
          <div className="flex items-center justify-center h-100 text-muted-foreground">
            <p>Add at least 2 drugs to check interactions</p>
          </div>
        ) : (
          <div className="h-100 border border-border rounded-lg overflow-hidden">
            <ForceGraph2D
              graphData={graphData}
              nodeLabel="name"
              nodeColor={() => "#00d4ff"}
              nodeRelSize={8}
              linkColor={(link: any) => link.color}
              linkWidth={2}
              linkDirectionalParticles={2}
              onLinkClick={(link: any) => {
                setSelectedInteraction({
                  drug1: link.source.id,
                  drug2: link.target.id,
                  severity: link.severity,
                  description: link.description,
                  recommendation: link.recommendation,
                });
              }}
              backgroundColor="#0a0a0f"
            />
          </div>
        )}

        {selectedInteraction && (
          <Card className="mt-4 p-4 border-2" style={{ borderColor: severityColors[selectedInteraction.severity] }}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" style={{ color: severityColors[selectedInteraction.severity] }} />
                <h3 className="font-bold">
                  {selectedInteraction.drug1} + {selectedInteraction.drug2}
                </h3>
              </div>
              <Badge
                variant="outline"
                style={{
                  borderColor: severityColors[selectedInteraction.severity],
                  color: severityColors[selectedInteraction.severity],
                }}
              >
                {selectedInteraction.severity.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm mb-2">{selectedInteraction.description}</p>
            {selectedInteraction.recommendation && (
              <p className="text-sm text-muted-foreground">
                <strong>Recommendation:</strong> {selectedInteraction.recommendation}
              </p>
            )}
          </Card>
        )}
      </Card>

      <Card className="glass-card p-6">
        <h3 className="text-xl font-bold mb-4">Manage Drugs</h3>
        
        <div className="flex gap-2 mb-4">
          <Input
            value={drugInput}
            onChange={(e) => setDrugInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDrug()}
            placeholder="Enter drug name"
          />
          <Button size="icon" onClick={addDrug}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {drugs.map((drug, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-secondary/20 rounded">
              <span className="text-sm">{drug}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => removeDrug(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {interactions.length > 0 && (
          <div className="mt-6">
            <h4 className="font-semibold mb-2">Interactions Found</h4>
            <div className="space-y-2">
              {interactions.map((interaction, index) => (
                <div
                  key={index}
                  className="p-2 border rounded cursor-pointer hover:bg-secondary/10"
                  style={{ borderColor: severityColors[interaction.severity] }}
                  onClick={() => setSelectedInteraction(interaction)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs">
                      {interaction.drug1} + {interaction.drug2}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{
                        borderColor: severityColors[interaction.severity],
                        color: severityColors[interaction.severity],
                      }}
                    >
                      {interaction.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
