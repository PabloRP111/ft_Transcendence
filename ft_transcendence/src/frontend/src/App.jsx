import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SocketProvider } from "./context/SocketContext";

import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import Profile from "./pages/Profile.jsx";
import Landing from "./pages/Landing.jsx";
import OnlineGame from "./pages/Online-Game.jsx";
import AIGame from "./pages/AI-Game.jsx";
import Credits from "./pages/Credits.jsx";
import Terms from "./pages/Terms.jsx";
import Privacy from "./pages/Privacy.jsx";
import Edit from "./pages/Edit.jsx";

import useTronTheme from "./hooks/useTronTheme";

function RouterContent() {
  useTronTheme();

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/credits" element={<Credits />} />
      <Route path="/ai-game" element={<AIGame />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/profile" element={<Profile />} />
        <Route path="/online-game" element={<OnlineGame />} />
        <Route path="/edit" element={<Edit />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <RouterContent />
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
