# League of Legends Draft Tool

A data-driven team analysis tool for League of Legends coaches. Analyze team statistics, champion pools, and contested picks before drafting.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend/Auth**: Supabase
- **Routing**: React Router
- **API**: Riot Games API

## Features

### Phase 1 (Current)
- Coach authentication
- Team builder (add players via Riot ID)
- Player statistics analysis:
  - Champion mastery
  - Win rates per champion
  - Games played
  - Adjustable time ranges
- Enemy team analysis:
  - Most played champions
  - Role identification
- Contested picks visualization
- Server-wide meta statistics

### Phase 2 (Future)
- Real-time draft tool with live collaboration

## Getting Started

### Prerequisites
- Node.js 18+
- Riot Games API Key
- Supabase account

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Add your environment variables to `.env`:
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_RIOT_API_KEY=your-riot-api-key
```

5. Run the development server:
```bash
npm run dev
```

## Project Structure

```
src/
├── components/     # Reusable React components
├── pages/         # Page components (Login, Dashboard)
├── hooks/         # Custom React hooks (useAuth)
├── lib/           # Third-party integrations (Supabase)
├── types/         # TypeScript type definitions
├── utils/         # Utility functions
└── App.tsx        # Main app component with routing
```

## Environment Variables

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `VITE_RIOT_API_KEY`: Your Riot Games API key

## Development

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Riot API Integration

The app uses the Riot Games API to fetch:
- Summoner data by Riot ID
- Match history
- Champion mastery
- Player statistics

Note: Riot API has rate limits. Implement caching to avoid hitting limits.

## License

MIT
