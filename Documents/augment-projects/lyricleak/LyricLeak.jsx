import React, { useState, useEffect } from 'react';

// CSS Variables for theming
const cssVariables = `
:root {
  --primary: #ff6b4a;
  --primary-hover: #ff4757;
  --surface: rgba(255, 255, 255, 0.1);
  --surface-hover: rgba(255, 255, 255, 0.15);
  --text: #ffffff;
  --text-muted: rgba(255, 255, 255, 0.7);
  --background: linear-gradient(135deg, #2c3e50 0%, #3b4a5c 100%);
  --border: rgba(255, 255, 255, 0.2);
  --shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  --radius: 12px;
  --radius-lg: 20px;
}
`;

const LyricLeak = () => {
  const [song, setSong] = useState('');
  const [artist, setArtist] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [recentSearches, setRecentSearches] = useState([
    'Yesterday - Beatles',
    'Hotel California - Eagles',
    'Bohemian Rhapsody - Queen'
  ]);

  // Handle URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSong = urlParams.get('song');
    const urlArtist = urlParams.get('artist');
    
    if (urlSong) {
      setSong(urlSong);
      if (urlArtist) setArtist(urlArtist);
      setTimeout(() => handleSearch(), 500);
    }
  }, []);

  const fetchSongMeaning = async (songTitle, artistName) => {
    let url = `https://ur74xqz788.execute-api.us-east-1.amazonaws.com/prod/api/meaning?song=${encodeURIComponent(songTitle)}`;
    if (artistName) {
      url += `&artist=${encodeURIComponent(artistName)}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error("not_found");
    const data = await res.json();

    return data;
  };

  const handleSearch = async () => {
    if (!song.trim()) return;

    setIsLoading(true);
    setShowResult(true);
    
    // Analytics placeholder
    // analytics.track('search_submitted', { song, artist });

    try {
      const data = await fetchSongMeaning(song.trim(), artist.trim());
      
      if (data.suggestion) {
        setResult({
          type: 'suggestion',
          ...data
        });
      } else {
        setResult({
          type: 'meaning',
          song: data.song,
          artist: data.artist,
          meaning: data.meaning
        });
        
        // Add to recent searches
        const searchTerm = `${data.song} - ${data.artist}`;
        setRecentSearches(prev => [searchTerm, ...prev.filter(s => s !== searchTerm)].slice(0, 5));
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: 'Sorry, no songwriter meaning found. Try refining your search.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionAccept = (correctedSong, suggestedArtist) => {
    setSong(correctedSong);
    setArtist(suggestedArtist);
    setResult(null);
    setShowResult(false);
    setTimeout(() => handleSearch(), 100);
  };

  const shareResult = (songTitle, artistName, meaning) => {
    const shareUrl = `${window.location.origin}/?song=${encodeURIComponent(songTitle)}&artist=${encodeURIComponent(artistName)}`;
    
    if (navigator.share) {
      navigator.share({
        title: `${songTitle} by ${artistName} - Song Meaning`,
        text: meaning.substring(0, 200) + '...',
        url: shareUrl
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      // Could show a toast notification here
    }
  };

  const LoadingAnimation = () => (
    <div className="text-center py-12">
      <div className="relative mx-auto mb-6 w-16 h-16">
        {/* Spinning vinyl record */}
        <div className="absolute inset-0 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        <div className="absolute inset-2 bg-primary/20 rounded-full"></div>
        <div className="absolute inset-4 bg-primary/40 rounded-full"></div>
      </div>
      
      {/* Floating musical notes */}
      <div className="relative mb-4">
        <span className="text-2xl animate-bounce" style={{animationDelay: '0s'}}>♪</span>
        <span className="text-xl animate-bounce mx-2" style={{animationDelay: '0.2s'}}>♫</span>
        <span className="text-2xl animate-bounce" style={{animationDelay: '0.4s'}}>♪</span>
      </div>
      
      <p className="text-lg text-text-muted mb-3">Leaking the story behind the lyrics...</p>
      
      {/* Animated dots */}
      <div className="flex justify-center gap-2">
        {[0, 1, 2].map(i => (
          <div 
            key={i}
            className="w-2 h-2 bg-primary rounded-full animate-pulse"
            style={{animationDelay: `${i * 0.2}s`}}
          ></div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVariables }} />
      
      <div className="min-h-screen text-white" style={{background: 'var(--background)'}}>
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-border" 
                style={{background: 'rgba(44, 62, 80, 0.95)'}}>
          <div className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
            <a href="/" className="flex items-center gap-3 text-2xl font-bold text-white no-underline">
              {/* Logo Icon */}
              <div className="w-10 h-10 rounded-lg flex items-center justify-center relative flex-shrink-0"
                   style={{background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))'}}>
                <div className="absolute top-2 w-3 h-3 bg-white rounded-full"></div>
                <div className="absolute bottom-1.5 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white"></div>
              </div>
              lyricleak
            </a>
            
            <nav className="hidden md:flex items-center gap-6">
              <a href="#" className="text-text-muted hover:text-white transition-colors">About</a>
              <a href="#" className="text-text-muted hover:text-white transition-colors">Blog</a>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="pt-20">
          {/* Hero Section */}
          <section className="text-center py-20 px-6">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-8"
                  style={{background: 'linear-gradient(135deg, var(--primary), #ff8a80)', 
                         WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
                Unravel the stories<br />behind the lyrics you love.
              </h1>
              
              <p className="text-xl md:text-2xl text-text-muted mb-12 leading-relaxed">
                Dive deeper into your favorite songs with LyricLeak, revealing the captivating 
                stories and meaning behind their lyrics through the power of AI
              </p>

              {/* Search Container */}
              <div className="max-w-2xl mx-auto p-8 rounded-3xl border border-border backdrop-blur-xl"
                   style={{background: 'var(--surface)', boxShadow: 'var(--shadow)'}}>
                
                {/* Recent Searches */}
                {!showResult && (
                  <div className="mb-6">
                    <p className="text-sm text-text-muted mb-3">Recent searches:</p>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((search, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            const [songPart, artistPart] = search.split(' - ');
                            setSong(songPart);
                            setArtist(artistPart);
                          }}
                          className="px-3 py-1 text-xs rounded-full border border-border hover:border-primary/50 transition-colors"
                          style={{background: 'rgba(255, 255, 255, 0.05)'}}
                        >
                          {search}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search Form */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="song-input" className="block text-sm font-medium mb-2 text-left">
                      Song Title
                    </label>
                    <input
                      id="song-input"
                      type="text"
                      value={song}
                      onChange={(e) => setSong(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSearch()}
                      placeholder="Enter song title..."
                      className="w-full px-5 py-4 rounded-xl border-2 border-border focus:border-primary focus:outline-none transition-all text-white text-lg"
                      style={{background: 'rgba(255, 255, 255, 0.1)'}}
                      autoComplete="off"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="artist-input" className="block text-sm font-medium mb-2 text-left">
                      Artist (optional)
                    </label>
                    <input
                      id="artist-input"
                      type="text"
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSearch()}
                      placeholder="Enter artist name..."
                      className="w-full px-5 py-4 rounded-xl border-2 border-border focus:border-primary focus:outline-none transition-all text-white text-lg"
                      style={{background: 'rgba(255, 255, 255, 0.1)'}}
                      autoComplete="off"
                    />
                  </div>
                  
                  <button
                    onClick={handleSearch}
                    disabled={!song.trim() || isLoading}
                    className="w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:transform hover:-translate-y-1"
                    style={{
                      background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                      boxShadow: isLoading ? 'none' : '0 10px 25px rgba(255, 107, 74, 0.4)'
                    }}
                  >
                    {isLoading ? 'Searching...' : 'Find Song Meaning'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Results Section */}
          {showResult && (
            <section className="px-6 pb-20">
              <div className="max-w-4xl mx-auto">
                <div className="p-8 rounded-3xl border border-border backdrop-blur-xl transition-all duration-500"
                     style={{background: 'var(--surface)', boxShadow: 'var(--shadow)'}}>
                  
                  {isLoading ? (
                    <LoadingAnimation />
                  ) : result?.type === 'suggestion' ? (
                    <div className="text-center py-8">
                      {result.songChanged && (
                        <div className="mb-4 text-sm text-text-muted">
                          <em>Corrected spelling: "{result.originalSong}" → "{result.correctedSong}"</em>
                        </div>
                      )}
                      <div className="mb-6 text-lg leading-relaxed">
                        {result.message}
                      </div>
                      <button
                        onClick={() => handleSuggestionAccept(result.correctedSong, result.suggestedArtist)}
                        className="px-8 py-3 rounded-xl font-semibold transition-all duration-200 hover:transform hover:-translate-y-1"
                        style={{
                          background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                          boxShadow: '0 8px 20px rgba(255, 107, 74, 0.3)'
                        }}
                      >
                        Yes, search for "{result.correctedSong}" by {result.suggestedArtist}
                      </button>
                      <div className="mt-4 text-sm text-text-muted">
                        Or fill in the artist field manually and try again
                      </div>
                    </div>
                  ) : result?.type === 'meaning' ? (
                    <div>
                      <div className="mb-6 pb-4 border-b border-border">
                        <h2 className="text-2xl font-bold mb-2">
                          "{result.song}" by {result.artist}
                        </h2>
                      </div>
                      
                      <div className="prose prose-lg prose-invert max-w-none mb-8">
                        <div className="text-base leading-relaxed whitespace-pre-wrap">
                          {result.meaning}
                        </div>
                      </div>

                      {/* Share Button */}
                      <div className="text-center pt-4 border-t border-border">
                        <button
                          onClick={() => shareResult(result.song, result.artist, result.meaning)}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 hover:transform hover:-translate-y-1"
                          style={{
                            background: 'var(--surface-hover)',
                            boxShadow: '0 8px 20px rgba(255, 107, 74, 0.2)'
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="18" cy="5" r="3"/>
                            <circle cx="6" cy="12" r="3"/>
                            <circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="currentColor" strokeWidth="2"/>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                          Share
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-text-muted">
                      {result?.message || 'Sorry, no songwriter meaning found. Try refining your search.'}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Featured Songs Grid */}
          {!showResult && (
            <section className="px-6 pb-20">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-3xl font-bold mb-8 text-center">Featured Stories</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { song: 'Detroit Rock City', artist: 'Kiss', preview: 'The tragic story of a fan who died rushing to a concert...' },
                    { song: 'Jeremy', artist: 'Pearl Jam', preview: 'Based on a true story of a troubled teenager...' },
                    { song: 'Yesterday', artist: 'Beatles', preview: 'Paul McCartney\'s dream that became a timeless classic...' },
                    { song: 'Hotel California', artist: 'Eagles', preview: 'The dark side of the American Dream in the 1970s...' },
                    { song: 'Bohemian Rhapsody', artist: 'Queen', preview: 'Freddie Mercury\'s operatic masterpiece about...' },
                    { song: 'Stairway to Heaven', artist: 'Led Zeppelin', preview: 'A spiritual journey through mystical imagery...' }
                  ].map((item, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setSong(item.song);
                        setArtist(item.artist);
                        handleSearch();
                        // analytics.track('featured_card_clicked', item);
                      }}
                      className="p-6 rounded-2xl border border-border cursor-pointer transition-all duration-200 hover:transform hover:-translate-y-2 hover:shadow-2xl"
                      style={{background: 'var(--surface)'}}
                    >
                      <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center"
                           style={{background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))'}}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                        </svg>
                      </div>
                      <h3 className="font-bold text-lg mb-2">"{item.song}"</h3>
                      <p className="text-text-muted text-sm mb-2">by {item.artist}</p>
                      <p className="text-sm leading-relaxed">{item.preview}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-8 px-6" style={{background: 'rgba(0, 0, 0, 0.2)'}}>
          <div className="max-w-6xl mx-auto text-center">
            <div className="flex flex-wrap justify-center gap-6 mb-4 text-sm">
              <a href="#" className="text-text-muted hover:text-white transition-colors">About</a>
              <a href="#" className="text-text-muted hover:text-white transition-colors">Privacy</a>
              <a href="#" className="text-text-muted hover:text-white transition-colors">Terms</a>
              <a href="#" className="text-text-muted hover:text-white transition-colors">Contact</a>
            </div>
            <p className="text-text-muted text-sm">
              © 2025 LyricLeak. Unraveling the stories behind the music.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LyricLeak;
