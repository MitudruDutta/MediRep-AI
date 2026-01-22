"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { usePatientContext } from "@/lib/context/PatientContext";
import {
  ChatMessages,
  ChatMessage,
  ChatSuggestions,
  ChatLoading,
  ChatEmpty
} from "@/components/Chat";
import { PromptInputBox } from "@/components/ai-prompt-box";
import { MessageSquare } from "lucide-react";

export default function ChatPage() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { messages, isLoading, suggestions, send } = useChat();
  const { patientContext } = usePatientContext();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (message: string, files?: File[]) => {
    if (!message.trim() && (!files || files.length === 0)) return;
    
    // Handle files if needed (you can extend this to send images to your backend)
    await send(message, patientContext || undefined);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="h-[calc(100vh-4rem)] w-full flex flex-col bg-linear-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">AI Medical Assistant</h1>
              <p className="text-sm text-muted-foreground">Ask about medications, interactions, and side effects</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 overflow-hidden">
        <div className="container mx-auto h-full max-w-5xl px-4 py-6">
          <div className="flex flex-col h-full">
            {/* Messages Area */}
            <ChatMessages className="flex-1 overflow-y-auto px-2 space-y-4 mb-6 scrollbar-hide">
              {messages.length === 0 && (
                <ChatEmpty message="Start a conversation about medications..." />
              )}
              
              {messages.map((message, index) => (
                <ChatMessage
                  key={index}
                  message={message}
                  index={index}
                  copiedIndex={copiedIndex}
                  onCopy={copyToClipboard}
                />
              ))}
              
              {isLoading && <ChatLoading />}
              
              <div ref={messagesEndRef} />
            </ChatMessages>

            {/* Input Area */}
            <div className="space-y-3 px-2">
              {suggestions.length > 0 && (
                <ChatSuggestions 
                  suggestions={suggestions} 
                  onSelect={(suggestion) => handleSend(suggestion)}
                />
              )}

              <PromptInputBox
                onSend={handleSend}
                isLoading={isLoading}
                placeholder="Ask about medications, interactions, or side effects..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
