import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import Profile from "./pages/Profile.jsx";
import Landing from "./pages/Landing.jsx";
import Game from "./pages/Game.jsx";
import Credits from "./pages/Credits.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="/game" element={<Game />} />
          <Route path="/credits" element={<Credits />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
