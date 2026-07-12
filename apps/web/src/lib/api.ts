/**
 * Typed API client for the Forum server.
 *
 * All requests include the auth token from localStorage.
 * In production this would use HttpOnly cookies instead.
 */

import type {
  Post,
  PostListResponse,
  PostsQuery,
  SaveToggleResponse,
  SavedPostsResponse,
} from "@forum/shared";

const BASE_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

// ─── Token storage ────────────────────────────────────────────────────────────

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

export function setAuthToken(token: string): void {
  localStorage.setItem("auth_token", token);
}

export function clearAuthToken(): void {
  localStorage.removeItem("auth_token");
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.message ?? "An error occurred",
      data.error
    );
  }

  return data as T;
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function fetchPosts(query: Partial<PostsQuery> = {}): Promise<PostListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.courseId) params.set("courseId", query.courseId);

  const qs = params.toString();
  return apiFetch<PostListResponse>(`/posts${qs ? `?${qs}` : ""}`);
}

export async function fetchPost(id: string): Promise<Post> {
  return apiFetch<Post>(`/posts/${id}`);
}

export async function createPost(data: {
  courseId: string;
  title: string;
  body: string;
}): Promise<Post> {
  return apiFetch<Post>("/posts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function removePost(id: string): Promise<void> {
  return apiFetch<void>(`/posts/${id}`, { method: "DELETE" });
}

// ─── Saves ────────────────────────────────────────────────────────────────────

export async function savePost(id: string): Promise<SaveToggleResponse> {
  return apiFetch<SaveToggleResponse>(`/posts/${id}/saves`, { method: "POST" });
}

export async function unsavePost(id: string): Promise<SaveToggleResponse> {
  return apiFetch<SaveToggleResponse>(`/posts/${id}/saves`, { method: "DELETE" });
}

export async function fetchSavedPosts(
  page = 1,
  limit = 20
): Promise<SavedPostsResponse> {
  return apiFetch<SavedPostsResponse>(
    `/users/me/saves?page=${page}&limit=${limit}`
  );
}

// ─── Dev helpers ──────────────────────────────────────────────────────────────

export async function devGetToken(userId: string): Promise<{ token: string; user: { id: string; name: string; role: string } }> {
  return apiFetch("/dev/token", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export { ApiError };
