import { apiFetch } from "./client";

export const getFriends = () => apiFetch("/friends");
export const getPendingRequests = () => apiFetch("/friends/pending");
export const getFriendStatus = (targetId) => apiFetch(`/friends/status/${targetId}`);
export const sendFriendRequest = (targetId) => apiFetch(`/friends/request/${targetId}`, { method: "POST" });
export const acceptFriendRequest = (requesterId) => apiFetch(`/friends/accept/${requesterId}`, { method: "POST" });
export const declineFriendRequest = (requesterId) => apiFetch(`/friends/decline/${requesterId}`, { method: "POST" });
export const removeFriend = (friendId) => apiFetch(`/friends/${friendId}`, { method: "DELETE" });
