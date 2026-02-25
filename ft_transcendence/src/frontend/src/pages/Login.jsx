import { useState } from "react";
import { login, refresh, logout } from "../api/auth.js";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [msg, setMsg] = useState("");

  const handleLogin = async e => {
    e.preventDefault();
    try {
      const res = await login({ email, password });
      if (res.error) {
        setMsg(res.error);
        return;
      }
      setAccessToken(res.accessToken);
      setMsg(JSON.stringify(res));
    } catch (err) {
      setMsg("Fetch failed in login: " + err.message);
    }
  };

  const handleRefresh = async e => {
    e.preventDefault();
    try {
      const res = await refresh();
      setAccessToken(res.accessToken);
      setMsg(JSON.stringify(res));
    } catch (err) {
      setMsg("Fetch failed in refresh: " + err.message);
    }
  };

  const handleLogout = async e => {
    e.preventDefault();
    try {
      const res = await logout();
      setAccessToken("");
      setMsg(JSON.stringify(res));
    } catch (err) {
      setMsg("Fetch failed in logout: " + err.message);
    }
  };

  return (
    <div>
      <h1>Login</h1>
      <form onSubmit={handleLogin}>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button type="submit">Login</button>
      </form>
      <button onClick={() => navigate("/register")}>Go to Register</button>
      <button onClick={handleRefresh}>Refresh Token</button>
      <button onClick={handleLogout}>Logout</button>
      <p>{msg}</p>
    </div>
  );
}
