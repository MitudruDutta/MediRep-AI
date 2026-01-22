import * as React from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Bot } from "lucide-react"

export interface ChatLoadingProps {
  className?: string
}

export function ChatLoading({ className }: ChatLoadingProps) {
  return (
    <div className={cn("flex gap-3 justify-start", className)}>
      {/* Avatar */}
      <div className="shrink-0 mt-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      </div>

      {/* Loading Card */}
      <Card className="bg-card border-border/50 p-4 shadow-sm max-w-[75%]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div 
              className="w-2 h-2 bg-primary rounded-full animate-bounce" 
              style={{ animationDelay: "0ms" }} 
            />
            <div 
              className="w-2 h-2 bg-primary rounded-full animate-bounce" 
              style={{ animationDelay: "150ms" }} 
            />
            <div 
              className="w-2 h-2 bg-primary rounded-full animate-bounce" 
              style={{ animationDelay: "300ms" }} 
            />
          </div>
          <span className="text-xs text-muted-foreground">AI is thinking...</span>
        </div>
      </Card>
    </div>
  )
}
