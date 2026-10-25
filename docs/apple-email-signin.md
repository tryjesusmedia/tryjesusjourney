# Apple, Google, and email sign-in rollout

Status: code prepared; provider configuration and real-device verification still required. Do not submit the existing Apple build 7 as if it contains these changes.

## Existing account contract

Use the existing Journey project `erejehmrtzjpqurbftsm` and `chronological-bible-doc-v5`. No progress IDs, indices, ownership policies, or account rows change. Requested Android update: version 0.9.1, versionCode 24; build only, without Google Play submission. Intended next iOS build: 0.9.1 (8), subject to checking the current EAS build history.

## Configuration required before a signed release

1. Apple Developer: enable Sign in with Apple on `com.tryjesusmedia.journey` as the primary App ID. Refresh the App Store provisioning profile to include `com.apple.developer.applesignin = [Default]`, and update EAS's stored provisioning profile while preserving the distribution signing identity. The production build uses `--freeze-credentials`; it intentionally does not change signing credentials silently.
2. Website/Android Apple OAuth: register a Services ID, suggested `com.tryjesusmedia.journey.web`, linked to this primary App ID. Register `tryjesusmedia.com` and return URL `https://erejehmrtzjpqurbftsm.supabase.co/auth/v1/callback`. Create the Sign in with Apple key and configure the Apple provider in Supabase. Keep the private key and generated client secret out of source control, pull requests, build artifacts, and chat.
3. Supabase Apple provider: enable it; configure the Services ID, native bundle ID as accepted client IDs, and valid Apple client secret. Per current Supabase guidance, the Services ID must precede the native App ID in the accepted-ID list. Keep nonce validation enabled. OAuth client secrets expire within six months; set up rotation before launch. Configure Apple's private email relay for any sender used for account emails.
4. Enable manual identity linking in Supabase. Existing users should sign in with their current method, then open Account & help > Manage sign-in methods to connect Apple/Google. This preserves the user ID when Apple supplies a different relay address. Do not merge accounts by matching names or unverified emails. If an identity already belongs to another account, report failure; do not move progress automatically.
5. Email provider is already enabled and email confirmation required (verified through public `/auth/v1/settings`). Confirm production SMTP, authorized sender and delivery. Keep confirmation enabled. Configure a password minimum consistent with the UI's 6-character minimum and existing users' passwords.
6. Preserve existing redirect URLs and add exact redirects:
   - `tryjesusjourney://auth/callback`
   - `tryjesusjourney://auth/callback?next=recovery`
   - `https://tryjesusmedia.com/chronbible/`
   - `https://tryjesusmedia.com/chronbible/?next=recovery`
   PKCE email links should be opened on the device/browser that requested them. The app has a dedicated password-entry screen, and the website handles `PASSWORD_RECOVERY` without losing the recovery form.

## Review account and verification

Create a dedicated email/password reviewer account through the normal account service and confirm it. Do not use a personal or developer-console account. Test the exact credentials in a fresh install of build 8 with access to all account-based features, then supply the credentials and navigation instructions in App Store Connect's App Review Information.

Verify signup, email confirmation delivery, password reset on the same phone, Google and Apple sign-in and cancellation, Hide My Email account linking, sign-out, account deletion, and progress isolation on a real iPhone. Verify account deletion complies with Apple's token-revocation requirements for the configured Apple integration before submission. Test website sign-in and recovery in Safari and another browser; check narrow screens and large text.

The iOS workflow builds and verifies an App Store IPA; it does not upload or submit it to Apple. Deploy the matching website changes only once the providers and email delivery are ready.

## Checks completed locally

Typecheck, lint, authentication method tests, callback/recovery tests, document plan/progress, chronological state, reader and reward checks. Expo iOS JavaScript export and generated Apple entitlement verified. Website authentication forms tested with a DOM and a mocked Supabase client. These checks do not replace live provider, SMTP, physical-device, or signed-IPA verification.

## Configuration verified on 2026-10-25

The owner enabled Apple and email alongside Google, configured exact website and native callback/recovery URLs and manual linking, tested Google Workspace SMTP delivery, and registered the sender with Apple (SPF passed). Website preview screenshots confirm Apple and Google on the same existing account and a successful password save. Fresh Android sign-in, email confirmation/reset links, progress, and account deletion still require device testing before publishing. Apple provisioning and iPhone verification remain separate pending work.
