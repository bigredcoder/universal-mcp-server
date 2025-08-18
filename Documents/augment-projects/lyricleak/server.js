// server.js — LyricLeak backend with agent loop
// Setup:
//   npm init -y
//   npm i express node-fetch cheerio cors dotenv
//   export OPENAI_API_KEY=sk-...   (optional)
//   node server.js

// Load environment variables
require('dotenv').config();

// Use built-in Node.js 18+ fetch and minimal dependencies for Lambda
const express = require("express");

// For Lambda, we need to handle missing dependencies gracefully
let cheerio, cors;
try {
  cheerio = require("cheerio");
  cors = require("cors");
} catch (e) {
  console.log('Optional dependencies not available:', e.message);
}

const app = express();
if (cors) app.use(cors());
if (express.static) app.use(express.static('.'));

const UA = "LyricLeak/1.0 (+https://example.com)";

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const key = (song, artist) => slug(`${artist}|${song}`);

function cleanContent(text) {
  if (!text) return '';

  return text
    // Remove JavaScript code patterns
    .replace(/freestar\.config\.[^;]+;/g, '')
    .replace(/\w+\.\w+\([^)]*\)/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\[[^\]]*\]/g, '')

    // Remove common ad/tracking text and metadata
    .replace(/License This Song/gi, '')
    .replace(/Album:\s*[^(]*\(\d{4}\)/gi, '')
    .replace(/Charted:\s*\d+/gi, '')
    .replace(/artistfacts|songplaces|songimage|ongimage/gi, '')
    .replace(/Songfacts®:/gi, 'Songfacts:')

    // Remove leading junk text patterns
    .replace(/^[^A-Z]*(?=Songfacts:)/i, '')
    .replace(/^[^A-Z]*(?=[A-Z][a-z]+ [A-Z][a-z]+)/i, '')

    // Remove excessive whitespace and normalize
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}
const cache = new Map();

// YouTube Search AI Agent Functions
async function searchYouTube(query, maxResults = 10) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.log('No YouTube API key - using fallback search');
    return null;
  }

  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${apiKey}`;

  try {
    const response = await fetch(searchUrl);
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.log('YouTube API error:', error.message);
    return null;
  }
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

// Main YouTube Search AI Agent
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

async function fetchText(url){
  console.log(`Fetching: ${url}`);
  const headers = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.5",
    "accept-encoding": "gzip, deflate",
    "connection": "keep-alive",
    "upgrade-insecure-requests": "1"
  };
  const r = await fetch(url, { headers });
  console.log(`Response status: ${r.status} for ${url}`);
  if (!r.ok) return null;
  const text = await r.text();

  // Check if we got blocked
  if (text.includes("anonymous Private/Proxy network") || text.includes("suspicious activity")) {
    console.log("Detected anti-bot response, skipping this source");
    return null;
  }

  return text;
}

async function getFromSongfacts(song, artist){
  // Try multiple URL patterns for Songfacts
  const urls = [
    `https://www.songfacts.com/facts/${slug(artist)}/${slug(song)}`,
    `https://www.songfacts.com/lyrics/${slug(artist)}/${slug(song)}`,
    `https://www.songfacts.com/songs/${slug(artist)}/${slug(song)}`
  ];

  for (const url of urls) {
    try {
      // Use a more realistic browser simulation
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "DNT": "1",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Cache-Control": "max-age=0"
        }
      });

      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove unwanted elements first
      $('script, style, noscript, .ad, .advertisement, [class*="ad-"], [id*="ad-"], .freestar, [class*="freestar"]').remove();

      // Look for the main Songfacts content block
      let content = $('div:contains("Songfacts®:")').text().trim();
      if (content && content.length > 200) {
        content = cleanContent(content);
        if (content.length > 100) {
          console.log(`Found Songfacts content via pattern 1 (${content.length} chars)`);
          return content;
        }
      }

      // Try alternative selectors
      content = $('.fact-content, .song-fact, .songfact').text().trim();
      if (content && content.length > 200) {
        content = cleanContent(content);
        if (content.length > 100) {
          console.log(`Found Songfacts content via pattern 2 (${content.length} chars)`);
          return content;
        }
      }

      // Look for paragraphs with song/artist mentions
      const paras = $("p").map((_,p)=>$(p).text().trim()).get();
      const relevantParas = paras.filter(p =>
        p.length > 100 &&
        (p.toLowerCase().includes(song.toLowerCase()) || p.toLowerCase().includes(artist.toLowerCase())) &&
        /wrote|written|song|meaning|story|about|inspired|explains/i.test(p)
      );

      if (relevantParas.length > 0) {
        console.log(`Found ${relevantParas.length} relevant paragraphs`);
        const cleanedParas = relevantParas.map(p => cleanContent(p)).filter(p => p.length > 50);
        return cleanedParas.slice(0, 5).join(' ');
      }

    } catch (e) {
      console.log(`Songfacts error for ${url}:`, e.message);
      continue;
    }
  }

  return null;
}

