import { AudioTags } from './metadata';

export interface iTunesSearchResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  releaseDate: string;
  primaryGenreName: string;
  artworkUrl100: string;
}

export interface MetadataApiResult extends AudioTags {
  id: string;
  coverUrl?: string;
}

export async function searchMetadata(query: string): Promise<MetadataApiResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`);

    if (!response.ok) {
      throw new Error(`iTunes API error: ${response.statusText}`);
    }

    const data = await response.json();

    return data.results.map((result: iTunesSearchResult) => {
      // Get higher resolution artwork if possible (600x600 instead of 100x100)
      const highResArtworkUrl = result.artworkUrl100?.replace('100x100bb', '600x600bb');

      const date = result.releaseDate ? new Date(result.releaseDate).getFullYear().toString() : '';

      return {
        id: result.trackId.toString(),
        title: result.trackName || '',
        artist: result.artistName || '',
        album: result.collectionName || '',
        date,
        genre: result.primaryGenreName || '',
        coverUrl: highResArtworkUrl
      };
    });
  } catch (error) {
    console.error("Error fetching metadata from iTunes Search API:", error);
    return [];
  }
}

export async function fetchCoverArt(url: string): Promise<{ format: string; data: ArrayBuffer } | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Could not fetch image");
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    // Guess format from extension or fallback to jpeg
    const format = response.headers.get('content-type') || (url.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');

    return {
      format,
      data: arrayBuffer
    };
  } catch (error) {
    console.error("Error fetching cover art:", error);
    return undefined;
  }
}
