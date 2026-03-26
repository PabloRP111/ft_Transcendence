/*
api/chat.js — REST client for the chat-service

This file contains all HTTP calls to the chat backend.
Flow: Frontend → Nginx (/api/chat/) → Gateway (validates JWT) → chat-service

Note: Authentication is handled automatically by apiFetch via the stored access token.
WebSocket (real-time) is handled separately in src/hooks/useChat.js.
*/

import { apiFetch } from "./client";

/**
 * Fetch all conversations the logged-in user participates in
 */
export async function getConversations() {
  return apiFetch("/chat/conversations");
}

/**
 * Fetch message history for a conversation, from oldest to newest.
 * Supports pagination via 'limit', 'before' (timestamp), and 'beforeId'.
 */
export async function getMessages(conversationId, { limit = 50, before, beforeId } = {}) {
  const params = new URLSearchParams({ limit });
  if (before) params.set("before", before);
  if (beforeId) params.set("beforeId", beforeId);

  return apiFetch(`/chat/conversations/${conversationId}/messages?${params.toString()}`);
}

/**
 * Create a new conversation.
 * @param {string} type - "private" (DM) or "channel"
 * @param {Array} participantIds - User IDs to add (excluding the creator)
 * @param {string} name - Optional name for channels (REQUIRED for global Arena sync)
 * @param {boolean} is_public - Whether the channel can be discovered via search
 */
export async function createConversation(type, participantIds = [], name = null, is_public = true, description = null) {
  return apiFetch("/chat/conversations", {
    method: "POST",
    body: JSON.stringify({ type, participantIds, name, is_public, description }),
  });
}

/**
 * Search public channels by name
 */
export async function searchChannels(q) {
  return apiFetch(`/chat/conversations/search?q=${encodeURIComponent(q)}`);
}

/**
 * Join an existing public channel
 */
export async function joinChannel(conversationId) {
  return apiFetch(`/chat/conversations/${conversationId}/participants`, {
    method: "POST",
  });
}

/**
 * Send a message via REST.
 * Fallback mechanism if WebSocket is unavailable. 
 * Normally, use the 'sendMessage' socket event instead.
 */
export async function sendMessageREST(conversationId, content) {
  return apiFetch(`/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

/**
 * Edit an existing message.
 * Backend constraint: Only the original sender can perform this action.
 */
export async function editMessage(conversationId, messageId, content) {
  return apiFetch(`/chat/conversations/${conversationId}/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  });
}