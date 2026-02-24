import { Notice } from 'obsidian';
import type HouseFixPlugin from '../main';
import type { Room } from '../models';
import { ConfirmModal } from '../components/ConfirmModal';

export class RoomsView {
  private el: HTMLElement;
  private plugin: HouseFixPlugin;
  private onRoomClick: (roomName: string) => void;

  constructor(el: HTMLElement, plugin: HouseFixPlugin, onRoomClick?: (roomName: string) => void) {
    this.el = el;
    this.plugin = plugin;
    this.onRoomClick = onRoomClick ?? (() => {});
  }

  render() {
    this.el.empty();
    this.el.addClass('hf-view');

    const header = this.el.createDiv({ cls: 'hf-view-header' });
    header.createEl('h2', { text: 'Rooms', cls: 'hf-view-title' });
    const addBtn = header.createEl('button', { text: '+ Add Room', cls: 'hf-btn hf-btn-primary' });
    addBtn.addEventListener('click', () => this.showAddRoomForm());

    const rooms = this.plugin.db.getRooms();

    if (rooms.length === 0) {
      const empty = this.el.createDiv({ cls: 'hf-empty-state' });
      empty.createEl('div', { text: '🏠', cls: 'hf-empty-icon' });
      empty.createEl('p', { text: 'No rooms yet. Add a room to get started.' });
      return;
    }

    const list = this.el.createDiv({ cls: 'hf-rooms-list' });
    for (const room of rooms) {
      this.renderRoomCard(list, room);
    }
  }

  private renderRoomCard(parent: HTMLElement, room: Room) {
    const pct = room.task_count > 0 ? Math.round((room.completed_count / room.task_count) * 100) : 0;
    const card = parent.createDiv({ cls: 'hf-room-card' });

    const cardHeader = card.createDiv({ cls: 'hf-room-card-header' });

    // Icon + name
    const titleArea = cardHeader.createDiv({ cls: 'hf-room-card-title' });
    const iconEl = titleArea.createEl('span', { text: room.outdoor ? '🌿' : '🏠', cls: 'hf-room-card-icon hf-room-card-link' });
    iconEl.title = `Go to ${room.name} on dashboard`;
    iconEl.addEventListener('click', () => this.onRoomClick(room.name));

    const nameEl = titleArea.createEl('span', { text: room.name, cls: 'hf-room-card-name hf-room-card-link' });
    nameEl.title = `Go to ${room.name} on dashboard`;
    nameEl.addEventListener('click', () => this.onRoomClick(room.name));

    // Inline rename on double-click
    nameEl.addEventListener('dblclick', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = room.name;
      input.className = 'hf-input hf-input-inline';
      nameEl.replaceWith(input);
      input.focus();
      input.select();
      const commit = async () => {
        const newName = input.value.trim();
        if (newName && newName !== room.name) {
          await this.plugin.db.renameRoom(room.name, newName);
          new Notice(`Room renamed to "${newName}".`);
          this.render();
        } else {
          this.render();
        }
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { this.render(); }
      });
    });

    // Badges + Actions row
    const metaRow = cardHeader.createDiv({ cls: 'hf-room-card-meta' });

    // Badges
    const badgeArea = metaRow.createDiv({ cls: 'hf-room-card-badges' });
    if (room.outdoor) {
      badgeArea.createEl('span', { text: 'Outdoor', cls: 'hf-badge hf-badge-outdoor' });
    } else {
      badgeArea.createEl('span', { text: 'Indoor', cls: 'hf-badge hf-badge-indoor' });
    }

    // Actions
    const actions = metaRow.createDiv({ cls: 'hf-room-card-actions' });
    const toggleBtn = actions.createEl('button', {
      text: room.outdoor ? '🏠 Set Indoor' : '🌿 Set Outdoor',
      cls: 'hf-btn hf-btn-sm',
      title: 'Toggle indoor/outdoor',
    });
    toggleBtn.addEventListener('click', async () => {
      await this.plugin.db.setRoomOutdoor(room.name, !room.outdoor);
      this.render();
    });

    const deleteBtn = actions.createEl('button', { text: '🗑️', cls: 'hf-icon-btn hf-btn-delete', title: 'Delete room and all its tasks' });
    deleteBtn.addEventListener('click', () => {
      new ConfirmModal(
        this.plugin.app,
        `Delete room "${room.name}" and all ${room.task_count} task(s) in it? This cannot be undone.`,
        async () => {
          await this.plugin.db.deleteRoom(room.name);
          new Notice(`Room "${room.name}" deleted.`);
          this.render();
        }
      ).open();
    });

    // Progress section
    const progressSection = card.createDiv({ cls: 'hf-room-card-progress' });
    const progressInfo = progressSection.createDiv({ cls: 'hf-room-card-progress-info' });
    progressInfo.createEl('span', { text: `${room.completed_count} of ${room.task_count} tasks complete`, cls: 'hf-room-progress-text' });
    progressInfo.createEl('span', { text: `${pct}%`, cls: 'hf-room-progress-pct' });
    const bar = progressSection.createDiv({ cls: 'hf-progress-bar' });
    const fill = bar.createDiv({ cls: 'hf-progress-fill' });
    fill.style.width = `${pct}%`;
    if (pct === 100) fill.addClass('hf-progress-complete');
  }

  private showAddRoomForm() {
    const form = this.el.createDiv({ cls: 'hf-inline-form' });
    const input = form.createEl('input', { type: 'text', cls: 'hf-input', placeholder: 'Room name...' });
    const outdoorCheck = form.createEl('input', { type: 'checkbox', cls: 'hf-checkbox' });
    form.createEl('label', { text: ' Outdoor', cls: 'hf-inline-label' });

    const addBtn = form.createEl('button', { text: 'Add', cls: 'hf-btn hf-btn-primary hf-btn-sm' });
    const cancelBtn = form.createEl('button', { text: 'Cancel', cls: 'hf-btn hf-btn-sm' });

    input.focus();

    const submit = async () => {
      const name = input.value.trim();
      if (!name) { new Notice('Please enter a room name.'); return; }
      await this.plugin.db.createRoom(name, outdoorCheck.checked);
      new Notice(`Room "${name}" created.`);
      this.render();
    };

    addBtn.addEventListener('click', submit);
    cancelBtn.addEventListener('click', () => this.render());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') this.render();
    });

    // Scroll to form
    form.scrollIntoView({ behavior: 'smooth' });
  }
}
