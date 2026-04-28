import { Outlet, NavLink } from "react-router-dom";
import { ListMusic, Settings, Home, List } from "lucide-react";
import { AudioPlayer } from "../player/AudioPlayer";
import { useAppStore } from "../../store";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";

export function AppLayout() {
  const { selectedFile } = useAppStore();
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="flex h-screen overflow-hidden bg-transparent text-foreground">
      {/* Sidebar sidebar */}
      <aside className="app-shell hidden w-64 flex-col border-r border-border/80 bg-card/85 sm:flex">
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
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Page Content */}
        <div className="flex-1 flex min-h-0 flex-col p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>

        {/* Audio Player Footer Bar */}
        {selectedFile && (
          <div className="app-shell relative z-10 flex h-24 items-center justify-between border-t border-border/80 bg-card/90 p-4 shadow-[var(--panel-shadow-lg)]">
            <AudioPlayer />
          </div>
        )}
      </main>
    </div>
  );
}
