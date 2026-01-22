import * as React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Check, Bot, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Message } from "@/types"

export interface ChatMessageProps {
  message: Message
  index: number
  copiedIndex: number | null
  onCopy: (text: string, index: number) => void
}

export function ChatMessage({ message, index, copiedIndex, onCopy }: ChatMessageProps) {
  const isUser = message.role === "user"
  
  return (
    <div className={cn("flex gap-3 group", isUser ? "justify-end" : "justify-start")}>
      {/* Avatar - only for assistant */}
      {!isUser && (
        <div className="shrink-0 mt-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <Bot className="h-4 w-4 text-primary" />
          </div>
        </div>
      )}

      {/* Message Content */}
      <div className={cn("flex flex-col gap-2 max-w-[75%]", isUser && "items-end")}>
        <Card
          className={cn(
            "p-4 shadow-sm transition-all",
            isUser
              ? "bg-primary text-primary-foreground border-primary/20"
              : "bg-card border-border/50 hover:border-border"
          )}
        >
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 space-y-2">
              <p className={cn(
                "text-sm leading-relaxed whitespace-pre-wrap",
                isUser ? "text-primary-foreground" : "text-foreground"
              )}>
                {message.content}
              </p>
            </div>
            
            {!isUser && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onCopy(message.content, index)}
              >
                {copiedIndex === index ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
          
          {message.citations && message.citations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/30">
              <p className="text-xs font-medium text-muted-foreground mb-2">Sources:</p>
              <div className="space-y-1">
                {message.citations.map((citation, idx) => (
                  <a
                    key={idx}
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline transition-colors"
                  >
                    <span className="text-muted-foreground">•</span>
                    {citation.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </Card>
        
        {/* Timestamp could go here if needed */}
      </div>

      {/* Avatar - only for user */}
      {isUser && (
        <div className="shrink-0 mt-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
            <User className="h-4 w-4 text-primary" />
          </div>
        </div>
      )}
    </div>
  )
}
