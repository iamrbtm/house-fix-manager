import { Notice } from 'obsidian';
import type HouseFixPlugin from '../main';
import type { Task, Room } from '../models';
import { TaskModal } from '../components/TaskModal';
import { ConfirmModal } from '../components/ConfirmModal';

export class DashboardView {
  private el: HTMLElement;
  private plugin: HouseFixPlugin;

  constructor(el: HTMLElement, plugin: HouseFixPlugin) {
    this.el = el;
    this.plugin = plugin;
  }

  render() {
    this.el.empty();
    this.el.addClass('hf-view');

    // Header row
    const header = this.el.createDiv({ cls: 'hf-view-header' });
    header.createEl('h2', { text: 'Dashboard', cls: 'hf-view-title' });
    const newBtn = header.createEl('button', { text: '+ New Task', cls: 'hf-btn hf-btn-primary' });
    newBtn.addEventListener('click', () => this.openNewTaskModal());

    // Stats cards
    const stats = this.plugin.db.getStats();
    const statsRow = this.el.createDiv({ cls: 'hf-stats-row' });
    this.statCard(statsRow, String(stats.total), 'Total Tasks', 'hf-stat-total');
    this.statCard(statsRow, String(stats.pending), 'Pending', 'hf-stat-pending');
    this.statCard(statsRow, String(stats.assigned), 'In Progress', 'hf-stat-assigned');
    this.statCard(statsRow, String(stats.completed), 'Completed', 'hf-stat-completed');

    // Room sections
    const rooms = this.plugin.db.getRooms();
    if (rooms.length === 0) {
      const empty = this.el.createDiv({ cls: 'hf-empty-state' });
      empty.createEl('div', { text: '🏗️', cls: 'hf-empty-icon' });
      empty.createEl('p', { text: 'No tasks yet. Add your first task or upload a task list!' });
      const addBtn = empty.createEl('button', { text: '+ Add First Task', cls: 'hf-btn hf-btn-primary' });
      addBtn.addEventListener('click', () => this.openNewTaskModal());
      return;
    }

    const roomsContainer = this.el.createDiv({ cls: 'hf-rooms-container' });
    for (const room of rooms) {
      this.renderRoom(roomsContainer, room);
    }
  }

  private statCard(parent: HTMLElement, value: string, label: string, cls: string) {
    const card = parent.createDiv({ cls: `hf-stat-card ${cls}` });
    card.createEl('div', { text: value, cls: 'hf-stat-value' });
    card.createEl('div', { text: label, cls: 'hf-stat-label' });
  }

  private renderRoom(parent: HTMLElement, room: Room) {
    const tasks = this.plugin.db.getTasks(room.name);
    const pct = room.task_count > 0 ? Math.round((room.completed_count / room.task_count) * 100) : 0;

    const section = parent.createDiv({ cls: 'hf-room-section' });
    section.dataset.room = room.name;
    const sectionHeader = section.createDiv({ cls: 'hf-room-header' });

    // Collapse toggle
    const toggleBtn = sectionHeader.createEl('button', { cls: 'hf-room-toggle' });
    toggleBtn.textContent = '▼';

    const titleArea = sectionHeader.createDiv({ cls: 'hf-room-title-area' });
    titleArea.createEl('span', { text: room.outdoor ? '🌿' : '🏠', cls: 'hf-room-icon' });
    titleArea.createEl('span', { text: room.name, cls: 'hf-room-name' });
    if (room.outdoor) {
      titleArea.createEl('span', { text: 'Outdoor', cls: 'hf-badge hf-badge-outdoor' });
    }

    const rightArea = sectionHeader.createDiv({ cls: 'hf-room-right' });
    rightArea.createEl('span', { text: `${room.completed_count}/${room.task_count}`, cls: 'hf-room-count' });

    // Progress bar
    const progressBar = sectionHeader.createDiv({ cls: 'hf-progress-bar' });
    const fill = progressBar.createDiv({ cls: 'hf-progress-fill' });
    fill.style.width = `${pct}%`;
    if (pct === 100) fill.addClass('hf-progress-complete');
    rightArea.appendChild(progressBar);

    // Task table
    const tableContainer = section.createDiv({ cls: 'hf-task-table-container' });
    this.renderTaskTable(tableContainer, tasks, room.name);

    // Restore persisted collapsed state
    const collapsedRooms: string[] = this.plugin.settings.collapsedRooms ?? [];
    if (collapsedRooms.includes(room.name)) {
      section.addClass('hf-collapsed');
      toggleBtn.textContent = '▶';
    }

    // Collapse behavior — toggle on the section so CSS selector works
    toggleBtn.addEventListener('click', async () => {
      const collapsed = section.hasClass('hf-collapsed');
      if (collapsed) {
        section.removeClass('hf-collapsed');
        toggleBtn.textContent = '▼';
        this.plugin.settings.collapsedRooms = (this.plugin.settings.collapsedRooms ?? []).filter(r => r !== room.name);
      } else {
        section.addClass('hf-collapsed');
        toggleBtn.textContent = '▶';
        if (!(this.plugin.settings.collapsedRooms ?? []).includes(room.name)) {
          this.plugin.settings.collapsedRooms = [...(this.plugin.settings.collapsedRooms ?? []), room.name];
        }
      }
      await this.plugin.saveSettings();
    });
  }

