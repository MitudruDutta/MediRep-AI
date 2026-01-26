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
import { ChatSidebar } from "@/components/Chat/ChatSidebar";
import { PromptInputBox } from "@/components/ai-prompt-box";
import { MessageSquare, PanelLeftOpen, PanelLeftClose, Globe, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ChatPage() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [webSearchMode, setWebSearchMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, suggestions, webSources, send, resetSession, loadSession, sessionId } = useChat();
  const { patientContext } = usePatientContext();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Responsive sidebar check
  useEffect(() => {
    const checkSize = () => {
      if (window.innerWidth < 768) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Updated to receive isSearchMode from PromptInputBox
  const handleSend = async (message: string, files?: File[], isSearchMode?: boolean) => {
    if (!message.trim() && (!files || files.length === 0)) return;
    // Use the search mode from PromptInputBox (passed via callback)
    await send(message, patientContext || undefined, isSearchMode || false);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="h-[calc(100vh-4rem)] w-full flex bg-linear-to-br from-background via-background to-muted/20 overflow-hidden">

      {/* Sidebar */}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentSessionId={sessionId}
        onSelectSession={loadSession}
        onNewChat={resetSession}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0 transition-all duration-300">

        {/* Header */}
        <div className="border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
          <div className="px-6 py-4 flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </Button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">AI Medical Assistant</h1>
                <p className="text-sm text-muted-foreground hidden md:block">
                  {webSearchMode ? "🌐 Web Search Mode Active" : "Ask about medications, interactions, and side effects"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 overflow-hidden relative">
          <div className="h-full flex flex-col max-w-5xl mx-auto px-4 py-6">

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

              {/* Web Sources Display */}
              {webSources.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Globe className="w-4 h-4" /> Web Sources
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {webSources.map((source, i) => (
                      <a
                        key={i}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs bg-background px-2 py-1 rounded-md border hover:border-primary transition-colors"
                      >
                        <span className="truncate max-w-[150px]">{source.source}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

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
                onSearchModeChange={setWebSearchMode}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


