"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePostQuery } from "@/hooks/useForum";
import { PostCard } from "@/components/PostCard";
import { useAuth } from "@/hooks/useAuth";
import { use } from "react";

interface PostPageProps {
  params: Promise<{ id: string }>;
}

export default function PostPage({ params }: PostPageProps) {
  const { id } = use(params);
  const t = useTranslations("feed");
  const tErrors = useTranslations("errors");
  const { isAuthenticated } = useAuth();
  const { data: post, isLoading, isError } = usePostQuery(id);

  if (!isAuthenticated) {
    return (
      <div className="page-container">
        <div className="feed-state feed-state--empty">
          <span className="feed-state-icon">🔒</span>
          <p>Please sign in to view posts.</p>
          <Link href="/" className="btn-primary">Back to Forum</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container page-container--narrow">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/" className="breadcrumb-link">
          ← {t("title")}
        </Link>
      </nav>

      {isLoading && (
        <div className="post-skeleton post-skeleton--detail" aria-label="Loading post">
          <div className="skeleton-header" />
          <div className="skeleton-title skeleton-title--lg" />
          <div className="skeleton-body" />
          <div className="skeleton-body" />
          <div className="skeleton-body skeleton-body--short" />
          <div className="skeleton-footer" />
        </div>
      )}

      {isError && (
        <div className="feed-state feed-state--error">
          <span className="feed-state-icon">⚠️</span>
          <p>{tErrors("notFound")}</p>
          <Link href="/" className="btn-primary">
            {t("title")}
          </Link>
        </div>
      )}

      {!isLoading && !isError && post && (
        <PostCard post={post} fullBody />
      )}
    </div>
  );
}
