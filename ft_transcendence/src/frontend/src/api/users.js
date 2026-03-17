import { apiFetch } from "./client";

export function getCurrentUser() {
  return apiFetch("/me");
}
