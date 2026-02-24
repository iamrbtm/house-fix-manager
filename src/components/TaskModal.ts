import { App, Modal, Notice } from 'obsidian';
import type HouseFixPlugin from '../main';
import type { Task, TaskAnalysis } from '../models';

export class TaskModal extends Modal {
  private plugin: HouseFixPlugin;
  private task: Partial<Task>;
  private isEdit: boolean;
  private onSave: (task: Task) => void;
  private analysisResult: TaskAnalysis | null = null;
  private datalistEl: HTMLDataListElement | null = null;

  constructor(
    app: App,
    plugin: HouseFixPlugin,
    onSave: (task: Task) => void,
    existingTask?: Task,
    defaultRoom?: string,
  ) {
    super(app);
    this.plugin = plugin;
    this.onSave = onSave;
    this.isEdit = !!existingTask;
    this.task = existingTask
      ? { ...existingTask }
      : {
          name: '', description: '', room: defaultRoom || '', estimated_hours: 0,
          estimated_minutes: 0, effort_level: 5, materials: [],
          status: 'pending', outdoor: false, shared_task_id: null,
        };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('hf-task-modal');
    this.renderStep1();
  }

  private renderStep1() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: this.isEdit ? 'Edit Task' : 'New Task' });

    const form = contentEl.createDiv({ cls: 'hf-form' });

    // Name
    const nameGroup = form.createDiv({ cls: 'hf-form-group' });
    nameGroup.createEl('label', { text: 'Task Name *', cls: 'hf-label' });
    const nameInput = nameGroup.createEl('input', {
      type: 'text', cls: 'hf-input',
      placeholder: 'e.g., Paint the bedroom walls',
    });
    nameInput.value = this.task.name || '';

    // Room
    const roomGroup = form.createDiv({ cls: 'hf-form-group' });
    roomGroup.createEl('label', { text: 'Room *', cls: 'hf-label' });
    const rooms = this.plugin.db.getRooms();

    // Attach datalist to document.body so Electron/Chromium can find it
    // via the input's list= attribute (datalists inside modal divs are not found).
    const datalistId = 'hf-rooms-datalist-' + Date.now();
    this.datalistEl = document.createElement('datalist');
    this.datalistEl.id = datalistId;
    for (const r of rooms) {
      const opt = document.createElement('option');
      opt.value = r.name;
      this.datalistEl.appendChild(opt);
    }
    document.body.appendChild(this.datalistEl);

    const roomInput = roomGroup.createEl('input', {
      type: 'text', cls: 'hf-input',
      placeholder: 'e.g., Master Bedroom',
    });
    roomInput.setAttribute('list', datalistId);
    roomInput.value = this.task.room || '';

    // Description
    const descGroup = form.createDiv({ cls: 'hf-form-group' });
    descGroup.createEl('label', { text: 'Description', cls: 'hf-label' });
    const descInput = descGroup.createEl('textarea', { cls: 'hf-textarea', placeholder: 'Describe the task in detail for better AI analysis...' });
    descInput.rows = 4;
    descInput.value = this.task.description || '';

    // Outdoor toggle
    const outdoorGroup = form.createDiv({ cls: 'hf-form-group hf-form-row' });
    const outdoorLabel = outdoorGroup.createEl('label', { cls: 'hf-label' });
    outdoorLabel.createEl('span', { text: 'Outdoor Task' });
    const outdoorToggle = outdoorGroup.createEl('input', { type: 'checkbox', cls: 'hf-checkbox' });
    outdoorToggle.checked = this.task.outdoor || false;

    // Buttons
    const btnRow = contentEl.createDiv({ cls: 'hf-modal-buttons' });
    const cancelBtn = btnRow.createEl('button', { text: 'Cancel', cls: 'hf-btn' });
    cancelBtn.addEventListener('click', () => this.close());

    const analyzeBtn = btnRow.createEl('button', { text: '✨ Analyze with AI', cls: 'hf-btn hf-btn-secondary' });
    analyzeBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      const room = roomInput.value.trim();
      const description = descInput.value.trim();
      if (!name) { new Notice('Please enter a task name.'); return; }
      if (!room) { new Notice('Please enter a room.'); return; }
      this.task.name = name;
      this.task.room = room;
      this.task.description = description;
      this.task.outdoor = outdoorToggle.checked;
      await this.runAiAnalysis(analyzeBtn);
    });

    const saveBtn = btnRow.createEl('button', {
      text: this.isEdit ? 'Save Changes' : 'Add Task',
      cls: 'hf-btn hf-btn-primary',
    });
    saveBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      const room = roomInput.value.trim();
      if (!name) { new Notice('Please enter a task name.'); return; }
      if (!room) { new Notice('Please enter a room.'); return; }
      this.task.name = name;
      this.task.room = room;
      this.task.description = descInput.value.trim();
      this.task.outdoor = outdoorToggle.checked;
      await this.saveTask();
    });
  }

  private async runAiAnalysis(btn: HTMLButtonElement) {
    btn.setAttr('disabled', 'true');
    btn.textContent = '⏳ Analyzing...';

    try {
      const ai = this.plugin.getAI();
      const analysisText = this.task.description || this.task.name || '';
      this.analysisResult = await ai.analyzeTask(analysisText);
      this.renderStep2();
    } catch (e) {
      new Notice(`AI analysis failed: ${(e as Error).message}`);
      btn.removeAttribute('disabled');
      btn.textContent = '✨ Analyze with AI';
    }
  }

  private renderStep2() {
    const { contentEl } = this;
    const r = this.analysisResult!;
    contentEl.empty();

    contentEl.createEl('h2', { text: '✨ AI Analysis Results' });
    contentEl.createEl('p', { text: `Task: "${this.task.name}"`, cls: 'hf-modal-subtitle' });

    const grid = contentEl.createDiv({ cls: 'hf-analysis-grid' });

    // Time
    const timeCard = grid.createDiv({ cls: 'hf-analysis-card' });
    timeCard.createEl('div', { text: '⏱ Estimated Time', cls: 'hf-analysis-label' });
    const timeRow = timeCard.createDiv({ cls: 'hf-analysis-inputs' });
    const hoursInput = timeRow.createEl('input', { type: 'number', cls: 'hf-input hf-input-sm' });
    hoursInput.min = '0'; hoursInput.max = '99'; hoursInput.value = String(r.time_hours);
    timeRow.createEl('span', { text: 'h' });
    const minsInput = timeRow.createEl('input', { type: 'number', cls: 'hf-input hf-input-sm' });
    minsInput.min = '0'; minsInput.max = '59'; minsInput.value = String(r.time_minutes);
    timeRow.createEl('span', { text: 'm' });

    // Effort
    const effortCard = grid.createDiv({ cls: 'hf-analysis-card' });
    effortCard.createEl('div', { text: '💪 Effort Level', cls: 'hf-analysis-label' });
    const effortInput = effortCard.createEl('input', { type: 'range', cls: 'hf-slider' });
    effortInput.min = '1'; effortInput.max = '10'; effortInput.value = String(r.effort_level);
    const effortVal = effortCard.createEl('div', { text: `${r.effort_level} / 10`, cls: 'hf-slider-value' });
    effortInput.addEventListener('input', () => { effortVal.textContent = `${effortInput.value} / 10`; });

    // Materials
    const materialsCard = contentEl.createDiv({ cls: 'hf-analysis-materials' });
    materialsCard.createEl('div', { text: '🔧 Materials Needed', cls: 'hf-analysis-label' });
    const materialsList = materialsCard.createDiv({ cls: 'hf-materials-tags' });
    const materialsData = [...r.materials];
    const renderMaterials = () => {
      materialsList.empty();
      for (let i = 0; i < materialsData.length; i++) {
        const tag = materialsList.createDiv({ cls: 'hf-tag' });
        tag.createEl('span', { text: materialsData[i] });
        const rm = tag.createEl('button', { text: '×', cls: 'hf-tag-remove' });
        const idx = i;
        rm.addEventListener('click', () => { materialsData.splice(idx, 1); renderMaterials(); });
      }
      const addInput = materialsList.createEl('input', {
        type: 'text', cls: 'hf-input hf-input-inline', placeholder: '+ Add material',
      });
      addInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && addInput.value.trim()) {
          materialsData.push(addInput.value.trim());
          renderMaterials();
        }
      });
    };
    renderMaterials();

    // Enhanced description
    const descCard = contentEl.createDiv({ cls: 'hf-analysis-desc' });
    descCard.createEl('div', { text: '📝 Enhanced Description', cls: 'hf-analysis-label' });
    const descArea = descCard.createEl('textarea', { cls: 'hf-textarea' });
    descArea.rows = 3;
    descArea.value = r.enhanced_description || this.task.description || '';

    // Reasoning
    const reasoningEl = contentEl.createDiv({ cls: 'hf-analysis-reasoning' });
    reasoningEl.createEl('span', { text: `🤖 ${r.reasoning}`, cls: 'hf-reasoning-text' });

    // Buttons
    const btnRow = contentEl.createDiv({ cls: 'hf-modal-buttons' });
    const backBtn = btnRow.createEl('button', { text: '← Back', cls: 'hf-btn' });
    backBtn.addEventListener('click', () => this.renderStep1());

    const saveBtn = btnRow.createEl('button', {
      text: this.isEdit ? 'Save Changes' : 'Add Task',
      cls: 'hf-btn hf-btn-primary',
    });
    saveBtn.addEventListener('click', async () => {
      this.task.estimated_hours = parseInt(hoursInput.value) || 0;
      this.task.estimated_minutes = parseInt(minsInput.value) || 0;
      this.task.effort_level = parseInt(effortInput.value) || 5;
      this.task.materials = [...materialsData];
      this.task.description = descArea.value.trim();
      await this.saveTask();
    });
  }

  private async saveTask() {
    try {
      let saved: Task;
      if (this.isEdit && this.task.id) {
        const { id, created_at, ...updates } = this.task as Task;
        void id; void created_at;
        saved = (await this.plugin.db.updateTask(this.task.id, updates))!;
      } else {
        saved = await this.plugin.db.createTask({
          name: this.task.name || '',
          description: this.task.description || '',
          room: this.task.room || '',
          estimated_hours: this.task.estimated_hours || 0,
          estimated_minutes: this.task.estimated_minutes || 0,
          effort_level: this.task.effort_level || 5,
          materials: this.task.materials || [],
          status: this.task.status || 'pending',
          outdoor: this.task.outdoor || false,
          shared_task_id: this.task.shared_task_id || null,
        });
      }
      this.close();
      this.onSave(saved);
      new Notice(this.isEdit ? 'Task updated.' : 'Task created.');
    } catch (e) {
      new Notice(`Failed to save task: ${(e as Error).message}`);
    }
  }

  onClose() {
    if (this.datalistEl) {
      this.datalistEl.remove();
      this.datalistEl = null;
    }
    this.contentEl.empty();
  }
}
