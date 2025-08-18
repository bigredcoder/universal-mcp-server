// Pure Lambda YouTube Search AI Agent - No dependencies
// Uses built-in Node.js 18+ fetch

// YouTube Search AI Agent Functions
async function searchYouTube(query, maxResults = 10) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  console.log('🔑 API Key available:', !!apiKey);
  console.log('🔍 Searching for:', query);

  if (!apiKey) {
    console.log('❌ No YouTube API key - using fallback search');
    return generateFallbackResults(query, maxResults);
  }

  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${apiKey}`;
  console.log('🌐 Search URL:', searchUrl.replace(apiKey, 'API_KEY_HIDDEN'));

  try {
    const response = await fetch(searchUrl);
    console.log('📡 Response status:', response.status);

    const data = await response.json();
    console.log('📊 Response data:', JSON.stringify(data, null, 2));

    if (data.error) {
      console.log('❌ YouTube API error:', data.error.message);
      if (data.error.reason === 'quotaExceeded') {
        console.log('🔄 Quota exceeded, using fallback results');
      }
      return generateFallbackResults(query, maxResults);
    }

    if (data.items && data.items.length > 0) {
      console.log('✅ Found', data.items.length, 'videos');
      return data.items;
    } else {
      console.log('⚠️ No items in response, using fallback');
      return generateFallbackResults(query, maxResults);
    }
  } catch (error) {
    console.log('❌ YouTube API error:', error.message);
    return generateFallbackResults(query, maxResults);
  }
}

// Fallback function to generate reasonable video IDs when API is not available
function generateFallbackResults(query, maxResults) {
  console.log('🔄 Using fallback search for:', query);

  // Map of common songs to their known YouTube video IDs
  const songMap = {
    'hallelujah leonard cohen': 'ttEMYvpoR-k',
    'hotel california eagles': 'BciS5krYL80',
    'bohemian rhapsody queen': 'fJ9rUzIMcZQ',
    'stairway to heaven led zeppelin': 'QkF3oxziUI4',
    'imagine john lennon': 'YkgkThdzX-8',
    'yesterday beatles': 'wXTJBr9tt8Q',
    'sweet child o mine guns n roses': '1w7OgIMMRc4',
    'smells like teen spirit nirvana': 'hTWKbfoikeg',
    'black pearl jam': 'j4R9Lq4Td7E',
    'everybody hurts rem': 'ijZRCIrTgQc',
    'alive pearl jam': 'wGiTPgvKktM',
    'fast car tracy chapman': 'TO9Qa7MpAvw',
    'wonderwall oasis': 'bx1Bh8ZvH84',
    'creep radiohead': 'XFkzRNyygfk',
    'losing my religion rem': '4N1iwQxiHrs',
    'under the bridge red hot chili peppers': 'lwlogyj7nFE',
    'november rain guns n roses': '8SbUC-UaAxE',
    'purple rain prince': 'TvnYmWpD_T8',
    'like a prayer madonna': 'ChV5BZ8SmS0',
    'billie jean michael jackson': 'Zi_XLOBDo_Y'
  };

  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  console.log('🔍 Normalized query:', normalizedQuery);

  // Try to find a match in our song map
  for (const [key, videoId] of Object.entries(songMap)) {
    if (normalizedQuery.includes(key) || key.includes(normalizedQuery)) {
      console.log('✅ Found fallback match:', key, '→', videoId);
      return [{
        id: { videoId: videoId },
        snippet: {
          title: query,
          channelTitle: 'Official Channel',
          description: 'Fallback video result'
        }
      }];
    }
  }

  console.log('❌ No fallback match found');
  return [];
}

async function analyzeVideoWithAI(video, targetSong, targetArtist) {
  if (!process.env.OPENAI_API_KEY) return null;

  const prompt = `Analyze this YouTube video to determine if it's the correct song:

TARGET: "${targetSong}" by ${targetArtist}

VIDEO DETAILS:
Title: ${video.snippet.title}
Description: ${video.snippet.description.substring(0, 500)}
Channel: ${video.snippet.channelTitle}

Is this the correct song by the correct artist? Consider:
1. Does the title match the song name?
2. Is it by the correct artist (not a cover by someone else)?
3. Is it the official version or a high-quality version?
4. Are there any red flags (wrong artist, cover version, live version when studio wanted)?

Respond with JSON only:
{
  "isCorrect": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "explanation",
  "artistMatch": true/false,
  "songMatch": true/false,
  "videoType": "official/cover/live/lyric/other"
}`;

  try {
    const body = JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a music expert that analyzes YouTube videos to verify correct song/artist matches. Always respond with valid JSON only." },
        { role: "user", content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.1
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: body
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    return JSON.parse(content);
  } catch (error) {
    console.log('AI analysis error:', error.message);
    return null;
  }
}

async function parseSearchQuery(query) {
  if (!process.env.OPENAI_API_KEY) return null;

  const prompt = `Parse this music search query and extract the song and artist:

