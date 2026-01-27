"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, RefreshCw, Download, Loader2 } from "lucide-react";
import { checkInteractions, saveDrug } from "@/lib/api";
import { DrugInteraction } from "@/types";
import { usePatientContext } from "@/lib/context/PatientContext";
import dynamic from "next/dynamic";
import {
  DrugSearchInput,
  DrugList,
  InteractionCard,
  InteractionList,
  InteractionSummary,
} from "@/components/InteractionGraph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

// import { forceCollide } from 'd3-force';

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
  const { patientContext } = usePatientContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: 400 });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Configure force simulation for node separation
  useEffect(() => {
    if (graphRef.current) {
      const fg = graphRef.current;
      // Add collision force to keep nodes apart (minimum 60px between nodes)
      // fg.d3Force('collision', forceCollide(60));
      // Increase charge repulsion
      fg.d3Force('charge')?.strength(-300);
      // Set link distance
      fg.d3Force('link')?.distance(180);
    }
  }, [drugs.length, interactions.length]);

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
    const hasContext = patientContext && (patientContext.conditions?.length > 0 || patientContext.allergies?.length > 0);

    if (drugs.length < 1 || (drugs.length < 2 && !hasContext)) {
      setInteractions([]);
      setSelectedInteraction(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await checkInteractions(drugs, patientContext) as any;

      // BRUTAL FIX: Backend returns an array directly
      if (Array.isArray(response)) {
        setInteractions(response);
      } else if (response.interactions && Array.isArray(response.interactions)) {
        setInteractions(response.interactions);
      } else {
        setInteractions([]);
      }
    } catch (error) {
      console.error("Error fetching interactions:", error);
      setInteractions([]);
    } finally {
      setIsLoading(false);
    }
  }, [drugs, patientContext]);

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

  // Build graph data with links between drugs that have related interactions
  const graphData = useMemo(() => {
    const nodeIds = new Set(drugs.map(d => d.toLowerCase().trim()));

    // Find direct drug-drug interactions
    const directLinks = interactions
      .filter(i => {
        const source = i.drug1.toLowerCase().trim();
        const target = i.drug2.toLowerCase().trim();
        return nodeIds.has(source) && nodeIds.has(target) && source !== target;
      })
      .map((interaction) => ({
        source: interaction.drug1.toLowerCase().trim(),
        target: interaction.drug2.toLowerCase().trim(),
        color: severityColors[interaction.severity as keyof typeof severityColors] || severityColors.moderate,
        severity: interaction.severity,
        description: interaction.description,
        recommendation: interaction.recommendation,
      }));

    // If we have interactions but no direct drug-drug links, 
    // create links between drugs that share interactions (via patient context)
    let links = directLinks;

    if (directLinks.length === 0 && interactions.length > 0 && drugs.length >= 2) {
      // Create links between all drug pairs with the highest severity from their interactions
      const drugArray = drugs.map(d => d.toLowerCase().trim());
      const pairLinks: typeof directLinks = [];

      for (let i = 0; i < drugArray.length; i++) {
        for (let j = i + 1; j < drugArray.length; j++) {
          // Find interactions involving each drug
          const drug1Interactions = interactions.filter(int =>
            int.drug1.toLowerCase().trim() === drugArray[i] ||
            int.drug2.toLowerCase().trim() === drugArray[i]
          );
          const drug2Interactions = interactions.filter(int =>
            int.drug1.toLowerCase().trim() === drugArray[j] ||
            int.drug2.toLowerCase().trim() === drugArray[j]
          );

          if (drug1Interactions.length > 0 || drug2Interactions.length > 0) {
            // Get max severity from both drugs' interactions
            const allRelevant = [...drug1Interactions, ...drug2Interactions];
            const severity = allRelevant.some(i => i.severity === 'major') ? 'major' :
              allRelevant.some(i => i.severity === 'moderate') ? 'moderate' : 'minor';

            pairLinks.push({
              source: drugArray[i],
              target: drugArray[j],
              color: severityColors[severity as keyof typeof severityColors],
              severity: severity as 'major' | 'moderate' | 'minor',
              description: `${allRelevant.length} interactions found via patient context`,
              recommendation: 'Review individual interactions in the list',
            });
          }
        }
      }
      links = pairLinks;
    }

    // Pre-position nodes in a circle for better initial spread
    const radius = 120;
    const angleStep = (2 * Math.PI) / Math.max(drugs.length, 1);

    return {
      nodes: drugs.map((drug, index) => ({
        id: drug.toLowerCase().trim(),
        name: drug,
        // Initial positions in a circle
        x: Math.cos(angleStep * index) * radius,
        y: Math.sin(angleStep * index) * radius,
      })),
      links,
    };
  }, [drugs, interactions]);

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
            ) : isLoading ? (
              <div className="h-[400px] flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                <div className="space-y-2 w-full max-w-xs">
                  <Skeleton className="h-4 w-full bg-slate-700" />
                  <Skeleton className="h-4 w-3/4 bg-slate-700" />
                  <Skeleton className="h-4 w-1/2 bg-slate-700" />
                </div>
                <p className="text-sm text-cyan-300/70">Analyzing molecular interactions...</p>
              </div>
            ) : (
              <div ref={containerRef} className="h-[400px] rounded-xl overflow-hidden relative">
                {/* Premium dark gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />

                {/* Animated grid pattern overlay */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: `
                      linear-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(99, 102, 241, 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px'
                  }}
                />

                {/* Radial glow in center */}
                <div className="absolute inset-0 bg-gradient-radial from-cyan-500/10 via-transparent to-transparent"
                  style={{
                    background: 'radial-gradient(circle at center, rgba(6, 182, 212, 0.15) 0%, transparent 50%)'
                  }}
                />

                <ForceGraph2D
                  ref={graphRef}
                  graphData={graphData}
                  nodeLabel=""
                  width={dimensions.width}
                  height={dimensions.height}
                  d3AlphaDecay={0.005}
                  d3VelocityDecay={0.15}
                  cooldownTicks={300}
                  warmupTicks={100}
                  minZoom={0.5}
                  maxZoom={3}
                  enableNodeDrag={true}
                  nodeRelSize={10}
                  nodeCanvasObject={(node: any, ctx, globalScale) => {
                    // Guard against undefined positions during initialization
                    if (node.x === undefined || node.y === undefined || !isFinite(node.x) || !isFinite(node.y)) {
                      return;
                    }

                    const label = node.name;
                    const nodeSize = 16;
                    const fontSize = Math.max(10, 12 / globalScale);

                    // Animated pulse effect (using time)
                    const time = Date.now() / 1000;
                    const pulse = Math.sin(time * 2 + node.x) * 0.15 + 1;

                    // Outer glow ring - animated
                    const gradient1 = ctx.createRadialGradient(
                      node.x, node.y, 0,
                      node.x, node.y, nodeSize * 1.8 * pulse
                    );
                    gradient1.addColorStop(0, 'rgba(6, 182, 212, 0.4)');
                    gradient1.addColorStop(0.5, 'rgba(99, 102, 241, 0.2)');
                    gradient1.addColorStop(1, 'transparent');

                    ctx.beginPath();
                    ctx.arc(node.x, node.y, nodeSize * 1.8 * pulse, 0, 2 * Math.PI);
                    ctx.fillStyle = gradient1;
                    ctx.fill();

                    // Middle glow
                    const gradient2 = ctx.createRadialGradient(
                      node.x, node.y, 0,
                      node.x, node.y, nodeSize * 1.3
                    );
                    gradient2.addColorStop(0, 'rgba(34, 211, 238, 0.6)');
                    gradient2.addColorStop(1, 'rgba(99, 102, 241, 0.3)');

                    ctx.beginPath();
                    ctx.arc(node.x, node.y, nodeSize * 1.3, 0, 2 * Math.PI);
                    ctx.fillStyle = gradient2;
                    ctx.fill();

                    // Main node - gradient fill
                    const gradient3 = ctx.createRadialGradient(
                      node.x - nodeSize * 0.3, node.y - nodeSize * 0.3, 0,
                      node.x, node.y, nodeSize
                    );
                    gradient3.addColorStop(0, '#67e8f9');
                    gradient3.addColorStop(0.5, '#22d3ee');
                    gradient3.addColorStop(1, '#0891b2');

                    ctx.beginPath();
                    ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
                    ctx.fillStyle = gradient3;
                    ctx.fill();

                    // Inner highlight (3D effect)
                    const highlight = ctx.createRadialGradient(
                      node.x - nodeSize * 0.4, node.y - nodeSize * 0.4, 0,
                      node.x, node.y, nodeSize
                    );
                    highlight.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
                    highlight.addColorStop(0.3, 'rgba(255, 255, 255, 0.1)');
                    highlight.addColorStop(1, 'transparent');

                    ctx.beginPath();
                    ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
                    ctx.fillStyle = highlight;
                    ctx.fill();

                    // Border ring
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.lineWidth = 2 / globalScale;
                    ctx.stroke();

                    // Drug label with background pill
                    ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
                    const textWidth = ctx.measureText(label).width;
                    const labelY = node.y + nodeSize + 14;
                    const pillPadding = 8;
                    const pillHeight = fontSize + 8;

                    // Label background pill
                    ctx.beginPath();
                    const pillRadius = pillHeight / 2;
                    ctx.roundRect(
                      node.x - textWidth / 2 - pillPadding,
                      labelY - pillHeight / 2,
                      textWidth + pillPadding * 2,
                      pillHeight,
                      pillRadius
                    );
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    // Label text
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#e0f2fe';
                    ctx.fillText(label, node.x, labelY);
                  }}
                  nodePointerAreaPaint={(node: any, color, ctx) => {
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 25, 0, 2 * Math.PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                  }}
                  linkCanvasObject={(link: any, ctx, globalScale) => {
                    const start = link.source;
                    const end = link.target;

                    if (!start.x || !end.x || !isFinite(start.x) || !isFinite(end.x)) return;
                    if (!start.y || !end.y || !isFinite(start.y) || !isFinite(end.y)) return;

                    // Get severity color
                    const severityColors: Record<string, { main: string; glow: string }> = {
                      major: { main: '#ef4444', glow: 'rgba(239, 68, 68, 0.3)' },
                      moderate: { main: '#f59e0b', glow: 'rgba(245, 158, 11, 0.3)' },
                      minor: { main: '#22c55e', glow: 'rgba(34, 197, 94, 0.3)' },
                    };
                    const colors = severityColors[link.severity] || severityColors.moderate;

                    // Calculate distance and angle
                    const dx = end.x - start.x;
                    const dy = end.y - start.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // Guard against zero distance
                    if (distance < 1) return;

                    // Animated time
                    const time = Date.now() / 800;

                    // Draw wavy curved line using bezier
                    const numWaves = Math.max(2, Math.floor(distance / 40));
                    const waveAmplitude = Math.min(20, distance * 0.15);

                    // Perpendicular direction for wave offset
                    const perpX = -dy / distance;
                    const perpY = dx / distance;

                    // Draw glow path
                    ctx.beginPath();
                    ctx.moveTo(start.x, start.y);

                    for (let i = 1; i <= 20; i++) {
                      const t = i / 20;
                      const x = start.x + dx * t;
                      const y = start.y + dy * t;

                      // Sine wave offset with animation
                      const waveOffset = Math.sin(t * Math.PI * numWaves + time) * waveAmplitude;
                      const offsetX = x + perpX * waveOffset;
                      const offsetY = y + perpY * waveOffset;

                      ctx.lineTo(offsetX, offsetY);
                    }

                    ctx.strokeStyle = colors.glow;
                    ctx.lineWidth = 8;
                    ctx.lineCap = 'round';
                    ctx.stroke();

                    // Draw main wavy line
                    ctx.beginPath();
                    ctx.moveTo(start.x, start.y);

                    for (let i = 1; i <= 20; i++) {
                      const t = i / 20;
                      const x = start.x + dx * t;
                      const y = start.y + dy * t;

                      const waveOffset = Math.sin(t * Math.PI * numWaves + time) * waveAmplitude;
                      const offsetX = x + perpX * waveOffset;
                      const offsetY = y + perpY * waveOffset;

                      ctx.lineTo(offsetX, offsetY);
                    }

                    ctx.strokeStyle = colors.main;
                    ctx.lineWidth = 3;
                    ctx.lineCap = 'round';
                    ctx.stroke();

                    // Center indicator dot
                    const midX = (start.x + end.x) / 2;
                    const midY = (start.y + end.y) / 2;
                    const midWaveOffset = Math.sin(0.5 * Math.PI * numWaves + time) * waveAmplitude;

                    ctx.beginPath();
                    ctx.arc(midX + perpX * midWaveOffset, midY + perpY * midWaveOffset, 5, 0, 2 * Math.PI);
                    ctx.fillStyle = colors.main;
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                  }}
                  linkDirectionalParticles={4}
                  linkDirectionalParticleWidth={4}
                  linkDirectionalParticleSpeed={0.005}
                  linkDirectionalParticleColor={(link: any) => {
                    const colors: Record<string, string> = {
                      major: '#fca5a5',
                      moderate: '#fcd34d',
                      minor: '#86efac',
                    };
                    return colors[link.severity] || colors.moderate;
                  }}
                  onLinkClick={(link: any) => {
                    setSelectedInteraction({
                      drug1: link.source.id,
                      drug2: link.target.id,
                      severity: link.severity,
                      description: link.description,
                      recommendation: link.recommendation,
                    });
                  }}
                  onNodeClick={(node: any) => {
                    // Find first interaction involving this drug
                    const interaction = interactions.find(
                      i => i.drug1.toLowerCase() === node.id || i.drug2.toLowerCase() === node.id
                    );
                    if (interaction) setSelectedInteraction(interaction);
                  }}
                  backgroundColor="transparent"
                />

                {/* Legend */}
                <div className="absolute bottom-3 left-3 flex gap-3 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-xs text-slate-300">Major</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-xs text-slate-300">Moderate</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-xs text-slate-300">Minor</span>
                  </div>
                </div>
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
              <DrugList
                drugs={drugs}
                onRemove={removeDrug}
                onSave={async (drug) => {
                  await saveDrug(drug);
                }}
              />
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
