"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  fetchPosts,
  fetchPost,
  fetchSavedPosts,
  savePost,
  unsavePost,
  removePost,
} from "@/lib/api";
import type { Post, PostListResponse, PostsQuery } from "@forum/shared";

// ─── Query keys ───────────────────────────────────────────────────────────────
// Centralised so invalidation is consistent across the app.

export const queryKeys = {
  posts: (query?: Partial<PostsQuery>) => ["posts", query ?? {}] as const,
  post: (id: string) => ["posts", id] as const,
  savedPosts: (page?: number) => ["savedPosts", page ?? 1] as const,
};

// ─── Posts hooks ──────────────────────────────────────────────────────────────

export function usePostsQuery(query: Partial<PostsQuery> = {}) {
  return useQuery({
    queryKey: queryKeys.posts(query),
    queryFn: () => fetchPosts(query),
    staleTime: 30_000, // 30 seconds
  });
}

export function usePostQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.post(id),
    queryFn: () => fetchPost(id),
    staleTime: 30_000,
  });
}

export function useSavedPostsQuery(page = 1) {
  return useQuery({
    queryKey: queryKeys.savedPosts(page),
    queryFn: () => fetchSavedPosts(page),
    staleTime: 30_000,
  });
}

// ─── Save toggle mutation (optimistic) ───────────────────────────────────────

/**
 * Optimistically toggles hasSaved + savesCount in the posts list cache,
 * then rolls back on error.
 *
 * Also invalidates the savedPosts query so the saved list stays consistent.
 */
export function useSaveToggleMutation(query: Partial<PostsQuery> = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, currentlySaved }: { postId: string; currentlySaved: boolean }) => {
      if (currentlySaved) {
        return unsavePost(postId);
      } else {
        return savePost(postId);
      }
    },

    onMutate: async ({ postId, currentlySaved }) => {
      // Cancel any in-flight queries to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.posts(query) });
      await queryClient.cancelQueries({ queryKey: queryKeys.post(postId) });

      // Snapshot previous value for rollback
      const prevPosts = queryClient.getQueryData<PostListResponse>(queryKeys.posts(query));
      const prevPost = queryClient.getQueryData<Post>(queryKeys.post(postId));

      const delta = currentlySaved ? -1 : 1;

      // Optimistically update the list
      if (prevPosts) {
        queryClient.setQueryData<PostListResponse>(queryKeys.posts(query), {
          ...prevPosts,
          posts: prevPosts.posts.map((p) =>
            p.id === postId
              ? { ...p, hasSaved: !currentlySaved, savesCount: Math.max(0, p.savesCount + delta) }
              : p
          ),
        });
      }

      // Optimistically update the detail view
      if (prevPost) {
        queryClient.setQueryData<Post>(queryKeys.post(postId), {
          ...prevPost,
          hasSaved: !currentlySaved,
          savesCount: Math.max(0, prevPost.savesCount + delta),
        });
      }

      return { prevPosts, prevPost };
    },

    onError: (_err, { postId }, context) => {
      // Roll back on error
      if (context?.prevPosts) {
        queryClient.setQueryData(queryKeys.posts(query), context.prevPosts);
      }
      if (context?.prevPost) {
        queryClient.setQueryData(queryKeys.post(postId), context.prevPost);
      }
    },

    onSettled: (_data, _err, { postId }) => {
      // Always sync with server after mutation settles
      queryClient.invalidateQueries({ queryKey: queryKeys.posts(query) });
      queryClient.invalidateQueries({ queryKey: queryKeys.post(postId) });
      // Keep the saved list consistent
      queryClient.invalidateQueries({ queryKey: ["savedPosts"] });
    },
  });
}

// ─── Remove post mutation (moderator) ────────────────────────────────────────

export function useRemovePostMutation(query: Partial<PostsQuery> = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => removePost(postId),

    onSuccess: (_data, postId) => {
      // Optimistically remove from list
      const prevPosts = queryClient.getQueryData<PostListResponse>(queryKeys.posts(query));
      if (prevPosts) {
        queryClient.setQueryData<PostListResponse>(queryKeys.posts(query), {
          ...prevPosts,
          posts: prevPosts.posts.filter((p) => p.id !== postId),
          total: prevPosts.total - 1,
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.posts(query) });
    },
  });
}
