import { Notice } from 'obsidian';
import type HouseFixPlugin from '../main';
import type { ParsedTask } from '../parser';
import { TaskParser } from '../parser';
import type { Task, Room, SharedTask } from '../models';

// Shape produced by the Flask /api/export/obsidian endpoint
interface FlaskExportStore {
  tasks: Task[];
  people: unknown[];
  shared_tasks: SharedTask[];
  schedules: unknown[];
  rooms: Array<{ name: string; outdoor: boolean; sort_order: number }>;
  _nextId: Record<string, number>;
}

export class UploadView {
  private el: HTMLElement;
  private plugin: HouseFixPlugin;
  private parsedTasks: ParsedTask[] = [];

  constructor(el: HTMLElement, plugin: HouseFixPlugin) {
    this.el = el;
    this.plugin = plugin;
  }

  render() {
    this.el.empty();
    this.el.addClass('hf-view');

    const header = this.el.createDiv({ cls: 'hf-view-header' });
    header.createEl('h2', { text: 'Upload Tasks', cls: 'hf-view-title' });

    // ── Flask export import section ─────────────────────────────────────────
    const importSection = this.el.createDiv({ cls: 'hf-import-section' });
    importSection.createEl('h3', { text: 'Import from Flask App Export', cls: 'hf-section-title' });
    importSection.createEl('p', {
      text: 'Download the export from the Flask app (navbar → "Export to Obsidian"), then load the house-fix.json file here.',
      cls: 'hf-hint',
    });

    const jsonDropZone = importSection.createDiv({ cls: 'hf-dropzone hf-dropzone-json' });
    jsonDropZone.createEl('div', { text: '📥', cls: 'hf-dropzone-icon' });
    jsonDropZone.createEl('p', { text: 'Drop house-fix.json here, or click to browse', cls: 'hf-dropzone-text' });

    const jsonInput = jsonDropZone.createEl('input', { type: 'file', cls: 'hf-file-input' });
    jsonInput.accept = '.json';

    jsonDropZone.addEventListener('click', () => jsonInput.click());
    jsonDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      jsonDropZone.addClass('hf-dropzone-active');
    });
    jsonDropZone.addEventListener('dragleave', () => jsonDropZone.removeClass('hf-dropzone-active'));
    jsonDropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      jsonDropZone.removeClass('hf-dropzone-active');
      const file = e.dataTransfer?.files[0];
      if (file) await this.handleJsonImport(file, importSection);
    });
    jsonInput.addEventListener('change', async () => {
      const file = jsonInput.files?.[0];
      if (file) await this.handleJsonImport(file, importSection);
    });

    importSection.createEl('hr', { cls: 'hf-divider' });

    // Drop zone
    const dropZone = this.el.createDiv({ cls: 'hf-dropzone' });
    dropZone.createEl('div', { text: '📤', cls: 'hf-dropzone-icon' });
    dropZone.createEl('p', { text: 'Drop a .txt or .pdf file here, or click to browse', cls: 'hf-dropzone-text' });
    dropZone.createEl('p', { text: 'PDF files will be extracted as text', cls: 'hf-hint' });

    const fileInput = dropZone.createEl('input', { type: 'file', cls: 'hf-file-input' });
    fileInput.accept = '.txt,.pdf,.text';

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      dropZone.addClass('hf-dropzone-active');
    });
    dropZone.addEventListener('dragleave', () => dropZone.removeClass('hf-dropzone-active'));
    dropZone.addEventListener('drop', async (e: DragEvent) => {
      e.preventDefault();
      dropZone.removeClass('hf-dropzone-active');
      const file = e.dataTransfer?.files[0];
      if (file) await this.handleFile(file);
    });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (file) await this.handleFile(file);
    });

    // Paste area
    const orDivider = this.el.createDiv({ cls: 'hf-or-divider' });
    orDivider.createEl('span', { text: 'or paste text directly' });

    const pasteArea = this.el.createEl('textarea', { cls: 'hf-textarea hf-paste-area', placeholder: 'Paste your task list here...\n\nKitchen:\n- Paint the walls\n- Replace cabinet handles\n\nBathroom:\n- Recaulk tub' });
    pasteArea.rows = 10;

    const parseBtn = this.el.createEl('button', { text: '🔍 Parse Text', cls: 'hf-btn hf-btn-secondary' });
    parseBtn.addEventListener('click', () => {
      const text = pasteArea.value.trim();
      if (!text) { new Notice('Please paste some text first.'); return; }
      this.parseAndPreview(text);
    });

    // Preview area (populated after parsing)
    this.el.createDiv({ cls: 'hf-upload-preview', attr: { id: 'hf-upload-preview' } });
  }

  private async handleFile(file: File) {
    const loadingEl = this.el.createDiv({ cls: 'hf-loading' });
    loadingEl.textContent = `Reading "${file.name}"...`;

    try {
      let text = '';
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        // Read PDF as array buffer and extract text
        // In Electron/Obsidian we can attempt to read the raw text from the PDF
        text = await this.extractTextFromPdf(file);
      } else {
        text = await file.text();
      }
      loadingEl.remove();
      this.parseAndPreview(text, file.name);
    } catch (e) {
      loadingEl.remove();
      new Notice(`Failed to read file: ${(e as Error).message}`);
    }
  }

  private async extractTextFromPdf(file: File): Promise<string> {
    // Read as array buffer, then convert to string - basic extraction
    // This works for simple text-based PDFs
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let text = '';

    // Simple PDF text extraction: look for text between BT/ET markers
    const str = new TextDecoder('latin1').decode(bytes);
    const textMatches = str.match(/BT[\s\S]*?ET/g) || [];

    for (const block of textMatches) {
      const tjMatches = block.match(/\((.*?)\)\s*Tj/g) || [];
      for (const m of tjMatches) {
        const inner = m.match(/\((.*?)\)\s*Tj/)?.[1] || '';
        if (inner.trim()) text += inner + '\n';
      }
    }

    // If no BT/ET extraction worked, fall back to raw text extraction
    if (!text.trim()) {
      // Try to find readable ASCII text spans
      const lines = str.split(/[\r\n]+/);
      for (const line of lines) {
        const cleaned = line.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned.length > 3 && /[a-zA-Z]{2,}/.test(cleaned)) {
          text += cleaned + '\n';
        }
      }
    }

    return text || 'Could not extract text from PDF. Please try copy-pasting the text directly.';
  }

  private parseAndPreview(text: string, fileName?: string) {
    const parser = new TaskParser();
    const result = parser.parse(text);
    this.parsedTasks = result.tasks;

    // Get or create preview section
    let preview = this.el.querySelector('.hf-upload-preview') as HTMLElement;
    if (!preview) {
      preview = this.el.createDiv({ cls: 'hf-upload-preview' });
    }
    preview.empty();

    if (result.warnings.length > 0) {
      const warnings = preview.createDiv({ cls: 'hf-upload-warnings' });
      for (const w of result.warnings) {
        warnings.createEl('p', { text: `⚠️ ${w}`, cls: 'hf-warning' });
      }
    }

    if (result.tasks.length === 0) {
      preview.createEl('p', { text: 'No tasks detected in the file.', cls: 'hf-hint' });
      return;
    }

    const previewHeader = preview.createDiv({ cls: 'hf-preview-header' });
    previewHeader.createEl('h3', { text: `Found ${result.tasks.length} task(s) in ${result.rooms.length} room(s)`, cls: 'hf-preview-title' });
    if (fileName) previewHeader.createEl('span', { text: fileName, cls: 'hf-hint' });

    // Import options
    const importOptions = preview.createDiv({ cls: 'hf-import-options' });
    const importAllBtn = importOptions.createEl('button', { text: `⬇️ Import All ${result.tasks.length} Tasks`, cls: 'hf-btn hf-btn-primary' });
    importAllBtn.addEventListener('click', () => this.importTasks(this.parsedTasks, importAllBtn));

    // Task list preview
    const taskList = preview.createDiv({ cls: 'hf-preview-list' });

    // Group by room
    const byRoom = new Map<string, ParsedTask[]>();
    for (const t of result.tasks) {
      if (!byRoom.has(t.room)) byRoom.set(t.room, []);
      byRoom.get(t.room)!.push(t);
    }

    for (const [room, tasks] of byRoom) {
      const roomEl = taskList.createDiv({ cls: 'hf-preview-room' });
      const roomHeader = roomEl.createDiv({ cls: 'hf-preview-room-header' });
      roomHeader.createEl('span', { text: room, cls: 'hf-preview-room-name' });
      roomHeader.createEl('span', { text: `${tasks.length} tasks`, cls: 'hf-badge' });

      const taskItems = roomEl.createDiv({ cls: 'hf-preview-tasks' });
      for (const task of tasks) {
        const item = taskItems.createDiv({ cls: 'hf-preview-task-item' });
        item.createEl('span', { text: task.name, cls: 'hf-preview-task-name' });
        if (task.description) {
          item.createEl('span', { text: task.description, cls: 'hf-preview-task-desc' });
        }
      }
    }
  }

  private async importTasks(tasks: ParsedTask[], importBtn: HTMLButtonElement) {
    if (tasks.length === 0) return;

    const preview = this.el.querySelector('.hf-upload-preview') as HTMLElement;
    if (!preview) return;

    // Disable import button
    importBtn.disabled = true;
    importBtn.textContent = 'Importing...';

    // Replace preview content with live progress UI
    preview.empty();
    const progressEl = preview.createDiv({ cls: 'hf-import-progress' });
    const statusEl = progressEl.createEl('p', { cls: 'hf-import-status', text: 'Preparing import...' });
    const barOuter = progressEl.createDiv({ cls: 'hf-progress-bar-outer' });
    const barInner = barOuter.createDiv({ cls: 'hf-progress-bar-inner' });
    barInner.style.width = '0%';
    const detailEl = progressEl.createEl('p', { cls: 'hf-import-detail hf-hint', text: '' });

    // Build a case-insensitive room lookup from existing rooms
    const existingRooms = this.plugin.db.getRooms();
    const roomMap = new Map<string, string>(); // lowercase → canonical name
    for (const r of existingRooms) {
      roomMap.set(r.name.toLowerCase(), r.name);
    }

    const ai = this.plugin.getAI();
    let imported = 0;
    let failed = 0;
    let roomsCreated = 0;
    let roomsMatched = 0;

    const validTasks = tasks.filter(t => t.name && t.name.trim());
    failed = tasks.length - validTasks.length; // count blank-name tasks as failed immediately

    for (let i = 0; i < validTasks.length; i++) {
      const task = validTasks[i];
      const pct = Math.round(((i) / validTasks.length) * 100);
      barInner.style.width = `${pct}%`;
      statusEl.textContent = `Analyzing task ${i + 1} of ${validTasks.length}...`;
      detailEl.textContent = task.name.trim();

      // Resolve room (match existing case-insensitively, or create new)
      const roomKey = task.room.toLowerCase();
      let resolvedRoom: string;
      if (roomMap.has(roomKey)) {
        resolvedRoom = roomMap.get(roomKey)!;
        roomsMatched++;
      } else {
        resolvedRoom = task.room;
        roomMap.set(roomKey, task.room); // prevent duplicates within this batch
        await this.plugin.db.createRoom(task.room);
        roomsCreated++;
      }

      // AI analysis — fall back to defaults on error
      let estimated_hours = 0;
      let estimated_minutes = 0;
      let effort_level = 5;
      let materials: string[] = [];
      let description = task.description || '';

      try {
        const analysis = await ai.analyzeTask(
          task.description ? `${task.name}: ${task.description}` : task.name
        );
        estimated_hours = analysis.time_hours;
        estimated_minutes = analysis.time_minutes;
        effort_level = analysis.effort_level;
        materials = analysis.materials;
        if (analysis.enhanced_description) description = analysis.enhanced_description;
      } catch {
        // keep defaults — don't abort
      }

      try {
        await this.plugin.db.createTask({
          name: task.name.trim(),
          description,
          room: resolvedRoom,
          estimated_hours,
          estimated_minutes,
          effort_level,
          materials,
          status: 'pending',
          outdoor: existingRooms.find(r => r.name === resolvedRoom)?.outdoor ?? false,
          shared_task_id: null,
        });
        imported++;
      } catch {
        failed++;
      }
    }

    // Final state
    barInner.style.width = '100%';
    barInner.addClass('hf-progress-bar-done');
    statusEl.textContent = `Import complete`;
    detailEl.textContent = '';

    const summaryParts = [`${imported} task${imported !== 1 ? 's' : ''} imported`];
    if (roomsCreated > 0) summaryParts.push(`${roomsCreated} room${roomsCreated !== 1 ? 's' : ''} created`);
    if (roomsMatched > 0) summaryParts.push(`${roomsMatched} room${roomsMatched !== 1 ? 's' : ''} matched`);
    if (failed > 0) summaryParts.push(`${failed} skipped`);

    progressEl.createEl('p', { text: `✓ ${summaryParts.join(', ')}.`, cls: 'hf-success' });
    progressEl.createEl('p', { text: 'Go to Dashboard to view your tasks.', cls: 'hf-hint' });

    const msg = failed > 0
      ? `Imported ${imported} tasks (${failed} skipped).`
      : `✓ Imported ${imported} task(s) successfully!`;
    new Notice(msg);

    importBtn.disabled = false;
    importBtn.textContent = 'Import More';
    importBtn.onclick = () => this.render();
  }

  // ── Flask JSON export import ──────────────────────────────────────────────

  private async handleJsonImport(file: File, container: HTMLElement) {
    if (!file.name.endsWith('.json')) {
      new Notice('Please select a .json file exported from the Flask app.');
      return;
    }

    // Replace the section content below the heading with a progress indicator
    const progressEl = container.createDiv({ cls: 'hf-import-progress' });
    const statusEl = progressEl.createEl('p', { cls: 'hf-import-status', text: 'Reading file...' });

    let store: FlaskExportStore;
    try {
      const raw = await file.text();
      store = JSON.parse(raw) as FlaskExportStore;
    } catch {
      statusEl.textContent = 'Failed to parse JSON file.';
      new Notice('Could not parse the selected file. Make sure it is the house-fix.json exported from the Flask app.');
      return;
    }

    if (!Array.isArray(store.tasks) || !Array.isArray(store.rooms)) {
      statusEl.textContent = 'Invalid export file format.';
      new Notice('The file does not look like a valid House Fix export.');
      return;
    }

    // ── Rooms ───────────────────────────────────────────────────────────────
    statusEl.textContent = 'Importing rooms...';
    const existingRooms = this.plugin.db.getRooms();
    const existingRoomNames = new Set(existingRooms.map(r => r.name.toLowerCase()));
    let roomsAdded = 0;

    for (const room of store.rooms) {
      if (!room.name) continue;
      if (!existingRoomNames.has(room.name.toLowerCase())) {
        await this.plugin.db.createRoom(room.name, room.outdoor ?? false);
        existingRoomNames.add(room.name.toLowerCase());
        roomsAdded++;
      } else {
        // Update outdoor flag if changed
        await this.plugin.db.setRoomOutdoor(room.name, room.outdoor ?? false);
      }
    }

    // ── Tasks ────────────────────────────────────────────────────────────────
    statusEl.textContent = 'Importing tasks...';
    const existingTasks = this.plugin.db.getTasks();
    // Use a set of (room + name) to avoid duplicating tasks
    const existingKeys = new Set(existingTasks.map(t => `${t.room}||${t.name}`));
    let tasksAdded = 0;
    let tasksDuplicate = 0;

    for (const task of store.tasks) {
      const key = `${task.room}||${task.name}`;
      if (existingKeys.has(key)) {
        tasksDuplicate++;
        continue;
      }
      existingKeys.add(key);
      await this.plugin.db.createTask({
        name: task.name,
        description: task.description ?? '',
        room: task.room,
        estimated_hours: task.estimated_hours ?? 0,
        estimated_minutes: task.estimated_minutes ?? 0,
        effort_level: task.effort_level ?? 5,
        materials: Array.isArray(task.materials) ? task.materials : [],
        status: task.status ?? 'pending',
        outdoor: task.outdoor ?? false,
        shared_task_id: task.shared_task_id ?? null,
      });
      tasksAdded++;
    }

    // ── Shared tasks ─────────────────────────────────────────────────────────
    const existingShared = this.plugin.db.getSharedTasks();
    const existingSharedNames = new Set(existingShared.map(s => s.name.toLowerCase()));
    let sharedAdded = 0;

    for (const st of (store.shared_tasks ?? [])) {
      if (!st.name || existingSharedNames.has(st.name.toLowerCase())) continue;
      existingSharedNames.add(st.name.toLowerCase());
      await this.plugin.db.createSharedTask({
        name: st.name,
        description: st.description ?? '',
        room: st.room ?? '',
        estimated_hours: st.estimated_hours ?? 0,
        estimated_minutes: st.estimated_minutes ?? 0,
        effort_level: st.effort_level ?? 5,
        materials: Array.isArray(st.materials) ? st.materials : [],
        status: st.status ?? 'pending',
        outdoor: st.outdoor ?? false,
        category: st.category ?? '',
      });
      sharedAdded++;
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    statusEl.textContent = 'Import complete';
    const parts: string[] = [];
    if (roomsAdded > 0) parts.push(`${roomsAdded} room${roomsAdded !== 1 ? 's' : ''} added`);
    if (tasksAdded > 0) parts.push(`${tasksAdded} task${tasksAdded !== 1 ? 's' : ''} imported`);
    if (tasksDuplicate > 0) parts.push(`${tasksDuplicate} duplicate${tasksDuplicate !== 1 ? 's' : ''} skipped`);
    if (sharedAdded > 0) parts.push(`${sharedAdded} shared task${sharedAdded !== 1 ? 's' : ''} added`);

    const summary = parts.length > 0 ? parts.join(', ') : 'Nothing new to import';
    progressEl.createEl('p', { text: `✓ ${summary}.`, cls: 'hf-success' });
    progressEl.createEl('p', { text: 'Go to Dashboard to view your tasks.', cls: 'hf-hint' });
    new Notice(`✓ Flask export imported: ${summary}.`);
  }
}

