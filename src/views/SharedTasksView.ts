import { App, Modal, Notice } from 'obsidian';
import type HouseFixPlugin from '../main';
import type { SharedTask } from '../models';
import { ConfirmModal } from '../components/ConfirmModal';

class SharedTaskModal extends Modal {
  private plugin: HouseFixPlugin;
  private task: Partial<SharedTask>;
  private isEdit: boolean;
  private onSave: () => void;

  constructor(app: App, plugin: HouseFixPlugin, onSave: () => void, existing?: SharedTask) {
    super(app);
    this.plugin = plugin;
    this.onSave = onSave;
    this.isEdit = !!existing;
    this.task = existing ? { ...existing } : {
      name: '', description: '', room: '', estimated_hours: 0,
      estimated_minutes: 0, effort_level: 5, materials: [],
      status: 'pending', outdoor: false, category: '',
    };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('hf-task-modal');
    contentEl.createEl('h2', { text: this.isEdit ? 'Edit Template' : 'New Template' });

    const form = contentEl.createDiv({ cls: 'hf-form' });

    const nameGroup = form.createDiv({ cls: 'hf-form-group' });
    nameGroup.createEl('label', { text: 'Template Name *', cls: 'hf-label' });
    const nameInput = nameGroup.createEl('input', { type: 'text', cls: 'hf-input', placeholder: 'e.g., Paint walls' });
    nameInput.value = this.task.name || '';

    const categoryGroup = form.createDiv({ cls: 'hf-form-group' });
    categoryGroup.createEl('label', { text: 'Category', cls: 'hf-label' });
    const catInput = categoryGroup.createEl('input', { type: 'text', cls: 'hf-input', placeholder: 'e.g., Painting, Cleaning' });
    catInput.value = this.task.category || '';

    const descGroup = form.createDiv({ cls: 'hf-form-group' });
    descGroup.createEl('label', { text: 'Description', cls: 'hf-label' });
    const descInput = descGroup.createEl('textarea', { cls: 'hf-textarea' });
    descInput.rows = 3;
    descInput.value = this.task.description || '';

    const timeRow = form.createDiv({ cls: 'hf-form-row' });
    const hoursGroup = timeRow.createDiv({ cls: 'hf-form-group' });
    hoursGroup.createEl('label', { text: 'Hours', cls: 'hf-label' });
    const hoursInput = hoursGroup.createEl('input', { type: 'number', cls: 'hf-input hf-input-sm' });
    hoursInput.min = '0'; hoursInput.value = String(this.task.estimated_hours || 0);

    const minsGroup = timeRow.createDiv({ cls: 'hf-form-group' });
    minsGroup.createEl('label', { text: 'Minutes', cls: 'hf-label' });
    const minsInput = minsGroup.createEl('input', { type: 'number', cls: 'hf-input hf-input-sm' });
    minsInput.min = '0'; minsInput.max = '59'; minsInput.value = String(this.task.estimated_minutes || 0);

    const effortGroup = form.createDiv({ cls: 'hf-form-group' });
    effortGroup.createEl('label', { text: `Effort Level: ${this.task.effort_level || 5}/10`, cls: 'hf-label' });
    const effortInput = effortGroup.createEl('input', { type: 'range', cls: 'hf-slider' });
    effortInput.min = '1'; effortInput.max = '10'; effortInput.value = String(this.task.effort_level || 5);
    effortInput.addEventListener('input', () => {
      effortGroup.querySelector('.hf-label')!.textContent = `Effort Level: ${effortInput.value}/10`;
    });

    const materialsGroup = form.createDiv({ cls: 'hf-form-group' });
    materialsGroup.createEl('label', { text: 'Materials (comma-separated)', cls: 'hf-label' });
    const matInput = materialsGroup.createEl('input', { type: 'text', cls: 'hf-input', placeholder: 'Paint, Roller, Drop cloth' });
    matInput.value = (this.task.materials || []).join(', ');

    const outdoorGroup = form.createDiv({ cls: 'hf-form-group hf-form-row' });
    const outdoorLabel = outdoorGroup.createEl('label', { cls: 'hf-label' });
    outdoorLabel.createEl('span', { text: 'Outdoor Task' });
    const outdoorCheck = outdoorGroup.createEl('input', { type: 'checkbox', cls: 'hf-checkbox' });
    outdoorCheck.checked = this.task.outdoor || false;

    const btnRow = contentEl.createDiv({ cls: 'hf-modal-buttons' });
    btnRow.createEl('button', { text: 'Cancel', cls: 'hf-btn' }).addEventListener('click', () => this.close());
    const saveBtn = btnRow.createEl('button', {
      text: this.isEdit ? 'Save' : 'Create Template', cls: 'hf-btn hf-btn-primary',
    });
    saveBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) { new Notice('Please enter a template name.'); return; }
      const data = {
        name,
        description: descInput.value.trim(),
        room: '',
        estimated_hours: parseInt(hoursInput.value) || 0,
        estimated_minutes: parseInt(minsInput.value) || 0,
        effort_level: parseInt(effortInput.value) || 5,
        materials: matInput.value.split(',').map(s => s.trim()).filter(Boolean),
        status: 'pending' as const,
        outdoor: outdoorCheck.checked,
        category: catInput.value.trim(),
      };
      try {
        if (this.isEdit && this.task.id) {
          await this.plugin.db.updateSharedTask(this.task.id, data);
          new Notice('Template updated.');
        } else {
          await this.plugin.db.createSharedTask(data);
          new Notice('Template created.');
        }
        this.close();
        this.onSave();
      } catch (e) {
        new Notice(`Error: ${(e as Error).message}`);
      }
    });
  }

  onClose() { this.contentEl.empty(); }
}

