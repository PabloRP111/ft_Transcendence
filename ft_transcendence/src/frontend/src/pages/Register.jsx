import { useState } from "react";
import { register } from "../api/auth.js";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const handleRegister = async e => {
    e.preventDefault();
    try {
      e.preventDefault();
      const res = await register({ email, username, password });
      setMsg(JSON.stringify(res));
    } catch (err) {
      setMsg("Fetch failed in register: " + err.message);
    }
  };

  return (
    <div>
      <h1>Register</h1>
      <form onSubmit={handleRegister}>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button type="submit">Register</button>
      </form>
      <button onClick={() => navigate("/login")}>Go to Login</button>
      <p>{msg}</p>
    </div>
  );
}
