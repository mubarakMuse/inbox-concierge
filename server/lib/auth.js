import { google } from 'googleapis';
import { getStoredTokens, saveTokens, clearTokens } from './storage.js';

let oauth2Client = null;

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

function getOAuth2Client() {
  if (!oauth2Client) {
    oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.OAUTH_REDIRECT_URI
    );
  }
  return oauth2Client;
}

export function getAuthUrl() {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

export async function setCredentialsFromCode(code) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();
  const userId = data?.email || `user-${data?.id || Date.now()}`;
  await saveTokens(tokens, userId);
  return { tokens, userId };
}

export async function getAuthenticatedClient(userId) {
  const client = getOAuth2Client();
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
