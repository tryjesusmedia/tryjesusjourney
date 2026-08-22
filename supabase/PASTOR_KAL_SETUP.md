# Ask Pastor Kal backend setup

The native app now includes the Ask Pastor Kal UI. It calls the Supabase Edge Function named `ask-pastor-kal`.

## 1. Run the database upgrade

In **Supabase → SQL Editor**, run:

`supabase/sql/app-upgrade.sql`

This adds:
- `reading_plan_progress`
- `pastor_kal_sources`
- `pastor_kal_knowledge`
- `pastor_kal_chat_messages`
- `search_pastor_kal_knowledge(...)`

## 2. Use the same organized knowledge as the website chatbot

The mobile function is intentionally organized as:

**collection → category → topic → source → content chunk → Scripture references → keywords**

If your website Ask Pastor Kal data is already in this same Supabase project, map/copy those approved records into `pastor_kal_sources` and `pastor_kal_knowledge`. Do not put unreviewed internet content into this table.

Example source:

```sql
insert into public.pastor_kal_sources
(collection, title, source_type, source_url, sort_order)
values
('Bible Guides', 'Why Does God Allow Evil?', 'bible_guide', 'https://tryjesusmedia.com/lesson-url/', 10)
returning id;
```

Example organized chunk (replace `SOURCE_ID`):

```sql
insert into public.pastor_kal_knowledge
(source_id, collection, category, topic, question, content, scripture_refs, keywords, priority, sort_order)
values
(
  SOURCE_ID,
  'Bible Guides',
  'Character of God',
  'Why God allows evil',
  'Why does God allow evil if He is good?',
  'PASTE THE APPROVED PASTOR KAL / TRY JESUS MEDIA CONTENT HERE',
  array['Genesis 3', 'Romans 8:28'],
  array['evil', 'suffering', 'free will', 'God is good'],
  10,
  10
);
```

The Edge Function searches only approved active rows and gives the answer model those retrieved records as grounding context.

## 3. Add the AI secret

In **Supabase → Edge Functions → Secrets**, add:

`OPENAI_API_KEY`

Optionally add:

`OPENAI_MODEL=gpt-5.6`

Do not place the API key in Expo, GitHub, or any `EXPO_PUBLIC_...` variable.

## 4. Deploy the function

Create/deploy the Edge Function named:

`ask-pastor-kal`

using:

`supabase/functions/ask-pastor-kal/index.ts`

Turn **Verify JWT with legacy secret** OFF if your project is using the newer Supabase publishable keys, consistent with the other app Edge Functions.

## 5. Test

POST body:

```json
{"question":"Why does God allow evil?","history":[]}
```

A successful response has:

```json
{
  "answer": "...",
  "sources": [
    {
      "category": "...",
      "topic": "...",
      "source_title": "...",
      "source_url": "...",
      "scripture_refs": ["..."]
    }
  ]
}
```
