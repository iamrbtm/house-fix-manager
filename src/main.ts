import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { HouseFixDatabase } from './database';
import { GitHubModelsClient } from './ai';
import { HouseFixSettings, DEFAULT_SETTINGS } from './models';
import { HouseFixSidebarView, VIEW_TYPE_HOUSE_FIX } from './views/SidebarView';
import { HouseFixSettingsTab } from './components/SettingsTab';

export default class HouseFixPlugin extends Plugin {
  settings!: HouseFixSettings;
  db!: HouseFixDatabase;

  async onload() {
    await this.loadSettings();

    // Initialize database
    this.db = new HouseFixDatabase(this.app, this.settings.dbFileName);
    try {
      await this.db.initialize();
    } catch (e) {
      new Notice(`House Fix: Failed to initialize database. ${(e as Error).message}`);
      console.error('House Fix DB init error:', e);
    }

    // Register sidebar view
    this.registerView(VIEW_TYPE_HOUSE_FIX, (leaf: WorkspaceLeaf) =>
      new HouseFixSidebarView(leaf, this)
    );

    // Ribbon icon
    this.addRibbonIcon('hammer', 'House Fix Manager', () => {
      this.activateView();
    });

    // Status bar item
    const statusBarItem = this.addStatusBarItem();
    statusBarItem.setText('🏠 House Fix');
    statusBarItem.addEventListener('click', () => this.activateView());

    // Commands
    this.addCommand({
      id: 'open-house-fix',
      name: 'Open House Fix Manager',
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'house-fix-new-task',
      name: 'New Task',
      callback: () => {
        this.activateView('dashboard');
        // Small delay to let view render
        setTimeout(() => {
          const view = this.getView();
          if (view) view.triggerNewTask();
        }, 200);
      },
    });

    this.addCommand({
      id: 'house-fix-generate-schedule',
      name: 'Generate AI Schedule',
      callback: () => {
        this.activateView('schedules');
      },
    });

    this.addCommand({
      id: 'house-fix-upload',
      name: 'Upload Task File',
      callback: () => {
        this.activateView('upload');
      },
    });

    // Settings tab
    this.addSettingTab(new HouseFixSettingsTab(this.app, this));
  }

  onunload() {
    this.db?.close();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  getAI(): GitHubModelsClient {
    return new GitHubModelsClient(this.settings.githubAccessToken, this.settings.githubModel);
  }

  private getView(): HouseFixSidebarView | null {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_HOUSE_FIX);
    if (leaves.length > 0) {
      return leaves[0].view as HouseFixSidebarView;
    }
    return null;
  }

  async activateView(section?: string) {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_HOUSE_FIX)[0];
    if (!leaf) {
      leaf = workspace.getLeftLeaf(false) ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE_HOUSE_FIX, active: true });
    }

    workspace.revealLeaf(leaf);

    if (section) {
      const view = leaf.view as HouseFixSidebarView;
      view.navigateTo(section);
    }
  }
}

// Re-export for use by other modules
export type { HouseFixPlugin };