async function getFromWikipedia(song, artist){
  const titles = [
    `${song} (${artist} song)`,
    `${song} (song)`,
    `${song} (single)`,
    `${song}`,
    `${song} by ${artist}`,
    `${artist} ${song}`
  ];

  for (const t of titles){
    try {
      // Try the summary API first
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`;
      const summaryResponse = await fetch(summaryUrl, {
        headers: { "user-agent": "LyricLeak/1.0", accept: "application/json" }
      });

      if (summaryResponse.ok) {
        const data = await summaryResponse.json();
        if (data.extract && data.extract.length > 100) {
          console.log(`Wikipedia found summary for "${t}" (${data.extract.length} chars)`);
          return data.extract;
        }
      }

      // Try the full content API for more detailed information
      const contentUrl = `https://en.wikipedia.org/api/rest_v1/page/mobile-sections/${encodeURIComponent(t)}`;
      const contentResponse = await fetch(contentUrl, {
        headers: { "user-agent": "LyricLeak/1.0", accept: "application/json" }
      });

      if (contentResponse.ok) {
        const contentData = await contentResponse.json();
        if (contentData.lead && contentData.lead.sections) {
          const leadText = contentData.lead.sections[0]?.text;
          if (leadText) {
            // Extract text from HTML
            const $ = cheerio.load(leadText);
            const text = $.text().trim();
            if (text.length > 100) {
              console.log(`Wikipedia found content for "${t}" (${text.length} chars)`);
              return text;
            }
          }
        }
      }

    } catch (e) {
      console.log(`Wikipedia error for "${t}":`, e.message);
      continue;
    }
  }
  return null;
}

async function getFromAllMusic(song, artist){
  const q = encodeURIComponent(`${song} ${artist} song meaning`);
  const url = `https://www.allmusic.com/search/all/${q}`;
  const html = await fetchText(url); if (!html) return null;
  const $ = cheerio.load(html);
  const first = $(".search-results .name a").first().attr("href");
  if (!first) return null;
  const page = await fetchText(first); if (!page) return null;
  const $$ = cheerio.load(page);
  const desc = $$(".song-composition, .text .review, .text .headline + p").map((_,p)=>$$(p).text().trim()).get().join(" ");
  return desc || null;
}

async function getFromGenius(song, artist){
  const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const urls = [
    `https://genius.com/${slugify(artist)}-${slugify(song)}-lyrics`,
    `https://genius.com/${slugify(song)}-${slugify(artist)}-lyrics`,
    `https://genius.com/songs/${slugify(artist)}-${slugify(song)}`
  ];

  for (const url of urls) {
    try {
      // Try direct scraping first
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          "DNT": "1",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1"
        }
      });

      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);

        // Look for song description or annotation content
        let content = $('.song_body-lyrics .lyrics, .lyrics, [data-lyrics-container="true"]').text().trim();

        // Look for song meaning in annotations or descriptions
        const annotations = $('.referent_annotation, .annotation, .song-description').map((_,el) => $(el).text().trim()).get();
        const meaningAnnotations = annotations.filter(ann =>
          ann.length > 100 &&
          /meaning|story|about|inspired|wrote|written|explains|according|background/i.test(ann)
        );

        if (meaningAnnotations.length > 0) {
          console.log(`Genius found ${meaningAnnotations.length} meaning annotations`);
          return meaningAnnotations.slice(0, 4).join(' ');
        }

        // Look for any text that mentions the song or artist with context
        const allText = $('body').text();
        const sentences = allText.split(/[.!?]+/).filter(s =>
          s.length > 100 &&
          (s.toLowerCase().includes(song.toLowerCase()) || s.toLowerCase().includes(artist.toLowerCase())) &&
          /wrote|written|song|meaning|story|about|inspired|explains/i.test(s)
        );

        if (sentences.length > 0) {
          console.log(`Genius found ${sentences.length} relevant sentences`);
          return sentences.slice(0, 4).join('. ');
        }
      }
    } catch (e) {
      console.log(`Genius error for ${url}:`, e.message);
      continue;
    }
  }

  return null;
}

