# MediRedAI Frontend 💊

Modern, responsive frontend for MediRedAI - your AI-powered digital medical representative built with Next.js 16, React 19, and TypeScript.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4, Shadcn UI
- **Animations**: Framer Motion, GSAP (ScrollTrigger)
- **Authentication**: Supabase Auth
- **Icons**: Lucide React
- **Voice**: ElevenLabs Integration

## Features

- 🔐 **Authentication**: Secure login/signup with Supabase Auth (Patient & Pharmacist roles)
- 🖥️ **Landing Page v2**: High-performance, animation-rich landing page with "Clinical Speed" workflow
- 💬 **AI Chat**: Natural language medical Q&A with context awareness
- 🏛️ **Pharmacist Marketplace**: Consult verified pharmacists via chat/voice
- 💊 **Drug Search**: Search and explore 100,000+ drugs
- ⚠️ **Interaction Checker**: Visualize drug-drug interactions with force graphs
- 📸 **Pill Scanner**: Identify pills using camera/image upload
- 🚨 **Safety Alerts**: Real-time FDA recalls and warnings
- 📊 **Dashboard**: Patient and Pharmacist specific dashboards
- 🎨 **Modern UI**: "Paper & Ink" aesthetic with premium typography

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
frontend/
├── app/                      # Next.js App Router
│   ├── auth/                 # Authentication pages
│   ├── dashboard/            # Patient Dashboard
│   ├── pharmacist/           # Pharmacist Portal & Dashboard
│   ├── v2/                   # New Landing Page components
│   └── page.tsx              # Main Landing Page
├── components/               # React components
│   ├── dashboard/            # Dashboard widgets
│   ├── ui/                   # Shadcn UI & Primitive components
│   ├── v2/                   # Landing page v2 specifics
│   └── ...
├── lib/                      # Utilities
│   ├── supabase/             # Supabase clients
│   └── api.ts                # Backend API client
├── hooks/                    # Custom React hooks
│   ├── useChat.ts
│   └── useVoice.ts
└── public/                   # Static assets
```

## Key Components

### Landing Page (v2)
- **Clinical Speed**: Optimized sections showing evidence-based workflows
- **Scroll Effects**: GSAP-powered scroll animations (`ScrollFloat`, `ScrambledText`)
- **Liquid Glass**: Premium visual effects using custom shaders

### Dashboard Widgets
- **Chat Widget**: AI-powered medical Q&A with streaming responses
- **Pill Scanner**: Camera/upload interface for pill identification
- **Interaction Graph**: Force-directed graph visualization of drug interactions
- **Safety Alert Widget**: Real-time FDA alerts and recalls

## Styling

This project uses Tailwind CSS 4 with custom configuration:

- **Design System**: "Paper & Ink" theme for landing, Dashboard theme for app
- **Dark Mode**: Theme support via `next-themes`
- **Animations**: Framer Motion for UI transitions, GSAP for scroll-linked effects
- **Components**: Shadcn UI (Radix UI + Tailwind)

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
