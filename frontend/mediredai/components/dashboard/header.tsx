"use client";

import { SidebarTrigger } from '@/components/ui/sidebar';
import { ModeToggle } from '@/components/mode-toggle';
import { Pill } from 'lucide-react';

interface AppHeaderProps {
  userEmail?: string | null;
}

export default function AppHeader({ userEmail }: AppHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b px-4 bg-card shadow-sm">
      <SidebarTrigger />
      <div className="flex items-center gap-2">
        
      </div>
      <div className="ml-auto flex items-center gap-4">
        {userEmail && (
          <div className="hidden md:block text-right">
            <p className="text-xs text-muted-foreground">Dashboard</p>
          </div>
        )}
        <ModeToggle />
      </div>
    </header>
  );
}