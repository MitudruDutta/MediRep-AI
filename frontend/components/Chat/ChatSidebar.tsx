"use client";

import { useSessions } from "@/hooks/useSessions";
import { Plus, Clock, ChevronLeft, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ChatSidebarProps {
    currentSessionId: string | null;
    onSelectSession: (id: string) => void;
    onNewChat: () => void;
    isOpen: boolean;
    onToggle: () => void;
}

export function ChatSidebar({
    currentSessionId,
    onSelectSession,
    onNewChat,
    isOpen,
    onToggle
}: ChatSidebarProps) {
    // SWR-powered session fetching with automatic caching
    const { sessions, isLoading } = useSessions(50);

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden"
                    onClick={onToggle}
                />
            )}

            {/* Sidebar Container */}
            <div
                className={cn(
                    "fixed inset-y-0 left-0 z-30 w-72 bg-card/95 backdrop-blur-xl border-r border-border/40 transform transition-transform duration-300 ease-in-out flex flex-col h-full overflow-hidden",
                    isOpen ? "translate-x-0" : "-translate-x-full",
                    "md:translate-x-0 md:relative md:w-72",
                    !isOpen && "md:w-0 md:border-none"
                )}
            >
                <div className="p-4 border-b border-border/40 flex items-center justify-between">
                    <h2 className="font-semibold text-lg tracking-tight flex items-center gap-2">
                        <History className="w-5 h-5 text-primary" />
                        History
                    </h2>
                    <Button variant="ghost" size="icon" onClick={onToggle} className="md:hidden">
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                </div>

                {/* New Chat Button */}
                <div className="p-4 pb-2">
                    <Button
                        onClick={() => {
                            onNewChat();
                            if (window.innerWidth < 768) onToggle();
                        }}
                        className="w-full justify-start gap-2 h-11 shadow-sm bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 border"
                        variant="ghost"
                    >
                        <Plus className="w-5 h-5" />
                        New Chat
                    </Button>
                </div>

                {/* Sessions List */}
                <div className="flex-1 overflow-y-auto p-4 pt-2 space-y-1 scrollbar-thin scrollbar-thumb-muted">
                    {isLoading && sessions.length === 0 ? (
                        <div className="flex flex-col gap-2 mt-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-10 w-full bg-muted/40 animate-pulse rounded-md" />
                            ))}
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8 text-sm">
                            No history found
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <button
                                key={session.id}
                                onClick={() => {
                                    onSelectSession(session.id);
                                    if (window.innerWidth < 768) onToggle();
                                }}
                                className={cn(
                                    "w-full text-left px-3 py-3 rounded-md transition-all duration-200 text-sm flex flex-col gap-1 group",
                                    currentSessionId === session.id
                                        ? "bg-primary/10 text-primary font-medium border border-primary/10"
                                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <span className="truncate w-full block pr-2">
                                    {session.title || "New Chat"}
                                </span>
                                <div className="flex items-center gap-2 text-xs opacity-60">
                                    <Clock className="w-3 h-3" />
                                    {new Date(session.last_message_at).toLocaleDateString()}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
