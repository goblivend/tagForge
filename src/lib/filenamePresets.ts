import { AudioTags } from "../services/metadata";
import { FilenamePreset } from "../store";

type MetadataLike = Partial<AudioTags> | AudioTags | null | undefined;

const TOKEN_REGEX = /\{(artist|title|album|genre|date|year)\}/gi;
const FILESYSTEM_FORBIDDEN_REGEX = /[<>:"/\\|?*]+/g;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function splitFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return { basename: fileName, extension: "" };
  }
  return {
    basename: fileName.slice(0, dotIndex),
    extension: fileName.slice(dotIndex + 1),
  };
}

export function applyPresetFormat(format: string, metadata: MetadataLike) {
  return format.replace(TOKEN_REGEX, (_match, token: string) => {
    const lower = token.toLowerCase();
    switch (lower) {
      case "artist":
        return metadata?.artist?.trim() || "Unknown Artist";
      case "title":
        return metadata?.title?.trim() || "Unknown Title";
      case "album":
        return metadata?.album?.trim() || "Unknown Album";
      case "genre":
        return metadata?.genre?.trim() || "Unknown Genre";
      case "date":
        return metadata?.date?.trim() || "Unknown Date";
      case "year":
        return metadata?.date?.trim()?.slice(0, 4) || "Unknown Year";
      default:
        return "";
    }
  });
}

export function sanitizePresetStem(stem: string) {
  return stem
    .replace(/\s+-\s+$/, "")
    .replace(/^\s+-\s+/, "")
    .replace(/\s{2,}/g, " ")
    .replace(FILESYSTEM_FORBIDDEN_REGEX, "_")
    .trim();
}

export function getPreviewNameForPreset(
  format: string,
  metadata: MetadataLike,
  originalFileName: string
) {
  const { extension } = splitFileName(originalFileName);
  const computedStem = sanitizePresetStem(applyPresetFormat(format, metadata));

  if (!extension) {
    return computedStem;
  }

  const extensionWithDot = `.${extension}`;
  return computedStem.endsWith(extensionWithDot)
    ? computedStem
    : `${computedStem}${extensionWithDot}`;
}

export function getRenamedPathForFile(path: string, nextName: string) {
  const slashIndex = path.lastIndexOf("/");
  return slashIndex >= 0 ? `${path.slice(0, slashIndex + 1)}${nextName}` : nextName;
}

export function presetFormatToBaseNameRegex(format: string) {
  const parts: string[] = [];
  let lastIndex = 0;

  // Find all token positions and build regex incrementally
  const matches = Array.from(format.matchAll(TOKEN_REGEX));
  for (const match of matches) {
    // Add escaped literal part before this token
    if (match.index! > lastIndex) {
      parts.push(escapeRegex(format.slice(lastIndex, match.index)));
    }
    // Add token pattern (non-greedy, matches anything)
    parts.push("(.+?)");
    lastIndex = match.index! + match[0].length;
  }

  // Add remaining literal part after last token
  if (lastIndex < format.length) {
    parts.push(escapeRegex(format.slice(lastIndex)));
  }

  const pattern = parts.join("");
  return new RegExp(`^${pattern}$`, "i");
}

export function matchesPresetFormat(fileName: string, format: string) {
  const { basename } = splitFileName(fileName);
  return presetFormatToBaseNameRegex(format).test(basename);
}

export function findPresetByGeneratedName(
  fileName: string,
  metadata: MetadataLike,
  presets: FilenamePreset[]
) {
  for (const preset of presets) {
    if (getPreviewNameForPreset(preset.format, metadata, fileName) === fileName) {
      return preset;
    }
  }

  return null;
}

export function findFirstMatchingPreset(
  fileName: string,
  presets: FilenamePreset[]
): FilenamePreset | null {
  for (const preset of presets) {
    if (matchesPresetFormat(fileName, preset.format)) {
      return preset;
    }
  }
  return null;
}
