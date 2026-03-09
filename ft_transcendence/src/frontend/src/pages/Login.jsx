import { useState } from "react";
import { login, logout } from "../api/auth.js";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const navigate = useNavigate();
  const { loginUser, logoutUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const handleLogin = async e => {
    e.preventDefault();

    try {
      const data = await login({ email, password });

      if (data.error) {
        setMsg(data.error);
        return;
      }

      loginUser(data.accessToken);
      navigate("/landing");

    } catch (err) {
      setMsg("Fetch failed in login: " + err.message);
    }
  };

  const handleLogout = async e => {
    e.preventDefault();

    try {
      await logout();
      logoutUser();
      navigate("/login");

    } catch (err) {
      setMsg("Fetch failed in logout: " + err.message);
    }
  };

  return (
    <div>
      <h1>Login</h1>

      <form onSubmit={handleLogin}>
        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <button type="submit">Login</button>
      </form>

      <button onClick={() => navigate("/register")}>
        Go to Register
      </button>

      <button onClick={handleLogout}>
        Logout
      </button>

      <p>{msg}</p>
    </div>
  );
}