import type { FileEntry } from "../store";
import type { AudioTags } from "../services/metadata";

function normalizeValue(value: string | undefined | null) {
  return (value || "").trim();
}

function splitArtistList(value: string | undefined | null) {
  return normalizeValue(value)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniquePreserveOrder(values: string[]) {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    ordered.push(normalized);
  }

  return ordered;
}

export function getTrackContributingArtists(metadata?: Partial<AudioTags>) {
  if (!metadata) return [];

  const explicitList = splitArtistList((metadata as Partial<AudioTags> & { contributingArtists?: string }).contributingArtists);
  if (explicitList.length > 0) return explicitList;

  return splitArtistList(metadata.artist);
}

export function computeAlbumArtistForAlbum(files: FileEntry[], albumName: string) {
  const targetAlbum = normalizeValue(albumName);
  if (!targetAlbum) return "";

  const contributors: string[] = [];
  for (const file of files) {
    if (normalizeValue(file.metadata?.album) !== targetAlbum) continue;
    contributors.push(...getTrackContributingArtists(file.metadata));
  }

  return uniquePreserveOrder(contributors).join("; ");
}

export function computeAlbumArtistsByAlbum(files: FileEntry[]) {
  const albums = new Map<string, string>();

  for (const file of files) {
    const album = normalizeValue(file.metadata?.album);
    if (!album || albums.has(album)) continue;
    albums.set(album, computeAlbumArtistForAlbum(files, album));
  }

  return albums;
}

export function getAlbumArtistForFile(files: FileEntry[], file: FileEntry) {
  return computeAlbumArtistForAlbum(files, file.metadata?.album || "");
}

export function shouldApplyAlbumArtist(existingValue: string | undefined | null, nextValue: string) {
  return normalizeValue(existingValue) !== normalizeValue(nextValue) && normalizeValue(nextValue) !== "";
}
