# APEX Fitness 💪

**Train Smarter. Get Stronger.**

APEX Fitness is a comprehensive fitness tracking and personal training platform that combines workout logging, social features, gamification, and trainer-client management into one seamless experience.

![APEX Fitness](https://via.placeholder.com/800x400/10b981/ffffff?text=APEX+Fitness)

## ✨ Features

### 🏋️ Workout Mode (User)
- **Smart Workout Logging** - Log sets, reps, and weights with automatic 1RM calculations
- **Workout Templates** - Pre-built templates (Push, Pull, Legs, Full Body, etc.) or create your own
- **Rest Timer** - Automatic rest timer between sets with customizable duration
- **Personal Bests** - Automatic PB detection with trophy indicators
- **Exercise Library** - 100+ exercises with muscle group targeting
- **Workout History** - Complete history with detailed summaries

### 🎓 Trainer Mode
- **Client Management** - Add, manage, and track client progress
- **Workout Assignment** - Create and assign workouts to clients
- **Calendar Scheduling** - Schedule sessions, consultations, and assessments
- **Client Onboarding** - Digital onboarding forms for goals, injuries, preferences
- **Progress Tracking** - Monitor client workout completion and progress
- **Verification Badge** - Verified trainer status for credibility

### 📊 Strength Rating System
- **Overall Score** - Aggregated strength rating based on key lifts
- **Push/Pull/Legs/Core** - Breakdown by movement pattern
- **Tier System** - Beginner → Novice → Intermediate → Advanced → Elite
- **Body Visualization** - Visual muscle group heatmap

### 🏆 Medals & Achievements
- **First Workout** - Complete your first workout
- **Week Streak** - Workout for 7 days straight
- **Personal Best** - Set a new personal record
- **Strength Tier Up** - Move up a strength tier
- **And many more...**

### 👥 Social Features
- **Feed** - Share workouts, achievements, and posts
- **Follow System** - Follow friends and trainers
- **Likes & Comments** - Engage with the community
- **Trainer Discovery** - Find and connect with personal trainers

### 📈 Weekly Reports
- **Volume Breakdown** - Total volume by muscle group
- **Consistency Score** - Track workout frequency
- **PB Highlights** - New personal bests achieved
- **Progress Comparison** - Week-over-week changes

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/apex-fitness.git

# Navigate to project directory
cd apex-fitness

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui
- **State Management**: Zustand
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Date Handling**: date-fns

## 📱 App Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── auth/              # Authentication
│   ├── workout/           # Workout logging & history
│   ├── feed/              # Social feed
│   ├── friends/           # Friends & following
│   ├── trainer/           # MyTrainer dashboard (client view)
│   ├── clients/           # Client management (trainer view)
│   ├── calendar/          # Calendar & scheduling
│   ├── profile/           # User profile & stats
│   ├── settings/          # App settings
│   ├── reports/           # Weekly reports
│   └── notifications/     # Notifications
├── components/            # Reusable components
│   ├── ui/               # shadcn/ui components
│   └── layout/           # Layout components
├── lib/                   # Utilities & stores
│   ├── store.ts          # Zustand state management
│   ├── exercises.ts      # Exercise library
│   ├── templates.ts      # Workout templates
│   └── utils.ts          # Utility functions
└── types/                 # TypeScript type definitions
```

## 🎨 Theme

The app features two distinct color themes:
- **User Mode**: Emerald/Green theme
- **Trainer Mode**: Rose/Red theme

Dark mode by default for optimal gym viewing.

## 📋 Key Features Breakdown

### Workout Logging
- Add exercises from library or create custom
- Log weight (kg/lb) and reps for each set
- Tick off sets as completed
- Automatic rest timer starts after each set
- 1RM calculation using Epley formula
- PB detection with trophy notification
- Supersets and drop sets support
- Exercise notes for trainers

### Trainer Features
- Client list with status (active/pending)
- Quick form for client onboarding
- Assign workouts from templates
- Schedule sessions on calendar
- View client workout history
- Track sessions used/remaining
- Client notes and goals

### Gamification
- Medal system with bronze/silver/gold/platinum tiers
- Strength rating with tier progression
- Weekly consistency score
- Volume milestones
- Social achievements

## 🔐 Data Storage

Currently uses localStorage for data persistence. For production:
- Integrate with Firebase/Supabase for backend
- Add user authentication (OAuth, email/password)
- Cloud sync for workout data
- Media storage for photos/videos

## 📄 License

MIT License - feel free to use for personal or commercial projects.

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines first.

---

Built with ❤️ for fitness enthusiasts and personal trainers.
