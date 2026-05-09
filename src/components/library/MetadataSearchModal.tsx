import { useState, useEffect } from 'react';
import { X, Search, Check, Loader2, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { searchMetadata, MetadataApiResult, fetchCoverArt } from '@/services/metadataApi';
import { AudioTags } from '@/services/metadata';

interface MetadataSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialQuery: string;
    onApply: (tags: Partial<AudioTags>) => void;
}

export function MetadataSearchModal({ isOpen, onClose, initialQuery, onApply }: MetadataSearchModalProps) {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<MetadataApiResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Set initial query when modal opens
    useEffect(() => {
        if (isOpen) {
            setQuery(initialQuery);
            if (initialQuery.trim()) {
                handleSearch(initialQuery);
            }
        } else {
            setResults([]);
            setError(null);
        }
    }, [isOpen, initialQuery]);

    const handleSearch = async (searchQuery: string = query) => {
        if (!searchQuery.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const data = await searchMetadata(searchQuery);
            setResults(data);
            if (data.length === 0) {
                setError("No results found. Try modifying the search query.");
            }
        } catch (err: any) {
            setError(err.message || 'Error occurred while searching');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApply = async (result: MetadataApiResult) => {
        setIsApplying(true);

        try {
            const updatedTags: Partial<AudioTags> = {
                title: result.title,
                artist: result.artist,
                album: result.album,
                date: result.date,
                genre: result.genre,
            };

            if (result.coverUrl) {
                const coverArt = await fetchCoverArt(result.coverUrl);
                if (coverArt) {
                    updatedTags.picture = coverArt;
                }
            }

            onApply(updatedTags);
            onClose();
        } catch (err) {
            console.error("Failed to apply tags", err);
            // Give it back without image if applying image failed
            onApply({
                title: result.title,
                artist: result.artist,
                album: result.album,
                date: result.date,
                genre: result.genre,
            });
            onClose();
        } finally {
            setIsApplying(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="bg-card w-full max-w-2xl rounded-xl shadow-lg border border-border flex flex-col max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Search className="w-5 h-5 text-primary" />
                        Find Metadata
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md text-muted-foreground hover:bg-muted/80 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 flex gap-2">
                    <input
                        type="text"
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50"
                        placeholder="Search title, artist, or album..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={() => handleSearch()} disabled={isLoading || isApplying}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 pt-0">
                    {isLoading && results.length === 0 ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-40 text-muted-foreground">
                            {error}
                        </div>
                    ) : results.length > 0 ? (
                        <div className="flex flex-col gap-3">
                            {results.map((result) => (
                                <div key={result.id} className="flex gap-4 p-3 rounded-lg border border-border bg-background/50 hover:bg-muted/30 transition-colors group items-center">
                                    <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center border border-border/50">
                                        {result.coverUrl ? (
                                            <img src={result.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                                        ) : (
                                            <Music className="w-6 h-6 text-muted-foreground" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-sm truncate">{result.title}</h3>
                                        <p className="text-xs text-muted-foreground truncate">{result.artist}</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {result.album} {result.date ? `(${result.date})` : ''}
                                        </p>
                                        {result.genre && (
                                            <span className="inline-block mt-1 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                                {result.genre}
                                            </span>
                                        )}
                                    </div>

                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleApply(result)}
                                        disabled={isApplying}
                                    >
                                        {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                                        Apply
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
