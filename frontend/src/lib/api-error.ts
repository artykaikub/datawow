import { AxiosError } from "axios";
import { translations, Locale } from "./i18n";

/**
 * Get the current locale from localStorage (fallback: "en").
 */
function getCurrentLocale(): Locale {
  if (typeof window !== "undefined") {
    return (localStorage.getItem("locale") as Locale) || "en";
  }
  return "en";
}

/**
 * Extract user-friendly error message from API response using i18n error codes.
 *
 * Priority:
 *   1. errorCode from response → map via i18n translations
 *   2. Validation details (field errors from backend)
 *   3. Fallback message
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError && err.response?.data) {
    const data = err.response.data;
    const locale = getCurrentLocale();
    const t = translations[locale] || translations["en"];

    // If backend sent an errorCode, use i18n mapping
    if (typeof data.errorCode === "number") {
      const key = `error.${data.errorCode}`;
      return t[key] || translations["en"][key] || t["error.fallback"] || fallback;
    }

    // Validation errors with field details
    if (Array.isArray(data.details) && data.details.length > 0) {
      return data.details[0];
    }

    // Legacy: plain message string
    if (typeof data.message === "string") {
      return data.message;
    }
    if (Array.isArray(data.message) && data.message.length > 0) {
      return data.message[0];
    }
  }
  return fallback;
}

/**
 * Extract the numeric error code from an API error response.
 */
export function getErrorCode(err: unknown): number | undefined {
  if (err instanceof AxiosError && err.response?.data) {
    const code = err.response.data.errorCode;
    if (typeof code === "number") return code;
  }
  return undefined;
}
