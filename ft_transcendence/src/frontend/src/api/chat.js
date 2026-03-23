/*
api/chat.js — REST client for the chat-service

This file contains all HTTP calls to the chat backend
All requests go through: Frontend → Nginx (/api/chat/) → Gateway (validates JWT) → chat-service

Authentication is handled automatically by apiFetch via the stored access token
No token needs to be passed manually to these functions

WebSocket (real-time) is handled separately in src/hooks/useChat.js.
This file is only for REST: loading history, creating conversations, etc.
*/

import { apiFetch } from "./client";

//Fetch all conversations the logged-in user participates in
export async function getConversations() {
  return apiFetch("/chat/conversations");
}

//Fetch message history for a conversation, oldest → newest.
export async function getMessages(conversationId, { limit = 50, before, beforeId } = {}) {
  const params = new URLSearchParams({ limit });
  if (before) params.set("before", before);
  if (beforeId) params.set("beforeId", beforeId);

  return apiFetch(`/chat/conversations/${conversationId}/messages?${params}`);
}

/* * Create a new conversation.
* type: "private" (DM) or "channel"
* participantIds: array of user IDs to add (besides the creator)
* name: optional name for channels (REQUIRED for global Arena sync) [English Comment]
*/
export async function createConversation(type, participantIds = [], name = null) {
  return apiFetch("/chat/conversations", {
    method: "POST",
    body: JSON.stringify({ 
      type, 
      participantIds,
      name // Fixed: Now the name is included in the request body [English Comment]
    }),
  });
}

// Send a message via REST (used as fallback if WebSocket is unavailable)
//In normal operation, messages are sent via the sendMessage socket event instead
export async function sendMessageREST(conversationId, content) {
  return apiFetch(`/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

//Edit a message. Only the original sender can do this
export async function editMessage(conversationId, messageId, content) {
  return apiFetch(`/chat/conversations/${conversationId}/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  });
}