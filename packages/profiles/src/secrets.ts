/**
 * Profile secrets — prefers encrypted vault when unlocked.
 * Legacy plaintext key only for migration (see vault.ts).
 */

import {
  getVaultSecret,
  isVaultUnlocked,
  setVaultSecret,
  type VaultSecretEntry,
} from "./vault.js";

export type ProfileSecretEntry = VaultSecretEntry;
export type ProfileSecrets = Record<string, ProfileSecretEntry>;

/** @deprecated use vault; kept for migration detection only */
export { LEGACY_SECRETS_KEY as PLAINTEXT_SECRETS_KEY } from "./vault.js";

export function getProfileSecret(
  profileId: string,
): ProfileSecretEntry | undefined {
  if (!isVaultUnlocked()) return undefined;
  return getVaultSecret(profileId);
}

export function getProfilePassword(profileId: string): string | undefined {
  return getProfileSecret(profileId)?.password;
}

export function getProfileAccount(profileId: string): string | undefined {
  return getProfileSecret(profileId)?.account;
}

export function getProfileAutoLogin(profileId: string): boolean {
  return Boolean(getProfileSecret(profileId)?.autoLogin);
}

export async function setProfileSecretEntry(
  profileId: string,
  entry: ProfileSecretEntry,
): Promise<void> {
  if (!isVaultUnlocked()) {
    throw new Error("vault locked — unlock before saving secrets");
  }
  await setVaultSecret(profileId, entry);
}

export async function clearProfileSecret(profileId: string): Promise<void> {
  if (!isVaultUnlocked()) {
    throw new Error("vault locked");
  }
  await setVaultSecret(profileId, null);
}

// --- legacy sync stubs removed; use vault APIs ---
