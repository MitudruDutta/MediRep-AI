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

export default function ChatWidget() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { messages, isLoading, suggestions, send } = useChat();
  const { patientContext } = usePatientContext();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (message: string, files?: File[]) => {
    if (!message.trim() && (!files || files.length === 0)) return;
    
    await send(message, patientContext || undefined);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-linear-to-br from-background to-muted/20 rounded-2xl border border-border/50 shadow-lg overflow-hidden">
      <div className="flex flex-col h-full p-6">
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
  );
}
