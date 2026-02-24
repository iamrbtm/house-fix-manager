import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type HouseFixPlugin from '../main';
import { GITHUB_MODELS } from '../models';
import { GitHubOAuthModal } from './GitHubOAuthModal';

export class HouseFixSettingsTab extends PluginSettingTab {
  plugin: HouseFixPlugin;

  constructor(app: App, plugin: HouseFixPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'House Fix Manager Settings' });

    // ─── GitHub AI Settings ───────────────────────────────────────────────

    containerEl.createEl('h3', { text: 'GitHub Account' });
    containerEl.createEl('p', {
      text: 'House Fix uses the GitHub Models AI API. Sign in with your GitHub account to enable AI-powered task analysis and schedule generation.',
      cls: 'hf-settings-desc',
    });

    const isSignedIn = !!this.plugin.settings.githubAccessToken;

    if (isSignedIn) {
      // ── Signed-in state ──────────────────────────────────────────────────
      new Setting(containerEl)
        .setName('Signed in')
        .setDesc(`Connected as: ${this.plugin.settings.githubUser || 'GitHub User'}`)
        .addButton(btn => {
          btn.setButtonText('Sign out')
             .setWarning()
             .onClick(async () => {
               this.plugin.settings.githubAccessToken = '';
               this.plugin.settings.githubUser = '';
               await this.plugin.saveSettings();
               new Notice('House Fix: Signed out of GitHub');
               this.display(); // re-render
             });
        });

      new Setting(containerEl)
        .setName('Test AI Connection')
        .setDesc('Verify the connection and model configuration work correctly.')
        .addButton(btn => {
          btn.setButtonText('Test Connection')
             .setCta()
             .onClick(async () => {
               btn.setButtonText('Testing…');
               btn.setDisabled(true);
               const ai = this.plugin.getAI();
               const result = await ai.testConnection();
               btn.setButtonText('Test Connection');
               btn.setDisabled(false);
               if (result.success) {
                 new Notice(`✓ ${result.message}`, 5000);
               } else {
                 new Notice(`✗ ${result.message}`, 8000);
               }
             });
        });
    } else {
      // ── Signed-out state ─────────────────────────────────────────────────
      new Setting(containerEl)
        .setName('GitHub Account')
        .setDesc('Sign in with GitHub to enable AI features (task analysis & schedule generation).')
        .addButton(btn => {
          btn.setButtonText('Sign in with GitHub')
             .setCta()
             .onClick(() => {
               new GitHubOAuthModal(this.app, this.plugin).open();
               // Re-render after modal closes (poll until token appears)
               const check = setInterval(() => {
                 if (this.plugin.settings.githubAccessToken) {
                   clearInterval(check);
                   this.display();
                 }
               }, 1000);
               // Stop polling after 10 min regardless
               setTimeout(() => clearInterval(check), 600_000);
             });
        });

      const helpEl = containerEl.createDiv({ cls: 'hf-settings-token-help' });
      helpEl.createEl('p', { text: 'What happens when you sign in:' });
      const steps = helpEl.createEl('ol');
      steps.createEl('li', { text: 'A short code is shown in Obsidian' });
      steps.createEl('li', { text: 'You open github.com/login/device in your browser and enter the code' });
      steps.createEl('li', { text: 'Obsidian detects the authorisation and saves your token automatically' });
      steps.createEl('li', { text: 'No password is stored — only an OAuth access token' });
    }

    // ─── AI Model ─────────────────────────────────────────────────────────

    containerEl.createEl('h3', { text: 'AI Model' });

    new Setting(containerEl)
      .setName('Model')
      .setDesc('Which GitHub Models AI model to use for analysis and scheduling.')
      .addDropdown(drop => {
        for (const m of GITHUB_MODELS) {
          drop.addOption(m.value, m.label);
        }
        drop.setValue(this.plugin.settings.githubModel);
        drop.onChange(async (value) => {
          this.plugin.settings.githubModel = value;
          await this.plugin.saveSettings();
        });
      });

    // ─── Database Settings ────────────────────────────────────────────────

    containerEl.createEl('h3', { text: 'Database' });

    new Setting(containerEl)
      .setName('Database File Name')
      .setDesc('Name of the SQLite database file stored in your vault root. Restart Obsidian after changing.')
      .addText(text => {
        text
          .setPlaceholder('house-fix.db')
          .setValue(this.plugin.settings.dbFileName)
          .onChange(async (value) => {
            const trimmed = value.trim();
            if (trimmed) {
              this.plugin.settings.dbFileName = trimmed;
              await this.plugin.saveSettings();
            }
          });
      });

    // ─── About ────────────────────────────────────────────────────────────

    containerEl.createEl('h3', { text: 'About' });
    const about = containerEl.createDiv({ cls: 'hf-settings-about' });
    about.createEl('p', { text: 'House Fix Manager v1.0.0' });
    about.createEl('p', { text: 'Manage home renovation tasks with AI-powered analysis and scheduling.' });
  }
}
