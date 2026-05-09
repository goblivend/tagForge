import { useEffect, useMemo, useState, useRef } from "react";
import { Tags, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { useAppStore, type FileEntry } from "../store";
import { checkPermission, getFileFromEntry } from "../services/fsAccess";
import { readMetadata, writeMetadata, type AudioTags } from "../services/metadata";
import {
    findPresetByGeneratedName,
    getPreviewNameForPreset,
    getRenamedPathForFile,
} from "../lib/filenamePresets";

type TagField = "artist" | "album" | "genre" | "date" | "title";

type OperationFailure = {
    path: string;
    reason: string;
};

type OperationResult = {
    totalCandidates: number;
    updated: number;
    renamed: number;
    skippedReadOnly: number;
    skippedPermission: number;
    skippedConflicts: number;
    skippedUnmatchedPreset: number;
    skippedUnchangedName: number;
    skippedValueMismatch: number;
    failures: OperationFailure[];
};

const TAG_FIELD_LABELS: Record<TagField, string> = {
    artist: "Artist",
    album: "Album",
    genre: "Genre",
    date: "Year / Date",
    title: "Title",
};

function normalizeTagValue(value: string | undefined | null) {
    return (value || "").trim();
}

function isMp3File(entry: FileEntry) {
    return entry.name.toLowerCase().endsWith(".mp3");
}

function hasCoreMetadata(entry: FileEntry) {
    const metadata = entry.metadata;
    return (
        !!metadata &&
        typeof metadata.artist === "string" &&
        typeof metadata.album === "string" &&
        typeof metadata.genre === "string" &&
        typeof metadata.date === "string" &&
        typeof metadata.title === "string"
    );
}

function mapRecentMetadata(tags: AudioTags) {
    return {
        artist: tags.artist,
        album: tags.album,
        genre: tags.genre,
    };
}

export default function TagOperations() {
    const {
        files,
        filenamePresets,
        selectedFile,
        setSelectedFile,
        setFiles,
        updateFileMetadata,
        markFileAsEdited,
        addRecentMetadata,
    } = useAppStore();

    const [activeField, setActiveField] = useState<TagField>("artist");
    const [oldValue, setOldValue] = useState("");
    const [newValue, setNewValue] = useState("");
    const [isRunning, setIsRunning] = useState(false);
    const [isIndexing, setIsIndexing] = useState(false);
    const [indexProgress, setIndexProgress] = useState({ processed: 0, total: 0 });
    const [runProgress, setRunProgress] = useState({ processed: 0, total: 0 });
    const [result, setResult] = useState<OperationResult | null>(null);

    const readOnlyCount = useMemo(() => files.filter((entry) => !entry.handle).length, [files]);

    const tagValues = useMemo(() => {
        const counts = new Map<string, number>();

        for (const file of files) {
            const value = normalizeTagValue(file.metadata?.[activeField] as string | undefined);
            if (!value) continue;
            counts.set(value, (counts.get(value) || 0) + 1);
        }

        return Array.from(counts.entries())
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => a.value.localeCompare(b.value));
    }, [files, activeField]);

    useEffect(() => {
        if (!oldValue) return;
        const exists = tagValues.some((entry) => entry.value === oldValue);
        if (!exists) {
            setOldValue("");
        }
    }, [tagValues, oldValue]);

    // Keep track of previously-selected old value so we don't overwrite
    // an actively edited `newValue` unless it was previously prefilled.
    const prevOldValueRef = useRef<string>("");

    useEffect(() => {
        if (!oldValue) {
            prevOldValueRef.current = "";
            return;
        }

        const shouldPrefill = (newValue || "").trim() === "" || prevOldValueRef.current === newValue;
        if (shouldPrefill) setNewValue(oldValue);
        prevOldValueRef.current = oldValue;
    }, [oldValue, newValue]);

    const candidateFiles = useMemo(() => {
        const source = normalizeTagValue(oldValue);
        if (!source) return [];

        return files.filter((file) => {
            if (!isMp3File(file)) return false;
            const value = normalizeTagValue(file.metadata?.[activeField] as string | undefined);
            return value === source;
        });
    }, [files, activeField, oldValue]);

    const renameEligibleCount = useMemo(() => {
        return candidateFiles.filter((file) => !!findPresetByGeneratedName(file.name, file.metadata, filenamePresets)).length;
    }, [candidateFiles, filenamePresets]);

    const indexAllMetadata = async () => {
        if (isIndexing || files.length === 0) return;

        const targets = useAppStore.getState().files.filter((entry) => isMp3File(entry) && !hasCoreMetadata(entry));
        if (targets.length === 0) return;

        setIsIndexing(true);
        setIndexProgress({ processed: 0, total: targets.length });

        try {
            let processed = 0;
            for (const entry of targets) {
                try {
                    const domFile = await getFileFromEntry(entry);
                    const tags = await readMetadata(domFile);
                    updateFileMetadata(entry.path, tags);
                    addRecentMetadata(mapRecentMetadata(tags));
                } catch (error) {
                    console.error("Failed to index metadata", entry.path, error);
                }

                processed += 1;
                setIndexProgress({ processed, total: targets.length });
            }
        } finally {
            setIsIndexing(false);
        }
    };

    useEffect(() => {
        void indexAllMetadata();
        // Only rerun indexing when library size changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [files.length]);

    const runOperation = async () => {
        const sourceValue = normalizeTagValue(oldValue);
        const targetValue = normalizeTagValue(newValue);

        if (!sourceValue || !targetValue || sourceValue === targetValue) {
            return;
        }

        if (candidateFiles.length === 0) {
            setResult({
                totalCandidates: 0,
                updated: 0,
                renamed: 0,
                skippedReadOnly: 0,
                skippedPermission: 0,
                skippedConflicts: 0,
                skippedUnmatchedPreset: 0,
                skippedUnchangedName: 0,
                skippedValueMismatch: 0,
                failures: [],
            });
            return;
        }

        if (candidateFiles.length > 20) {
            const accepted = window.confirm(
                `Apply this change to ${candidateFiles.length} files? This will update metadata and may rename matching files.`
            );
            if (!accepted) return;
        }

        const opResult: OperationResult = {
            totalCandidates: candidateFiles.length,
            updated: 0,
            renamed: 0,
            skippedReadOnly: 0,
            skippedPermission: 0,
            skippedConflicts: 0,
            skippedUnmatchedPreset: 0,
            skippedUnchangedName: 0,
            skippedValueMismatch: 0,
            failures: [],
        };

        setIsRunning(true);
        setRunProgress({ processed: 0, total: candidateFiles.length });
        setResult(null);

        const candidatePaths = candidateFiles.map((entry) => entry.path);
        const workingFiles = [...useAppStore.getState().files];

        try {
            let processed = 0;

            for (const sourcePath of candidatePaths) {
                const current = workingFiles.find((entry) => entry.path === sourcePath);

                if (!current || !isMp3File(current)) {
                    processed += 1;
                    setRunProgress({ processed, total: candidatePaths.length });
                    continue;
                }

                if (!current.handle) {
                    opResult.skippedReadOnly += 1;
                    processed += 1;
                    setRunProgress({ processed, total: candidatePaths.length });
                    continue;
                }

                try {
                    const hasPermission = await checkPermission(current.handle, true);
                    if (!hasPermission) {
                        opResult.skippedPermission += 1;
                        processed += 1;
                        setRunProgress({ processed, total: candidatePaths.length });
                        continue;
                    }

                    const file = await getFileFromEntry(current);
                    const existingTags = await readMetadata(file);
                    const existingValue = normalizeTagValue(existingTags[activeField]);

                    if (existingValue !== sourceValue) {
                        opResult.skippedValueMismatch += 1;
                        processed += 1;
                        setRunProgress({ processed, total: candidatePaths.length });
                        continue;
                    }

                    const updatedTags: AudioTags = {
                        ...existingTags,
                        [activeField]: targetValue,
                    };

                    const saveResult = await writeMetadata(file, current.handle, updatedTags);
                    if (!saveResult.success) {
                        opResult.failures.push({
                            path: current.path,
                            reason: saveResult.error,
                        });
                        processed += 1;
                        setRunProgress({ processed, total: candidatePaths.length });
                        continue;
                    }

                    opResult.updated += 1;
                    updateFileMetadata(current.path, updatedTags);
                    markFileAsEdited(current.path);
                    addRecentMetadata(mapRecentMetadata(updatedTags));

                    const matchedPreset = findPresetByGeneratedName(current.name, existingTags, filenamePresets);
                    if (!matchedPreset) {
                        opResult.skippedUnmatchedPreset += 1;
                        processed += 1;
                        setRunProgress({ processed, total: candidatePaths.length });
                        continue;
                    }

                    const nextName = getPreviewNameForPreset(matchedPreset.format, updatedTags, current.name);
                    if (!nextName || nextName === current.name) {
                        opResult.skippedUnchangedName += 1;
                        processed += 1;
                        setRunProgress({ processed, total: candidatePaths.length });
                        continue;
                    }

                    const nextPath = getRenamedPathForFile(current.path, nextName);
                    const conflict = workingFiles.some((entry) => entry.path === nextPath);
                    if (conflict) {
                        opResult.skippedConflicts += 1;
                        processed += 1;
                        setRunProgress({ processed, total: candidatePaths.length });
                        continue;
                    }

                    const moveHandle = current.handle as FileSystemFileHandle & {
                        move?: (newName: string) => Promise<void> | void;
                    };

                    if (typeof moveHandle.move !== "function") {
                        opResult.failures.push({
                            path: current.path,
                            reason: "Browser does not support File System Access move()",
                        });
                        processed += 1;
                        setRunProgress({ processed, total: candidatePaths.length });
                        continue;
                    }

                    await moveHandle.move(nextName);

                    const index = workingFiles.findIndex((entry) => entry.path === current.path);
                    if (index >= 0) {
                        const renamedEntry: FileEntry = {
                            ...workingFiles[index],
                            name: nextName,
                            path: nextPath,
                            metadata: {
                                ...workingFiles[index].metadata,
                                [activeField]: targetValue,
                            },
                        };

                        workingFiles[index] = renamedEntry;
                        setFiles([...workingFiles]);

                        if (selectedFile?.path === current.path) {
                            setSelectedFile(renamedEntry);
                        }
                    }

                    opResult.renamed += 1;
                } catch (error) {
                    const reason = error instanceof Error ? error.message : String(error);
                    opResult.failures.push({ path: current.path, reason });
                }

                processed += 1;
                setRunProgress({ processed, total: candidatePaths.length });
            }

            setResult(opResult);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
            <header className="app-shell rounded-2xl border border-border/80 bg-card/85 p-5 shadow-[var(--panel-shadow)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--accent-color)))] text-white shadow-[var(--panel-shadow)]">
                            <Tags className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight text-foreground">Tag Operations</h1>
                            <p className="text-sm text-muted-foreground">
                                Bulk-rename a tag value across files and update filenames when a known preset pattern matches.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => void indexAllMetadata()}
                        disabled={isIndexing || isRunning || files.length === 0}
                        className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${isIndexing ? "animate-spin" : ""}`} />
                        Index Tag Values
                    </button>
                </div>

                {(isIndexing || indexProgress.total > 0) && (
                    <p className="mt-3 text-xs text-muted-foreground">
                        Metadata indexing: {indexProgress.processed}/{indexProgress.total}
                    </p>
                )}
            </header>

            {readOnlyCount > 0 && (
                <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    {readOnlyCount} file(s) are in read-only mode in this session. Those files will be skipped for write and rename actions.
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div className="app-shell rounded-2xl border border-border/80 bg-card/85 p-5 shadow-[var(--panel-shadow)]">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Operation</h2>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="space-y-1 text-sm">
                            <span className="font-medium text-foreground">Tag Field</span>
                            <select
                                className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm"
                                value={activeField}
                                onChange={(event) => setActiveField(event.target.value as TagField)}
                                disabled={isRunning}
                            >
                                {Object.entries(TAG_FIELD_LABELS).map(([field, label]) => (
                                    <option key={field} value={field}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="space-y-1 text-sm">
                            <span className="font-medium text-foreground">Current Value</span>
                            <select
                                className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm"
                                value={oldValue}
                                onChange={(event) => setOldValue(event.target.value)}
                                disabled={isRunning || tagValues.length === 0}
                            >
                                <option value="">Select a value</option>
                                {tagValues.map((entry) => (
                                    <option key={entry.value} value={entry.value}>
                                        {entry.value} ({entry.count})
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className="mt-4 block space-y-1 text-sm">
                        <span className="font-medium text-foreground">New Value</span>
                        <input
                            type="text"
                            className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm"
                            value={newValue}
                            onChange={(event) => setNewValue(event.target.value)}
                            disabled={isRunning}
                            placeholder="Enter replacement value"
                        />
                    </label>

                    <div className="mt-4 rounded-xl border border-border/70 bg-background/60 p-3 text-sm">
                        <p className="text-muted-foreground">Files to update: <span className="font-semibold text-foreground">{candidateFiles.length}</span></p>
                        <p className="text-muted-foreground">Rename-eligible (preset match): <span className="font-semibold text-foreground">{renameEligibleCount}</span></p>
                    </div>

                    <button
                        type="button"
                        onClick={() => void runOperation()}
                        disabled={
                            isRunning ||
                            isIndexing ||
                            !normalizeTagValue(oldValue) ||
                            !normalizeTagValue(newValue) ||
                            normalizeTagValue(oldValue) === normalizeTagValue(newValue)
                        }
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--panel-shadow)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--panel-shadow-lg)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tags className="h-4 w-4" />}
                        {isRunning ? "Applying Changes..." : "Apply Bulk Edit"}
                    </button>

                    {isRunning && (
                        <p className="mt-3 text-xs text-muted-foreground">
                            Running operation: {runProgress.processed}/{runProgress.total}
                        </p>
                    )}
                </div>

                <div className="app-shell rounded-2xl border border-border/80 bg-card/85 p-5 shadow-[var(--panel-shadow)]">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Values For {TAG_FIELD_LABELS[activeField]}
                    </h2>

                    <div className="mt-4 max-h-[24rem] space-y-2 overflow-y-auto pr-1">
                        {tagValues.length === 0 && (
                            <p className="text-sm text-muted-foreground">No values indexed yet for this field.</p>
                        )}

                        {tagValues.map((entry) => (
                            <button
                                key={entry.value}
                                type="button"
                                onClick={() => setOldValue(entry.value)}
                                disabled={isRunning}
                                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors ${oldValue === entry.value
                                        ? "border-primary/50 bg-primary/10 text-foreground"
                                        : "border-border/70 bg-background/70 text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                                    }`}
                            >
                                <span className="truncate">{entry.value}</span>
                                <span className="ml-2 shrink-0 text-xs font-semibold">{entry.count}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {result && (
                <div className="app-shell rounded-2xl border border-border/80 bg-card/85 p-5 shadow-[var(--panel-shadow)]">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Result</h2>

                    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                        <p>Total candidates: <span className="font-semibold">{result.totalCandidates}</span></p>
                        <p>Metadata updated: <span className="font-semibold">{result.updated}</span></p>
                        <p>Files renamed: <span className="font-semibold">{result.renamed}</span></p>
                        <p>Skipped read-only: <span className="font-semibold">{result.skippedReadOnly}</span></p>
                        <p>Skipped permissions: <span className="font-semibold">{result.skippedPermission}</span></p>
                        <p>Skipped conflicts: <span className="font-semibold">{result.skippedConflicts}</span></p>
                        <p>Skipped unmatched preset: <span className="font-semibold">{result.skippedUnmatchedPreset}</span></p>
                        <p>Skipped unchanged name: <span className="font-semibold">{result.skippedUnchangedName}</span></p>
                        <p>Skipped value mismatch: <span className="font-semibold">{result.skippedValueMismatch}</span></p>
                    </div>

                    {result.failures.length > 0 && (
                        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                            <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
                                <AlertTriangle className="h-4 w-4" />
                                Failures ({result.failures.length})
                            </p>
                            <div className="max-h-48 space-y-1 overflow-y-auto text-xs text-red-700 dark:text-red-300">
                                {result.failures.map((failure, index) => (
                                    <p key={`${failure.path}-${index}`}>
                                        {failure.path}: {failure.reason}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
