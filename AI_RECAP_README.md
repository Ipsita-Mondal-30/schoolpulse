# AI Daily Recap Audio Feature

## Overview
Automatically generates kid-friendly 15-minute audio recaps of daily teaching using Google Gemini AI and Text-to-Speech.

## Status
✅ **Phase 1 Complete** - Core infrastructure built  
⏳ **Ready for Testing** - Needs API keys setup

## What's Built

### Core Modules
- **`lib/gemini.ts`** - Gemini text generation with kid-friendly prompts
- **`lib/tts.ts`** - Google Cloud Text-to-Speech integration
- **`lib/storage.ts`** - Audio file storage utilities
- **`lib/types/daily-recap.ts`** - TypeScript interfaces

### API Routes
- **`/api/generate-recap`** - POST endpoint to generate recaps

### UI Components
- **`components/DailyRecapPlayer.tsx`** - Audio player with transcript
- **`app/test-recap/page.tsx`** - Test page for generation

## Setup Instructions

### 1. Get API Keys

#### Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create new API key
3. Copy the key

#### Google Cloud TTS API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Text-to-Speech API
3. Create API key or service account
4. Copy the key

### 2. Configure Environment

Create `.env.local` file:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_CLOUD_API_KEY=your_google_cloud_api_key_here
```

### 3. Restart Dev Server
```bash
npm run dev
```

## Testing

### Manual Test
1. Navigate to http://localhost:3000/test-recap
2. Select a date with schedule data (e.g., 2026-01-17)
3. Click "Generate Recap"
4. Wait 1-2 minutes for generation
5. Play the audio recap

### Expected Output
- Text recap: ~2000-2200 words
- Audio file: ~15 minutes, MP3 format
- Saved to: `public/audio-recaps/YYYY-MM-DD.mp3`

## How It Works

```
1. User requests recap for a date
   ↓
2. API fetches day's schedule from data
   ↓
3. Gemini generates kid-friendly script (15 min)
   ↓
4. Google TTS converts text to audio
   ↓
5. Audio saved to public/audio-recaps/
   ↓
6. Player displays with play/pause/transcript
```

## Features

### Text Generation (Gemini)
- Kid-friendly language (age 4-5)
- Covers all subjects taught
- Interactive recall questions
- Warm, encouraging tone
- ~2000 words (15 minutes)

### Audio Synthesis (TTS)
- Voice: Indian English (en-IN-Wavenet-D)
- Female voice, kid-friendly
- Slower speaking rate (0.85x)
- Higher pitch (1.5x)
- MP3 format, 24kHz

### Audio Player
- Play/Pause controls
- Progress bar
- Time display
- Transcript toggle
- Responsive design

## Cost Estimate
- Text generation: ~$0.001 per recap
- Audio synthesis: ~$0.016 per recap
- Storage: ~$0.005 per file
- **Total: ~$0.02 per recap**

For 20 school days/month: **~$0.40/month**

## Next Steps

### Phase 2: Integration
- [ ] Integrate into Today page
- [ ] Add to DaySchedule data structure
- [ ] Persist recap metadata

### Phase 3: Automation
- [ ] Create cron job for daily generation
- [ ] Schedule for 3 PM daily
- [ ] Auto-generate for all school days

### Phase 4: Enhancements
- [ ] Multiple language support (Hindi, Kannada)
- [ ] Playback speed control
- [ ] Download option
- [ ] Weekly recap (30 min)

## Troubleshooting

### "GEMINI_API_KEY not configured"
- Check `.env.local` file exists
- Verify API key is correct
- Restart dev server

### "TTS API failed"
- Check Google Cloud API key
- Verify Text-to-Speech API is enabled
- Check API quota limits

### "No schedule found for this date"
- Ensure date has schedule data in JSON
- Check date format: YYYY-MM-DD
- Verify month data is loaded

## Files Created
```
lib/
├── gemini.ts              # Gemini text generation
├── tts.ts                 # Text-to-Speech
├── storage.ts             # File storage
└── types/
    └── daily-recap.ts     # TypeScript types

app/
├── api/
│   └── generate-recap/
│       └── route.ts       # API endpoint
└── test-recap/
    └── page.tsx           # Test page

components/
└── DailyRecapPlayer.tsx   # Audio player

public/
└── audio-recaps/          # Generated audio files
    └── YYYY-MM-DD.mp3
```

## Branch
`ai-features` - All AI feature development

## Commits
- `2fee01f` - Initial setup (Gemini, TTS, types)
- `107fd70` - Complete infrastructure (API, UI, storage)