class ApplyToRoomsModal extends Modal {
  private plugin: HouseFixPlugin;
  private template: SharedTask;
  private onApply: () => void;

  constructor(app: App, plugin: HouseFixPlugin, template: SharedTask, onApply: () => void) {
    super(app);
    this.plugin = plugin;
    this.template = template;
    this.onApply = onApply;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: `Apply "${this.template.name}" to Rooms` });

    const rooms = this.plugin.db.getRooms();
    if (rooms.length === 0) {
      contentEl.createEl('p', { text: 'No rooms available.' });
      contentEl.createEl('button', { text: 'Close', cls: 'hf-btn' }).addEventListener('click', () => this.close());
      return;
    }

    contentEl.createEl('p', { text: 'Select rooms to apply this template to:', cls: 'hf-hint' });
    const checkboxes: Array<{ name: string; el: HTMLInputElement }> = [];
    const list = contentEl.createDiv({ cls: 'hf-rooms-checklist' });

    for (const room of rooms) {
      const label = list.createEl('label', { cls: 'hf-checklist-item' });
      const cb = label.createEl('input', { type: 'checkbox', cls: 'hf-checkbox' });
      label.createEl('span', { text: room.name });
      checkboxes.push({ name: room.name, el: cb });
    }

    const selectAllBtn = contentEl.createEl('button', { text: 'Select All', cls: 'hf-btn hf-btn-sm' });
    selectAllBtn.addEventListener('click', () => checkboxes.forEach(c => { c.el.checked = true; }));

    const btnRow = contentEl.createDiv({ cls: 'hf-modal-buttons' });
    btnRow.createEl('button', { text: 'Cancel', cls: 'hf-btn' }).addEventListener('click', () => this.close());
    const applyBtn = btnRow.createEl('button', { text: 'Apply to Selected', cls: 'hf-btn hf-btn-primary' });
    applyBtn.addEventListener('click', async () => {
      const selected = checkboxes.filter(c => c.el.checked).map(c => c.name);
      if (selected.length === 0) { new Notice('Select at least one room.'); return; }
      await this.plugin.db.applySharedTaskToRooms(this.template.id, selected);
      new Notice(`Template applied to ${selected.length} room(s).`);
      this.close();
      this.onApply();
    });
  }

  onClose() { this.contentEl.empty(); }
}

export class SharedTasksView {
  private el: HTMLElement;
  private plugin: HouseFixPlugin;

  constructor(el: HTMLElement, plugin: HouseFixPlugin) {
    this.el = el;
    this.plugin = plugin;
  }

