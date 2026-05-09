import { Outlet, NavLink } from "react-router-dom";
import { ListMusic, Settings, Home, List, Tags } from "lucide-react";
import { AudioPlayer } from "../player/AudioPlayer";
import { useAppStore } from "../../store";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";

export function AppLayout() {
  const { selectedFile } = useAppStore();
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="flex min-h-dvh flex-col overflow-hidden bg-transparent text-foreground lg:h-dvh lg:flex-row">
      <header className="app-shell border-b border-border/80 bg-card/85 px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--accent-color)))] text-white shadow-[var(--panel-shadow)]">
              <ListMusic className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="gradient-text block text-base font-semibold tracking-tight">TagForge</span>
              <span className="block text-[11px] text-muted-foreground">Metadata workspace</span>
            </div>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>

        <nav className="mt-3 grid grid-cols-4 gap-2 text-sm font-medium">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center justify-center gap-2 rounded-xl px-3 py-2 transition-colors ${isActive ? "bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] text-primary-foreground shadow-[var(--panel-shadow)]" : "bg-background/70 text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground"}`
            }
          >
            <Home className="h-4 w-4" />
            Library
          </NavLink>
          <NavLink
            to="/tag-operations"
            className={({ isActive }) =>
              `flex items-center justify-center gap-2 rounded-xl px-3 py-2 transition-colors ${isActive ? "bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] text-primary-foreground shadow-[var(--panel-shadow)]" : "bg-background/70 text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground"}`
            }
          >
            <Tags className="h-4 w-4" />
            Tags
          </NavLink>
          <NavLink
            to="/playlists"
            className={({ isActive }) =>
              `flex items-center justify-center gap-2 rounded-xl px-3 py-2 transition-colors ${isActive ? "bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] text-primary-foreground shadow-[var(--panel-shadow)]" : "bg-background/70 text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground"}`
            }
          >
            <List className="h-4 w-4" />
            Playlists
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center justify-center gap-2 rounded-xl px-3 py-2 transition-colors ${isActive ? "bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] text-primary-foreground shadow-[var(--panel-shadow)]" : "bg-background/70 text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground"}`
            }
          >
            <Settings className="h-4 w-4" />
            Settings
          </NavLink>
        </nav>
      </header>

      {/* Sidebar sidebar */}
      <aside className="app-shell hidden w-64 flex-col border-r border-border/80 bg-card/85 lg:flex">
        <div className="flex h-16 items-center justify-between border-b border-border/80 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--accent-color)))] text-white shadow-[var(--panel-shadow)]">
              <ListMusic className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="gradient-text block text-lg font-semibold tracking-tight">TagForge</span>
              <span className="block text-xs text-muted-foreground">Metadata workspace</span>
            </div>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <nav className="flex-1 space-y-2 p-4">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-[transform,box-shadow,background-color,color] ${isActive ? "bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] text-primary-foreground shadow-[var(--panel-shadow)]" : "text-muted-foreground hover:-translate-y-0.5 hover:bg-accent/80 hover:text-accent-foreground"
              }`
            }
          >
            <Home className="h-4 w-4" />
            Library
          </NavLink>
          <NavLink
            to="/tag-operations"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-[transform,box-shadow,background-color,color] ${isActive ? "bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] text-primary-foreground shadow-[var(--panel-shadow)]" : "text-muted-foreground hover:-translate-y-0.5 hover:bg-accent/80 hover:text-accent-foreground"
              }`
            }
          >
            <Tags className="h-4 w-4" />
            Tag Operations
          </NavLink>
          <NavLink
            to="/playlists"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-[transform,box-shadow,background-color,color] ${isActive ? "bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] text-primary-foreground shadow-[var(--panel-shadow)]" : "text-muted-foreground hover:-translate-y-0.5 hover:bg-accent/80 hover:text-accent-foreground"
              }`
            }
          >
            <List className="h-4 w-4" />
            Playlists
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-[transform,box-shadow,background-color,color] ${isActive ? "bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] text-primary-foreground shadow-[var(--panel-shadow)]" : "text-muted-foreground hover:-translate-y-0.5 hover:bg-accent/80 hover:text-accent-foreground"
              }`
            }
          >
            <Settings className="h-4 w-4" />
            Settings
          </NavLink>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Page Content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 pb-44 sm:p-6 sm:pb-44 lg:p-8 lg:pb-8">
          <Outlet />
        </div>

        {/* Audio Player Footer Bar */}
        {selectedFile && (
          <div className="app-shell fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-border/80 bg-card/95 px-4 py-3 shadow-[var(--panel-shadow-lg)] lg:relative lg:inset-auto lg:z-10">
            <AudioPlayer />
          </div>
        )}
      </main>
    </div>
  );
}
