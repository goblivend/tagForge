import { Outlet, NavLink } from "react-router-dom";
import { ListMusic, Settings, Home, List } from "lucide-react";
import { AudioPlayer } from "../player/AudioPlayer";
import { useAppStore } from "../../store";

export function AppLayout() {
  const { selectedFile } = useAppStore();
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-card sm:flex">
        <div className="flex h-14 items-center border-b px-4">
          <ListMusic className="mr-2 h-6 w-6 text-primary" />
          <span className="text-lg font-semibold tracking-tight">TagForge</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
              }`
            }
          >
            <Home className="h-4 w-4" />
            Library
          </NavLink>
          <NavLink
            to="/playlists"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
              }`
            }
          >
            <List className="h-4 w-4" />
            Playlists
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
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
        <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 min-h-0">
          <Outlet />
        </div>

        {/* Audio Player Footer Bar */}
        {selectedFile && (
          <div className="border-t bg-card h-20 p-4 flex items-center justify-between shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.1)] z-10 relative">
            <AudioPlayer />
          </div>
        )}
      </main>
    </div>
  );
}
