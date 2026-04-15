import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading)
    return <p>Loading...</p>; // waiting for AuthProvider finished the refresh
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}