import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading)
    return <p>Loading...</p>; // espera a que AuthProvider termine el refresh
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}