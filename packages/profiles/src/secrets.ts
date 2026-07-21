/** Profile secrets store — separate from exportable profiles. */

const KEY = "assmud.profileSecrets";

export type ProfileSecrets = Record<
  string,
  { password?: string; notes?: string }
>;

export function loadProfileSecrets(): ProfileSecrets {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const j = JSON.parse(raw) as ProfileSecrets;
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

export function saveProfileSecrets(s: ProfileSecrets): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function setProfilePassword(profileId: string, password: string): void {
  const s = loadProfileSecrets();
  s[profileId] = { ...s[profileId], password };
  saveProfileSecrets(s);
}

export function getProfilePassword(profileId: string): string | undefined {
  return loadProfileSecrets()[profileId]?.password;
}

export function clearProfileSecret(profileId: string): void {
  const s = loadProfileSecrets();
  delete s[profileId];
  saveProfileSecrets(s);
}
