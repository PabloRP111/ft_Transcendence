// ── JWT helper ────────────────────────────────────────────────────────────────
// Decodes the JWT in localStorage to get the current user's id without an
// extra API call. Used for unread tracking keys and sender comparison.
export const getMyIdFromToken = () => {
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));
    return payload.id;
  } catch (e) {
    return null;
  }
};

// ── Unread tracking (localStorage) ────────────────────────────────────────────
// We store the ISO timestamp of when the user last opened each conversation.
// On load we compare it against conv.lastMessageAt to detect offline unreads.
const lastOpenedKey = (userId, convId) => `chat_last_opened_${userId}_${convId}`;

export const getLastOpened = (userId, convId) => {
  const val = localStorage.getItem(lastOpenedKey(userId, convId));
  return val ? new Date(val) : null;
};

export const saveLastOpened = (userId, convId) => {
  localStorage.setItem(lastOpenedKey(userId, convId), new Date().toISOString());
};

// ── Display name ──────────────────────────────────────────────────────────────
// For private DMs the backend returns a `participants` array with the other
// user(s). For channels we use the channel name.
export const convDisplayName = (conv) => {
  if (conv.type === "private") {
    return conv.participants?.[0]?.username || "Direct_Link";
  }
  return conv.name || "Public_Channel";
};
