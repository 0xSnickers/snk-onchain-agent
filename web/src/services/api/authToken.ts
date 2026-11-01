const TOKEN_STORAGE_KEY = 'app.auth.token';

let memoryToken: string | null = null;

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function getAuthToken() {
  if (memoryToken) {
    return memoryToken;
  }

  if (!canUseStorage()) {
    return null;
  }

  memoryToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  return memoryToken;
}

export function setAuthToken(token: string) {
  memoryToken = token;

  if (canUseStorage()) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
}

export function clearAuthToken() {
  memoryToken = null;

  if (canUseStorage()) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}
