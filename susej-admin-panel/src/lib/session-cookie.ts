// Browser-safe session constants. This module MUST stay free of node:* imports
// and module-level throws: it is imported by "use client" components
// (auth-gate, signed-in-guard). Server auth lives in @/lib/auth which
// re-exports SESSION_COOKIE so server importers keep working unchanged.
export const SESSION_COOKIE = "susej_session";
export const CHALLENGE_COOKIE = "susej_challenge";
