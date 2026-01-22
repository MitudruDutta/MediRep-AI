"use client";

import * as React from "react";
import { Search, AlertTriangle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AlertSearchInputProps {
  onSearch: (drugName: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function AlertSearchInput({ onSearch, isLoading, className }: AlertSearchInputProps) {
  const [value, setValue] = React.useState("");

  const handleSearch = () => {
    if (value.trim()) {
      onSearch(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && value.trim()) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search for drug alerts (e.g., Aspirin, Metformin)"
          className="pl-10"
          disabled={isLoading}
        />
      </div>
      <Button onClick={handleSearch} disabled={!value.trim() || isLoading}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <AlertTriangle className="h-4 w-4 mr-2" />
        )}
        Check Alerts
      </Button>
    </div>
  );
}
