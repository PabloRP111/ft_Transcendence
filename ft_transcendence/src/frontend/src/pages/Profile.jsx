import { useState } from "react";
import { me } from "../api/auth.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Profile() {
  const { accessToken } = useAuth();
  const [user, setUser] = useState(null);

  const handleMe = async () => {
    const res = await me(accessToken);
    setUser(res.user);
  };

  return (
    <div>
      <h1>Profile</h1>
      <button onClick={handleMe}>Load Profile</button>

      {user && (
        <div>
          <p>ID: {user.id}</p>
          <p>Email: {user.email}</p>
          <p>Username: {user.username}</p>
        </div>
      )}
    </div>
  );
}