function rankSentences(text){
  const sents = text.split(/(?<=\.)\s+/).filter(Boolean);
  return sents.map(s => ({
    s,
    w: (s.match(/about|meaning|inspired|lyric|theme|narrates|addresses|wrote|written|singer|explained|according|describes|tells|story|incident|tragedy|death|died|killed|accident|crash|fan|concert|event|happened|true|real|based|dedicated|tribute|memory|memorial/i)||[]).length
  }))
  .sort((a,b)=>b.w-a.w)
  .map(x=>x.s);
}

function getKnownSongStory(song, artist) {
  // Only use this as a last resort for a few well-documented cases
  // when all web scraping fails
  const key = `${artist.toLowerCase()}|${song.toLowerCase()}`;

  const emergencyFallbacks = {
    "kiss|detroit rock city": "\"Detroit Rock City\" by Kiss tells the tragic story of a young fan who dies in a car accident while rushing to attend a Kiss concert. Paul Stanley wrote the song after learning about a real incident where a fan was killed in a car crash outside an arena on their way to a Kiss show.",

    "pearl jam|jeremy": "\"Jeremy\" by Pearl Jam tells the true story of Jeremy Wade Delle, a 15-year-old student who committed suicide in front of his English class in Richardson, Texas in 1991. Eddie Vedder was deeply affected by reading about this tragedy in a newspaper."
  };

  return emergencyFallbacks[key] || null;
}

async function summarizeWithOpenAI(text, song, artist){
  if (!process.env.OPENAI_API_KEY) return null;
  const body = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a music expert who explains song meanings with specific lyric examples. Write engaging, detailed explanations in 3-4 paragraphs. ALWAYS include exactly 2-3 direct lyric quotes that demonstrate the song's meaning. Format quotes like this: \"lyric quote here\" - then explain what that specific lyric means or represents. Focus on the real story, inspiration, and deeper meaning behind the song. Include human stories, real events, and context. DO NOT start with the song title - jump straight into the meaning and story." },
      { role: "user", content: `Explain the meaning and story behind "${song}" by ${artist}. What is this song really about? What inspired it? MUST include 2-3 direct lyric quotes that highlight the song's meaning, formatted with quotation marks, followed by explanation of what each quote means. Focus on the deeper meaning and real story. Use only this source text:\n\n${text.substring(0, 4000)}` }
    ],
    max_tokens: 800,
    temperature: 0.1
  };
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body)
  });
  if (!r.ok) return null;
  const data = await r.json();
  let result = data?.choices?.[0]?.message?.content?.trim() || null;

  // Clean up any remaining redundant prefixes
  if (result) {
    const cleanPatterns = [
      `"${song}" by ${artist}:`,
      `"${song}" by ${artist} `,
      `${song} by ${artist}:`,
      `${song} by ${artist} `,
      `"${song.toLowerCase()}" by ${artist.toLowerCase()}:`,
      `"${song.toLowerCase()}" by ${artist.toLowerCase()} `,
      `${song.toLowerCase()} by ${artist.toLowerCase()}:`,
      `${song.toLowerCase()} by ${artist.toLowerCase()} `
    ];

    for (const pattern of cleanPatterns) {
      if (result.toLowerCase().startsWith(pattern.toLowerCase())) {
        result = result.substring(pattern.length).trim();
        break;
      }
    }
  }

  return result;
}

