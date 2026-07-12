"use client";

import { useTranslations } from "next-intl";
import { PostCard } from "./PostCard";
import { EmptyState } from "./EmptyState";
import { usePostsQuery } from "@/hooks/useForum";
import type { PostsQuery } from "@forum/shared";

interface PostFeedProps {
  query?: Partial<PostsQuery>;
}

/**
 * Data-fetching container for the post list.
 * Handles loading, error, and empty states.
 * Passes clean post data to PostCard (pure presentation).
 */
export function PostFeed({ query = {} }: PostFeedProps) {
  const t = useTranslations("feed");
  const tErrors = useTranslations("errors");
  const { data, isLoading, isError, refetch } = usePostsQuery(query);

  if (isLoading) {
    return (
      <div className="feed-state">
        <div className="loading-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="post-skeleton" aria-hidden="true">
              <div className="skeleton-header" />
              <div className="skeleton-title" />
              <div className="skeleton-body" />
              <div className="skeleton-body skeleton-body--short" />
              <div className="skeleton-footer" />
            </div>
          ))}
        </div>
        <p className="visually-hidden">{t("loading")}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon="⚠️"
        variant="error"
        message={tErrors("loadFailed")}
        action={
          <button id="retry-posts-btn" className="btn-primary" onClick={() => refetch()}>
            {tErrors("retry")}
          </button>
        }
      />
    );
  }

  if (!data?.posts.length) {
    return <EmptyState icon="💬" message={t("empty")} />;
  }

  return (
    <div className="post-feed" role="feed" aria-label="Discussion posts">
      {data.posts.map((post) => (
        <PostCard key={post.id} post={post} query={query} />
      ))}
    </div>
  );
}
