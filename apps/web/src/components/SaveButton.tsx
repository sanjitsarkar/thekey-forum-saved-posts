"use client";

import { useTranslations } from "next-intl";
import { useSaveToggleMutation } from "@/hooks/useForum";
import type { PostsQuery } from "@forum/shared";

interface SaveButtonProps {
  postId: string;
  hasSaved: boolean;
  savesCount: number;
  query?: Partial<PostsQuery>;
}

/**
 * Bookmark toggle button with optimistic UI.
 *
 * - Immediately flips state on click (optimistic update in React Query)
 * - Shows loading state while the mutation is in flight
 * - Rolls back automatically on error
 */
export function SaveButton({ postId, hasSaved, savesCount, query = {} }: SaveButtonProps) {
  const t = useTranslations("post");
  const { mutate, isPending } = useSaveToggleMutation(query);

  const handleClick = () => {
    mutate({ postId, currentlySaved: hasSaved });
  };

  return (
    <button
      id={`save-btn-${postId}`}
      className={`save-button ${hasSaved ? "save-button--saved" : ""} ${isPending ? "save-button--loading" : ""}`}
      onClick={handleClick}
      disabled={isPending}
      aria-label={hasSaved ? `Unsave post` : `Save post`}
      aria-pressed={hasSaved}
      title={hasSaved ? t("saved") : t("save")}
    >
      <span className="save-button-icon" aria-hidden="true">
        {hasSaved ? "🔖" : "🏷️"}
      </span>
      <span className="save-button-label">
        {hasSaved ? t("saved") : t("save")}
      </span>
    </button>
  );
}
