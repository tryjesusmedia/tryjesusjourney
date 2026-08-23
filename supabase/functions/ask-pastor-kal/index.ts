const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const PASTOR_KAL_PROMPT_URL =
  'https://raw.githubusercontent.com/tryjesusmedia/tjm/main/lib/pastor-kal-prompt.js';
const MAX_MESSAGE_CHARS = 6000;
const MAX_HISTORY_ITEMS = 14;

type HistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

let cachedPastorKalPrompt: string | null = null;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

async function getPastorKalPrompt() {
  if (cachedPastorKalPrompt) return cachedPastorKalPrompt;

  const response = await fetch(PASTOR_KAL_PROMPT_URL, {
    headers: { 'user-agent': 'TryJesusJourney/1.0' },
  });

  if (!response.ok) {
    throw new Error(`Could not load Pastor Kal prompt: ${response.status}`);
  }

  const source = await response.text();
  const marker = 'String.raw`';
  const start = source.indexOf(marker);
  const end = source.lastIndexOf('`;');

  if (start === -1 || end === -1 || end <= start + marker.length) {
    throw new Error('Pastor Kal prompt file format was not recognized.');
  }

  cachedPastorKalPrompt = source.slice(start + marker.length, end);
  return cachedPastorKalPrompt;
}

function normalizeHistory(history: unknown): HistoryMessage[] {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-MAX_HISTORY_ITEMS)
    .filter(
      (item) =>
        item &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string',
    )
    .map((item) => ({
      role: item.role,
      content: String(item.content).slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((item) => item.content.trim().length > 0);
}

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text;

  const chunks: string[] = [];
  for (const item of payload?.output ?? []) {
    if (item?.type !== 'message') continue;
    for (const part of item?.content ?? []) {
      if (part?.type === 'output_text' && typeof part.text === 'string') {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join('\n').trim();
}

function extractFileSources(payload: any) {
  const seen = new Set<string>();
  const sources: Array<{
    id: string;
    category: string;
    topic: string;
    source_title: string;
    source_url: null;
    scripture_refs: string[];
  }> = [];

  for (const item of payload?.output ?? []) {
    if (item?.type !== 'file_search_call') continue;

    for (const result of item?.results ?? []) {
      const filename = result?.filename || result?.file_name;
      if (!filename || seen.has(filename)) continue;

      seen.add(filename);
      sources.push({
        id: String(result?.file_id || filename),
        category: 'Approved Pastor Kal knowledge',
        topic: filename,
        source_title: filename,
        source_url: null,
        scripture_refs: [],
      });

      if (sources.length >= 6) return sources;
    }
  }

  return sources;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const question = String(body?.question ?? body?.message ?? '').trim();

    if (!question) return json({ error: 'Please ask a question.' }, 400);
    if (question.length > MAX_MESSAGE_CHARS) {
      return json(
        { error: `Please shorten the question to ${MAX_MESSAGE_CHARS.toLocaleString()} characters or fewer.` },
        413,
      );
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
    const vectorStoreId = Deno.env.get('OPENAI_VECTOR_STORE_ID') ?? '';
    const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.6';

    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY is missing from Edge Function secrets.');
    }
    if (!vectorStoreId) {
      throw new Error('OPENAI_VECTOR_STORE_ID is missing from Edge Function secrets.');
    }

    const baseInstructions = await getPastorKalPrompt();
    const instructions = `${baseInstructions}\n\nVOICE REQUIREMENT: Speak only in the first person as Pastor Kal. Use “I,” “me,” and “my” when referring to yourself. Never refer to Pastor Kal in the third person. Do not mention the approved database, knowledge base, file search, retrieval system, or internal sources unless the user specifically asks what sources support the answer.`;
    const history = normalizeHistory(body?.history);
    const input = [...history, { role: 'user', content: question }];

    const openAIResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${openaiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions,
        input,
        store: false,
        tools: [
          {
            type: 'file_search',
            vector_store_ids: [vectorStoreId],
            max_num_results: 10,
          },
        ],
        include: ['file_search_call.results'],
      }),
    });

    const payload = await openAIResponse.json().catch(() => ({}));

    if (!openAIResponse.ok) {
      console.error('OpenAI error', openAIResponse.status, payload);
      return json(
        { error: 'Pastor Kal could not answer that right now. Please try again.' },
        openAIResponse.status >= 500 ? 502 : 400,
      );
    }

    const answer = extractOutputText(payload);
    if (!answer) {
      return json(
        { error: 'No answer was generated. Please try rephrasing your question.' },
        502,
      );
    }

    return json({
      answer,
      sources: extractFileSources(payload),
      knowledgeConnected: true,
    });
  } catch (error) {
    console.error(error);
    return json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    );
  }
});
