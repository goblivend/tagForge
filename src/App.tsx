import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import Library from "./pages/Library";
import Playlists from "./pages/Playlists";
import Settings from "./pages/Settings";
function App() {
    return (
        <Router basename="/tagForge/">
            <Routes>
                <Route path="/" element={<AppLayout />}>
                    <Route index element={<Library />} />
                    <Route path="playlists" element={<Playlists />} />
                    <Route path="settings" element={<Settings />} />
                </Route>
            </Routes>
        </Router>
    );
}
export default App;
