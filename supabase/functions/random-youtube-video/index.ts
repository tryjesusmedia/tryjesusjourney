const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const channelHandles = ['@TryJesusMedia', '@TryJesusMedia2'];
const minimumLongFormSeconds = 240;

function durationSeconds(duration: string) {
  const match = duration.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 86400 + Number(match[2] ?? 0) * 3600 + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0);
}

async function youtube(path: string, params: Record<string, string>, apiKey: string) {
  const search = new URLSearchParams({ ...params, key: apiKey });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${search}`);
  if (!response.ok) throw new Error(`YouTube request failed (${response.status})`);
  return response.json();
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!apiKey) throw new Error('YOUTUBE_API_KEY is not configured');

    const uploadPlaylists: string[] = [];
    for (const handle of channelHandles) {
      const channelData = await youtube('channels', { part: 'contentDetails', forHandle: handle }, apiKey);
      const uploads = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (uploads) uploadPlaylists.push(uploads);
    }

    const videoIds = new Set<string>();
    for (const playlistId of uploadPlaylists) {
      const playlistData = await youtube('playlistItems', { part: 'contentDetails', playlistId, maxResults: '50' }, apiKey);
      for (const item of playlistData.items ?? []) {
        if (item.contentDetails?.videoId) videoIds.add(item.contentDetails.videoId);
      }
    }

    const ids = [...videoIds];
    const details: any[] = [];
    for (let start = 0; start < ids.length; start += 50) {
      const videoData = await youtube('videos', { part: 'snippet,contentDetails,status', id: ids.slice(start, start + 50).join(',') }, apiKey);
      details.push(...(videoData.items ?? []));
    }

    const longVideos = details.filter((video) => {
      const text = `${video.snippet?.title ?? ''} ${video.snippet?.description ?? ''}`;
      return video.status?.privacyStatus === 'public'
        && durationSeconds(video.contentDetails?.duration ?? '') >= minimumLongFormSeconds
        && !/#shorts?\b/i.test(text);
    });

    for (let index = longVideos.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [longVideos[index], longVideos[randomIndex]] = [longVideos[randomIndex], longVideos[index]];
    }

    const videos = longVideos.slice(0, 3).map((video) => ({
      videoId: video.id,
      title: video.snippet.title,
      thumbnail: video.snippet.thumbnails?.maxres?.url ?? video.snippet.thumbnails?.high?.url ?? video.snippet.thumbnails?.medium?.url,
      channelTitle: video.snippet.channelTitle,
      watchUrl: `https://www.youtube.com/watch?v=${video.id}`,
      durationSeconds: durationSeconds(video.contentDetails.duration),
    }));

    return new Response(JSON.stringify({ videos }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to load videos' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
