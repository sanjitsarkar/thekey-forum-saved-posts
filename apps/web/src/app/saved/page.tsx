"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSavedPostsQuery } from "@/hooks/useForum";
import { PostCard } from "@/components/PostCard";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/hooks/useAuth";

export default function SavedPostsPage() {
  const t = useTranslations("saved");
  const tErrors = useTranslations("errors");
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError, refetch } = useSavedPostsQuery();

  if (!isAuthenticated) {
    return (
      <div className="page-container">
        <EmptyState
          icon="🔒"
          variant="locked"
          message="Please sign in to view your saved posts."
          action={
            <Link href="/" className="btn-primary">
              {t("backToForum")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">🔖</span>
          {t("title")}
        </h1>
        <p className="page-subtitle">{t("subtitle")}</p>
        {data && (
          <div className="saves-count-badge">
            {t("count", { count: data.total })}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="feed-state">
          <div className="loading-grid">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="post-skeleton" aria-hidden="true">
                <div className="skeleton-header" />
                <div className="skeleton-title" />
                <div className="skeleton-body" />
                <div className="skeleton-footer" />
              </div>
            ))}
          </div>
          <p className="visually-hidden">{t("loading")}</p>
        </div>
      )}

      {isError && (
        <EmptyState
          icon="⚠️"
          variant="error"
          message={tErrors("loadFailed")}
          action={
            <button id="retry-saved-btn" className="btn-primary" onClick={() => refetch()}>
              {tErrors("retry")}
            </button>
          }
        />
      )}

      {!isLoading && !isError && data?.posts.length === 0 && (
        <EmptyState
          icon="🔖"
          message={t("empty")}
          action={
            <Link href="/" id="browse-forum-link" className="btn-primary">
              {t("backToForum")}
            </Link>
          }
        />
      )}

      {!isLoading && !isError && data && data.posts.length > 0 && (
        <div className="post-feed saved-post-feed" role="feed" aria-label="Saved posts">
          {data.posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