Query: "${query}"

Consider common patterns like:
- "Song Title Artist Name"
- "Song Title by Artist Name"  
- "Artist Name Song Title"
- Handle typos and variations

Respond with JSON only:
{
  "song": "extracted song title",
  "artist": "extracted artist name",
  "confidence": 0.0-1.0,
  "searchTerms": ["alternative", "search", "terms"],
  "originalQuery": "${query}"
}`;

  try {
    const body = JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a music query parser. Extract song and artist from search queries. Always respond with valid JSON only." },
        { role: "user", content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.1
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: body
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    return JSON.parse(content);
  } catch (error) {
    console.log('Query parsing error:', error.message);
    return null;
  }
}

async function generateSearchStrategy(song, artist) {
  if (!process.env.OPENAI_API_KEY) return null;

  const prompt = `Generate smart YouTube search strategies for finding the correct version of this song:

Song: "${song}"
Artist: ${artist}

Create multiple search queries that would help find the official/correct version and avoid covers or wrong artists.

Respond with JSON only:
{
  "primarySearch": "best search query",
  "alternativeSearches": ["backup", "queries", "to", "try"],
  "avoidTerms": ["terms", "that", "indicate", "covers"],
  "preferTerms": ["terms", "that", "indicate", "official"],
  "strategy": "explanation of approach"
}`;

  try {
    const body = JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a YouTube search strategist. Create optimal search queries to find correct song versions. Always respond with valid JSON only." },
        { role: "user", content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.2
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: body
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    return JSON.parse(content);
  } catch (error) {
    console.log('Strategy generation error:', error.message);
    return null;
  }
}

// Fast YouTube Search - No AI analysis, just search
async function youtubeSearchAgent(query) {
  console.log('🤖 Fast YouTube Search starting for:', query);

  const results = {
    query: query,
    success: false,
    videoId: null,
    confidence: 1,
    reasoning: '',
    toolsUsed: ['youtube_search'],
    logs: []
  };

  // Hardcoded fallback video IDs for common songs
  const fallbackVideos = {
    'everybody hurts rem': '5rOiW_xY-kc',
    'everybody hurts r.e.m.': '5rOiW_xY-kc',
    'alive pearl jam': 'wGiTPgvKktM',
    'black pearl jam': 'cs-XZ_dN4Hc',
    'jeremy pearl jam': 'MS91knuzoOA',
    'hurt johnny cash': '8AHCfZTRGiI',
    'hallelujah leonard cohen': 'ttEMYvpoR-k',
    'creep radiohead': 'XFkzRNyygfk',
    'losing my religion rem': 'xwtdhWltSIg',
    'losing my religion r.e.m.': 'xwtdhWltSIg',
    'rooster alice in chains': 'uAE6Il6OTcs',
    'welcome to the jungle guns n roses': 'o1tj2zJ2Wvg',
    'betterman pearl jam': 'hbpUfWz-rlc',
    'in the air tonight phil collins': 'YkADj0TPrJA',
    'yesterday beatles': 'wXTJBr9tt8Q',
    'hotel california eagles': 'BciS5krYL80',
    'bohemian rhapsody queen': 'fJ9rUzIMcZQ',
    'stairway to heaven led zeppelin': 'QkF3oxziUI4',
    'imagine john lennon': 'YkgkThdzX-8',
    'sweet child o mine guns n roses': '1w7OgIMMRc4',
    'smells like teen spirit nirvana': 'hTWKbfoikeg'
  };

  try {
    // First try to find a hardcoded video ID
    const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    results.logs.push(`🔍 Checking fallback for: ${normalizedQuery}`);

    const fallbackVideoId = fallbackVideos[normalizedQuery];
    if (fallbackVideoId) {
      results.success = true;
      results.videoId = fallbackVideoId;
      results.reasoning = `Found fallback video: ${fallbackVideoId}`;
      results.logs.push(`✅ Using fallback video: ${fallbackVideoId}`);
      console.log('🤖 Fast search completed:', results);
      return results;
    }

    // If no fallback, try YouTube API
    results.logs.push('🔍 Searching YouTube API...');
    const videos = await searchYouTube(`${query} official`, 3);

    if (videos && videos.length > 0) {
      const video = videos[0];
      results.success = true;
      results.videoId = video.id.videoId;
      results.reasoning = `Found: "${video.snippet.title}"`;
      results.logs.push(`📺 Found: "${video.snippet.title}"`);
      results.logs.push('✅ Using API result');
    } else {
      results.logs.push('❌ No videos found');
      results.reasoning = 'No videos found';
    }

  } catch (error) {
    results.logs.push(`❌ Error: ${error.message}`);
    results.reasoning = `Error: ${error.message}`;
  }

  console.log('🤖 Fast search completed:', results);
  return results;
}

// Artist suggestion function (restored original functionality)
async function suggestArtistForSong(song) {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a music expert. When given a song title (which may have typos or incorrect capitalization), identify the most famous artist and correct song title. Respond with ONLY a JSON object containing 'artist', 'correctedSong', and 'confidence' (high/medium/low). Fix any spelling errors and use proper capitalization. If you're not confident, return null."
          },
          {
            role: "user",
            content: `What artist is most famous for the song "${song}"? Also provide the correct spelling and capitalization of the song title. Consider iconic lyrics, famous covers, and cultural impact.`
          }
        ],
        max_tokens: 100,
        temperature: 0.1
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) return null;

    try {
      const result = JSON.parse(content);
      if (result && result.artist && result.confidence) {
        return {
          artist: result.artist,
          correctedSong: result.correctedSong || song,
          confidence: result.confidence
        };
      }
    } catch (e) {
      // If JSON parsing fails, try to extract artist name from text
      const artistMatch = content.match(/artist["\s]*:?["\s]*([^"]+)/i);
      if (artistMatch) {
        return {
          artist: artistMatch[1].trim(),
          correctedSong: song,
          confidence: "medium"
        };
      }
    }

    return null;
  } catch (e) {
    console.error('Artist suggestion error:', e);
    return null;
  }
}

// Song meaning function (restored original functionality)
async function getSongMeaning(song, artist) {
  try {
    console.log(`🎵 Getting meaning for: "${song}" by ${artist}`);

    // Use OpenAI knowledge as a fast, reliable source
    const prompt = `You are a music historian. Provide engaging, detailed information about song meanings in 2-3 paragraphs. Focus on the compelling story, inspiration, and context behind the song. Include specific details, real events, and human stories. ALWAYS include 1-2 key lyric quotes that illustrate the meaning, formatted with quotation marks. If there was a tragedy, death, or significant event, describe it with appropriate detail.

