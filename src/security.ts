/** Validate the Host header for a server that is intentionally loopback-only.
 *
 * @param hostHeader - The raw Host header value from the HTTP request
 * @returns True if the host is localhost, 127.x.x.x, or ::1
 */
export function isAllowedLoopbackHost(hostHeader: unknown): boolean {
  if (typeof hostHeader !== "string" || !hostHeader || /[\\/]/.test(hostHeader)) return false;
  try {
    const host = new URL(`http://${hostHeader}`).hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, "");
    return (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "::1" ||
      /^127(?:\.\d{1,3}){3}$/.test(host)
    );
  } catch {
    return false;
  }
}
