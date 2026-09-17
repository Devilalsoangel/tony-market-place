/**
 * Money/event notifications (server-owned rows the bell + Orders tab read).
 *
 * Fire-and-forget ONLY — a notification must never fail or slow a money
 * movement: every caller invokes without await and every write is
 * best-effort. Types consumed by the app: 'order' (Orders tab + deep-link to
 * /orders), 'promotion' (explore rail link). Social types (follower/like/
 * comment) are emitted at their own call sites.
 */

export interface MoneyNotice {
  /** Recipient username. Falsy = skip silently. */
  username: string | null | undefined;
  type: string;
  /** Actor display name (who did it). */
  userName?: string;
  /** Actor username for avatar routing. */
  userHandle?: string;
  /** Human sentence fragment, e.g. "shipped your order". */
  action: string;
  /** Subject, e.g. order total or listing title. */
  target?: string;
  /** Deep-link id (order/tracking id). */
  targetId?: string;
}

export function notifyUser(
  prisma: any,
  notice: MoneyNotice
): void {
  const to = String(notice.username ?? "").trim();
  if (!to) return;
  void prisma.userNotification
    .create({
      data: {
        username: to,
        type: notice.type,
        userName: String(notice.userName ?? "susej").slice(0, 120),
        ...(notice.userHandle ? { userHandle: String(notice.userHandle).slice(0, 120) } : {}),
        action: String(notice.action).slice(0, 300),
        ...(notice.target ? { target: String(notice.target).slice(0, 200) } : {}),
        ...(notice.targetId ? { targetId: String(notice.targetId).slice(0, 120) } : {}),
      },
    })
    .catch(() => {});
}
