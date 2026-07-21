/** Profile secrets store — separate from exportable profiles. */

const KEY = "assmud.profileSecrets";

export type ProfileSecretEntry = {
  /** MUD account / character name for auto-login */
  account?: string;
  password?: string;
  /** When true: send account after connect; send password on Telnet ECHO mask */
  autoLogin?: boolean;
  notes?: string;
};

export type ProfileSecrets = Record<string, ProfileSecretEntry>;

/** Node / tests without DOM: in-memory store. */
let memoryStore: ProfileSecrets = {};

export function loadProfileSecrets(): ProfileSecrets {
  if (typeof localStorage === "undefined") {
    return { ...memoryStore };
  }
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
  if (typeof localStorage === "undefined") {
    memoryStore = { ...s };
    return;
  }
  localStorage.setItem(KEY, JSON.stringify(s));
}

function patchSecret(
  profileId: string,
  patch: Partial<ProfileSecretEntry>,
): void {
  const s = loadProfileSecrets();
  const prev = s[profileId] ?? {};
  const next: ProfileSecretEntry = { ...prev, ...patch };
  // drop empty strings
  if (next.account === "") delete next.account;
  if (next.password === "") delete next.password;
  if (
    !next.account &&
    !next.password &&
    !next.autoLogin &&
    !next.notes
  ) {
    delete s[profileId];
  } else {
    s[profileId] = next;
  }
  saveProfileSecrets(s);
}

export function getProfileSecret(
  profileId: string,
): ProfileSecretEntry | undefined {
  return loadProfileSecrets()[profileId];
}

export function setProfilePassword(profileId: string, password: string): void {
  patchSecret(profileId, { password });
}

export function getProfilePassword(profileId: string): string | undefined {
  return loadProfileSecrets()[profileId]?.password;
}

export function setProfileAccount(profileId: string, account: string): void {
  patchSecret(profileId, { account });
}

export function getProfileAccount(profileId: string): string | undefined {
  return loadProfileSecrets()[profileId]?.account;
}

export function setProfileAutoLogin(profileId: string, on: boolean): void {
  patchSecret(profileId, { autoLogin: on });
}

export function getProfileAutoLogin(profileId: string): boolean {
  return Boolean(loadProfileSecrets()[profileId]?.autoLogin);
}

/** Replace secret fields in one write (editor save). */
export function setProfileSecretEntry(
  profileId: string,
  entry: ProfileSecretEntry,
): void {
  const s = loadProfileSecrets();
  const clean: ProfileSecretEntry = {};
  if (entry.account?.trim()) clean.account = entry.account.trim();
  if (entry.password) clean.password = entry.password;
  if (entry.autoLogin) clean.autoLogin = true;
  if (entry.notes?.trim()) clean.notes = entry.notes.trim();
  if (!clean.account && !clean.password && !clean.autoLogin && !clean.notes) {
    delete s[profileId];
  } else {
    s[profileId] = clean;
  }
  saveProfileSecrets(s);
}

export function clearProfileSecret(profileId: string): void {
  const s = loadProfileSecrets();
  delete s[profileId];
  saveProfileSecrets(s);
}
