import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../store";
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX } from "lucide-react";

export function AudioPlayer() {
  const { selectedFile, files, setSelectedFile } = useAppStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const selectedPath = selectedFile?.path;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;

    const loadAudio = async () => {
      if (!selectedFile) {
        setAudioUrl(null);
        return;
      }

      try {
        const file = await selectedFile.handle.getFile();
        url = URL.createObjectURL(file);
        setAudioUrl(url);
      } catch (err) {
        console.error("Failed to load audio for playback:", err);
      }
    };

    loadAudio();

    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [selectedPath, selectedFile]);

  useEffect(() => {
    const currentIndex = selectedPath ? files.findIndex(f => f.path === selectedPath) : -1;

    const playNext = () => {
      if (currentIndex !== -1 && currentIndex < files.length - 1) {
        setSelectedFile(files[currentIndex + 1]);
      }
    };

    const playPrev = () => {
      if (currentIndex > 0) {
        setSelectedFile(files[currentIndex - 1]);
      }
    };

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('previoustrack', playPrev);
      navigator.mediaSession.setActionHandler('nexttrack', playNext);
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      }
    };
  }, [selectedPath, files, setSelectedFile]);

  useEffect(() => {
    if (audioRef.current && audioUrl) {
      // Only auto-play if something was already playing
      if (isPlaying) {
        audioRef.current.play().catch(() => {
          // Play failed (e.g., interrupted by new load), just ignore
          setIsPlaying(false);
        });
      }
    }
  }, [audioUrl, isPlaying]);

  useEffect(() => {
    const handleToggle = () => {
      if (!audioRef.current || !audioUrl) return;
      if (!audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    };
    window.addEventListener('toggle-audio-play', handleToggle);
    return () => window.removeEventListener('toggle-audio-play', handleToggle);
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const time = Number(e.target.value);
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!selectedFile) {
    return <div className="text-sm text-muted-foreground">Select a file to play</div>;
  }

  return (
    <div className="flex h-full w-full items-center justify-between gap-4">
      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => {
            setIsPlaying(false);
            const currentIndex = selectedFile ? files.findIndex(f => f.path === selectedFile.path) : -1;
            if (currentIndex !== -1 && currentIndex < files.length - 1) {
              setSelectedFile(files[currentIndex + 1]);
            }
          }}
        />
      )}

      {/* Track Info */}
      <div className="w-1/4 min-w-[150px] truncate">
        <div className="truncate text-sm font-semibold" title={selectedFile.name}>
          {selectedFile.name}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {selectedFile.path}
        </div>
      </div>

      {/* Controls & Timeline */}
      <div className="flex max-w-2xl flex-1 flex-col items-center justify-center gap-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const idx = selectedFile ? files.findIndex(f => f.path === selectedFile.path) : -1;
              if (idx > 0) setSelectedFile(files[idx - 1]);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-[transform,color,background-color] hover:-translate-y-0.5 hover:bg-accent/80 hover:text-foreground"
          >
            <SkipBack className="h-5 w-5" />
          </button>
          <button
            onClick={togglePlay}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] text-primary-foreground shadow-[var(--panel-shadow)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--panel-shadow-lg)]"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
          <button
            onClick={() => {
              const idx = selectedFile ? files.findIndex(f => f.path === selectedFile.path) : -1;
              if (idx !== -1 && idx < files.length - 1) setSelectedFile(files[idx + 1]);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-[transform,color,background-color] hover:-translate-y-0.5 hover:bg-accent/80 hover:text-foreground"
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>

        <div className="w-full flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full border-0 bg-secondary/90 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-[var(--panel-shadow)]"
          />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume / Extra Controls */}
      <div className="w-1/4 min-w-[150px] flex items-center justify-end gap-2">
        <button onClick={toggleMute} className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-[transform,color,background-color] hover:-translate-y-0.5 hover:bg-accent/80 hover:text-foreground">
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={isMuted ? 0 : volume}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            if (audioRef.current) audioRef.current.volume = v;
            if (v > 0 && isMuted) setIsMuted(false);
          }}
          className="h-1.5 w-24 cursor-pointer appearance-none rounded-full border-0 bg-secondary/90 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-[var(--panel-shadow)]"
        />
      </div>
    </div>
  );
}
