import { Notice } from 'obsidian';
import type HouseFixPlugin from '../main';
import type { Schedule, Person, ScheduleResult } from '../models';
import { ConfirmModal } from '../components/ConfirmModal';

export class SchedulesView {
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
    header.createEl('h2', { text: 'Schedules', cls: 'hf-view-title' });

    const people = this.plugin.db.getPeople();
    if (people.length === 0) {
      const empty = this.el.createDiv({ cls: 'hf-empty-state' });
      empty.createEl('div', { text: '📅', cls: 'hf-empty-icon' });
      empty.createEl('p', { text: 'Add people first before generating schedules.' });
      return;
    }

    // Generation controls
    const controls = this.el.createDiv({ cls: 'hf-schedule-controls hf-card' });
    controls.createEl('h3', { text: '✨ Generate AI Schedule', cls: 'hf-card-title' });

    const form = controls.createDiv({ cls: 'hf-form hf-form-inline' });

    // Start date
    const dateGroup = form.createDiv({ cls: 'hf-form-group' });
    dateGroup.createEl('label', { text: 'Start Date', cls: 'hf-label' });
    const dateInput = dateGroup.createEl('input', { type: 'date', cls: 'hf-input' });
    dateInput.value = new Date().toISOString().split('T')[0];

    // Days
    const daysGroup = form.createDiv({ cls: 'hf-form-group' });
    daysGroup.createEl('label', { text: 'Days to Schedule', cls: 'hf-label' });
    const daysInput = daysGroup.createEl('input', { type: 'number', cls: 'hf-input hf-input-sm' });
    daysInput.min = '1'; daysInput.max = '30'; daysInput.value = '7';

    const btnRow = controls.createDiv({ cls: 'hf-schedule-btn-row' });

    if (!this.plugin.settings.githubAccessToken) {
      btnRow.createEl('p', { text: '⚠️ Configure your GitHub token in settings to use AI scheduling. Rule-based fallback will be used.', cls: 'hf-warning' });
    }

    const generateBtn = btnRow.createEl('button', { text: '⚡ Generate Schedule', cls: 'hf-btn hf-btn-primary' });
    const clearBtn = btnRow.createEl('button', { text: '🗑 Clear All Schedules', cls: 'hf-btn hf-btn-sm' });

    clearBtn.addEventListener('click', () => {
      new ConfirmModal(
        this.plugin.app,
        'Clear all schedules? This will delete all generated schedule data.',
        async () => {
          await this.plugin.db.clearAllSchedules();
          new Notice('All schedules cleared.');
          this.render();
        },
        'Clear All',
      ).open();
    });

    generateBtn.addEventListener('click', async () => {
      const startDate = dateInput.value;
      const numDays = parseInt(daysInput.value) || 7;
      if (!startDate) { new Notice('Please select a start date.'); return; }

      generateBtn.setAttr('disabled', 'true');
      generateBtn.textContent = '⏳ Generating...';

      try {
        const tasks = this.plugin.db.getTasksByStatus('pending');
        const assigned = this.plugin.db.getTasksByStatus('assigned');
        const allTasks = [...tasks, ...assigned];

        if (allTasks.length === 0) {
          new Notice('No pending tasks to schedule.');
          generateBtn.removeAttribute('disabled');
          generateBtn.textContent = '⚡ Generate Schedule';
          return;
        }

        const ai = this.plugin.getAI();
        const result = await ai.generateSchedules(people, allTasks, startDate, numDays);

        // Persist schedules
        await this.plugin.db.clearAllSchedules();
        await this.persistScheduleResult(result, people);

        new Notice(`Schedule generated! ${result.schedules.length} day-person entries created.`);
        this.renderScheduleDisplay(result, people);
      } catch (e) {
        new Notice(`Schedule generation failed: ${(e as Error).message}`);
      } finally {
        generateBtn.removeAttribute('disabled');
        generateBtn.textContent = '⚡ Generate Schedule';
      }
    });

