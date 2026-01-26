import { useState, useEffect } from "react";
import { Message, PatientContext, WebSearchResult } from "@/types";
import { sendMessage, getSessionMessages } from "@/lib/api";
import { invalidateSessionsCache } from "@/hooks/useSessions";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [webSources, setWebSources] = useState<WebSearchResult[]>([]);

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
      setIsLoading(true);
      const history = await getSessionMessages(id);
      setMessages(history);
    } catch (e) {
      console.error("Failed to load history:", e);
      // If session invalid, clear it
      sessionStorage.removeItem("current_chat_session_id");
      setSessionId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const send = async (content: string, patientContext?: PatientContext, webSearchMode: boolean = false) => {
    setIsLoading(true);
    setWebSources([]); // Clear previous web sources

    // Add user message locally
    const userMessage: Message = {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      // Send to backend with web search mode
      const response = await sendMessage(content, patientContext, undefined, sessionId || undefined, webSearchMode);

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
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

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
    sessionStorage.removeItem("current_chat_session_id");
  };

  return { messages, isLoading, suggestions, webSources, send, resetSession, loadSession, sessionId };
}
