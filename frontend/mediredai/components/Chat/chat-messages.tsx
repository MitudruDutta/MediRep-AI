import * as React from "react"
import { cn } from "@/lib/utils"

export interface ChatMessagesProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function ChatMessages({ children, className, ...props }: ChatMessagesProps) {
  return (
    <div 
      className={cn("flex-1 overflow-y-auto space-y-4 mb-4", className)} 
      {...props}
    >
      {children}
    </div>
  )
}
