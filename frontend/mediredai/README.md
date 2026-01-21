# MediRedAI Frontend 💊

Modern, responsive frontend for MediRedAI - your AI-powered digital medical representative built with Next.js 16, React 19, and TypeScript.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI
- **Authentication**: Supabase Auth
- **State Management**: React Context + Hooks
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Graph Visualization**: React Force Graph 2D
- **PDF Export**: jsPDF
- **Icons**: Lucide React

## Features

- 🔐 **Authentication**: Secure login/signup with Supabase Auth
- 💬 **AI Chat**: Natural language medical Q&A with context awareness
- 💊 **Drug Search**: Search and explore 100,000+ drugs
- ⚠️ **Interaction Checker**: Visualize drug-drug interactions with force graphs
- 📸 **Pill Scanner**: Identify pills using camera/image upload
- 🚨 **Safety Alerts**: Real-time FDA recalls and warnings
- 👤 **User Profile**: Manage account settings and saved medications
- 📊 **Dashboard**: Unified interface with widget-based layout
- 📱 **Responsive**: Mobile-first design that works on all devices
- 🎨 **Modern UI**: Beautiful components with Radix UI and Tailwind

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend API running on `http://localhost:8000`
- Supabase project with authentication enabled

### Installation

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.local.example .env.local
# Edit .env.local with your credentials
```

### Environment Variables

Create a `.env.local` file with the following:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_your_key

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Site URL for OAuth redirects
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> **Note**: Use the new `sb_publishable_` key format from your [Supabase Dashboard](https://supabase.com/dashboard/project/_/settings/api).

### Development

```bash
# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Build

```bash
# Create production build
npm run build

# Start production server
npm start
```

### Linting

```bash
npm run lint
```

## Project Structure

```
frontend/mediredai/
├── app/                      # Next.js App Router
│   ├── auth/                 # Authentication pages
│   │   ├── login/           # Login page
│   │   ├── signup/          # Signup page
│   │   ├── callback/        # OAuth callback
│   │   ├── confirm/         # Email confirmation
│   │   └── error/           # Auth error page
│   ├── dashboard/           # Main application
│   │   ├── Chat/            # AI chat interface
│   │   ├── PillScanner/     # Pill identification
│   │   ├── InteractionGraph/ # Drug interactions
│   │   ├── SafetyAlert/     # FDA alerts
│   │   ├── PatientContext/  # Patient info
│   │   ├── ExportSummary/   # PDF export
│   │   └── layout.tsx       # Dashboard layout
│   ├── account/             # User account settings
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Landing page
│   └── globals.css          # Global styles
├── components/              # React components
│   ├── dashboard/           # Dashboard components
│   │   ├── dashboard.tsx    # Main dashboard
│   │   └── widgets/         # Feature widgets
│   ├── account/             # Account components
│   ├── ui/                  # Radix UI components
│   └── login-form.tsx       # Login form
├── lib/                     # Utilities
│   ├── supabase/            # Supabase clients
│   │   ├── client.ts        # Browser client
│   │   ├── server.ts        # Server client
│   │   └── middleware.ts    # Auth middleware
│   ├── context/             # React contexts
│   │   └── PatientContext.tsx
│   ├── api.ts               # API client
│   └── utils.ts             # Helper functions
├── hooks/                   # Custom React hooks
│   ├── useChat.ts           # Chat functionality
│   ├── useVoice.ts          # Voice input
│   └── use-mobile.ts        # Mobile detection
├── types/                   # TypeScript types
│   └── index.ts
├── public/                  # Static assets
├── .env.local               # Environment variables
├── next.config.ts           # Next.js configuration
├── tailwind.config.ts       # Tailwind configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies
```

## Key Components

### Dashboard Widgets

- **Chat Widget**: AI-powered medical Q&A with streaming responses
- **Pill Scanner**: Camera/upload interface for pill identification
- **Interaction Graph**: Force-directed graph visualization of drug interactions
- **Safety Alert Widget**: Real-time FDA alerts and recalls
- **Patient Context**: Manage patient medications and conditions
- **Export Summary**: Generate PDF reports of patient data

### Authentication Flow

1. User signs up/logs in via Supabase Auth
2. OAuth callback handles authentication
3. Middleware protects dashboard routes
4. Session persists across page loads

### API Integration

The frontend communicates with the FastAPI backend through `lib/api.ts`:

```typescript
// Example API calls
await fetch(`${API_URL}/api/drugs/search?q=aspirin`)
await fetch(`${API_URL}/api/chat`, { method: 'POST', body: JSON.stringify({ message }) })
await fetch(`${API_URL}/api/vision/identify-pill`, { method: 'POST', body: formData })
```

## Styling

This project uses Tailwind CSS 4 with custom configuration:

- **Design System**: Consistent spacing, colors, and typography
- **Dark Mode**: Theme support via `next-themes`
- **Responsive**: Mobile-first breakpoints
- **Animations**: Smooth transitions and micro-interactions
- **Components**: Pre-built Radix UI components with Tailwind styling

## Development Tips

- Hot reload is enabled - changes appear instantly
- Use TypeScript for type safety
- Follow the existing component patterns
- Keep components small and focused
- Use custom hooks for shared logic
- Leverage Radix UI for accessible components

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Or connect your GitHub repo to [Vercel](https://vercel.com) for automatic deployments.

### Environment Variables

Remember to set all environment variables in your deployment platform:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SITE_URL`

## Troubleshooting

### Common Issues

**Authentication not working**
- Verify Supabase URL and publishable key
- Check that site URL matches your deployment URL
- Ensure email confirmation is enabled in Supabase

**API calls failing**
- Confirm backend is running on the correct port
- Check CORS settings in backend
- Verify `NEXT_PUBLIC_API_URL` is correct

**Build errors**
- Clear `.next` folder: `rm -rf .next`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npm run lint`

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Radix UI](https://www.radix-ui.com/primitives)

## License

MIT License - see the [LICENSE](../../LICENSE) file for details.
