"use client";

import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Pill } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pill className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">MediRep AI</h1>
          </div>
          <ModeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-6 px-4">
          <Pill className="h-24 w-24 mx-auto text-primary" />
          <h2 className="text-4xl font-bold">Welcome to MediRep AI</h2>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Your AI-powered medical representative assistant for drug information, 
            interactions, and safety alerts
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/dashboard">
              <Button size="lg">
                Go to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built with ❤️ for better healthcare information access</p>
        </div>
      </footer>
    </div>
  );
}


