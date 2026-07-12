"use client";

import { useTranslations } from "next-intl";
import { PostFeed } from "@/components/PostFeed";
import { useAuth } from "@/hooks/useAuth";
import { SEED_USERS } from "@/hooks/useAuth";

export default function ForumPage() {
  const t = useTranslations("feed");
  const tAuth = useTranslations("auth");
  const { isAuthenticated, signInAs } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="page-container">
        <div className="hero">
          <div className="hero-icon">💬</div>
          <h1 className="hero-title">{t("title")}</h1>
          <p className="hero-subtitle">{t("subtitle")}</p>
          <p className="hero-cta-label">{tAuth("signInAs")}:</p>
          <div className="hero-cta-group">
            {SEED_USERS.map((user) => (
              <button
                key={user.id}
                id={`hero-sign-in-${user.id}`}
                className={`hero-cta-btn hero-cta-btn--${user.role}`}
                onClick={() => signInAs(user.id)}
              >
                <span className="cta-avatar">
                  {user.name.charAt(0)}
                </span>
                <span className="cta-info">
                  <span className="cta-name">{user.name}</span>
                  <span className="cta-role">{user.role}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-subtitle">{t("subtitle")}</p>
      </div>
      <PostFeed />
    </div>
  );
}
