import { App, Modal, Notice, requestUrl } from 'obsidian';
import type HouseFixPlugin from '../main';

// ─── GitHub OAuth App Client ID ───────────────────────────────────────────────
//
// The Device Flow only requires the CLIENT_ID (it is public — the client secret
// is NOT needed for this flow).
//
// Steps to get your own:
//   1. github.com → Settings → Developer settings → OAuth Apps → New OAuth App
//   2. Application name: "House Fix Manager"
//   3. Homepage URL: anything (e.g. https://github.com)
//   4. Authorization callback URL: https://github.com  (not used by device flow)
//   5. Copy the "Client ID" (starts with Ov23...) and paste it below.
//
const GITHUB_CLIENT_ID = 'Ov23likHLKVE1ULzXoq3';

// Scopes needed: read:user to identify the user, no repo scope needed for
// GitHub Models API (it only checks that the account has Models access).
const DEVICE_SCOPES = 'read:user';

// GitHub API endpoints
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_API_URL = 'https://api.github.com/user';

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface AccessTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export class GitHubOAuthModal extends Modal {
  private plugin: HouseFixPlugin;
  private pollTimeout: ReturnType<typeof setTimeout> | null = null;
  private cancelled = false;

  constructor(app: App, plugin: HouseFixPlugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('hf-oauth-modal');

    contentEl.createEl('h2', { text: 'Sign in with GitHub' });
    contentEl.createEl('p', {
      text: 'Authorise House Fix Manager to use the GitHub Models AI API.',
      cls: 'hf-settings-desc',
    });

    // Check if client ID is still the placeholder
    if (GITHUB_CLIENT_ID.includes('YOUR_CLIENT_ID_HERE')) {
      this.showClientIdError(contentEl);
      return;
    }

    // Show loading state while requesting device code
    const statusEl = contentEl.createDiv({ cls: 'hf-oauth-status' });
    statusEl.createDiv({ cls: 'hf-loading', text: 'Requesting authorisation code…' });

    try {
      const deviceData = await this.requestDeviceCode();
      this.renderCodeStep(contentEl, statusEl, deviceData);
    } catch (e) {
      statusEl.empty();
      statusEl.createEl('p', {
        text: `Failed to start sign-in: ${(e as Error).message}`,
        cls: 'hf-warning',
      });
    }
  }

  onClose() {
    this.cancelled = true;
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
    this.contentEl.empty();
  }

  // ─── Step 1: request device + user code ─────────────────────────────────────

  private async requestDeviceCode(): Promise<DeviceCodeResponse> {
    const res = await requestUrl({
      url: DEVICE_CODE_URL,
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        scope: DEVICE_SCOPES,
      }),
    });

    // requestUrl throws on non-2xx, so if we get here status is 2xx
    let data: DeviceCodeResponse;
    const contentType = res.headers?.['content-type'] ?? '';
    if (contentType.includes('application/x-www-form-urlencoded') || !contentType.includes('json')) {
      const params = new URLSearchParams(res.text);
      data = {
        device_code: params.get('device_code') ?? '',
        user_code: params.get('user_code') ?? '',
        verification_uri: params.get('verification_uri') ?? 'https://github.com/login/device',
        expires_in: parseInt(params.get('expires_in') ?? '900', 10),
        interval: parseInt(params.get('interval') ?? '5', 10),
      };
    } else {
      data = res.json as DeviceCodeResponse;
    }

    console.log('[HouseFix] device code response:', JSON.stringify({ ...data, device_code: '***' }));

    if (!data.device_code) {
      throw new Error('Invalid response from GitHub (no device_code)');
    }
    return data;
  }

  // ─── Step 2: show user_code + poll ──────────────────────────────────────────

  private renderCodeStep(
    contentEl: HTMLElement,
    statusEl: HTMLElement,
    deviceData: DeviceCodeResponse,
  ) {
    statusEl.empty();

    // Instruction
    statusEl.createEl('p', {
      text: '1. Copy the code below, then click "Open GitHub" to authorise.',
      cls: 'hf-settings-desc',
    });

    // User code display
    const codeBox = statusEl.createDiv({ cls: 'hf-oauth-code-box' });
    const codeEl = codeBox.createEl('span', {
      text: deviceData.user_code,
      cls: 'hf-oauth-code',
    });

    const copyBtn = codeBox.createEl('button', { text: 'Copy', cls: 'hf-btn hf-btn-sm' });
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(deviceData.user_code).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
      });
    });

    // Open GitHub button
    const openBtn = statusEl.createEl('button', {
      text: 'Open GitHub →',
      cls: 'hf-btn hf-btn-primary',
    });
    openBtn.style.marginTop = '8px';
    openBtn.addEventListener('click', () => {
      // Copy to clipboard automatically when opening
      navigator.clipboard.writeText(deviceData.user_code);
      window.open(deviceData.verification_uri, '_blank');
      openBtn.textContent = 'Opened — waiting for authorisation…';
      openBtn.disabled = true;
    });

    // Waiting indicator
    const waitEl = statusEl.createDiv({ cls: 'hf-oauth-waiting' });
    waitEl.createDiv({ cls: 'hf-loading' });
    waitEl.createEl('span', {
      text: 'Waiting for you to authorise in the browser…',
      cls: 'hf-settings-desc',
    });

    // Expiry countdown
    const expiresAt = Date.now() + deviceData.expires_in * 1000;
    const expiryEl = statusEl.createEl('p', { cls: 'hf-oauth-expiry' });

    const updateExpiry = () => {
      const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      expiryEl.textContent = `Code expires in ${remaining}s`;
    };
    updateExpiry();

    // Cancel button
    const cancelBtn = statusEl.createEl('button', { text: 'Cancel', cls: 'hf-btn hf-btn-secondary' });
    cancelBtn.style.marginTop = '8px';
    cancelBtn.addEventListener('click', () => this.close());

    // Start polling using recursive setTimeout so we can adjust the interval
    // dynamically when GitHub sends a slow_down response.
    let currentIntervalMs = Math.max((deviceData.interval ?? 5) * 1000, 5000);

    const schedulePoll = () => {
      this.pollTimeout = setTimeout(async () => {
        if (this.cancelled) return;
        updateExpiry();

        if (Date.now() > expiresAt) {
          waitEl.empty();
          waitEl.createEl('p', { text: 'Code expired. Please try again.', cls: 'hf-warning' });
          return;
        }

        const result = await this.pollAccessToken(deviceData.device_code);

        // Check cancelled again — modal may have been closed while we were awaiting
        if (this.cancelled) return;

        if (result !== null && typeof result === 'object' && result.access_token) {
          // Success — we have the token
          await this.handleSuccess(result.access_token, contentEl);
          return;
        }

        if (typeof result === 'number') {
          // slow_down — use the new interval
          currentIntervalMs = result * 1000;
        }

        // null = still pending, number = slow_down — schedule next poll
        schedulePoll();
      }, currentIntervalMs);
    };

    schedulePoll();
  }

  // ─── Poll for token ──────────────────────────────────────────────────────────
  // Returns:
  //   null          → authorization_pending, keep polling at same interval
  //   number        → slow_down, value is the new minimum interval in seconds
  //   AccessTokenResponse → success, has access_token

  private async pollAccessToken(deviceCode: string): Promise<null | number | AccessTokenResponse> {
    try {
      const res = await requestUrl({
        url: ACCESS_TOKEN_URL,
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      let data: AccessTokenResponse & { interval?: number };
      const contentType = res.headers?.['content-type'] ?? '';
      if (contentType.includes('application/x-www-form-urlencoded') || !contentType.includes('json')) {
        const params = new URLSearchParams(res.text);
        data = {
          access_token: params.get('access_token') ?? undefined,
          token_type: params.get('token_type') ?? undefined,
          scope: params.get('scope') ?? undefined,
          error: params.get('error') ?? undefined,
          error_description: params.get('error_description') ?? undefined,
        };
      } else {
        data = res.json as AccessTokenResponse & { interval?: number };
      }

      console.log('[HouseFix] poll response:', JSON.stringify(data));

      if (data.access_token) return data;

      if (data.error === 'slow_down') {
        // GitHub tells us the new required minimum interval
        const newInterval = (data.interval ?? 5) + 5;
        return newInterval;
      }

      if (data.error === 'authorization_pending') {
        return null;
      }

      // Any other error (expired_token, access_denied, etc.) — log and stop
      console.error('[HouseFix] OAuth terminal error:', data.error, data.error_description);
      return null;
    } catch (e) {
      console.error('[HouseFix] poll requestUrl error:', e);
      return null;
    }
  }

  // ─── Success ─────────────────────────────────────────────────────────────────

  private async handleSuccess(accessToken: string, contentEl: HTMLElement) {
    // Replace the entire modal body so we're never working with a stale child ref
    contentEl.empty();
    contentEl.createDiv({ cls: 'hf-loading', text: 'Fetching your GitHub profile…' });

    let login = 'GitHub User';
    try {
      const userRes = await requestUrl({
        url: USER_API_URL,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github+json',
        },
      });
      const user = userRes.json as GitHubUser;
      login = user.name || user.login || 'GitHub User';
    } catch { /* non-fatal */ }

    // Persist
    this.plugin.settings.githubAccessToken = accessToken;
    this.plugin.settings.githubUser = login;
    await this.plugin.saveSettings();

    // Show success — re-render the whole modal so nothing is stale
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Signed in!' });
    contentEl.createEl('p', {
      text: `Signed in as ${login}`,
      cls: 'hf-success',
    });
    contentEl.createEl('p', {
      text: 'AI features are now enabled. You can close this window.',
      cls: 'hf-settings-desc',
    });
    const doneBtn = contentEl.createEl('button', { text: 'Done', cls: 'hf-btn hf-btn-primary' });
    doneBtn.style.marginTop = '8px';
    doneBtn.addEventListener('click', () => this.close());

    new Notice(`House Fix: Signed in as ${login}`, 4000);
  }

  // ─── Client ID not configured ────────────────────────────────────────────────

  private showClientIdError(contentEl: HTMLElement) {
    const err = contentEl.createDiv({ cls: 'hf-upload-warnings' });
    err.createEl('strong', { text: 'GitHub OAuth App not configured' });
    err.createEl('p', {
      text: 'The plugin needs a GitHub OAuth App Client ID before sign-in works. This is a one-time developer setup:',
    });
    const steps = err.createEl('ol');
    steps.createEl('li', { text: 'Go to github.com → Settings → Developer settings → OAuth Apps → New OAuth App' });
    steps.createEl('li', { text: 'Name: "House Fix Manager", Homepage URL: https://github.com, Callback URL: https://github.com' });
    steps.createEl('li', { text: 'Copy the Client ID (starts with Ov23…)' });
    steps.createEl('li', { text: 'Open the plugin source: src/components/GitHubOAuthModal.ts and replace YOUR_CLIENT_ID_HERE with your Client ID' });
    steps.createEl('li', { text: 'Run "npm run build" in the plugin folder to rebuild' });

    err.createEl('p', {
      text: 'The Client ID is not a secret — it is safe to include in the plugin source.',
      cls: 'hf-hint',
    });
  }
}