    // Existing schedules
    const existingSchedules = this.plugin.db.getSchedules();
    if (existingSchedules.length > 0) {
      this.renderExistingSchedules(existingSchedules, people);
    } else {
      const hint = this.el.createDiv({ cls: 'hf-empty-state hf-empty-small' });
      hint.createEl('p', { text: 'No schedules generated yet. Click "Generate Schedule" above to create one.' });
    }
  }

  private async persistScheduleResult(result: ScheduleResult, people: Person[]) {
    for (const entry of result.schedules) {
      const person = people.find(p => p.id === entry.person_id);
      if (!person) continue;
      await this.plugin.db.createSchedule({
        person_id: entry.person_id,
        schedule_date: entry.date,
        status: 'draft',
        ai_generated: result.ai_model !== 'rule-based',
        generation_metadata: { ai_model: result.ai_model, generated_at: result.generated_at },
        assignments: entry.assignments.map((a, idx) => ({
          id: 0, schedule_id: 0,
          task_id: a.task_id,
          start_time: a.start_time,
          end_time: a.end_time,
          is_grouped: a.is_grouped,
          grouped_task_ids: a.grouped_task_ids || [],
          group_description: a.group_description || '',
          estimated_minutes: a.estimated_minutes,
          notes: a.notes,
          order: idx,
        })),
      });
    }

    // Show warnings
    if (result.warnings?.length > 0) {
      for (const w of result.warnings) {
        new Notice(`⚠️ ${w}`, 6000);
      }
    }

    if (result.unscheduled_tasks?.length > 0) {
      new Notice(`${result.unscheduled_tasks.length} task(s) could not be scheduled in the given timeframe.`, 8000);
    }
  }

  private renderExistingSchedules(schedules: Schedule[], people: Person[]) {
    const section = this.el.createDiv({ cls: 'hf-schedules-section' });
    section.createEl('h3', { text: 'Current Schedules', cls: 'hf-section-title' });

    // Group by date
    const byDate = new Map<string, Schedule[]>();
    for (const s of schedules) {
      if (!byDate.has(s.schedule_date)) byDate.set(s.schedule_date, []);
      byDate.get(s.schedule_date)!.push(s);
    }

    for (const [date, daySchedules] of Array.from(byDate.entries()).sort()) {
      const dateSection = section.createDiv({ cls: 'hf-schedule-date-section' });
      const d = new Date(date + 'T00:00:00');
      const formatted = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      dateSection.createEl('h4', { text: formatted, cls: 'hf-schedule-date-title' });

      const dayGrid = dateSection.createDiv({ cls: 'hf-schedule-day-grid' });
      for (const sched of daySchedules) {
        const person = people.find(p => p.id === sched.person_id);
        this.renderPersonScheduleCard(dayGrid, sched, person?.name || `Person ${sched.person_id}`);
      }
    }
  }

  private renderScheduleDisplay(result: ScheduleResult, people: Person[]) {
    // Re-render with the fresh DB data
    const schedules = this.plugin.db.getSchedules();
    const section = this.el.querySelector('.hf-schedules-section');
    if (section) section.remove();
    this.renderExistingSchedules(schedules, people);

    // Show reasoning
    if (result.reasoning) {
      const reasoningEl = this.el.createDiv({ cls: 'hf-schedule-reasoning hf-card' });
      reasoningEl.createEl('h4', { text: '🤖 AI Reasoning', cls: 'hf-card-title' });
      reasoningEl.createEl('p', { text: result.reasoning });
      reasoningEl.createEl('p', { text: `Model: ${result.ai_model}`, cls: 'hf-hint' });
    }
  }

  private renderPersonScheduleCard(parent: HTMLElement, schedule: Schedule, personName: string) {
    const card = parent.createDiv({ cls: 'hf-schedule-card' });
    const cardHeader = card.createDiv({ cls: 'hf-schedule-card-header' });

    const avatar = cardHeader.createDiv({ cls: 'hf-person-avatar hf-avatar-sm' });
    avatar.textContent = personName.charAt(0).toUpperCase();
    cardHeader.createEl('span', { text: personName, cls: 'hf-schedule-person-name' });

    const badges = cardHeader.createDiv({ cls: 'hf-schedule-badges' });
    if (schedule.ai_generated) {
      badges.createEl('span', { text: '✨ AI', cls: 'hf-badge hf-badge-ai' });
    }
    badges.createEl('span', { text: schedule.status, cls: `hf-badge hf-badge-status-${schedule.status}` });

    const assignments = schedule.assignments || [];
    if (assignments.length === 0) {
      card.createEl('p', { text: 'No tasks assigned.', cls: 'hf-hint' });
      return;
    }

    const list = card.createDiv({ cls: 'hf-assignment-list' });
    for (const assignment of assignments) {
      const item = list.createDiv({ cls: 'hf-assignment-item' });
      const timeEl = item.createEl('span', { cls: 'hf-assignment-time' });
      timeEl.textContent = `${assignment.start_time}–${assignment.end_time}`;

      const nameEl = item.createEl('span', { cls: 'hf-assignment-name' });
      nameEl.textContent = assignment.task_name || `Task #${assignment.task_id}`;

      if (assignment.task_room) {
        item.createEl('span', { text: assignment.task_room, cls: 'hf-badge hf-badge-room' });
      }

      if (assignment.notes) {
        item.createEl('span', { text: assignment.notes, cls: 'hf-assignment-notes' });
      }
    }
  }
}
