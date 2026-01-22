"use client";

import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import PillMatchCard from "./pill-match-card";

interface DrugMatch {
  name: string;
  genericName?: string;
  manufacturer?: string;
  price?: string;
  matchScore: number;
  matchReason: string;
  description?: string;
}

interface PillResultsPanelProps {
  matches: DrugMatch[];
  confidence: number;
  onReset: () => void;
}

export default function PillResultsPanel({
  matches,
  confidence,
  onReset,
}: PillResultsPanelProps) {
  const hasMatches = matches.length > 0;
  const bestMatch = matches[0];

  return (
    <div className="space-y-4">
      {/* Status Alert */}
      <Alert
        className={
          confidence >= 0.8
            ? "border-green-500/50 bg-green-500/10"
            : confidence >= 0.5
            ? "border-yellow-500/50 bg-yellow-500/10"
            : "border-orange-500/50 bg-orange-500/10"
        }
      >
        <div className="flex items-start gap-3">
          {confidence >= 0.8 ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
          ) : confidence >= 0.5 ? (
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          ) : (
            <XCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
          )}
          <AlertDescription className="flex-1">
            {hasMatches ? (
              <div>
                <p className="font-semibold mb-1">
                  {confidence >= 0.8
                    ? "High Confidence Match"
                    : confidence >= 0.5
                    ? "Possible Match Found"
                    : "Low Confidence Match"}
                </p>
                <p className="text-sm">
                  Found {matches.length} possible match{matches.length > 1 ? "es" : ""} in
                  the database. Review all matches and verify with a pharmacist.
                </p>
              </div>
            ) : (
              <div>
                <p className="font-semibold mb-1">No Matches Found</p>
                <p className="text-sm">
                  Could not identify this pill in the database. Please consult a
                  pharmacist or try searching manually on 1mg.com or pharmeasy.in.
                </p>
              </div>
            )}
          </AlertDescription>
        </div>
      </Alert>

      {/* Best Match Highlight */}
      {hasMatches && bestMatch && (
        <Card className="p-4 border-primary/50 bg-primary/5">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            BEST MATCH
          </h3>
          <PillMatchCard match={bestMatch} rank={1} />
        </Card>
      )}

      {/* Other Matches */}
      {matches.length > 1 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            OTHER POSSIBLE MATCHES
          </h3>
          {matches.slice(1).map((match, index) => (
            <PillMatchCard key={index} match={match} rank={index + 2} />
          ))}
        </div>
      )}

      {/* Safety Warning */}
      <Alert className="border-red-500/50 bg-red-500/10">
        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        <AlertDescription className="text-sm">
          <p className="font-semibold mb-1">⚠️ IMPORTANT SAFETY NOTICE</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>This is visual matching only - NOT a medical diagnosis</li>
            <li>Many pills look similar but contain different medications</li>
            <li>ALWAYS verify with a licensed pharmacist before use</li>
            <li>Never take medication based solely on visual identification</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button onClick={onReset} variant="outline" className="flex-1">
          <RotateCcw className="h-4 w-4 mr-2" />
          Scan Another Pill
        </Button>
      </div>
    </div>
  );
}
