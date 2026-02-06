import { useState, useEffect, useRef, useCallback } from "react";
import { Message, PatientContext, WebSearchResult } from "@/types";
import { sendMessage, getSessionMessages } from "@/lib/api";
import { invalidateSessionsCache } from "@/hooks/useSessions";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false); // AI is generating response
  const [isLoadingHistory, setIsLoadingHistory] = useState(false); // Loading past messages
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [webSources, setWebSources] = useState<WebSearchResult[]>([]);
  // Track the count of messages loaded from session (not new)
  const loadedMessageCountRef = useRef<number>(0);
  // AbortController for cancelling requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load session from storage or props on mount
  useEffect(() => {
    const storedSessionId = sessionStorage.getItem("current_chat_session_id");
    if (storedSessionId) {
      setSessionId(storedSessionId);
      loadHistory(storedSessionId);
    }
  }, []);

  const loadHistory = async (id: string) => {
    try {
      setIsLoadingHistory(true);
      const history = await getSessionMessages(id);
      setMessages(history);
      // Mark all loaded messages as "old" so they don't animate
      loadedMessageCountRef.current = history.length;
    } catch (e) {
      console.error("Failed to load history:", e);
      // If session invalid, clear it
      sessionStorage.removeItem("current_chat_session_id");
      setSessionId(null);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const send = async (content: string, patientContext?: PatientContext, webSearchMode: boolean = false, files?: File[]) => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    setIsGenerating(true);
    setWebSources([]); // Clear previous web sources

    // Convert files to base64 if present
    const images: string[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          try {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            images.push(base64);
          } catch (e) {
            console.error("Failed to convert image to base64", e);
          }
        }
      }
    }

    // Add user message locally
    const userMessage: Message = {
      role: "user",
      content: content,
      timestamp: new Date().toISOString(),
      images: images.length > 0 ? images : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      // Send to backend with web search mode and images
      const response = await sendMessage(
        content,
        patientContext,
        undefined,
        sessionId || undefined,
        webSearchMode,
        images,
        abortControllerRef.current.signal
      );

      // Handle new session
      if (!sessionId && response.session_id) {
        setSessionId(response.session_id);
        sessionStorage.setItem("current_chat_session_id", response.session_id);
      }

      // Add assistant response
      const assistantMessage: Message = {
        role: "assistant",
        content: response.response,
        citations: response.citations,
        timestamp: new Date().toISOString(),
        track2: response.track2,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (response.suggestions) {
        setSuggestions(response.suggestions);
      }

      // Store web sources if returned
      if (response.web_sources && response.web_sources.length > 0) {
        setWebSources(response.web_sources);
      }

      // Invalidate session cache so sidebar updates with new message count/timestamp
      invalidateSessionsCache();
    } catch (error: any) {
      // Don't show error if request was aborted by user
      if (error?.name === 'AbortError') {
        console.log("Request cancelled by user");
        // Add a cancelled message indicator
        const cancelledMessage: Message = {
          role: "assistant",
          content: "_Response cancelled_",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, cancelledMessage]);
      } else {
        console.error("Chat error:", error);
        const errorMessage: Message = {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Stop/cancel the current generation
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const loadSession = async (id: string) => {
    setSessionId(id);
    sessionStorage.setItem("current_chat_session_id", id);
    await loadHistory(id);
  };

  const resetSession = () => {
    setMessages([]);
    setSuggestions([]);
    setWebSources([]);
    setSessionId(null);
    loadedMessageCountRef.current = 0;
    sessionStorage.removeItem("current_chat_session_id");
  };

  // Helper to check if a message at given index is new (should animate)
  const isNewMessage = (index: number) => index >= loadedMessageCountRef.current;

  // Backwards compatibility: isLoading is true when generating (not when loading history)
  const isLoading = isGenerating;

  // Determine if Rep Mode is active based on the last assistant message
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");
  const activeRepMode = lastAssistantMessage?.track2?.rep_mode;

  return {
    messages,
    isLoading,
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
  };
}
