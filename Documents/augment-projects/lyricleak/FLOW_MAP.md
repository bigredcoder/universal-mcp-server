# LyricLeak App Flow Map

## Current Flow (As-Is)

### 1. User Input
```
User types in search bar → Clicks search button
```

### 2. Frontend Processing (JavaScript)
```javascript
handleSearch() {
  // Parse user input
  parseQuery(inputText) → {song: "...", artist: "..."}
  
  // Make API call
  fetchSongMeaning(song, artist)
  
  // Update UI state
}
```

### 3. Backend API Endpoint
```
GET /api/meaning?song={song}&artist={artist}
```

### 4. Current Backend Logic
```javascript
if (!artist || !artist.trim()) {
  // Path A: No artist provided
  suggestArtistForSong(song) → Returns suggestion response
} else {
  // Path B: Artist provided  
  smartAgentResolve(song, artist) → Returns meaning
}
```

## Current AI Agents

### Agent 1: `suggestArtistForSong()`
- **Task**: Identify most famous artist for a song title
- **AI Model**: GPT-4
- **Instructions**: "You are a music expert. Identify the most famous artist and correct song title"
- **Returns**: `{artist, correctedSong, confidence}`

### Agent 2: `smartAgentResolve()`
- **Task**: Find story/meaning behind confirmed song
- **AI Model**: GPT-4  
- **Instructions**: "You are a music research agent. Find the story, meaning, or inspiration behind the song"
- **Tools Available**:
  - `songfacts_search`
  - `wikipedia_search` 
  - `genius_search`
  - `web_search`
  - `openai_knowledge`

## Problems with Current Flow

1. **Missing Input Analysis**: No validation of song/artist combinations
2. **Limited Edge Case Handling**: Doesn't handle vague inputs, lyrics, typos
3. **Hardcoded Fallbacks**: Emergency fallbacks violate "no hardcoding" rule
4. **Single-Purpose Agents**: Each agent only does one task

## Proposed New Flow

### 1. User Input (Same)
```
User types in search bar → Clicks search button
```

### 2. Frontend Processing (Keep as JavaScript)
```javascript
handleSearch() {
  parseQuery(inputText) → {song, artist}
  fetchSongMeaning(song, artist)
}
```

### 3. Backend API Endpoint (Enhanced)
```
GET /api/meaning?song={song}&artist={artist}
```

### 4. New Backend Logic
```javascript
// Step 1: Analyze input type
const inputType = await analyzeInputType(song, artist);

// Step 2: Route to appropriate handler
switch(inputType) {
  case 'VAGUE': return clarifyVagueInput(song);
  case 'LYRICS': return identifyFromLyrics(song);  
  case 'TYPOS': return correctSpellingAndSuggest(song);
  case 'SONG_NO_ARTIST': return suggestArtistForSong(song);
  case 'MULTIPLE_MATCHES': return disambiguateMultipleMatches(song);
  case 'CLEAR_SONG_AND_ARTIST': return researchSongMeaning(song, artist);
}
```

## Proposed AI Agents

### Agent 1: Input Analysis Agent
- **Task**: Classify user input type
- **Returns**: Input classification (VAGUE, LYRICS, TYPOS, etc.)

### Agent 2: Song Identification Agent  
- **Task**: Identify/verify/correct song and artist
- **Tools**: Spotify search, MusicBrainz lookup, etc.

### Agent 3: Song Research Agent
- **Task**: Find comprehensive story/meaning
- **Tools**: Multiple research sources + rich media tools

## Tools for AI Agents

### Identification Tools
- `spotify_search`: Search Spotify database
- `musicbrainz_lookup`: Canonical music data
- `genius_verify`: Verify song exists
- `discogs_search`: Discography database

### Research Tools  
- `songfacts_search`: Song stories/facts
- `wikipedia_search`: Artist/song info
- `genius_annotations`: Lyric meanings
- `allmusic_review`: Professional reviews

### Rich Media Tools
- `spotify_album_art`: High-quality artwork
- `youtube_official_video`: Find official videos
- `chart_history`: Billboard/chart data
- `similar_songs`: Recommendations

### Analysis Tools
- `lyric_analysis`: Deep lyrical themes
- `cultural_context`: Historical significance
- `cover_versions`: Famous interpretations

## Key Principles

✅ **No Hardcoding**: All song/artist data comes from fresh API calls
✅ **No Database Storage**: Each request is completely fresh  
✅ **AI Tool Selection**: Agents intelligently choose which tools to use
✅ **Edge Case Handling**: Smart agents handle unusual inputs
✅ **Extensible**: Easy to add new tools and capabilities

## Recent Changes (Fixed Suggestion System)

### New Backend Logic (Updated)
```javascript
if (!artist || !artist.trim()) {
  // Path A: No artist provided
  suggestArtistForSong(song) → Returns suggestion response
} else {
  // Path B: Artist provided - NOW VALIDATES FIRST
  validation = validateSongArtistCombination(song, artist)

  if (!validation.isValid) {
    // Return suggestion with corrections
    return suggestion response
  } else {
    // Proceed to meaning research
    smartAgentResolve(song, artist)
  }
}
```

### New AI Agent: `validateSongArtistCombination()`
- **Task**: Validate song/artist combinations and fix typos
- **AI Model**: GPT-4
- **Instructions**: "Check if the provided song and artist match correctly, fixing any typos or errors"
- **Returns**: `{isValid, correctedSong, correctedArtist, confidence, reason}`

### Examples Now Handled:
- ✅ `"Bohemain Rhapsodie - Quen"` → Suggests `"Bohemian Rhapsody" by Queen`
- ✅ `"Hurt - Nine Inch Nails"` → May suggest Johnny Cash version if more famous
- ✅ `"that sad song - Johnny Cash"` → Validates and corrects vague titles

## Status

- [x] Current basic flow working
- [x] Enhanced suggestion system (validates song/artist combinations)
- [x] Handles typos and corrections for both song and artist
- [ ] Input analysis agent for other edge cases
- [ ] Rich media tools integration
- [ ] Remove hardcoded fallbacks
- [ ] Comprehensive edge case handling