  private renderTaskTable(parent: HTMLElement, tasks: Task[], roomName: string) {
    if (tasks.length === 0) {
      const empty = parent.createDiv({ cls: 'hf-room-empty' });
      empty.createEl('span', { text: 'No tasks in this room. ' });
      const addLink = empty.createEl('a', { text: 'Add one?', cls: 'hf-link', href: '#' });
      addLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.openNewTaskModal(roomName);
      });
      return;
    }

    const table = parent.createEl('table', { cls: 'hf-table' });
    const thead = table.createEl('thead');
    const headerRow = thead.createEl('tr');
    for (const h of ['', 'Task', 'Time', 'Effort', 'Materials', 'Status', '']) {
      headerRow.createEl('th', { text: h, cls: 'hf-th' });
    }

    const tbody = table.createEl('tbody');
    for (const task of tasks) {
      this.renderTaskRow(tbody, task);
    }
  }

  private renderTaskRow(tbody: HTMLElement, task: Task) {
    const tr = tbody.createEl('tr', { cls: `hf-tr hf-status-${task.status}` });

    // Checkbox
    const checkTd = tr.createEl('td', { cls: 'hf-td hf-td-check' });
    const checkbox = checkTd.createEl('input', { type: 'checkbox', cls: 'hf-check' });
    checkbox.checked = task.status === 'completed';
    checkbox.addEventListener('change', async () => {
      await this.plugin.db.updateTask(task.id, {
        status: checkbox.checked ? 'completed' : 'pending',
      });
      tr.className = `hf-tr hf-status-${checkbox.checked ? 'completed' : 'pending'}`;
    });

    // Name
    const nameTd = tr.createEl('td', { cls: 'hf-td' });
    const nameSpan = nameTd.createEl('span', { text: task.name, cls: 'hf-task-name' });
    if (task.description) {
      nameSpan.title = task.description;
    }

    // Time
    const timeTd = tr.createEl('td', { cls: 'hf-td hf-td-time' });
    const timeText = this.formatTime(task.estimated_hours, task.estimated_minutes);
    timeTd.createEl('span', { text: timeText, cls: 'hf-time-text' });

    // Effort
    const effortTd = tr.createEl('td', { cls: 'hf-td hf-td-effort' });
    const effortBadge = effortTd.createDiv({ cls: `hf-effort-badge hf-effort-${this.effortClass(task.effort_level)}` });
    effortBadge.textContent = `${task.effort_level}/10`;

    // Materials
    const matTd = tr.createEl('td', { cls: 'hf-td hf-td-materials' });
    if (task.materials.length > 0) {
      const matSpan = matTd.createEl('span', { cls: 'hf-materials-summary' });
      matSpan.textContent = task.materials.slice(0, 2).join(', ');
      if (task.materials.length > 2) {
        matSpan.textContent += ` +${task.materials.length - 2}`;
      }
      matSpan.title = task.materials.join(', ');
    }

    // Status
    const statusTd = tr.createEl('td', { cls: 'hf-td' });
    const statusSel = statusTd.createEl('select', { cls: 'hf-status-select' });
    for (const [val, label] of [['pending', 'Pending'], ['assigned', 'In Progress'], ['completed', 'Done']]) {
      const opt = statusSel.createEl('option', { value: val, text: label });
      if (task.status === val) opt.selected = true;
    }
    statusSel.addEventListener('change', async () => {
      await this.plugin.db.updateTask(task.id, { status: statusSel.value as Task['status'] });
      tr.className = `hf-tr hf-status-${statusSel.value}`;
      checkbox.checked = statusSel.value === 'completed';
    });

    // Actions
    const actionsTd = tr.createEl('td', { cls: 'hf-td hf-td-actions' });
    const editBtn = actionsTd.createEl('button', { text: '✏️', cls: 'hf-icon-btn', title: 'Edit task' });
    editBtn.addEventListener('click', () => {
      new TaskModal(this.plugin.app, this.plugin, (updated) => {
        this.render();
      }, task).open();
    });
    const deleteBtn = actionsTd.createEl('button', { text: '🗑️', cls: 'hf-icon-btn hf-btn-delete', title: 'Delete task' });
    deleteBtn.addEventListener('click', () => {
      new ConfirmModal(
        this.plugin.app,
        `Delete task "${task.name}"? This cannot be undone.`,
        async () => {
          await this.plugin.db.deleteTask(task.id);
          new Notice(`Task "${task.name}" deleted.`);
          this.render();
        }
      ).open();
    });
  }

  /** Navigate to the dashboard, expand the given room, and scroll it into view. */
  scrollToRoom(roomName: string) {
    // Ensure the room is not collapsed
    if ((this.plugin.settings.collapsedRooms ?? []).includes(roomName)) {
      this.plugin.settings.collapsedRooms = this.plugin.settings.collapsedRooms.filter(r => r !== roomName);
      this.plugin.saveSettings();
      this.render();
    }

    // Find the section and scroll to it
    const section = this.el.querySelector(`[data-room="${CSS.escape(roomName)}"]`) as HTMLElement | null;
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  openNewTaskModal(defaultRoom?: string) {
    new TaskModal(this.plugin.app, this.plugin, () => { this.render(); }, undefined, defaultRoom).open();
  }

  private formatTime(hours: number, minutes: number): string {
    if (!hours && !minutes) return '—';
    const parts = [];
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    return parts.join(' ');
  }

  private effortClass(level: number): string {
    if (level <= 3) return 'low';
    if (level <= 6) return 'medium';
    return 'high';
  }
}
