import { ItemView, WorkspaceLeaf } from 'obsidian';
import type HouseFixPlugin from '../main';
import { DashboardView } from './DashboardView';
import { RoomsView } from './RoomsView';
import { PeopleView } from './PeopleView';
import { SchedulesView } from './SchedulesView';
import { SharedTasksView } from './SharedTasksView';
import { UploadView } from './UploadView';
import { ReportsView } from './ReportsView';

export const VIEW_TYPE_HOUSE_FIX = 'house-fix-sidebar';

type SectionKey = 'dashboard' | 'rooms' | 'people' | 'schedules' | 'shared' | 'upload' | 'reports';

const NAV_ITEMS: Array<{ key: SectionKey; icon: string; label: string }> = [
  { key: 'dashboard', icon: '📋', label: 'Dashboard' },
  { key: 'rooms',     icon: '🏠', label: 'Rooms' },
  { key: 'people',    icon: '👥', label: 'People' },
  { key: 'schedules', icon: '📅', label: 'Schedules' },
  { key: 'shared',    icon: '📌', label: 'Templates' },
  { key: 'upload',    icon: '📤', label: 'Upload' },
  { key: 'reports',   icon: '📊', label: 'Reports' },
];

export class HouseFixSidebarView extends ItemView {
  plugin: HouseFixPlugin;
  private activeSection: SectionKey = 'dashboard';
  private contentEl2!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: HouseFixPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return VIEW_TYPE_HOUSE_FIX; }
  getDisplayText(): string { return 'House Fix'; }
  getIcon(): string { return 'hammer'; }

  async onOpen() {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass('hf-sidebar-root');

    // ── Header ──────────────────────────────────────────────────────────────
    const header = root.createDiv({ cls: 'hf-sidebar-header' });
    header.createEl('span', { text: '🏠', cls: 'hf-sidebar-logo' });
    header.createEl('span', { text: 'House Fix', cls: 'hf-sidebar-title' });

    // ── Nav ─────────────────────────────────────────────────────────────────
    const nav = root.createEl('nav', { cls: 'hf-nav' });
    for (const item of NAV_ITEMS) {
      const btn = nav.createEl('button', { cls: 'hf-nav-item', attr: { 'data-section': item.key } });
      btn.createEl('span', { text: item.icon, cls: 'hf-nav-icon' });
      btn.createEl('span', { text: item.label, cls: 'hf-nav-label' });
      btn.addEventListener('click', () => this.navigateTo(item.key));
    }

    // ── Content area ────────────────────────────────────────────────────────
    this.contentEl2 = root.createDiv({ cls: 'hf-sidebar-content' });

    this.renderSection();
  }

  navigateTo(section: string) {
    this.activeSection = section as SectionKey;
    this.renderSection();
    // Update nav active state
    const root = this.containerEl.children[1] as HTMLElement;
    root.querySelectorAll('.hf-nav-item').forEach(btn => {
      btn.removeClass('hf-nav-active');
      if ((btn as HTMLElement).dataset.section === section) {
        btn.addClass('hf-nav-active');
      }
    });
  }

  triggerNewTask() {
    const view = this.getActiveViewInstance();
    if (view instanceof DashboardView) {
      view.openNewTaskModal();
    }
  }

  navigateToDashboardRoom(roomName: string) {
    this.navigateTo('dashboard');
    // Let the dashboard render before scrolling
    setTimeout(() => {
      const view = this.getActiveViewInstance();
      if (view instanceof DashboardView) {
        view.scrollToRoom(roomName);
      }
    }, 50);
  }

  private sectionInstance: DashboardView | RoomsView | PeopleView | SchedulesView | SharedTasksView | UploadView | ReportsView | null = null;

  private renderSection() {
    this.contentEl2.empty();
    const { plugin, activeSection } = this;

    switch (activeSection) {
      case 'dashboard':
        this.sectionInstance = new DashboardView(this.contentEl2, plugin);
        break;
      case 'rooms':
        this.sectionInstance = new RoomsView(this.contentEl2, plugin, (roomName) => this.navigateToDashboardRoom(roomName));
        break;
      case 'people':
        this.sectionInstance = new PeopleView(this.contentEl2, plugin);
        break;
      case 'schedules':
        this.sectionInstance = new SchedulesView(this.contentEl2, plugin);
        break;
      case 'shared':
        this.sectionInstance = new SharedTasksView(this.contentEl2, plugin);
        break;
      case 'upload':
        this.sectionInstance = new UploadView(this.contentEl2, plugin);
        break;
      case 'reports':
        this.sectionInstance = new ReportsView(this.contentEl2, plugin);
        break;
    }

    this.sectionInstance?.render();
  }

  private getActiveViewInstance() {
    return this.sectionInstance;
  }

  async onClose() {
    // nothing to clean up
  }
}
