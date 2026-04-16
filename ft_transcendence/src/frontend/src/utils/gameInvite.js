import { createConversation, postSystemMessage } from "../api/chat";
import { getCurrentUser } from "../api/users";
import { notifyInviteSent } from "../components/InviteModal";

/**
 * Sends a game invite and posts a system message to the DM between the two users.
 * Call this from any invite entry point (ChatModule, InboxView, UserProfile).
 *
 * @param {object} socketRef - ref to the chat socket
 * @param {string} targetId - the invited user's id
 * @param {string} targetUsername - the invited user's username
 */
export async function sendGameInvite(socketRef, targetId, targetUsername) {
  // 1. Emit the socket invite event so the server handles the invite lifecycle
  socketRef.current?.emit("gameInviteSend", { targetId: String(targetId) });

  // 2. Show the "waiting" banner on the inviter's side
  notifyInviteSent(targetUsername);

  // 3. Post a system message to the DM (best-effort, non-blocking)
  try {
    const me = await getCurrentUser();
    const dm = await createConversation("private", [String(targetId)]);
    await postSystemMessage(dm.id, `⚔ ${me.username} challenged ${targetUsername} to a game`);
  } catch (err) {
    console.error("[gameInvite] failed to post system message:", err);
  }
}
