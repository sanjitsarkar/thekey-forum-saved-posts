"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, SEED_USERS } from "@/hooks/useAuth";
import { useState } from "react";

export function Navbar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { currentUser, signInAs, signOut, isAuthenticated } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="navbar-left">
          <Link href="/" className="navbar-brand">
            <span className="brand-icon">💬</span>
            <span className="brand-text">Forum</span>
          </Link>

          {isAuthenticated && (
            <div className="navbar-links">
              <Link
                href="/"
                className={`nav-link ${pathname === "/" ? "nav-link--active" : ""}`}
              >
                {t("nav.forum")}
              </Link>
              <Link
                href="/saved"
                className={`nav-link ${pathname === "/saved" ? "nav-link--active" : ""}`}
              >
                <span className="nav-link-icon">🔖</span>
                {t("nav.savedPosts")}
              </Link>
            </div>
          )}
        </div>

        <div className="navbar-right">
          {isAuthenticated && currentUser ? (
            <div className="user-menu-wrapper">
              <button
                id="user-menu-btn"
                className="user-pill"
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-expanded={showUserMenu}
                aria-haspopup="true"
              >
                <span className="user-avatar">
                  {currentUser.name.charAt(0).toUpperCase()}
                </span>
                <span className="user-name">{currentUser.name}</span>
                <span className={`role-badge role-badge--${currentUser.role}`}>
                  {t(`auth.role.${currentUser.role}`)}
                </span>
                <span className="chevron">▾</span>
              </button>

              {showUserMenu && (
                <div className="user-dropdown" role="menu">
                  <div className="dropdown-header">
                    {t("auth.signInAs")}
                  </div>
                  {SEED_USERS.map((user) => (
                    <button
                      key={user.id}
                      id={`switch-user-${user.id}`}
                      className={`dropdown-item ${user.id === currentUser.id ? "dropdown-item--active" : ""}`}
                      onClick={async () => {
                        await signInAs(user.id);
                        setShowUserMenu(false);
                      }}
                      role="menuitem"
                    >
                      <span className="dropdown-avatar">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="dropdown-user-info">
                        <span className="dropdown-user-name">{user.name}</span>
                        <span className={`role-badge-sm role-badge-sm--${user.role}`}>
                          {t(`auth.role.${user.role}`)}
                        </span>
                      </span>
                      {user.id === currentUser.id && (
                        <span className="check-mark">✓</span>
                      )}
                    </button>
                  ))}
                  <div className="dropdown-divider" />
                  <button
                    className="dropdown-item dropdown-item--danger"
                    onClick={() => { signOut(); setShowUserMenu(false); }}
                    role="menuitem"
                    id="sign-out-btn"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="sign-in-group">
              <span className="sign-in-label">{t("auth.signInAs")}:</span>
              {SEED_USERS.map((user) => (
                <button
                  key={user.id}
                  id={`sign-in-${user.id}`}
                  className={`sign-in-btn sign-in-btn--${user.role}`}
                  onClick={() => signInAs(user.id)}
                >
                  {user.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
