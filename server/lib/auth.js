import { google } from 'googleapis';
import { getStoredTokens, saveTokens, clearTokens } from './storage.js';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.OAUTH_REDIRECT_URI
  );
}

export function getAuthUrl() {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

export async function setCredentialsFromCode(code) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();
  const userId = data?.email || `user-${data?.id || Date.now()}`;
  await saveTokens(tokens, userId);
  return { tokens, userId };
}

export async function getAuthenticatedClient(userId) {
  const client = createOAuth2Client();
  const stored = await getStoredTokens(userId);
  if (!stored) return null;
  client.setCredentials(stored);
  if (stored.refresh_token && stored.expiry_date && Date.now() > stored.expiry_date - 60000) {
    try {
      const { credentials } = await client.refreshAccessToken();
      await saveTokens(credentials, userId);
      client.setCredentials(credentials);
    } catch {
      await clearTokens(userId);
      return null;
    }
  }
  return client;
}
