/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserProfile } from '../types';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: unknown) => void;
          }) => TokenClient;
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

const STORAGE_TOKEN_KEY = 'atelier_google_access_token';
const STORAGE_EXPIRES_KEY = 'atelier_google_token_expires';
const STORAGE_USER_KEY = 'atelier_google_user_profile';

export const OAUTH_CLIENT_ID = '698242881476-19c06hi1tm5qoqrc6io713i6n960qpql.apps.googleusercontent.com';

export const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

class GoogleAuthService {
  private tokenClient: TokenClient | null = null;
  private accessToken: string | null = null;
  private userProfile: UserProfile | null = null;
  private listeners: Array<() => void> = [];

  constructor() {
    this.restoreSession();
  }

  private restoreSession() {
    try {
      const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
      const storedExpires = localStorage.getItem(STORAGE_EXPIRES_KEY);
      const storedUser = localStorage.getItem(STORAGE_USER_KEY);

      if (storedToken && storedExpires) {
        const expiresAt = parseInt(storedExpires, 10);
        if (Date.now() < expiresAt) {
          this.accessToken = storedToken;
          if (storedUser) {
            this.userProfile = JSON.parse(storedUser);
          }
        } else {
          this.clearSession();
        }
      }
    } catch {
      this.clearSession();
    }
  }

  private clearSession() {
    this.accessToken = null;
    this.userProfile = null;
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_EXPIRES_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public getUserProfile(): UserProfile | null {
    return this.userProfile;
  }

  public async fetchUserProfile(token: string): Promise<UserProfile> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          name: data.name || data.email?.split('@')[0] || 'Studio Architect',
          email: data.email || 'designer@atelier-studio.com',
          picture: data.picture,
        };
      }
    } catch {
      // Fallback
    }

    return {
      name: 'Studio Designer',
      email: 'falcongroupdhk@gmail.com',
    };
  }

  public async initClient(): Promise<boolean> {
    if (this.tokenClient) return true;

    // Check if GIS is available
    if (!window.google?.accounts?.oauth2) {
      return false;
    }

    try {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: OAUTH_CLIENT_ID,
        scope: REQUIRED_SCOPES,
        callback: async (resp: TokenResponse) => {
          if (resp.error) {
            console.error('OAuth token error:', resp.error, resp.error_description);
            return;
          }

          if (resp.access_token) {
            this.accessToken = resp.access_token;
            const expiresInMs = (resp.expires_in || 3600) * 1000;
            const expiresAt = Date.now() + expiresInMs;

            localStorage.setItem(STORAGE_TOKEN_KEY, resp.access_token);
            localStorage.setItem(STORAGE_EXPIRES_KEY, expiresAt.toString());

            // Fetch user info
            const profile = await this.fetchUserProfile(resp.access_token);
            this.userProfile = profile;
            localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(profile));

            this.notify();
          }
        },
        error_callback: (err: unknown) => {
          console.error('GIS Error:', err);
        },
      });
      return true;
    } catch (e) {
      console.error('Failed to init GIS token client', e);
      return false;
    }
  }

  public async signIn(promptConsent: boolean = false): Promise<void> {
    if (!window.google?.accounts?.oauth2) {
      // If script is not ready, wait briefly
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const initialized = await this.initClient();
    if (!initialized || !this.tokenClient) {
      throw new Error('Google Identity Services client is not initialized yet. Please check connection.');
    }

    this.tokenClient.requestAccessToken({
      prompt: promptConsent ? 'consent' : '',
    });
  }

  public signOut(): void {
    if (this.accessToken && window.google?.accounts?.oauth2?.revoke) {
      try {
        window.google.accounts.oauth2.revoke(this.accessToken, () => {
          // Revoked
        });
      } catch {
        // Ignored
      }
    }
    this.clearSession();
    this.notify();
  }

  public setDirectToken(token: string, user?: UserProfile) {
    this.accessToken = token;
    const expiresAt = Date.now() + 3600 * 1000;
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
    localStorage.setItem(STORAGE_EXPIRES_KEY, expiresAt.toString());
    if (user) {
      this.userProfile = user;
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    }
    this.notify();
  }
}

export const googleAuth = new GoogleAuthService();
