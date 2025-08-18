// YouTube Search AI Agent with Tools
// Smart agent that uses multiple tools to find and verify correct songs

const https = require('https');
const { URL } = require('url');

// Tool: YouTube Data API Search
async function searchYouTube(query, maxResults = 10) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.log('No YouTube API key - using fallback search');
    return null;
  }

  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${apiKey}`;
  
  try {
    const response = await makeRequest(searchUrl);
    return response.items || [];
  } catch (error) {
    console.log('YouTube API error:', error.message);
    return null;
  }
}

// Tool: AI Video Analyzer - Uses GPT to analyze video titles/descriptions
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

    const response = await makeRequest('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: body
    });

    const content = response?.choices?.[0]?.message?.content?.trim();
    return JSON.parse(content);
  } catch (error) {
    console.log('AI analysis error:', error.message);
    return null;
  }
}

// Tool: Query Parser - Uses AI to parse and understand search queries
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

    const response = await makeRequest('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: body
    });

    const content = response?.choices?.[0]?.message?.content?.trim();
    return JSON.parse(content);
  } catch (error) {
    console.log('Query parsing error:', error.message);
    return null;
  }
}

// Tool: Smart Search Strategy Generator
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

    const response = await makeRequest('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: body
    });

    const content = response?.choices?.[0]?.message?.content?.trim();
    return JSON.parse(content);
  } catch (error) {
    console.log('Strategy generation error:', error.message);
    return null;
  }
}

// Main AI Agent - Orchestrates all tools
async function youtubeSearchAgent(query) {
  console.log('🤖 YouTube Search Agent starting for:', query);
  
  const results = {
    query: query,
    success: false,
    videoId: null,
    confidence: 0,
    reasoning: '',
    toolsUsed: [],
    logs: []
  };

  try {
    // Step 1: Parse the query using AI
    results.logs.push('🧠 Parsing query with AI...');
    const parsedQuery = await parseSearchQuery(query);
    if (parsedQuery) {
      results.toolsUsed.push('query_parser');
      results.logs.push(`🎵 Parsed - Song: "${parsedQuery.song}", Artist: "${parsedQuery.artist}"`);
    } else {
      results.logs.push('❌ Query parsing failed, using original query');
    }

    const song = parsedQuery?.song || query.split(' ').slice(0, -2).join(' ');
    const artist = parsedQuery?.artist || query.split(' ').slice(-2).join(' ');

    // Step 2: Generate smart search strategy
    results.logs.push('🎯 Generating search strategy...');
    const strategy = await generateSearchStrategy(song, artist);
    if (strategy) {
      results.toolsUsed.push('search_strategy');
      results.logs.push(`📋 Strategy: ${strategy.strategy}`);
    }

    // Step 3: Search YouTube with multiple queries
    const searchQueries = strategy ? 
      [strategy.primarySearch, ...strategy.alternativeSearches] : 
      [`${song} ${artist} official`, `${song} ${artist}`, query];

    let bestVideo = null;
    let bestScore = 0;

    for (const searchQuery of searchQueries.slice(0, 3)) {
      results.logs.push(`🔍 Searching YouTube for: "${searchQuery}"`);
      const videos = await searchYouTube(searchQuery, 5);
      
      if (videos && videos.length > 0) {
        results.toolsUsed.push('youtube_search');
        results.logs.push(`📺 Found ${videos.length} videos`);

        // Step 4: Analyze each video with AI
        for (const video of videos) {
          results.logs.push(`🤖 Analyzing: "${video.snippet.title}"`);
          const analysis = await analyzeVideoWithAI(video, song, artist);
          
          if (analysis) {
            results.toolsUsed.push('ai_analyzer');
            const score = analysis.confidence * (analysis.isCorrect ? 1 : 0);
            
            results.logs.push(`📊 Analysis: ${analysis.isCorrect ? '✅' : '❌'} (${Math.round(analysis.confidence * 100)}%) - ${analysis.reasoning}`);
            
            if (score > bestScore && analysis.isCorrect) {
              bestVideo = video;
              bestScore = score;
              results.confidence = analysis.confidence;
              results.reasoning = analysis.reasoning;
            }
          }
        }
      }
    }

    // Step 5: Return best result
    if (bestVideo && bestScore > 0.7) {
      results.success = true;
      results.videoId = bestVideo.id.videoId;
      results.logs.push(`🎉 Selected video: "${bestVideo.snippet.title}" (${Math.round(bestScore * 100)}% confidence)`);
    } else {
      results.logs.push('🚫 No high-confidence match found');
      results.reasoning = 'AI agent could not find a verified match with sufficient confidence';
    }

  } catch (error) {
    results.logs.push(`❌ Agent error: ${error.message}`);
    results.reasoning = 'Technical error in AI agent processing';
  }

  console.log('🤖 Agent completed:', results);
  return results;
}

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Lambda handler
exports.handler = async (event) => {
  const { query } = event.queryStringParameters || {};
  
  if (!query) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'query parameter required' })
    };
  }

  try {
    const result = await youtubeSearchAgent(query);
    
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error', logs: [error.message] })
    };
  }
};
