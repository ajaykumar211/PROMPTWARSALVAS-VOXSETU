import { CitizenAccount } from '../types/index.ts';

const STORAGE_KEY = 'voxsetu_citizen_account';

function generateRandomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'VX-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateRandomToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = 'ctok_';
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function getStoredCitizenAccount(): CitizenAccount | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.citizenId === 'string' && typeof parsed.token === 'string') {
      return parsed as CitizenAccount;
    }
  } catch {
    // Ignore storage parse error
  }
  return null;
}

export function saveCitizenAccount(account: CitizenAccount): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  } catch {
    // Ignore storage write error
  }
}

export function getOrCreateCitizenAccount(): CitizenAccount {
  const existing = getStoredCitizenAccount();
  if (existing) return existing;

  const newAccount: CitizenAccount = {
    citizenId: generateRandomCode(),
    token: generateRandomToken(),
    createdAt: new Date().toISOString(),
  };

  saveCitizenAccount(newAccount);

  // Asynchronously register account with server
  if (typeof window !== 'undefined') {
    fetch('/api/citizen/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAccount),
    }).catch(() => {});
  }

  return newAccount;
}