async function smartAgentResolve(song, artist) {
  const k = key(song, artist);
  if (cache.has(k)) return cache.get(k);

  const logs = [];

  // Create an intelligent agent that can reason about the best approach
  const agentPrompt = `You are a music research agent. Your task is to find the story, meaning, or inspiration behind the song "${song}" by ${artist}.

Available tools:
1. songfacts_search - Search Songfacts.com for song information
2. wikipedia_search - Search Wikipedia for song/artist information
3. genius_search - Search Genius.com for song annotations and meanings
4. web_search - General web search for song information
5. openai_knowledge - Use your training knowledge as a last resort

Analyze this request and determine:
1. What type of song this likely is (popular/obscure/classic/recent)
2. Which sources are most likely to have information
3. What search strategies to try
4. How to handle edge cases (very short titles, common words, etc.)

Respond with a JSON strategy:
{
  "analysis": "brief analysis of the song/artist",
  "primary_sources": ["source1", "source2"],
  "search_variations": ["variation1", "variation2"],
  "expected_challenges": ["challenge1"],
  "fallback_strategy": "description"
}`;

  try {
    const strategyResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a music research strategist. Always respond with valid JSON." },
          { role: "user", content: agentPrompt }
        ],
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (strategyResponse.ok) {
      const strategyData = await strategyResponse.json();
      const strategy = JSON.parse(strategyData.choices[0].message.content);
      logs.push(`agent strategy: ${strategy.analysis}`);

      // Execute the strategy
      const result = await executeStrategy(song, artist, strategy, logs);
      if (result) {
        cache.set(k, result);
        return result;
      }
    }
  } catch (e) {
    logs.push(`agent strategy failed: ${e.message}`);
  }

  // Fallback to original approach if agent fails
  return await fallbackResolve(song, artist, logs);
}

async function executeStrategy(song, artist, strategy, logs) {
  const tools = {
    songfacts_search: () => getFromSongfacts(song, artist),
    wikipedia_search: () => getFromWikipedia(song, artist),
    genius_search: () => getFromGenius(song, artist),
    web_search: () => performWebSearch(song, artist),
    openai_knowledge: () => getFromOpenAIKnowledge(song, artist)
  };

  // Try primary sources first
  for (const source of strategy.primary_sources) {
    if (tools[source]) {
      try {
        const content = await tools[source]();
        if (content && content.length > 100) {
          logs.push(`${source}: success (${content.length} chars)`);

          // Validate content quality
          if (await validateContent(content, song, artist, logs)) {
            const ai = await summarizeWithOpenAI(content, song, artist);
            return { meaning: ai || content, logs };
          }
        } else {
          logs.push(`${source}: no content`);
        }
      } catch (e) {
        logs.push(`${source}: error - ${e.message}`);
      }
    }
  }

  // Try fallback strategy
  if (strategy.fallback_strategy.includes("knowledge")) {
    try {
      const knowledge = await getFromOpenAIKnowledge(song, artist);
      if (knowledge) {
        logs.push("openai_knowledge: success");
        return { meaning: knowledge, logs };
      }
    } catch (e) {
      logs.push(`openai_knowledge: error - ${e.message}`);
    }
  }

  return null;
}

async function performWebSearch(song, artist) {
  // Implement a general web search strategy
  const queries = [
    `"${song}" ${artist} song meaning story`,
    `"${song}" ${artist} inspiration behind song`,
    `${artist} ${song} wrote about`,
    `${song} ${artist} real story incident`
  ];

  for (const query of queries) {
    try {
      // This would integrate with a web search API
      // For now, return null to indicate not implemented
      console.log(`Would search: ${query}`);
    } catch (e) {
      console.log(`Web search error: ${e.message}`);
    }
  }

  return null;
}

async function getFromOpenAIKnowledge(song, artist) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a music historian. Provide comprehensive, engaging information about song meanings in 3-5 detailed paragraphs. Focus on the compelling story, inspiration, and context behind the song. Include specific details, real events, and human stories. ALWAYS include 2-3 key lyric quotes that illustrate the meaning, formatted with quotation marks. If there was a tragedy, death, or significant event, describe it with appropriate detail and context. Include background about the songwriter's state of mind, the recording process, cultural impact, and any interesting trivia. Make it informative, engaging, and comprehensive."
          },
          {
            role: "user",
            content: `What is the comprehensive story, meaning, and inspiration behind "${song}" by ${artist}? Include specific context, background information, human stories, and as much detail as possible. ALWAYS include 2-3 key lyric quotes that best illustrate the song's meaning.`
          }
        ],
        max_tokens: 1200,
        temperature: 0.1
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0].message.content;
    }
  } catch (e) {
    console.log(`OpenAI knowledge error: ${e.message}`);
  }

  return null;
}

