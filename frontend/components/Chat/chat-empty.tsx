import * as React from "react"
import { cn } from "@/lib/utils"
import { MessageSquare, Sparkles, Shield, Zap } from "lucide-react"

export interface ChatEmptyProps {
  message?: string
  className?: string
}

export function ChatEmpty({ 
  message = "Start a conversation...", 
  className 
}: ChatEmptyProps) {
  const features = [
    {
      icon: MessageSquare,
      title: "Ask Questions",
      description: "Get instant answers about medications"
    },
    {
      icon: Shield,
      title: "Check Interactions",
      description: "Verify drug interactions and safety"
    },
    {
      icon: Sparkles,
      title: "AI-Powered",
      description: "Advanced medical knowledge base"
    },
    {
      icon: Zap,
      title: "Quick Responses",
      description: "Fast and accurate information"
    }
  ]

  return (
    <div className={cn("flex flex-col items-center justify-center h-full py-12", className)}>
      <div className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-8">
        {/* Icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <MessageSquare className="h-10 w-10 text-primary" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Welcome to AI Medical Assistant</h2>
          <p className="text-muted-foreground">{message}</p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-lg mt-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex flex-col items-center p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/50 transition-colors"
            >
              <feature.icon className="h-6 w-6 text-primary mb-2" />
              <h3 className="font-medium text-sm mb-1">{feature.title}</h3>
              <p className="text-xs text-muted-foreground text-center">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Suggestions */}
        <div className="text-sm text-muted-foreground">
          Try asking: <span className="text-foreground font-medium">"What are the side effects of aspirin?"</span>
        </div>
      </div>
    </div>
  )
}
