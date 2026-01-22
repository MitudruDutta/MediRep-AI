"use client";

import * as React from "react";
import { AlertTriangle, AlertCircle, Info, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DrugInteraction } from "@/types";
import { motion } from "framer-motion";

const severityConfig = {
  major: {
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/50",
    icon: AlertTriangle,
  },
  moderate: {
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/50",
    icon: AlertCircle,
  },
  minor: {
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/50",
    icon: Info,
  },
};

export interface InteractionListProps {
  interactions: DrugInteraction[];
  onSelect: (interaction: DrugInteraction) => void;
  selectedInteraction?: DrugInteraction | null;
  className?: string;
}

export function InteractionList({ interactions, onSelect, selectedInteraction, className }: InteractionListProps) {
  if (interactions.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8 text-center", className)}>
        <div className="rounded-full bg-green-500/10 p-4 mb-3">
          <Info className="h-6 w-6 text-green-500" />
        </div>
        <p className="text-sm font-medium">No interactions found</p>
        <p className="text-xs text-muted-foreground mt-1">These drugs appear safe to use together</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {interactions.map((interaction, index) => {
        const config = severityConfig[interaction.severity];
        const Icon = config.icon;
        const isSelected = selectedInteraction?.drug1 === interaction.drug1 && 
                          selectedInteraction?.drug2 === interaction.drug2;

        return (
          <motion.div
            key={`${interaction.drug1}-${interaction.drug2}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              "p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md",
              config.borderColor,
              config.bgColor,
              isSelected && "ring-2 ring-primary"
            )}
            onClick={() => onSelect(interaction)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <Icon className={cn("h-4 w-4 shrink-0", config.color)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {interaction.drug1} + {interaction.drug2}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {interaction.description.substring(0, 60)}...
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={cn("text-xs", config.color, config.borderColor)}>
                  {interaction.severity}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