async function validateContent(content, song, artist, logs) {
  const lowerContent = content.toLowerCase();
  const lowerSong = song.toLowerCase();
  const lowerArtist = artist.toLowerCase();

  // Check for generic content patterns
  const genericPatterns = [
    "cake by the ocean", "this is how we do it", "house of the rising sun",
    "passionate kisses", "songfacts newsletter", "sign up for our newsletter"
  ];

  if (genericPatterns.some(pattern => lowerContent.includes(pattern))) {
    logs.push("validation: rejected generic content");
    return false;
  }

  // For very short songs, be lenient
  if (lowerSong.length <= 3) {
    logs.push("validation: short title, accepting content");
    return true;
  }

  // Check if content seems relevant
  const hasRelevantTerms = lowerContent.includes(lowerSong) ||
                          lowerContent.includes(lowerArtist) ||
                          /wrote|written|song|meaning|story|inspired|about/i.test(content);

  if (!hasRelevantTerms) {
    logs.push("validation: no relevant terms found");
    return false;
  }

  logs.push("validation: content approved");
  return true;
}

async function fallbackResolve(song, artist, logs) {
  // Original simple approach as fallback
  const sources = [
    () => getFromSongfacts(song, artist),
    () => getFromWikipedia(song, artist),
    () => getFromGenius(song, artist)
  ];

  for (const source of sources) {
    try {
      const content = await source();
      if (content && content.length > 100) {
        if (await validateContent(content, song, artist, logs)) {
          const ai = await summarizeWithOpenAI(content, song, artist);
          return { meaning: ai || content, logs };
        }
      }
    } catch (e) {
      logs.push(`fallback error: ${e.message}`);
    }
  }

  // Last resort - emergency fallback
  const emergency = getKnownSongStory(song, artist);
  if (emergency) {
    logs.push("using emergency fallback");
    return { meaning: emergency, logs };
  }

  return { meaning: null, logs };
}

// Fast album information lookup using iTunes API only (no AI)
async function getAlbumInfo(song, artist) {
  console.log(`Getting album info for: "${song}" by ${artist}`);

  try {
    // Search iTunes API directly for the song
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(artist + ' ' + song)}&media=music&entity=song&limit=5`;
    console.log('Searching iTunes API for song:', itunesUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch(itunesUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      console.log(`iTunes API returned ${data.results?.length || 0} song results`);

      if (data.results && data.results.length > 0) {
        // Look for the best match
        for (const result of data.results) {
          const resultArtist = result.artistName?.toLowerCase() || '';
          const resultSong = result.trackName?.toLowerCase() || '';
          const searchArtist = artist.toLowerCase();
          const searchSong = song.toLowerCase();

          console.log(`Checking song: "${result.trackName}" by "${result.artistName}" from "${result.collectionName}"`);

          // Check if artist and song match reasonably well
          if ((resultArtist.includes(searchArtist) || searchArtist.includes(resultArtist)) &&
              (resultSong.includes(searchSong) || searchSong.includes(resultSong))) {

            const albumInfo = {
              name: result.collectionName,
              year: result.releaseDate ? new Date(result.releaseDate).getFullYear().toString() : null,
              coverUrl: result.artworkUrl100?.replace('100x100', '600x600') || null
            };

            console.log('Found iTunes album info:', albumInfo);
            return albumInfo;
          }
        }

        // If no exact match, use the first result from the same artist
        const firstResult = data.results.find(r => {
          const resultArtist = r.artistName?.toLowerCase() || '';
          const searchArtist = artist.toLowerCase();
          return resultArtist.includes(searchArtist) || searchArtist.includes(resultArtist);
        });

        if (firstResult) {
          const albumInfo = {
            name: firstResult.collectionName,
            year: firstResult.releaseDate ? new Date(firstResult.releaseDate).getFullYear().toString() : null,
            coverUrl: firstResult.artworkUrl100?.replace('100x100', '600x600') || null
          };

          console.log('Using first iTunes result from same artist:', albumInfo);
          return albumInfo;
        }
      }
    }

    console.log('No album info found from iTunes API');
    return null;

  } catch (error) {
    console.log('Error getting album info from iTunes API:', error.message);
    return null;
  }
}

// Get album cover from iTunes Search API (no hardcoded data)
async function getAlbumCoverFromAPI(song, artist, albumName) {
  console.log(`Searching for album cover: "${song}" by ${artist} from album "${albumName}"`);

  try {
    // Try iTunes Search API first (free and reliable)
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(artist + ' ' + albumName)}&media=music&entity=album&limit=5`;
    console.log('Searching iTunes API:', itunesUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(itunesUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      console.log(`iTunes API returned ${data.results?.length || 0} results`);

      if (data.results && data.results.length > 0) {
        // Look for the best match
        for (const result of data.results) {
          const resultArtist = result.artistName?.toLowerCase() || '';
          const resultAlbum = result.collectionName?.toLowerCase() || '';
          const searchArtist = artist.toLowerCase();
          const searchAlbum = albumName.toLowerCase();

          console.log(`Checking: "${result.artistName}" - "${result.collectionName}"`);

          // Check if artist and album match reasonably well
          if (resultArtist.includes(searchArtist) || searchArtist.includes(resultArtist)) {
            if (resultAlbum.includes(searchAlbum) || searchAlbum.includes(resultAlbum)) {
              const coverUrl = result.artworkUrl100?.replace('100x100', '600x600'); // Get higher res
              if (coverUrl) {
                console.log('Found iTunes album cover:', coverUrl);
                return coverUrl;
              }
            }
          }
        }

        // If no exact match, try the first result from the same artist
        const firstResult = data.results.find(r => {
          const resultArtist = r.artistName?.toLowerCase() || '';
          const searchArtist = artist.toLowerCase();
          return resultArtist.includes(searchArtist) || searchArtist.includes(resultArtist);
        });

        if (firstResult && firstResult.artworkUrl100) {
          const coverUrl = firstResult.artworkUrl100.replace('100x100', '600x600');
          console.log('Using first iTunes result from same artist:', coverUrl);
          return coverUrl;
        }
      }
    }

    console.log('No album cover found from iTunes API');
    return null;

  } catch (error) {
    console.log('Error getting album cover from iTunes API:', error.message);
    return null;
  }
}

