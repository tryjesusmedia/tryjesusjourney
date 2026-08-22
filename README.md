# Try Jesus: The Journey — Expo Native Beta

This is the first native Android/iOS Expo codebase for Try Jesus Media.

## Already wired

- Supabase project connection (public client values in `.env`)
- Google OAuth through Supabase + custom deep link `tryjesusjourney://`
- Guest mode
- Synced `guide_progress` for signed-in users
- Local guest progress
- Bible guide WebView starting at `https://tryjesusmedia.com/welcome/`
- Private journal (Supabase for signed-in users; local for guests)
- Random YouTube Edge Function: `random-youtube-video`
- Random Fourthwall Edge Function: `random-fourthwall-products`
- Bible Decoded expected as pinned Fourthwall result #1
- Thursday live discussion table + Eastern-time countdown
- Zoom join link
- Native local reminder scheduling

## Before the first build

1. Install dependencies:
   ```bash
   npm install
   ```
2. Log in to Expo:
   ```bash
   npx eas-cli@latest login
   ```
3. Link the project to your Expo account:
   ```bash
   npx eas-cli@latest init
   ```
   Accept/create the Expo project for `Try Jesus: The Journey`. EAS will add the real project ID to the app configuration.
4. Run a local/dev server:
   ```bash
   npx expo start
   ```
5. For a real Android development build (recommended for native deep links and notifications):
   ```bash
   npx eas-cli@latest build --profile development --platform android
   ```
6. For an installable Android APK:
   ```bash
   npx eas-cli@latest build --profile preview --platform android
   ```
7. For Google Play AAB later:
   ```bash
   npx eas-cli@latest build --profile production --platform android
   ```

## Supabase settings already expected

- Redirect allowlist includes `tryjesusjourney://**`
- Google provider is enabled
- RLS policies exist for `profiles`, `guide_progress`, `journal_entries`, `questions`
- `live_discussions` contains Thursday 8 PM America/New_York + Zoom URL
- `youtube_channels` contains @TryJesusMedia and @TryJesusMedia2
- Edge Functions `random-youtube-video` and `random-fourthwall-products` are deployed

## Still to configure later

- Facebook OAuth provider (Meta Developer app + Supabase provider)
- Apple Developer + Sign in with Apple
- App Store/Play Store privacy metadata
- A ministry admin workflow for question responses
- Exact lesson catalog/deep links if you want native guide navigation instead of the website WebView
- Optional push notifications from the server; current beta uses reliable local scheduled reminders on-device

## Security

The YouTube API key and Fourthwall Storefront token should remain only in Supabase Edge Function Secrets. Do not put those keys in Expo public environment variables.

## Added in this build: Ask Pastor Kal

The native app now has a dedicated **Ask Kal** tab and dashboard invitation. The UI invokes a Supabase Edge Function named `ask-pastor-kal`. The included backend is designed to reproduce the organized database-grounded pattern used by the website chatbot:

**collection → category → topic → source → approved content → Scripture references → keywords**

Setup files:

- `supabase/sql/app-upgrade.sql`
- `supabase/functions/ask-pastor-kal/index.ts`
- `supabase/PASTOR_KAL_SETUP.md`

The Edge Function requires an `OPENAI_API_KEY` Supabase secret and uses only retrieved approved knowledge as its ministry grounding. The API key must never be placed in Expo or GitHub.

## Added in this build: Bible in Chronological Order

The **Guides** tab now includes a **Bible in Chronological Order** experience based on the supplied Try Jesus Media reading sequence. It includes:

- the complete reading sequence supplied for this build
- section headings from The Beginning through Revelation
- one-tap passage opening in Bible Gateway
- check-off completion
- progress percentage
- Continue Reading card
- local guest progress
- Supabase cross-device progress for signed-in users

Run `supabase/sql/app-upgrade.sql` before expecting signed-in chronological-plan progress or Ask Pastor Kal chat history to sync.
