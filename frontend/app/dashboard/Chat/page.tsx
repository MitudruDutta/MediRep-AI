"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";

import { useProfile } from "@/hooks/useProfile";
import { usePatientContext } from "@/lib/context/PatientContext";
import { useSearchParams } from "next/navigation";
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
import { motion, AnimatePresence } from "framer-motion";

const ALL_SUGGESTIONS = [
  { label: "Check interactions", prompt: "Check interactions between Aspirin and Warfarin" },
  { label: "Summarize patient", prompt: "Summarize the current patient's medical history" },
  { label: "Side effects", prompt: "What are the common side effects of Metformin?" },
  { label: "Identify pill", prompt: "Help me identify a pill based on its physical appearance" },
  { label: "Dosage info", prompt: "What is the standard dosage for Amoxicillin?" },
  { label: "Contraindications", prompt: "List contraindications for Ibuprofen" },
  { label: "Mechanism of action", prompt: "Explain how Lisinopril works" },
  { label: "Latest alerts", prompt: "Show recent FDA alerts for cardiac medications" },
];

export default function ChatPage() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [webSearchMode, setWebSearchMode] = useState(false);
  const [randomSuggestions, setRandomSuggestions] = useState<typeof ALL_SUGGESTIONS>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Randomize suggestions on mount to provide "AI-like" variety
    const shuffled = [...ALL_SUGGESTIONS].sort(() => 0.5 - Math.random());
    setRandomSuggestions(shuffled.slice(0, 4));
  }, []);

  const { messages, isLoading, suggestions, webSources, send, resetSession, loadSession, sessionId } = useChat();

  const { profile, loading: profileLoading } = useProfile();
  const { patientContext } = usePatientContext();
  const searchParams = useSearchParams();

  // Define variables for visual display
  const initialUserName = profile?.full_name;
  const initialUserEmail = profile?.email || "User";

  // Load session from URL if present (for sharing)
  useEffect(() => {
    const sessionParam = searchParams.get("session");
    if (sessionParam && sessionParam !== sessionId) {
      loadSession(sessionParam);
    }
  }, [searchParams, loadSession, sessionId]);

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
    await send(message, patientContext || undefined, isSearchMode || false, files);
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

            {/* Messages Area & Input */}
            {messages.length === 0 && !isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500">
                <div className="text-center space-y-2">
                  <h1 className="text-4xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                    Hi there, {initialUserName || initialUserEmail}
                  </h1>
                  <h2 className="text-2xl text-muted-foreground">
                    Where should we start?
                  </h2>
                </div>

                <div className="w-full max-w-2xl px-4">
                  <PromptInputBox
                    onSend={handleSend}
                    isLoading={isLoading}
                    placeholder="Ask about medications, interactions, or side effects..."
                    onSearchModeChange={setWebSearchMode}
                    className="shadow-xl border-primary/10"
                  />
                </div>

                <div className="flex flex-wrap justify-center gap-3 px-4 max-w-3xl">
                  {randomSuggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(suggestion.prompt)}
                      className="px-4 py-2 rounded-full bg-muted/50 hover:bg-muted border border-border/50 text-sm text-muted-foreground hover:text-foreground transition-all duration-200"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <ChatMessages className="flex-1 overflow-y-auto px-2 space-y-4 mb-6 scrollbar-hide">
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
              </>
            )}
          </div>
        </div>
      </div>
    </div >
  );
}


