"use client";

import { useState, useEffect, useCallback } from "react";
import { useChat } from "@/hooks/useChat";
import { useProfile } from "@/hooks/useProfile";
import { usePatientContext } from "@/lib/context/PatientContext";
import { useSearchParams } from "next/navigation";
import {
  ChatMessages,
  ChatMessage,
  ChatSuggestions,
  ChatLoading,
} from "@/components/Chat";
import { ChatSidebar } from "@/components/Chat/ChatSidebar";
import { RepModeBadge } from "@/components/Chat/RepModeBadge";
import { PromptInputBox } from "@/components/ai-prompt-box";
import { VoiceCallOverlay } from "@/components/Voice/VoiceCallOverlay";
import { Bot, PanelLeftOpen, PanelLeftClose, Globe, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  { label: "Drug interactions", prompt: "Check interactions between Aspirin and Warfarin" },
  { label: "Side effects", prompt: "What are the common side effects of Metformin?" },
  { label: "Dosage info", prompt: "What is the standard dosage for Amoxicillin?" },
  { label: "Identify pill", prompt: "Help me identify a pill based on its physical appearance" },
];

export default function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [webSearchMode, setWebSearchMode] = useState(false);
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);

  const {
    messages,
    isGenerating,
    isLoadingHistory,
    suggestions,
    webSources,
    send,
    stop,
    resetSession,
    loadSession,
    sessionId,
    isNewMessage,
    activeRepMode
  } = useChat();

  const { profile } = useProfile();
  const { patientContext } = usePatientContext();
  const searchParams = useSearchParams();

  const userName = profile?.full_name || profile?.email?.split('@')[0] || "there";

  useEffect(() => {
    const sessionParam = searchParams.get("session");
    if (sessionParam && sessionParam !== sessionId) {
      loadSession(sessionParam);
    }
  }, [searchParams, loadSession, sessionId]);

  useEffect(() => {
    const checkSize = () => setIsSidebarOpen(window.innerWidth >= 768);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const handleSend = async (message: string, files?: File[], isSearchMode?: boolean) => {
    if (!message.trim() && (!files || files.length === 0)) return;
    await send(message, patientContext || undefined, isSearchMode || false, files);
  };

  const handleVoiceTurn = useCallback(async (transcript: string): Promise<string | null> => {
    const response = await send(transcript, patientContext || undefined, webSearchMode, undefined, true);
    const assistant = (response?.response || "").trim();
    return assistant || null;
  }, [patientContext, send, webSearchMode]);

  const showEmptyState = messages.length === 0 && !isGenerating && !isLoadingHistory;

  return (
    <div className="h-dvh w-full flex bg-(--landing-paper) overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentSessionId={sessionId}
        onSelectSession={loadSession}
        onNewChat={resetSession}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0 min-h-0">
        {/* Header */}
        <header className="shrink-0 h-14 border-b border-(--landing-border) bg-(--landing-card-strong) flex items-center px-4 gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="h-8 w-8 text-(--landing-muted) hover:text-(--landing-ink)"
          >
            {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-(--landing-moss) flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm text-(--landing-ink)">MediRep AI</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {activeRepMode && (
              <RepModeBadge
                repMode={activeRepMode}
                onExit={() => handleSend("exit rep mode")}
              />
            )}
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-zinc-950 min-h-0">
          {/* Loading History */}
          {isLoadingHistory && (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2 text-(--landing-muted)">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading conversation...</span>
              </div>
            </div>
          )}

          {/* Empty State */}
          {showEmptyState && (
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
              <div className="max-w-xl w-full space-y-8">
                {/* Welcome */}
                <div className="text-center space-y-3">
                  <div className="h-14 w-14 rounded-2xl bg-(--landing-moss) flex items-center justify-center mx-auto shadow-lg">
                    <Sparkles className="h-7 w-7 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-(--landing-ink)">
                    Hi {userName}!
                  </h1>
                  <p className="text-(--landing-muted) text-sm max-w-sm mx-auto">
                    Ask me about medications, drug interactions, dosages, or help identifying pills.
                  </p>
                </div>

                {/* Input */}
                <PromptInputBox
                  onSend={handleSend}
                  onStop={stop}
                  isLoading={isGenerating}
                  placeholder="Ask about medications..."
                  onSearchModeChange={setWebSearchMode}
                  onVoiceCall={() => setIsVoiceCallOpen(true)}
                />

                {/* Suggestions */}
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(s.prompt)}
                      className="px-3 py-2 text-sm rounded-xl border border-(--landing-border) text-(--landing-muted) hover:text-(--landing-ink) hover:border-(--landing-border-strong) hover:bg-(--landing-card) transition-all"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {!showEmptyState && !isLoadingHistory && (
            <>
              <ChatMessages className="flex-1 min-h-0">
                {messages.map((message, index) => (
                  <ChatMessage
                    key={index}
                    message={message}
                    index={index}
                    isNewMessage={isNewMessage(index)}
                  />
                ))}

                {isGenerating && <ChatLoading />}

                {/* Web Sources */}
                {webSources.length > 0 && (
                  <div className="px-4 py-3">
                    <div className="flex gap-3 max-w-[95%] md:max-w-[85%]">
                      <div className="w-8" /> {/* Spacer for alignment */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Globe className="w-3.5 h-3.5 text-(--landing-muted)" />
                          <span className="text-xs font-medium text-(--landing-muted) uppercase tracking-wide">Sources</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {webSources.map((source, i) => (
                            <a
                              key={i}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-400 transition-colors border border-zinc-200 dark:border-zinc-700"
                            >
                              <span className="truncate max-w-35">{source.source}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </ChatMessages>

              {/* Input Area */}
              <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                <div className="max-w-3xl mx-auto space-y-3">
                  {suggestions.length > 0 && (
                    <ChatSuggestions
                      suggestions={suggestions}
                      onSelect={(suggestion) => handleSend(suggestion)}
                    />
                  )}

                  <PromptInputBox
                    onSend={handleSend}
                    onStop={stop}
                    isLoading={isGenerating}
                    placeholder="Message MediRep AI..."
                    onSearchModeChange={setWebSearchMode}
                    onVoiceCall={() => setIsVoiceCallOpen(true)}
                  />

                  <p className="text-[11px] text-center text-zinc-400">
                    MediRep AI can make mistakes. Always verify medical information.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Voice Call Overlay */}
      <VoiceCallOverlay
        isOpen={isVoiceCallOpen}
        onClose={() => setIsVoiceCallOpen(false)}
        onVoiceTurn={handleVoiceTurn}
      />
    </div>
  );
}
