import { useState } from "react";
import { Message, PatientContext } from "@/types";
import { sendMessage } from "@/lib/api";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const send = async (content: string, patientContext?: PatientContext) => {
    setIsLoading(true);
    
    // Add user message
    const userMessage: Message = {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    
    // Build new messages array with user message
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    try {
      // Send with updated messages array
      const response = await sendMessage(content, patientContext, newMessages);
      
      // Add assistant message
      const assistantMessage: Message = {
        role: "assistant",
        content: response.response,
        citations: response.citations,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      
      // Update suggestions
      if (response.suggestions) {
        setSuggestions(response.suggestions);
      }
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

  const clearMessages = () => {
    setMessages([]);
    setSuggestions([]);
  };

  return { messages, isLoading, suggestions, send, clearMessages };
}
