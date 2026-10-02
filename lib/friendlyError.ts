export function friendlyAppError(message?: string | null) {
  const raw = (message ?? "").trim();
  const value = raw.toLowerCase();

  if (!raw) return "Something went wrong. Please try again.";

  if (value.includes("invalid login credentials")) {
    return "That email or password is incorrect.";
  }
  if (value.includes("email not confirmed")) {
    return "Please confirm your email first. Check your inbox for the Hockey Live email.";
  }
  if (value.includes("already") && value.includes("match")) {
    return "That game looks like it already exists. Open the existing game instead.";
  }
  if (
    value.includes("duplicate key") ||
    value.includes("unique constraint") ||
    value.includes("already exists")
  ) {
    return "That already exists in Hockey Live. Search for the existing one and use it instead.";
  }
  if (
    value.includes("network") ||
    value.includes("failed to fetch") ||
    value.includes("load failed")
  ) {
    return "Hockey Live could not connect. Check your signal and try again.";
  }
  if (
    value.includes("row-level security") ||
    value.includes("permission denied") ||
    value.includes("not allowed to execute")
  ) {
    return "You do not have permission to do that. Try signing in again.";
  }
  if (
    value.includes("violates") ||
    value.includes("sqlstate") ||
    value.includes("schema cache") ||
    value.includes("pgrst") ||
    value.includes("relation ") ||
    value.includes("function public.") ||
    raw.length > 180
  ) {
    return "Hockey Live could not save that. Please try again.";
  }

  return raw;
}
