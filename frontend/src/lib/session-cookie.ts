/** Name of the signed session cookie issued by the backend. */
export const SESSION_COOKIE = "ariadna_session";

/**
 * True when a raw `Cookie` header carries the session cookie (exact name, non-empty value).
 * A cookie that merely ends with the name (`xariadna_session`) does not count.
 */
export function hasSessionCookie(header: string | null): boolean {
  if (!header) return false;
  return header.split(";").some((part) => {
    const pair = part.trim();
    const eq = pair.indexOf("=");
    return eq > 0 && pair.slice(0, eq) === SESSION_COOKIE && pair.slice(eq + 1).length > 0;
  });
}

/**
 * Where an unauthenticated visitor goes: a 401 that still carried a session cookie means the
 * session expired (or was tampered with); no cookie at all is a plain first visit.
 */
export function unauthenticatedHref(cookieHeader: string | null): "/sesion-expirada" | "/entrar" {
  return hasSessionCookie(cookieHeader) ? "/sesion-expirada" : "/entrar";
}
