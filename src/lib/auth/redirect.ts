/**
 * Validates and normalizes redirect destinations to prevent open redirects,
 * protocol injection, and path-traversal/backslash bypasses.
 *
 * Only relative local application paths starting with a single '/' are permitted.
 * Absolute URLs, protocol-relative URLs (//), backslash bypasses (/\ or \),
 * control characters, and recursive auth destinations (/login, /register) are rejected.
 */
export function getSafeRedirectUrl(target: unknown, fallback: string = "/"): string {
  if (typeof target !== "string") {
    return fallback;
  }

  const trimmed = target.trim();
  if (!trimmed) {
    return fallback;
  }

  // Reject strings with ASCII control characters or newlines (CRLF injection prevention)
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    return fallback;
  }

  // Reject backslashes anywhere in the target to prevent browser parser normalization to '//'
  if (trimmed.includes("\\")) {
    return fallback;
  }

  // Must begin with a single '/' and not protocol-relative '//'
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  try {
    // Parse against a dummy origin to inspect pathname, search, and hash
    const parsed = new URL(trimmed, "http://localhost");

    // Origin must remain dummy localhost
    if (parsed.origin !== "http://localhost") {
      return fallback;
    }

    // Do not redirect back to auth pages to avoid redirect loops
    const lowerPath = parsed.pathname.toLowerCase();
    if (lowerPath === "/login" || lowerPath === "/register") {
      return fallback;
    }

    // Return the safe relative path including search query and hash
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Checks whether a target URL points to a platform administration route.
 * Matches exact "/platform-admin" or paths starting with "/platform-admin/".
 * Does NOT match similarly prefixed routes like "/platform-administrator".
 */
export function isPlatformAdminRoute(target: string): boolean {
  try {
    const parsed = new URL(target, "http://localhost");
    const pathname = parsed.pathname;
    return pathname === "/platform-admin" || pathname.startsWith("/platform-admin/");
  } catch {
    return false;
  }
}
