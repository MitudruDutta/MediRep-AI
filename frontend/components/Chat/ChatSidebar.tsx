"use client";

import { useState } from "react";
import { useSessions } from "@/hooks/useSessions";
import { Plus, Clock, ChevronLeft, History, MoreVertical, Trash, Share2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

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
    const { sessions, isLoading, deleteSession, renameSession } = useSessions(50);

    // Rename state
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState("");
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);

    const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        // Removed confirm dialog as per user request
        try {
            await deleteSession(sessionId);
            toast.success("Chat deleted");
            if (currentSessionId === sessionId) {
                onNewChat();
            }
        } catch (error) {
            toast.error("Failed to delete chat");
        }
    };

    const handleShare = async (e: React.MouseEvent, sessionId: string) => {
        // e.stopPropagation(); // Removed to allow dropdown to close properly
        const url = `${window.location.origin}/dashboard/Chat?session=${sessionId}`;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(url);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = url;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            toast.success("Link copied to clipboard");
        } catch (err) {
            console.error("Share error:", err);
            toast.error("Failed to copy link");
        }
    };

    const openRenameDialog = (e: React.MouseEvent, session: { id: string, title?: string }) => {
        e.stopPropagation();
        setEditingSessionId(session.id);
        setNewTitle(session.title || "");
        setIsRenameDialogOpen(true);
    };

    const handleRenameSubmit = async () => {
        if (!editingSessionId || !newTitle.trim()) return;

        try {
            await renameSession(editingSessionId, newTitle);
            toast.success("Chat renamed");
            setIsRenameDialogOpen(false);
        } catch (error) {
            toast.error("Failed to rename chat");
        }
    };

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

                            <div
                                key={session.id}
                                className={cn(
                                    "w-full rounded-md transition-all duration-200 text-sm flex items-center group relative pr-1",
                                    currentSessionId === session.id
                                        ? "bg-primary/10 text-primary font-medium border border-primary/10"
                                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <button
                                    onClick={() => {
                                        onSelectSession(session.id);
                                        if (window.innerWidth < 768) onToggle();
                                    }}
                                    className="flex-1 text-left px-3 py-3 overflow-hidden"
                                >
                                    <span className="truncate w-full block">
                                        {session.title || "New Chat"}
                                    </span>
                                    <div className="flex items-center gap-2 text-xs opacity-60 mt-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(session.last_message_at).toLocaleDateString()}
                                    </div>
                                </button>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                                "h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 shrink-0",
                                                currentSessionId === session.id && "opacity-100"
                                            )}
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={(e) => handleShare(e, session.id)}>
                                            <Share2 className="mr-2 h-4 w-4" />
                                            Share conversation
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => openRenameDialog(e, session)}>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={(e) => handleDelete(e, session.id)}
                                        >
                                            <Trash className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        ))
                    )}
                </div>
            </div>


            <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename Chat</DialogTitle>
                        <DialogDescription>
                            Enter a new title for this conversation.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="Chat title"
                            onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleRenameSubmit}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
