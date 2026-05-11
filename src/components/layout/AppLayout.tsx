import { Outlet, NavLink } from "react-router-dom";
import { ListMusic, Settings, Home, List, Tags, Moon, Sun } from "lucide-react";
import { AudioPlayer } from "../player/AudioPlayer";
import { useAppStore } from "../../store";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";
import { useState } from "react";

function GitHubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2a10 10 0 0 0-3.162 19.488c.5.092.684-.216.684-.48 0-.236-.008-.86-.012-1.688-2.782.604-3.37-1.34-3.37-1.34-.454-1.156-1.108-1.464-1.108-1.464-.908-.62.068-.608.068-.608 1.004.072 1.532 1.032 1.532 1.032.892 1.528 2.34 1.086 2.91.83.092-.646.35-1.086.636-1.336-2.22-.252-4.556-1.11-4.556-4.944 0-1.092.39-1.984 1.03-2.684-.102-.252-.446-1.268.098-2.644 0 0 .84-.268 2.752 1.024A9.58 9.58 0 0 1 12 6.844a9.56 9.56 0 0 1 2.506.336c1.91-1.292 2.75-1.024 2.75-1.024.546 1.376.202 2.392.1 2.644.64.7 1.028 1.592 1.028 2.684 0 3.844-2.34 4.688-4.568 4.936.36.31.68.92.68 1.852 0 1.336-.012 2.416-.012 2.744 0 .266.18.576.69.478A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

export function AppLayout() {
  const { selectedFile } = useAppStore();
  const { theme, toggleTheme } = useTheme();
  const [navCollapsed, setNavCollapsed] = useState(false);
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
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/goblivend/tagForge"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground transition-colors hover:bg-accent/80 hover:text-accent-foreground"
              title="GitHub project"
            >
              <GitHubIcon className="h-4 w-4" />
            </a>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
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
      <aside className={`app-shell hidden ${navCollapsed ? 'w-20' : 'w-64'} flex-col border-r border-border/80 bg-card/85 transition-[width] duration-200 lg:flex`}>
        <div className={`flex h-16 items-center border-b border-border/80 px-4 ${navCollapsed ? 'justify-center' : ''}`}>
          <div
            className={`flex min-w-0 cursor-pointer items-center ${navCollapsed ? 'justify-center' : 'gap-3'}`}
            onClick={() => setNavCollapsed((v) => !v)}
            title={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--accent-color)))] text-white shadow-[var(--panel-shadow)]">
              <ListMusic className="h-5 w-5" />
            </div>
            {!navCollapsed && (
              <div className="min-w-0">
                <span className="gradient-text block text-lg font-semibold tracking-tight">TagForge</span>
                <span className="block text-xs text-muted-foreground">Metadata workspace</span>
              </div>
            )}
          </div>
        </div>
        <nav className={`flex-1 space-y-2 ${navCollapsed ? 'p-3' : 'p-4'}`}>
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center ${navCollapsed ? 'h-11 w-11 justify-center rounded-2xl p-0 mx-auto' : 'gap-3 px-3 py-2.5 rounded-xl'} text-sm font-medium transition-[transform,box-shadow,background-color,color] ${isActive ? "bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] text-primary-foreground shadow-[var(--panel-shadow)]" : "text-muted-foreground hover:-translate-y-0.5 hover:bg-accent/80 hover:text-accent-foreground"
              }`
            }
            title={navCollapsed ? 'Library' : undefined}
          >
            <Home className="h-4 w-4" />
            {!navCollapsed && 'Library'}
          </NavLink>
          <NavLink
            to="/tag-operations"
            className={({ isActive }) =>
              `flex items-center ${navCollapsed ? 'h-11 w-11 justify-center rounded-2xl p-0 mx-auto' : 'gap-3 px-3 py-2.5 rounded-xl'} text-sm font-medium transition-[transform,box-shadow,background-color,color] ${isActive ? "bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] text-primary-foreground shadow-[var(--panel-shadow)]" : "text-muted-foreground hover:-translate-y-0.5 hover:bg-accent/80 hover:text-accent-foreground"
              }`
            }
            title={navCollapsed ? 'Tag Operations' : undefined}
          >
            <Tags className="h-4 w-4" />
            {!navCollapsed && 'Tag Operations'}
          </NavLink>
          <NavLink
            to="/playlists"
            className={({ isActive }) =>
              `flex items-center ${navCollapsed ? 'h-11 w-11 justify-center rounded-2xl p-0 mx-auto' : 'gap-3 px-3 py-2.5 rounded-xl'} text-sm font-medium transition-[transform,box-shadow,background-color,color] ${isActive ? "bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] text-primary-foreground shadow-[var(--panel-shadow)]" : "text-muted-foreground hover:-translate-y-0.5 hover:bg-accent/80 hover:text-accent-foreground"
              }`
            }
            title={navCollapsed ? 'Playlists' : undefined}
          >
            <List className="h-4 w-4" />
            {!navCollapsed && 'Playlists'}
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center ${navCollapsed ? 'h-11 w-11 justify-center rounded-2xl p-0 mx-auto' : 'gap-3 px-3 py-2.5 rounded-xl'} text-sm font-medium transition-[transform,box-shadow,background-color,color] ${isActive ? "bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] text-primary-foreground shadow-[var(--panel-shadow)]" : "text-muted-foreground hover:-translate-y-0.5 hover:bg-accent/80 hover:text-accent-foreground"
              }`
            }
            title={navCollapsed ? 'Settings' : undefined}
          >
            <Settings className="h-4 w-4" />
            {!navCollapsed && 'Settings'}
          </NavLink>
        </nav>
        <div className={`border-t border-border/80 p-3 ${navCollapsed ? 'flex flex-col items-center gap-2' : 'flex items-center justify-between'}`}>
          {!navCollapsed && (
            <a
              href="https://github.com/goblivend/tagForge"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/80 hover:text-accent-foreground"
              title="GitHub project"
            >
              <GitHubIcon className="h-3.5 w-3.5" />
              GitHub
            </a>
          )}
          {navCollapsed && (
            <a
              href="https://github.com/goblivend/tagForge"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground transition-colors hover:bg-accent/80 hover:text-accent-foreground"
              title="GitHub project"
            >
              <GitHubIcon className="h-4 w-4" />
            </a>
          )}
          {navCollapsed ? (
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground transition-colors hover:bg-accent/80 hover:text-accent-foreground"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          ) : (
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          )}
        </div>
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
