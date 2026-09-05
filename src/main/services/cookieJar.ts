import Store from "electron-store";
import { CookieItem } from "../../types";

type CookieStoreData = {
  cookies: Record<string, CookieItem[]>; // domain -> cookies
  allowlist: string[];
};

const cookieStore = new Store<CookieStoreData>({
  name: "routelens-cookie-jar",
  defaults: {
    cookies: {},
    allowlist: [],
  },
});

export class CookieJarService {
  /**
   * Normalize a domain string (lowercase, remove leading dot, trim)
   */
  static normalizeDomain(domain: string): string {
    let clean = (domain || "").toLowerCase().trim();
    if (clean.startsWith(".")) {
      clean = clean.substring(1);
    }
    // Remove protocol if user typed http://domain.com
    clean = clean.replace(/^https?:\/\//i, "");
    // Remove trailing slashes and paths
    clean = clean.split("/")[0];
    // Remove port numbers (e.g. localhost:3000 -> localhost)
    clean = clean.split(":")[0];
    return clean;
  }

  /**
   * Check if a cookie is expired
   */
  static isExpired(cookie: CookieItem): boolean {
    if (!cookie.expires) return false;
    const expTime = new Date(cookie.expires).getTime();
    if (isNaN(expTime)) return false;
    return expTime < Date.now();
  }

  /**
   * Match cookie domain with request host
   */
  static matchesDomain(cookieDomain: string, requestHost: string): boolean {
    const cDomain = CookieJarService.normalizeDomain(cookieDomain);
    const rHost = CookieJarService.normalizeDomain(requestHost);

    if (cDomain === rHost) return true;
    // Localhost / 127.0.0.1 compatibility
    if ((cDomain === "localhost" || cDomain === "127.0.0.1") && (rHost === "localhost" || rHost === "127.0.0.1")) {
      return true;
    }
    // Subdomain matching (e.g. cDomain "example.com" matches rHost "api.example.com")
    if (rHost.endsWith(`.${cDomain}`)) return true;

    return false;
  }

  /**
   * Match cookie path with request path
   */
  static matchesPath(cookiePath: string, requestPath: string): boolean {
    const cPath = (cookiePath || "/").trim();
    const rPath = (requestPath || "/").trim();

    if (cPath === "/" || cPath === "") return true;
    if (rPath === cPath) return true;

    const prefixWithSlash = cPath.endsWith("/") ? cPath : `${cPath}/`;
    return rPath.startsWith(prefixWithSlash);
  }

  /**
   * Parse a single RFC 6265 Set-Cookie header string
   */
  static parseSetCookie(header: string, requestUrl: string): CookieItem | null {
    if (!header || typeof header !== "string") return null;

    let urlObj: URL | null = null;
    try {
      urlObj = new URL(requestUrl);
    } catch {
      // Fallback
    }

    const defaultDomain = urlObj ? CookieJarService.normalizeDomain(urlObj.hostname) : "localhost";
    const defaultPath = "/";

    const parts = header.split(";").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return null;

    const [firstPart, ...attributes] = parts;
    const firstEq = firstPart.indexOf("=");
    if (firstEq === -1) return null;

    const name = firstPart.substring(0, firstEq).trim();
    const value = firstPart.substring(firstEq + 1).trim();
    if (!name) return null;

    const cookie: CookieItem = {
      name,
      value,
      domain: defaultDomain,
      path: defaultPath,
      httpOnly: false,
      secure: false,
      raw: header,
    };

    for (const attr of attributes) {
      const eqIdx = attr.indexOf("=");
      const attrKey = (eqIdx === -1 ? attr : attr.substring(0, eqIdx)).trim().toLowerCase();
      const attrVal = eqIdx === -1 ? "" : attr.substring(eqIdx + 1).trim();

      switch (attrKey) {
        case "domain":
          if (attrVal) {
            cookie.domain = CookieJarService.normalizeDomain(attrVal);
          }
          break;
        case "path":
          cookie.path = attrVal || "/";
          break;
        case "expires":
          if (attrVal) {
            try {
              const d = new Date(attrVal);
              if (!isNaN(d.getTime())) {
                cookie.expires = d.toISOString();
              }
            } catch {
              // ignore invalid date
            }
          }
          break;
        case "max-age": {
          const secs = parseInt(attrVal, 10);
          if (!isNaN(secs)) {
            cookie.maxAge = secs;
            cookie.expires = new Date(Date.now() + secs * 1000).toISOString();
          }
          break;
        }
        case "httponly":
          cookie.httpOnly = true;
          break;
        case "secure":
          cookie.secure = true;
          break;
        case "samesite":
          if (attrVal) {
            const lower = attrVal.toLowerCase();
            if (lower === "strict") cookie.sameSite = "Strict";
            else if (lower === "none") cookie.sameSite = "None";
            else cookie.sameSite = "Lax";
          }
          break;
      }
    }

    return cookie;
  }

  /**
   * Get all cookies stored in the jar (grouped by domain)
   */
  static getAllCookies(): Record<string, CookieItem[]> {
    const data = cookieStore.get("cookies", {});
    const cleaned: Record<string, CookieItem[]> = {};
    let hasExpired = false;

    for (const [domain, list] of Object.entries(data)) {
      if (!Array.isArray(list)) continue;
      const valid = list.filter((c) => {
        if (CookieJarService.isExpired(c)) {
          hasExpired = true;
          return false;
        }
        return true;
      });
      if (valid.length > 0) {
        cleaned[domain] = valid;
      }
    }

    if (hasExpired) {
      cookieStore.set("cookies", cleaned);
    }

    return cleaned;
  }

  /**
   * Check if a domain is allowed by the allowlist
   */
  static isDomainAllowed(domain: string): boolean {
    const allowlist = cookieStore.get("allowlist", []);
    if (!Array.isArray(allowlist) || allowlist.length === 0) {
      return true; // No allowlist filter = all domains allowed
    }
    const norm = CookieJarService.normalizeDomain(domain);
    return allowlist.some((a) => CookieJarService.matchesDomain(a, norm));
  }

  /**
   * Get all active matching cookies for a target request URL
   */
  static getCookiesForUrl(urlStr: string): CookieItem[] {
    let url: URL;
    try {
      url = new URL(urlStr);
    } catch {
      return [];
    }

    const host = url.hostname;
    if (!CookieJarService.isDomainAllowed(host)) {
      return [];
    }

    const all = CookieJarService.getAllCookies();
    const matching: CookieItem[] = [];

    for (const [domain, cookies] of Object.entries(all)) {
      if (CookieJarService.matchesDomain(domain, host)) {
        for (const c of cookies) {
          if (CookieJarService.matchesPath(c.path, url.pathname)) {
            // Check secure flag
            if (c.secure && url.protocol !== "https:" && host !== "localhost" && host !== "127.0.0.1") {
              continue;
            }
            matching.push(c);
          }
        }
      }
    }

    return matching;
  }

  /**
   * Produce the Cookie request header value string (e.g. "foo=bar; session=123")
   */
  static getCookieHeader(urlStr: string): string {
    const cookies = CookieJarService.getCookiesForUrl(urlStr);
    if (cookies.length === 0) return "";
    return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  }

  /**
   * Store or update a cookie in the jar
   */
  static setCookie(cookie: CookieItem): boolean {
    if (!cookie || !cookie.name || !cookie.domain) return false;
    const domain = CookieJarService.normalizeDomain(cookie.domain);

    if (!CookieJarService.isDomainAllowed(domain)) {
      return false;
    }

    const all = cookieStore.get("cookies", {});
    const list = Array.isArray(all[domain]) ? [...all[domain]] : [];

    const existingIdx = list.findIndex(
      (c) => c.name === cookie.name && (c.path || "/") === (cookie.path || "/")
    );

    const newCookie: CookieItem = {
      ...cookie,
      domain,
      path: cookie.path || "/",
    };

    if (existingIdx !== -1) {
      list[existingIdx] = newCookie;
    } else {
      list.push(newCookie);
    }

    all[domain] = list;
    cookieStore.set("cookies", all);
    return true;
  }

  /**
   * Save an array of Set-Cookie header strings received from a response
   */
  static saveSetCookieHeaders(headers: string[], requestUrl: string): CookieItem[] {
    if (!Array.isArray(headers) || headers.length === 0) return [];
    const saved: CookieItem[] = [];

    for (const h of headers) {
      const parsed = CookieJarService.parseSetCookie(h, requestUrl);
      if (parsed) {
        const ok = CookieJarService.setCookie(parsed);
        if (ok) {
          saved.push(parsed);
        }
      }
    }

    return saved;
  }

  /**
   * Delete a single cookie
   */
  static deleteCookie(domain: string, name: string): boolean {
    const norm = CookieJarService.normalizeDomain(domain);
    const all = cookieStore.get("cookies", {});
    if (!all[norm]) return false;

    all[norm] = all[norm].filter((c) => c.name !== name);
    if (all[norm].length === 0) {
      delete all[norm];
    }
    cookieStore.set("cookies", all);
    return true;
  }

  /**
   * Delete all cookies for a domain
   */
  static deleteDomain(domain: string): boolean {
    const norm = CookieJarService.normalizeDomain(domain);
    const all = cookieStore.get("cookies", {});
    if (all[norm]) {
      delete all[norm];
      cookieStore.set("cookies", all);
      return true;
    }
    return false;
  }

  /**
   * Clear all cookies from the jar
   */
  static clearAll(): boolean {
    cookieStore.set("cookies", {});
    return true;
  }

  /**
   * Get domain allowlist
   */
  static getAllowlist(): string[] {
    return cookieStore.get("allowlist", []);
  }

  /**
   * Set domain allowlist
   */
  static setAllowlist(domains: string[]): boolean {
    const cleaned = Array.from(
      new Set((domains || []).map((d) => CookieJarService.normalizeDomain(d)).filter(Boolean))
    );
    cookieStore.set("allowlist", cleaned);
    return true;
  }
}
