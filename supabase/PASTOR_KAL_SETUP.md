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

## 2. Share the website knowledge base

The mobile Edge Function uses the same OpenAI vector store as the website. It also loads the canonical Pastor Kal instructions from the website repository, so web and app keep one authority hierarchy and one answer policy.

The five Conflict of the Ages books live in the website repository under `knowledge/sources/conflict-of-the-ages/` and are synchronized with:

`npm run kb:conflict:sync`

They are supplemental, hidden retrieval context. Normal answers lead with Scripture and do not show book filenames, chapter/page references, or a “knowledge used” list. The books may be named only when the user specifically asks about Ellen White, a particular book, or supporting sources.

## 3. Add the AI secret

In **Supabase → Edge Functions → Secrets**, add:

`OPENAI_API_KEY`

`OPENAI_VECTOR_STORE_ID`

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

The `sources` array is retained as server-side provenance for testing and private history. The app intentionally does not render it in normal answers.
