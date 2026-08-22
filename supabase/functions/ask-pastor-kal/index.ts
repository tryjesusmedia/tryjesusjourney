const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type HistoryMessage = { role: 'user' | 'assistant'; content: string };
type Knowledge = {
  id: number;
  source_id?: number | null;
  collection?: string;
  category?: string;
  topic?: string;
  question?: string | null;
  content: string;
  scripture_refs?: string[];
  keywords?: string[];
  source_title?: string | null;
  source_url?: string | null;
  score?: number;
};

function getSupabaseServerKey() {
  const current = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (current) {
    try {
      const parsed = JSON.parse(current);
      if (parsed.default) return parsed.default as string;
      const first = Object.values(parsed)[0];
      if (typeof first === 'string') return first;
    } catch (_) {}
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

function extractResponseText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const parts: string[] = [];
  for (const item of payload?.output ?? []) {
    if (item?.type !== 'message') continue;
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const question = String(body?.question ?? '').trim();
    const history = Array.isArray(body?.history) ? body.history.slice(-8) as HistoryMessage[] : [];
    if (!question) throw new Error('Please ask a question.');
    if (question.length > 1200) throw new Error('Please shorten the question to 1,200 characters or fewer.');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serverKey = getSupabaseServerKey();
    const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
    const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.6';

    if (!supabaseUrl || !serverKey) throw new Error('Supabase server configuration is missing.');
    if (!openaiKey) throw new Error('OPENAI_API_KEY is missing from Edge Function secrets.');

    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/search_pastor_kal_knowledge`, {
      method: 'POST',
      headers: { apikey: serverKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ search_query: question, match_count: 10 }),
    });

    let knowledge: Knowledge[] = [];
    if (rpcResponse.ok) knowledge = await rpcResponse.json();

    // Fallback for questions whose wording does not produce an FTS match.
    // The model is still restricted to approved rows from the organized knowledge table.
    if (!knowledge.length) {
      const fallback = await fetch(
        `${supabaseUrl}/rest/v1/pastor_kal_knowledge?select=id,source_id,collection,category,topic,question,content,scripture_refs,keywords,priority,sort_order&active=eq.true&order=priority.desc,sort_order.asc&limit=8`,
        { headers: { apikey: serverKey } },
      );
      if (fallback.ok) knowledge = await fallback.json();
    }

    const sourceIds = [...new Set(knowledge.map((k) => k.source_id).filter(Boolean))];
    let sourceMap = new Map<number, { title?: string; source_url?: string }>();
    if (sourceIds.length) {
      const sourceResponse = await fetch(
        `${supabaseUrl}/rest/v1/pastor_kal_sources?select=id,title,source_url&id=in.(${sourceIds.join(',')})`,
        { headers: { apikey: serverKey } },
      );
      if (sourceResponse.ok) {
        const rows = await sourceResponse.json();
        sourceMap = new Map(rows.map((row: any) => [Number(row.id), row]));
      }
    }

    const context = knowledge.map((row, index) => {
      const source = row.source_id ? sourceMap.get(Number(row.source_id)) : undefined;
      const title = row.source_title || source?.title || row.topic || `Knowledge item ${index + 1}`;
      const url = row.source_url || source?.source_url || '';
      const scriptures = Array.isArray(row.scripture_refs) && row.scripture_refs.length ? row.scripture_refs.join(', ') : 'None listed';
      return [
        `[SOURCE ${index + 1}]`,
        `Collection: ${row.collection ?? 'Bible Guides'}`,
        `Category: ${row.category ?? 'General'}`,
        `Topic: ${row.topic ?? ''}`,
        `Source title: ${title}`,
        `Source URL: ${url}`,
        `Scripture references: ${scriptures}`,
        row.question ? `Approved question framing: ${row.question}` : '',
        `Approved content:\n${row.content}`,
      ].filter(Boolean).join('\n');
    }).join('\n\n');

    const instructions = `You are Ask Pastor Kal, the Try Jesus Media Bible-study assistant.\n\nGROUNDING RULES:\n- Answer from the APPROVED KNOWLEDGE supplied below and Scripture references contained in it.\n- Preserve Pastor Kal / Try Jesus Media's theological positions represented by the approved database.\n- Do not invent a ministry position or claim that is not supported by the approved material.\n- If the approved database is insufficient, clearly say you do not have enough approved material to answer confidently, then invite the user to the Thursday live discussion at https://tryjesusmedia.com/welcome/ or to email info@tryjesusmedia.com.\n- Distinguish Scripture from interpretation.\n- Be warm, direct, concise, and understandable to a spiritually curious adult.\n- Avoid manipulative pressure.\n- When useful, cite Bible references naturally in the answer.\n- Never claim to literally be Pastor Kal; you are an AI assistant grounded in his approved material.\n\nAPPROVED KNOWLEDGE:\n${context || '[No approved knowledge was retrieved.]'}`;

    const conversation = history
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => `${m.role === 'user' ? 'User' : 'Ask Pastor Kal'}: ${m.content}`)
      .join('\n');

    const input = `${conversation ? `RECENT CONVERSATION:\n${conversation}\n\n` : ''}CURRENT QUESTION:\n${question}`;

    const aiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions,
        input,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI response failed: ${aiResponse.status} ${errorText.slice(0, 400)}`);
    }

    const aiJson = await aiResponse.json();
    const answer = extractResponseText(aiJson);
    if (!answer) throw new Error('The AI service returned an empty answer.');

    const sources = knowledge.slice(0, 6).map((row) => {
      const source = row.source_id ? sourceMap.get(Number(row.source_id)) : undefined;
      return {
        id: row.id,
        category: row.category,
        topic: row.topic,
        scripture_refs: row.scripture_refs ?? [],
        source_title: row.source_title || source?.title || row.topic,
        source_url: row.source_url || source?.source_url || null,
      };
    });

    return new Response(JSON.stringify({ answer, sources }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