What is the detailed story, meaning, and inspiration behind "${song}" by ${artist}? Include specific context and human stories. ALWAYS include 1-2 key lyric quotes that best illustrate the song's meaning.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const meaning = data.choices[0].message.content;

    return {
      song: song.trim(),
      artist: artist.trim(),
      meaning,
      logs: ['openai_knowledge: success']
    };
  } catch (error) {
    console.error('Error getting song meaning:', error);
    return {
      song: song.trim(),
      artist: artist.trim(),
      error: error.message,
      logs: [`error: ${error.message}`]
    };
  }
}

// AWS Lambda handler
exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const path = event.path || event.pathParameters?.proxy || '';
  const method = event.httpMethod || 'GET';
  const query = event.queryStringParameters || {};
  
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    // Route to YouTube search
    if (path.includes('youtube-search')) {
      const { query: searchQuery = "" } = query;
      if (!searchQuery) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "query required" })
        };
      }

      const result = await youtubeSearchAgent(searchQuery);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    // Route to meaning search (existing functionality)
    if (path.includes('meaning')) {
      const { song = "", artist = "" } = query;
      if (!song) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "song parameter required" })
        };
      }

      // If no artist provided or artist is empty/whitespace, try to suggest one
      if (!artist || !artist.trim()) {
        try {
          const suggestion = await suggestArtistForSong(song.trim());
          if (suggestion) {
            const correctedSong = suggestion.correctedSong || song.trim();
            const originalSong = song.trim();
            const songChanged = correctedSong.toLowerCase() !== originalSong.toLowerCase();

            let message;
            if (songChanged) {
              message = `Did you mean "${correctedSong}" by ${suggestion.artist}?`;
            } else {
              message = `Did you mean "${correctedSong}" by ${suggestion.artist}?`;
            }

            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                suggestion: true,
                originalSong: originalSong,
                correctedSong: correctedSong,
                suggestedArtist: suggestion.artist,
                confidence: suggestion.confidence,
                songChanged: songChanged,
                message: message,
                searchUrl: `/api/meaning?song=${encodeURIComponent(correctedSong)}&artist=${encodeURIComponent(suggestion.artist)}`
              })
            };
          } else {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({
                error: "Artist name is required. Could not automatically identify the artist for this song.",
                suggestion: false
              })
            };
          }
        } catch (e) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "Artist name is required" })
          };
        }
      }

      const result = await getSongMeaning(song, artist);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    // Default response
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Not found" })
    };
    
  } catch (error) {
    console.error('Lambda handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
