import { App, Modal, Notice } from 'obsidian';
import type HouseFixPlugin from '../main';
import type { Person, PersonAvailability, TimeSlot } from '../models';
import { DAYS_OF_WEEK } from '../models';
import { ConfirmModal } from '../components/ConfirmModal';

class PersonModal extends Modal {
  private plugin: HouseFixPlugin;
  private person: Partial<Person>;
  private isEdit: boolean;
  private onSave: () => void;

  constructor(app: App, plugin: HouseFixPlugin, onSave: () => void, existing?: Person) {
    super(app);
    this.plugin = plugin;
    this.onSave = onSave;
    this.isEdit = !!existing;
    this.person = existing ? { ...existing, availability: JSON.parse(JSON.stringify(existing.availability)) }
      : { name: '', availability: {}, max_tasks_per_day: 3, physical_limitations: '' };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('hf-person-modal');
    contentEl.createEl('h2', { text: this.isEdit ? 'Edit Person' : 'Add Person' });

    const form = contentEl.createDiv({ cls: 'hf-form' });

    // Name
    const nameGroup = form.createDiv({ cls: 'hf-form-group' });
    nameGroup.createEl('label', { text: 'Name *', cls: 'hf-label' });
    const nameInput = nameGroup.createEl('input', { type: 'text', cls: 'hf-input' });
    nameInput.value = this.person.name || '';

    // Max tasks per day
    const maxGroup = form.createDiv({ cls: 'hf-form-group' });
    maxGroup.createEl('label', { text: 'Max Tasks Per Day', cls: 'hf-label' });
    const maxInput = maxGroup.createEl('input', { type: 'number', cls: 'hf-input hf-input-sm' });
    maxInput.min = '1'; maxInput.max = '20';
    maxInput.value = String(this.person.max_tasks_per_day || 3);

    // Physical limitations
    const limitGroup = form.createDiv({ cls: 'hf-form-group' });
    limitGroup.createEl('label', { text: 'Physical Limitations', cls: 'hf-label' });
    const limitInput = limitGroup.createEl('textarea', { cls: 'hf-textarea', placeholder: 'e.g., No heavy lifting, bad knees...' });
    limitInput.rows = 2;
    limitInput.value = this.person.physical_limitations || '';

    // Availability
    const availGroup = form.createDiv({ cls: 'hf-form-group' });
    availGroup.createEl('label', { text: 'Availability', cls: 'hf-label' });
    availGroup.createEl('p', { text: 'Click a day to add/remove time slots.', cls: 'hf-hint' });

    const availability: PersonAvailability = this.person.availability || {};
    const availGrid = availGroup.createDiv({ cls: 'hf-avail-grid' });
    this.renderAvailabilityGrid(availGrid, availability);

    // Buttons
    const btnRow = contentEl.createDiv({ cls: 'hf-modal-buttons' });
    const cancelBtn = btnRow.createEl('button', { text: 'Cancel', cls: 'hf-btn' });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = btnRow.createEl('button', {
      text: this.isEdit ? 'Save Changes' : 'Add Person',
      cls: 'hf-btn hf-btn-primary',
    });
    saveBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) { new Notice('Please enter a name.'); return; }
      const personData = {
        name,
        availability,
        max_tasks_per_day: parseInt(maxInput.value) || 3,
        physical_limitations: limitInput.value.trim(),
      };
      try {
        if (this.isEdit && this.person.id) {
          await this.plugin.db.updatePerson(this.person.id, personData);
          new Notice('Person updated.');
        } else {
          await this.plugin.db.createPerson(personData);
          new Notice(`${name} added.`);
        }
        this.close();
        this.onSave();
      } catch (e) {
        new Notice(`Error: ${(e as Error).message}`);
      }
    });
  }

  private renderAvailabilityGrid(container: HTMLElement, availability: PersonAvailability) {
    container.empty();
    for (const day of DAYS_OF_WEEK) {
      const dayRow = container.createDiv({ cls: 'hf-avail-day' });
      const dayHeader = dayRow.createDiv({ cls: 'hf-avail-day-header' });
      dayHeader.createEl('span', { text: day, cls: 'hf-avail-day-name' });
      const addSlotBtn = dayHeader.createEl('button', { text: '+ Slot', cls: 'hf-btn hf-btn-xs' });

      const slotsContainer = dayRow.createDiv({ cls: 'hf-avail-slots' });

      if (!availability[day]) availability[day] = [];

      const renderSlots = () => {
        slotsContainer.empty();
        const slots = availability[day] || [];
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          const slotEl = slotsContainer.createDiv({ cls: 'hf-avail-slot' });
          const startInput = slotEl.createEl('input', { type: 'time', cls: 'hf-input hf-input-time' });
          startInput.value = slot.start || '09:00';
          slotEl.createEl('span', { text: '—' });
          const endInput = slotEl.createEl('input', { type: 'time', cls: 'hf-input hf-input-time' });
          endInput.value = slot.end || '17:00';
          slotEl.createEl('span', { text: '⚡', cls: 'hf-avail-effort-label', title: 'Max effort capacity' });
          const effortInput = slotEl.createEl('input', { type: 'number', cls: 'hf-input hf-input-tiny' });
          effortInput.min = '1'; effortInput.max = '10'; effortInput.value = String(slot.effort_capacity || 7);
          const rmBtn = slotEl.createEl('button', { text: '×', cls: 'hf-tag-remove' });

          startInput.addEventListener('change', () => { slot.start = startInput.value; });
          endInput.addEventListener('change', () => { slot.end = endInput.value; });
          effortInput.addEventListener('change', () => { slot.effort_capacity = parseInt(effortInput.value) || 7; });
          rmBtn.addEventListener('click', () => { slots.splice(i, 1); renderSlots(); });
        }
      };

      addSlotBtn.addEventListener('click', () => {
        availability[day].push({ start: '09:00', end: '17:00', effort_capacity: 7 });
        renderSlots();
      });

      renderSlots();
    }
  }

  onClose() { this.contentEl.empty(); }
}