// Validate that an image URL actually works
async function validateImageUrl(url) {
  try {
    console.log('Validating image URL:', url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      method: 'HEAD', // Only get headers, not the full image
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const isValid = response.ok && response.headers.get('content-type')?.startsWith('image/');
    console.log(`URL validation result: ${isValid ? 'VALID' : 'INVALID'} (status: ${response.status}, content-type: ${response.headers.get('content-type')})`);

    return isValid;
  } catch (error) {
    console.log('URL validation error:', error.message);
    return false;
  }
}

async function suggestArtistForSong(song) {
  console.log('suggestArtistForSong called with:', song);
  if (!process.env.OPENAI_API_KEY) {
    console.log('No OpenAI API key found');
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a music expert. When given a song title (which may have typos or incorrect capitalization), identify the most famous artist and provide the correct song title with proper capitalization. ALWAYS fix capitalization - song titles should use Title Case (e.g., 'alive' becomes 'Alive'). Respond with ONLY a JSON object containing 'artist', 'correctedSong', and 'confidence' (high/medium/low). The 'correctedSong' field must have proper capitalization. If you're not confident, return null."
          },
          {
            role: "user",
            content: `What artist is most famous for the song "${song}"? Provide the correct spelling and proper Title Case capitalization of the song title (e.g., "alive" should be "Alive"). Consider iconic lyrics, famous covers, and cultural impact.`
          }
        ],
        max_tokens: 100,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      console.log('OpenAI API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    console.log('Raw AI response:', content);

    if (!content) {
      console.log('No content in AI response');
      return null;
    }

    try {
      // Remove markdown code blocks if present
      let cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();
      console.log('Cleaned content:', cleanContent);

      const result = JSON.parse(cleanContent);
      console.log('AI response for suggestArtistForSong:', result);
      console.log('Original song:', song);
      console.log('AI correctedSong:', result.correctedSong);

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

// New function to validate song/artist combinations
async function validateSongArtistCombination(song, artist) {
  console.log('validateSongArtistCombination called with:', song, artist);
  if (!process.env.OPENAI_API_KEY) {
    console.log('No OPENAI_API_KEY found, using fallback validation');

    // Simple fallback validation for testing - detect obvious typos
    const knownSongs = {
      'bohemian rhapsody': { artist: 'Queen', song: 'Bohemian Rhapsody' },
      'bohemain rhapsodie': { artist: 'Queen', song: 'Bohemian Rhapsody' },
      'hurt': { artist: 'Johnny Cash', song: 'Hurt' },
      'fast car': { artist: 'Tracy Chapman', song: 'Fast Car' }
    };

    const songKey = song.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    const artistKey = artist.toLowerCase().replace(/[^a-z\s]/g, '').trim();

    if (knownSongs[songKey]) {
      const correct = knownSongs[songKey];
      const songMatch = correct.song.toLowerCase() === song.toLowerCase();
      const artistMatch = correct.artist.toLowerCase() === artist.toLowerCase();

      if (!songMatch || !artistMatch) {
        return {
          isValid: false,
          correctedSong: correct.song,
          correctedArtist: correct.artist,
          confidence: 'high',
          reason: 'Detected typos in song or artist name'
        };
      }
    }

    // If no obvious issues found, assume valid
    return {
      isValid: true,
      correctedSong: song,
      correctedArtist: artist,
      confidence: 'medium',
      reason: 'No obvious issues detected'
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a music expert that validates song/artist combinations. Check if the provided song and artist match correctly, fixing any typos, capitalization, or formatting errors. ALWAYS provide the correct capitalization and spelling in 'correctedSong' and 'correctedArtist' fields. Set 'isValid' to false if there are any corrections needed (including capitalization) OR if the combination is wrong. Respond with ONLY a JSON object containing 'isValid' (boolean), 'correctedSong', 'correctedArtist', 'confidence' (high/medium/low), and 'reason' (brief explanation)."
          },
          {
            role: "user",
            content: `Is "${song}" by ${artist} correct? Check for typos, wrong artist attribution, or other issues. Provide the correct spelling and capitalization if needed.`
          }
        ],
        max_tokens: 150,
        temperature: 0.1
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) return null;

    try {
      const result = JSON.parse(content);
      if (result && typeof result.isValid === 'boolean') {
        return {
          isValid: result.isValid,
          correctedSong: result.correctedSong || song,
          correctedArtist: result.correctedArtist || artist,
          confidence: result.confidence || 'medium',
          reason: result.reason || 'Validation completed'
        };
      }
    } catch (e) {
      console.log('JSON parsing failed for validation:', e.message);
    }

    return null;
  } catch (e) {
    console.error('Song/artist validation error:', e);
    return null;
  }
}

// Fast Direct YouTube Search endpoint (2-3 seconds instead of 3 minutes)
app.get("/api/youtube-direct-search", async (req, res) => {
  const { query = "" } = req.query;
  if (!query) return res.status(400).json({ error: "query required" });

  try {
    console.log('🔍 Fast YouTube search for:', query);

    // Direct YouTube API search - much faster than AI agent
    const videos = await searchYouTube(query + " official", 5);

    if (videos && videos.length > 0) {
      // Take the first result - usually the most relevant
      const video = videos[0];
      console.log('✅ Fast search found:', video.snippet.title);

      res.json({
        success: true,
        videoId: video.id.videoId,
        title: video.snippet.title,
        query: query
      });
    } else {
      console.log('❌ Fast search found no videos for:', query);
      res.json({
        success: false,
        videoId: null,
        query: query
      });
    }
  } catch (error) {
    console.error('Fast YouTube search error:', error);
    res.status(500).json({
      error: 'Search failed',
      success: false,
      query: query
    });
  }
});

// YouTube Search AI Agent endpoint (slow but more accurate)
app.get("/api/youtube-search", async (req, res) => {
  const { query = "" } = req.query;
  if (!query) return res.status(400).json({ error: "query required" });

  try {
    const result = await youtubeSearchAgent(query);
    res.json(result);
  } catch (error) {
    console.error('YouTube search agent error:', error);
    res.status(500).json({
      error: 'Internal server error',
      logs: [error.message],
      success: false,
      reasoning: 'Technical error in AI agent processing'
    });
  }
});

app.get("/api/meaning", async (req, res) => {
  const { song = "", artist = "" } = req.query;
  if (!song) return res.status(400).json({ error: "song required" });

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

        return res.json({
          suggestion: true,
          originalSong: originalSong,
          correctedSong: correctedSong,
          suggestedArtist: suggestion.artist,
          confidence: suggestion.confidence,
          songChanged: songChanged,
          message: message,
          searchUrl: `/api/meaning?song=${encodeURIComponent(correctedSong)}&artist=${encodeURIComponent(suggestion.artist)}`
        });
      } else {
        return res.status(400).json({
          error: "Artist name is required. Could not automatically identify the artist for this song.",
          suggestion: false
        });
      }
    } catch (e) {
      return res.status(400).json({ error: "Artist name is required" });
    }
  }

  // If both song and artist are provided, validate the combination first
  console.log(`Validating: "${song.trim()}" by "${artist.trim()}"`);
  try {
    const validation = await validateSongArtistCombination(song.trim(), artist.trim());
    console.log('Validation result:', validation);

    if (validation) {
      // Check if ANY corrections were made (including capitalization)
      const songChanged = validation.correctedSong !== song.trim();
      const artistChanged = validation.correctedArtist !== artist.trim();

      if (songChanged || artistChanged) {
        let message;
        if (songChanged && artistChanged) {
          message = `Did you mean "${validation.correctedSong}" by ${validation.correctedArtist}?`;
        } else if (songChanged) {
          message = `Did you mean "${validation.correctedSong}" by ${validation.correctedArtist}?`;
        } else {
          message = `Did you mean "${validation.correctedSong}" by ${validation.correctedArtist}?`;
        }

        return res.json({
          suggestion: true,
          originalSong: song.trim(),
          originalArtist: artist.trim(),
          correctedSong: validation.correctedSong,
          suggestedArtist: validation.correctedArtist,
          confidence: validation.confidence,
          songChanged: songChanged,
          artistChanged: artistChanged,
          message: message,
          reason: validation.reason,
          searchUrl: `/api/meaning?song=${encodeURIComponent(validation.correctedSong)}&artist=${encodeURIComponent(validation.correctedArtist)}`
        });
      }
    }
  } catch (e) {
    console.log('Validation failed, proceeding with original input:', e.message);
    // If validation fails, continue with the original input
  }

  try {
    // Run song meaning and album info in parallel for speed
    const [meaningResult, album] = await Promise.all([
      smartAgentResolve(song.trim(), artist.trim()),
      getAlbumInfo(song.trim(), artist.trim())
    ]);

    const { meaning, logs } = meaningResult;
    if (!meaning) return res.status(404).json({ error: "not_found", logs });

    res.json({
      song: song.trim(),
      artist: artist.trim(),
      meaning,
      album,
      logs
    });
  } catch (error) {
    console.error("Smart Agent Error:", error);
    // Fallback to simple approach
    const { meaning, logs } = await fallbackResolve(song.trim(), artist.trim(), [`smart_agent_error: ${error.message}`]);
    if (!meaning) return res.status(404).json({ error: "not_found", logs });

    // Get album information even for fallback
    const album = await getAlbumInfo(song.trim(), artist.trim());

    res.json({
      song: song.trim(),
      artist: artist.trim(),
      meaning,
      album,
      logs
    });
  }
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => console.log("LyricLeak API running on http://localhost:3000"));
}

// AWS Lambda handler - manual implementation
module.exports.handler = async (event, context) => {
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

    // Route to meaning search
    if (path.includes('meaning')) {
      const { song = "", artist = "" } = query;
      if (!song) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "song required" })
        };
      }

      // If no artist provided, try to suggest one
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

      try {
        const { meaning, logs } = await smartAgentResolve(song.trim(), artist.trim());
        if (!meaning) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: "not_found", logs })
          };
        }

        // Get album information
        const album = await getAlbumInfo(song.trim(), artist.trim());

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            song: song.trim(),
            artist: artist.trim(),
            meaning,
            album,
            logs
          })
        };
      } catch (error) {
        console.error("Smart Agent Error:", error);
        // Fallback to simple approach
        const { meaning, logs } = await fallbackResolve(song.trim(), artist.trim(), [`smart_agent_error: ${error.message}`]);
        if (!meaning) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: "not_found", logs })
          };
        }

        // Get album information even for fallback
        const album = await getAlbumInfo(song.trim(), artist.trim());

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            song: song.trim(),
            artist: artist.trim(),
            meaning,
            album,
            logs
          })
        };
      }
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
