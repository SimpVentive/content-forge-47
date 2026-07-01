# Google Cloud Text-to-Speech Setup

This document explains how to set up Google Cloud Text-to-Speech for proper Indian language narration support (Telugu, Hindi, Tamil, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Urdu).

## Why Google Cloud TTS?

- **Proper Pronunciation**: Native speakers trained models for Indian languages
- **Indian Accents**: Audio sounds natural with authentic Indian accents
- **Multiple Voices**: High-quality Neural2 voices for all supported Indian languages
- **Better Than ElevenLabs**: ElevenLabs doesn't support these languages natively, causing:
  - Wrong pronunciation of words
  - American accent instead of Indian accent
  - Poor narration quality

## Setup Steps

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Create Project**
3. Name it (e.g., "ContentForge-TTS")
4. Click **Create**

### Step 2: Enable the Text-to-Speech API

1. In the Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for **"Text-to-Speech"**
3. Click on **Cloud Text-to-Speech API**
4. Click **Enable**

### Step 3: Create a Service Account

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **Service Account**
3. Fill in:
   - Service account name: `contentforge-tts` (or similar)
   - Service account ID: auto-filled
   - Click **Create and Continue**
4. Grant roles:
   - Click **Add another role**
   - Search for and select: **Cloud Text-to-Speech Client**
   - Click **Continue**
5. Click **Create Key** and select **JSON**
6. Save the JSON file safely (contains API key)

### Step 4: Get Your API Key

From the JSON file you just downloaded, copy the `private_key` value.

### Step 5: Configure Supabase Edge Function

Add the API key to your Supabase project secrets:

```bash
# Via Supabase Dashboard:
1. Go to Settings > Secrets
2. Add a new secret:
   - Name: GOOGLE_CLOUD_TTS_API_KEY
   - Value: <paste the private_key from the JSON file>
3. Click Save

# OR via CLI:
supabase secrets set GOOGLE_CLOUD_TTS_API_KEY="<your-private-key>"
```

### Step 6: Deploy the Edge Function

The Edge Function `google-cloud-tts` should already exist in your project at:
```
supabase/functions/google-cloud-tts/index.ts
```

Deploy it:
```bash
supabase functions deploy google-cloud-tts
```

### Step 7: Test the Integration

1. Create a course in ContentForge
2. In Course Setup:
   - Select **Image Course**
   - Go to **Voiceover Narration** section
   - Toggle **Yes** to enable voiceover
   - Select **Telugu** (or Hindi, Tamil, etc.) from the language dropdown
3. Create and launch the course
4. The narration should now be generated in **Telugu with proper Indian accent**

## Supported Indian Languages

- **Hindi** (hi-IN)
- **Tamil** (ta-IN)
- **Telugu** (te-IN)
- **Kannada** (kn-IN)
- **Malayalam** (ml-IN)
- **Bengali** (bn-IN)
- **Marathi** (mr-IN)
- **Gujarati** (gu-IN)
- **Punjabi** (pa-IN)
- **Urdu** (ur-PK)

## Pricing

Google Cloud Text-to-Speech pricing:
- Free tier: 1 million characters per month (always free)
- Paid tier: $16 per 1 million characters after free tier

For a typical course:
- 5 scenes × 100 words average = ~3,000 words = ~15,000 characters
- Cost: ~$0.24 per course

## Troubleshooting

### "No audio data returned"
- Verify the API key is correct in Supabase Secrets
- Check that the Text-to-Speech API is enabled in Google Cloud Console

### "Unsupported language"
- Make sure you selected a language from the Indian languages list
- English will still use ElevenLabs (not Google Cloud)

### Wrong pronunciation still occurring
- Clear browser cache and localStorage
- Ensure you selected the correct narration language in Course Setup
- Regenerate the course

## How It Works

1. **User selects narration language** (e.g., Telugu) in Course Setup
2. **Visual Narrative Agent** generates scene narration **in Telugu** (not English)
3. **Audio generation** routes to Google Cloud TTS (not ElevenLabs)
4. **Google Cloud TTS** generates audio with **proper Telugu pronunciation and Indian accent**
5. **Flipbook** plays narration in learner preview

## Architecture

```
CourseParametersDialog
  ↓ (narrationLanguage: "Telugu")
useAgentPipeline
  ↓ (Visual Narrative Agent generates in Telugu)
Narrative Scenes with Telugu narration
  ↓
generateNarrationAudio(text, voiceId, "Telugu")
  ↓
Detects Indian language → Routes to Google Cloud TTS
  ↓
google-cloud-tts Edge Function
  ↓
Google Cloud Text-to-Speech API
  ↓
Returns MP3 audio (Telugu, Indian accent)
  ↓
Flipbook plays audio
```

## Key Differences from ElevenLabs

| Aspect | ElevenLabs | Google Cloud TTS |
|--------|------------|------------------|
| Hindi Support | No | Yes (hi-IN) |
| Telugu Support | No | Yes (te-IN) |
| Tamil Support | No | Yes (ta-IN) |
| Pronunciation | N/A (doesn't support) | ✓ Native speaker quality |
| Accent | N/A (doesn't support) | ✓ Indian accent |
| Neural Voices | Limited | Yes (Neural2) |
| Cost | ~$8/hour audio | $16/1M characters |

## Questions?

If you encounter issues:
1. Check Supabase logs: **Functions** > **google-cloud-tts** > **Logs**
2. Verify API key is set correctly in Secrets
3. Check Google Cloud Console for API usage
