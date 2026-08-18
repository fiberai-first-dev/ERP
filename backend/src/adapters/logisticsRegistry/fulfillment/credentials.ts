import { decryptJson } from "../../../utils/crypto.js";
import { LogisticsCredentials } from "../types.js";

export function decryptLogisticsCredentials(
  encrypted: string | null | undefined
): LogisticsCredentials | null {
  if (!encrypted) return null;
  try {
    return decryptJson<LogisticsCredentials>(encrypted);
  } catch {
    return null;
  }
}
