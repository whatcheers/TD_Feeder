import React, { useState, useEffect, useRef } from 'react';
import { Settings, Play, Pause, Clock, Podcast, Lock, Search, ArrowDownUp, Rss, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from './lib/utils';

interface Episode {
  id: string;
  title: string;
  pubDate: Date;
  audioUrl: string;
  description: string;
  source: 'public' | 'patreon';
  imageUrl?: string;
}

const DEFAULT_PUBLIC_FEED = 'https://audioboom.com/channels/5093219.rss';

export default function App() {
  const [publicFeedUrl, setPublicFeedUrl] = useState(() => {
    const saved = localStorage.getItem('publicFeedUrl');
    if (saved === 'https://feeds.megaphone.fm/the-tim-dillon-show') {
      localStorage.setItem('publicFeedUrl', DEFAULT_PUBLIC_FEED);
      return DEFAULT_PUBLIC_FEED;
    }
    return saved || DEFAULT_PUBLIC_FEED;
  });
  const [patreonFeedUrl, setPatreonFeedUrl] = useState(() => localStorage.getItem('patreonFeedUrl') || '');
  
  const [isConfiguring, setIsConfiguring] = useState(!localStorage.getItem('patreonFeedUrl'));
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedFeed, setCopiedFeed] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!isConfiguring && (publicFeedUrl || patreonFeedUrl)) {
      fetchFeeds();
    }
  }, [isConfiguring]);

  const fetchFeeds = async () => {
    setLoading(true);
    setError('');
    try {
      const fetchedEpisodes: Episode[] = [];

      // Fetch Public Feed
      if (publicFeedUrl) {
        const res = await fetch('/api/feed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: publicFeedUrl })
        });
        if (res.ok) {
          const data = await res.json();
          const publicEps = data.items.map((item: any) => ({
            id: item.guid || item.id || item.link,
            title: item.title,
            pubDate: new Date(item.pubDate),
            audioUrl: item.enclosure?.url,
            description: item.contentSnippet || item.content || '',
            source: 'public',
            imageUrl: item.itunes?.image || data.image?.url
          })).filter((ep: Episode) => ep.audioUrl);
          fetchedEpisodes.push(...publicEps);
        }
      }

      // Fetch Patreon Feed
      if (patreonFeedUrl) {
        const res = await fetch('/api/feed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: patreonFeedUrl })
        });
        if (res.ok) {
          const data = await res.json();
          const patreonEps = data.items.map((item: any) => ({
            id: item.guid || item.id || item.link,
            title: item.title,
            pubDate: new Date(item.pubDate),
            audioUrl: item.enclosure?.url,
            description: item.contentSnippet || item.content || '',
            source: 'patreon',
            imageUrl: item.itunes?.image || data.image?.url
          })).filter((ep: Episode) => ep.audioUrl);
          fetchedEpisodes.push(...patreonEps);
        }
      }

      setEpisodes(fetchedEpisodes);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch feeds. Please check your URLs.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('publicFeedUrl', publicFeedUrl);
    localStorage.setItem('patreonFeedUrl', patreonFeedUrl);
    setIsConfiguring(false);
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const copyFeedUrl = async () => {
    const url = `${window.location.origin}/main.rss`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedFeed(true);
      setTimeout(() => setCopiedFeed(false), 2000);
    } catch {
      window.prompt('Copy this feed URL:', url);
    }
  };

  const playEpisode = (episode: Episode) => {
    if (currentEpisode?.id === episode.id) {
      togglePlayPause();
    } else {
      setCurrentEpisode(episode);
      setIsPlaying(true);
      // The audio element will auto-play due to autoPlay prop
    }
  };

  const filteredAndSortedEpisodes = episodes
    .filter(ep => ep.title.toLowerCase().includes(searchQuery.toLowerCase()) || ep.description.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const timeA = a.pubDate.getTime();
      const timeB = b.pubDate.getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  if (isConfiguring) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center justify-center mb-6 text-orange-500">
            <Podcast size={48} />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Tim Dillon Player</h1>
          <p className="text-zinc-400 text-center mb-8 text-sm">
            Combine the public and Patreon feeds into one chronological timeline.
          </p>
          
          <form onSubmit={handleSaveConfig} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Public Feed URL
              </label>
              <input
                type="url"
                value={publicFeedUrl}
                onChange={(e) => setPublicFeedUrl(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors"
                placeholder="https://..."
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                <Lock size={16} className="text-orange-500" />
                Patreon RSS URL
              </label>
              <input
                type="url"
                value={patreonFeedUrl}
                onChange={(e) => setPatreonFeedUrl(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors"
                placeholder="https://www.patreon.com/rss/..."
              />
              <p className="text-xs text-zinc-500 mt-2">
                Find this in your Patreon membership tab under "Listen on other podcast apps".
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-medium py-3 rounded-lg transition-colors"
            >
              Load Episodes
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 px-4 py-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/20">
              <Podcast size={24} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Tim Dillon Player</h1>
          </div>
          
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="text"
                placeholder="Search episodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-10 pr-4 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              />
            </div>
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-full transition-colors"
              title="Toggle sort order"
            >
              <ArrowDownUp size={20} />
            </button>
            <button
              onClick={copyFeedUrl}
              className={cn(
                "p-2 rounded-full transition-colors",
                copiedFeed
                  ? "text-emerald-400 bg-emerald-500/10"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
              )}
              title={copiedFeed ? "Copied!" : "Copy combined feed URL"}
            >
              {copiedFeed ? <Check size={20} /> : <Rss size={20} />}
            </button>
            <button
              onClick={() => setIsConfiguring(true)}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-full transition-colors"
              title="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-400">Loading episodes...</p>
          </div>
        ) : error ? (
          <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => setIsConfiguring(true)}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-sm font-medium transition-colors"
            >
              Check Configuration
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedEpisodes.map((episode) => {
              const isPlayingThis = currentEpisode?.id === episode.id;
              
              return (
                <div
                  key={episode.id}
                  className={cn(
                    "group flex flex-col sm:flex-row gap-4 p-4 rounded-2xl border transition-all duration-200",
                    isPlayingThis 
                      ? "bg-zinc-900/80 border-orange-500/30 shadow-lg shadow-orange-900/5" 
                      : "bg-zinc-900/30 border-zinc-800/50 hover:bg-zinc-900 hover:border-zinc-700"
                  )}
                >
                  <div className="flex-shrink-0 relative">
                    {episode.imageUrl ? (
                      <img 
                        src={episode.imageUrl} 
                        alt={episode.title} 
                        className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-xl shadow-md"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-24 h-24 sm:w-32 sm:h-32 bg-zinc-800 rounded-xl flex items-center justify-center shadow-md">
                        <Podcast size={32} className="text-zinc-600" />
                      </div>
                    )}
                    <button
                      onClick={() => playEpisode(episode)}
                      className={cn(
                        "absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl",
                        isPlayingThis && "opacity-100 bg-black/60"
                      )}
                    >
                      <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-lg transform group-hover:scale-105 transition-transform">
                        {isPlayingThis && isPlaying ? <Pause size={24} className="fill-current" /> : <Play size={24} className="fill-current ml-1" />}
                      </div>
                    </button>
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn(
                        "text-xs font-semibold px-2.5 py-0.5 rounded-full",
                        episode.source === 'patreon' 
                          ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                          : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                      )}>
                        {episode.source === 'patreon' ? 'Patreon' : 'Free'}
                      </span>
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <Clock size={12} />
                        {format(episode.pubDate, 'MMM d, yyyy')}
                      </span>
                    </div>
                    <h3 className={cn(
                      "text-lg font-semibold leading-tight mb-2 line-clamp-2",
                      isPlayingThis ? "text-orange-400" : "text-zinc-100"
                    )}>
                      {episode.title}
                    </h3>
                    <p className="text-sm text-zinc-400 line-clamp-2 sm:line-clamp-3">
                      {episode.description.replace(/<[^>]*>?/gm, '')}
                    </p>
                  </div>
                </div>
              );
            })}
            
            {filteredAndSortedEpisodes.length === 0 && !loading && (
              <div className="text-center py-20 text-zinc-500">
                No episodes found.
              </div>
            )}
          </div>
        )}
      </main>

      {/* Audio Player */}
      {currentEpisode && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 p-4 z-50 shadow-2xl">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-4 w-full sm:w-1/3 min-w-0">
              {currentEpisode.imageUrl ? (
                <img 
                  src={currentEpisode.imageUrl} 
                  alt="" 
                  className="w-12 h-12 rounded-lg object-cover shadow-md hidden sm:block"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center shadow-md hidden sm:flex">
                  <Podcast size={20} className="text-zinc-600" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-100 truncate">
                  {currentEpisode.title}
                </p>
                <p className="text-xs text-zinc-500 truncate">
                  {currentEpisode.source === 'patreon' ? 'Patreon Exclusive' : 'Free Episode'}
                </p>
              </div>
            </div>
            
            <div className="flex-1 w-full">
              <audio
                ref={audioRef}
                src={currentEpisode.audioUrl}
                autoPlay
                controls
                className="w-full h-10 rounded-lg outline-none custom-audio"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

