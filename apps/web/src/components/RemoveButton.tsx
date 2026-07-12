"use client";

import { useTranslations } from "next-intl";
import { useRemovePostMutation } from "@/hooks/useForum";
import { useState } from "react";
import type { PostsQuery } from "@forum/shared";

interface RemoveButtonProps {
  postId: string;
  query?: Partial<PostsQuery>;
}

/**
 * Moderator-only remove button with confirmation dialog.
 */
export function RemoveButton({ postId, query = {} }: RemoveButtonProps) {
  const t = useTranslations("post");
  const { mutate, isPending } = useRemovePostMutation(query);
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="remove-confirm" role="alert" aria-live="polite">
        <span className="remove-confirm-text">Remove this post?</span>
        <button
          id={`remove-confirm-btn-${postId}`}
          className="btn-danger-sm"
          onClick={() => { mutate(postId); setConfirming(false); }}
          disabled={isPending}
        >
          Yes, remove
        </button>
        <button
          id={`remove-cancel-btn-${postId}`}
          className="btn-ghost-sm"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      id={`remove-btn-${postId}`}
      className="remove-button"
      onClick={() => setConfirming(true)}
      disabled={isPending}
      aria-label={`Remove post`}
      title={t("remove")}
    >
      🚫 {t("remove")}
    </button>
  );
}