export class PeopleView {
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
    header.createEl('h2', { text: 'People', cls: 'hf-view-title' });
    const addBtn = header.createEl('button', { text: '+ Add Person', cls: 'hf-btn hf-btn-primary' });
    addBtn.addEventListener('click', () => {
      new PersonModal(this.plugin.app, this.plugin, () => this.render()).open();
    });

    const people = this.plugin.db.getPeople();

    if (people.length === 0) {
      const empty = this.el.createDiv({ cls: 'hf-empty-state' });
      empty.createEl('div', { text: '👥', cls: 'hf-empty-icon' });
      empty.createEl('p', { text: 'No people yet. Add people to enable schedule generation.' });
      return;
    }

    const grid = this.el.createDiv({ cls: 'hf-people-grid' });
    for (const person of people) {
      this.renderPersonCard(grid, person);
    }
  }

  private renderPersonCard(parent: HTMLElement, person: Person) {
    const card = parent.createDiv({ cls: 'hf-person-card' });

    const cardHeader = card.createDiv({ cls: 'hf-person-card-header' });
    const avatar = cardHeader.createDiv({ cls: 'hf-person-avatar' });
    avatar.textContent = person.name.charAt(0).toUpperCase();
    const nameArea = cardHeader.createDiv({ cls: 'hf-person-name-area' });
    nameArea.createEl('h3', { text: person.name, cls: 'hf-person-name' });
    nameArea.createEl('span', { text: `Max ${person.max_tasks_per_day} tasks/day`, cls: 'hf-person-meta' });

    const actions = cardHeader.createDiv({ cls: 'hf-person-actions' });
    const editBtn = actions.createEl('button', { text: '✏️', cls: 'hf-icon-btn', title: 'Edit' });
    editBtn.addEventListener('click', () => {
      new PersonModal(this.plugin.app, this.plugin, () => this.render(), person).open();
    });
    const deleteBtn = actions.createEl('button', { text: '🗑️', cls: 'hf-icon-btn hf-btn-delete', title: 'Delete' });
    deleteBtn.addEventListener('click', () => {
      new ConfirmModal(
        this.plugin.app,
        `Remove "${person.name}" from the project? Their schedules will also be deleted.`,
        async () => {
          await this.plugin.db.deletePerson(person.id);
          new Notice(`${person.name} removed.`);
          this.render();
        }
      ).open();
    });

    // Availability summary
    const availSection = card.createDiv({ cls: 'hf-person-avail' });
    const activeDays = Object.entries(person.availability)
      .filter(([, slots]) => (slots as TimeSlot[]).length > 0)
      .map(([day]) => day.slice(0, 3));

    if (activeDays.length > 0) {
      const dayChips = availSection.createDiv({ cls: 'hf-day-chips' });
      for (const day of DAYS_OF_WEEK.map(d => d.slice(0, 3))) {
        const chip = dayChips.createEl('span', { text: day, cls: 'hf-day-chip' });
        if (activeDays.includes(day)) chip.addClass('hf-day-chip-active');
      }
    } else {
      availSection.createEl('span', { text: 'No availability set', cls: 'hf-hint' });
    }

    // Physical limitations
    if (person.physical_limitations) {
      const limEl = card.createDiv({ cls: 'hf-person-limitations' });
      limEl.createEl('span', { text: '⚠️ ', cls: 'hf-limitations-icon' });
      limEl.createEl('span', { text: person.physical_limitations, cls: 'hf-limitations-text' });
    }
  }
}
