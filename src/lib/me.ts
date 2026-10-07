/** The signed-in account's settings ({ email, emailAlerts, currency, theme }), or null when signed out. One request per page load, shared by the currency and theme stores. */
export type Me = { email: string; emailAlerts: boolean; currency: string; theme: string | null };

let pending: Promise<Me | null> | undefined;

export function me(): Promise<Me | null> {
  pending ??= fetch("/api/account")
    .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
    .catch(() => null);
  return pending;
}