  render() {
    this.el.empty();
    this.el.addClass('hf-view');

    const header = this.el.createDiv({ cls: 'hf-view-header' });
    header.createEl('h2', { text: 'Task Templates', cls: 'hf-view-title' });
    const addBtn = header.createEl('button', { text: '+ New Template', cls: 'hf-btn hf-btn-primary' });
    addBtn.addEventListener('click', () => {
      new SharedTaskModal(this.plugin.app, this.plugin, () => this.render()).open();
    });

    const templates = this.plugin.db.getSharedTasks();

    if (templates.length === 0) {
      const empty = this.el.createDiv({ cls: 'hf-empty-state' });
      empty.createEl('div', { text: '📌', cls: 'hf-empty-icon' });
      empty.createEl('p', { text: 'No templates yet. Create reusable task templates to apply across multiple rooms.' });
      return;
    }

    // Apply all button
    const applyAllRow = this.el.createDiv({ cls: 'hf-apply-all-row' });
    const applyAllBtn = applyAllRow.createEl('button', { text: '⚡ Apply All to All Rooms', cls: 'hf-btn hf-btn-secondary' });
    applyAllBtn.addEventListener('click', async () => {
      const rooms = this.plugin.db.getRooms();
      if (rooms.length === 0) { new Notice('No rooms to apply to.'); return; }
      let count = 0;
      for (const t of templates) {
        await this.plugin.db.applySharedTaskToRooms(t.id, rooms.map(r => r.name));
        count++;
      }
      new Notice(`Applied ${count} templates to ${rooms.length} room(s).`);
    });

    // Group by category
    const categories = new Map<string, SharedTask[]>();
    for (const t of templates) {
      const cat = t.category || 'Uncategorized';
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat)!.push(t);
    }

    for (const [category, tasks] of categories) {
      const section = this.el.createDiv({ cls: 'hf-templates-section' });
      section.createEl('h3', { text: category, cls: 'hf-section-title' });
      const grid = section.createDiv({ cls: 'hf-templates-grid' });
      for (const task of tasks) {
        this.renderTemplateCard(grid, task);
      }
    }
  }

  private renderTemplateCard(parent: HTMLElement, task: SharedTask) {
    const card = parent.createDiv({ cls: 'hf-template-card' });

    const cardHeader = card.createDiv({ cls: 'hf-template-card-header' });
    cardHeader.createEl('h4', { text: task.name, cls: 'hf-template-name' });

    const actions = cardHeader.createDiv({ cls: 'hf-template-actions' });
    const applyBtn = actions.createEl('button', { text: '+ Apply', cls: 'hf-btn hf-btn-sm hf-btn-primary' });
    applyBtn.addEventListener('click', () => {
      new ApplyToRoomsModal(this.plugin.app, this.plugin, task, () => {}).open();
    });
    const editBtn = actions.createEl('button', { text: '✏️', cls: 'hf-icon-btn' });
    editBtn.addEventListener('click', () => {
      new SharedTaskModal(this.plugin.app, this.plugin, () => this.render(), task).open();
    });
    const deleteBtn = actions.createEl('button', { text: '🗑️', cls: 'hf-icon-btn hf-btn-delete' });
    deleteBtn.addEventListener('click', () => {
      new ConfirmModal(
        this.plugin.app,
        `Delete template "${task.name}"?`,
        async () => {
          await this.plugin.db.deleteSharedTask(task.id);
          new Notice(`Template "${task.name}" deleted.`);
          this.render();
        }
      ).open();
    });

    // Meta
    const meta = card.createDiv({ cls: 'hf-template-meta' });
    const time = task.estimated_hours || task.estimated_minutes
      ? `${task.estimated_hours}h ${task.estimated_minutes}m`
      : '—';
    meta.createEl('span', { text: `⏱ ${time}`, cls: 'hf-template-time' });
    meta.createEl('span', { text: `💪 ${task.effort_level}/10`, cls: `hf-effort-badge hf-effort-${this.effortClass(task.effort_level)}` });
    if (task.outdoor) meta.createEl('span', { text: '🌿 Outdoor', cls: 'hf-badge hf-badge-outdoor' });

    if (task.description) {
      card.createEl('p', { text: task.description, cls: 'hf-template-desc' });
    }

    if (task.materials.length > 0) {
      const matEl = card.createDiv({ cls: 'hf-template-materials' });
      matEl.createEl('span', { text: '🔧 ', cls: 'hf-materials-icon' });
      matEl.createEl('span', { text: task.materials.join(', '), cls: 'hf-materials-list' });
    }
  }

  private effortClass(level: number): string {
    if (level <= 3) return 'low';
    if (level <= 6) return 'medium';
    return 'high';
  }
}
