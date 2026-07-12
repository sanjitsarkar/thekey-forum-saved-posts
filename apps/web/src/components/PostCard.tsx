"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Post } from "@forum/shared";
import { SaveButton } from "./SaveButton";
import { RemoveButton } from "./RemoveButton";
import { useAuth } from "@/hooks/useAuth";
import type { PostsQuery } from "@forum/shared";

interface PostCardProps {
  post: Post;
  query?: Partial<PostsQuery>;
  /** Show full body or truncated preview */
  fullBody?: boolean;
}

/**
 * Pure presentational component — receives all data as props.
 * No data fetching happens here.
 */
export function PostCard({ post, query = {}, fullBody = false }: PostCardProps) {
  const t = useTranslations();
  const { currentUser } = useAuth();

  const previewBody = post.body.length > 200 ? `${post.body.slice(0, 200)}…` : post.body;

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(post.createdAt));

  return (
    <article
      className={`post-card ${post.isRemoved ? "post-card--removed" : ""}`}
      id={`post-${post.id}`}
      aria-label={post.title}
    >
      <div className="post-card-header">
        <div className="post-meta">
          <span className="post-course-badge">{post.courseTitle}</span>
          <span className="post-meta-separator">·</span>
          <span className="post-author">
            {t("post.by")} <strong>{post.authorName}</strong>
          </span>
          <span className="post-meta-separator">·</span>
          <time className="post-date" dateTime={post.createdAt}>
            {formattedDate}
          </time>
        </div>

        <div className="post-actions">
          {currentUser && (
            <SaveButton
              postId={post.id}
              hasSaved={post.hasSaved}
              savesCount={post.savesCount}
              query={query}
            />
          )}

          {currentUser?.role === "moderator" && !post.isRemoved && (
            <RemoveButton postId={post.id} query={query} />
          )}
        </div>
      </div>

      <div className="post-card-body">
        <h2 className="post-title">
          <Link href={`/posts/${post.id}`} className="post-title-link">
            {post.title}
          </Link>
        </h2>

        {post.isRemoved && (
          <div className="removed-banner">
            <span>🚫</span>
            <span>{t("post.removed")}</span>
          </div>
        )}

        <p className="post-body-text">
          {fullBody ? post.body : previewBody}
        </p>

        {!fullBody && post.body.length > 200 && (
          <Link href={`/posts/${post.id}`} className="read-more-link">
            {t("post.readMore")} →
          </Link>
        )}
      </div>

      <div className="post-card-footer">
        <div className="post-stats">
          <span className="stat-item stat-item--saves">
            <span className="stat-icon">🔖</span>
            <span className="stat-label">
              {t("post.saves", { count: post.savesCount })}
            </span>
          </span>
          <span className="stat-item stat-item--likes">
            <span className="stat-icon">❤️</span>
            <span className="stat-label">
              {t("post.likes", { count: post.likesCount })}
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}
