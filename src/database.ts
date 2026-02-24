import type { App } from 'obsidian';
import type {
  Task, TaskStatus, Person, PersonAvailability,
  SharedTask, Schedule, TaskAssignment, Room
} from './models';

// ─── JSON store shape ─────────────────────────────────────────────────────────

interface DbStore {
  tasks: Task[];
  people: Person[];
  shared_tasks: SharedTask[];
  schedules: Schedule[];           // includes assignments array
  rooms: RoomRecord[];
  _nextId: Record<string, number>; // per-table auto-increment counters
}

interface RoomRecord {
  name: string;
  outdoor: boolean;
  sort_order: number;
}

const EMPTY_STORE: DbStore = {
  tasks: [],
  people: [],
  shared_tasks: [],
  schedules: [],
  rooms: [],
  _nextId: { tasks: 1, people: 1, shared_tasks: 1, schedules: 1, assignments: 1 },
};

// ─── Database class ───────────────────────────────────────────────────────────

export class HouseFixDatabase {
  private app: App;
  private fileName: string;
  private store: DbStore = JSON.parse(JSON.stringify(EMPTY_STORE));

  constructor(app: App, fileName: string) {
    this.app = app;
    // Always use .json extension
    this.fileName = fileName.replace(/\.db$/, '.json');
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    try {
      const exists = await this.app.vault.adapter.exists(this.fileName);
      if (exists) {
        const raw = await this.app.vault.adapter.read(this.fileName);
        const parsed = JSON.parse(raw) as Partial<DbStore>;
        // Merge with empty store so any missing keys get defaults
        this.store = {
          ...JSON.parse(JSON.stringify(EMPTY_STORE)),
          ...parsed,
          _nextId: {
            ...EMPTY_STORE._nextId,
            ...(parsed._nextId ?? {}),
          },
        };
      }
    } catch (e) {
      console.warn('[HouseFix] Could not load database, starting fresh:', e);
      this.store = JSON.parse(JSON.stringify(EMPTY_STORE));
    }
    // Persist immediately to create the file if it doesn't exist
    await this.save();
  }

  async save(): Promise<void> {
    await this.app.vault.adapter.write(
      this.fileName,
      JSON.stringify(this.store, null, 2),
    );
  }

  close(): void {
    // Nothing to close for JSON storage
  }

  // ── ID generation ──────────────────────────────────────────────────────────

  private nextId(table: string): number {
    if (!this.store._nextId[table]) this.store._nextId[table] = 1;
    return this.store._nextId[table]++;
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  getTasks(room?: string): Task[] {
    const tasks = room
      ? this.store.tasks.filter(t => t.room === room)
      : [...this.store.tasks];
    // Sort: by room then created_at desc
    return tasks.sort((a, b) => {
      if (a.room < b.room) return -1;
      if (a.room > b.room) return 1;
      return b.created_at.localeCompare(a.created_at);
    });
  }

  getTask(id: number): Task | null {
    return this.store.tasks.find(t => t.id === id) ?? null;
  }

  async createTask(task: Omit<Task, 'id' | 'created_at'>): Promise<Task> {
    const newTask: Task = {
      ...task,
      id: this.nextId('tasks'),
      created_at: new Date().toISOString(),
    };
    this.store.tasks.push(newTask);
    await this.ensureRoom(task.room, task.outdoor);
    await this.save();
    return { ...newTask };
  }

  async updateTask(id: number, updates: Partial<Omit<Task, 'id' | 'created_at'>>): Promise<Task | null> {
    const idx = this.store.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    this.store.tasks[idx] = { ...this.store.tasks[idx], ...updates };
    await this.save();
    return { ...this.store.tasks[idx] };
  }

  async deleteTask(id: number): Promise<void> {
    this.store.tasks = this.store.tasks.filter(t => t.id !== id);
    // Remove from any schedule assignments too
    for (const s of this.store.schedules) {
      if (s.assignments) {
        s.assignments = s.assignments.filter(a => a.task_id !== id);
      }
    }
    await this.save();
  }

  getTasksByStatus(status: TaskStatus): Task[] {
    return this.store.tasks
      .filter(t => t.status === status)
      .sort((a, b) => a.room.localeCompare(b.room) || b.effort_level - a.effort_level);
  }

  // ── Rooms ──────────────────────────────────────────────────────────────────

  getRooms(): Room[] {
    return this.store.rooms
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map(r => {
        const roomTasks = this.store.tasks.filter(t => t.room === r.name);
        return {
          name: r.name,
          outdoor: r.outdoor,
          sort_order: r.sort_order,
          task_count: roomTasks.length,
          completed_count: roomTasks.filter(t => t.status === 'completed').length,
        };
      });
  }

  async ensureRoom(name: string, outdoor = false): Promise<void> {
    if (this.store.rooms.some(r => r.name === name)) return;
    const maxOrder = this.store.rooms.reduce((m, r) => Math.max(m, r.sort_order), 0);
    this.store.rooms.push({ name, outdoor, sort_order: maxOrder + 1 });
  }

  async createRoom(name: string, outdoor = false): Promise<void> {
    await this.ensureRoom(name, outdoor);
    await this.save();
  }

  async renameRoom(oldName: string, newName: string): Promise<void> {
    const room = this.store.rooms.find(r => r.name === oldName);
    if (room) room.name = newName;
    for (const t of this.store.tasks) {
      if (t.room === oldName) t.room = newName;
    }
    await this.save();
  }

  async deleteRoom(name: string): Promise<void> {
    this.store.rooms = this.store.rooms.filter(r => r.name !== name);
    this.store.tasks = this.store.tasks.filter(t => t.room !== name);
    await this.save();
  }

  async setRoomOutdoor(name: string, outdoor: boolean): Promise<void> {
    const room = this.store.rooms.find(r => r.name === name);
    if (room) room.outdoor = outdoor;
    await this.save();
  }

  async reorderRooms(orderedNames: string[]): Promise<void> {
    for (let i = 0; i < orderedNames.length; i++) {
      const room = this.store.rooms.find(r => r.name === orderedNames[i]);
      if (room) room.sort_order = i;
    }
    await this.save();
  }

  // ── People ─────────────────────────────────────────────────────────────────

  getPeople(): Person[] {
    return [...this.store.people].sort((a, b) => a.name.localeCompare(b.name));
  }

  getPerson(id: number): Person | null {
    return this.store.people.find(p => p.id === id) ?? null;
  }

  async createPerson(person: Omit<Person, 'id' | 'created_at'>): Promise<Person> {
    const newPerson: Person = {
      ...person,
      id: this.nextId('people'),
      created_at: new Date().toISOString(),
    };
    this.store.people.push(newPerson);
    await this.save();
    return { ...newPerson };
  }

  async updatePerson(id: number, updates: Partial<Omit<Person, 'id' | 'created_at'>>): Promise<Person | null> {
    const idx = this.store.people.findIndex(p => p.id === id);
    if (idx === -1) return null;
    this.store.people[idx] = { ...this.store.people[idx], ...updates };
    await this.save();
    return { ...this.store.people[idx] };
  }

  async deletePerson(id: number): Promise<void> {
    this.store.people = this.store.people.filter(p => p.id !== id);
    this.store.schedules = this.store.schedules.filter(s => s.person_id !== id);
    await this.save();
  }

  // ── Shared Tasks ───────────────────────────────────────────────────────────

  getSharedTasks(): SharedTask[] {
    return [...this.store.shared_tasks].sort((a, b) =>
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    );
  }

  getSharedTask(id: number): SharedTask | null {
    return this.store.shared_tasks.find(t => t.id === id) ?? null;
  }

  async createSharedTask(task: Omit<SharedTask, 'id' | 'created_at' | 'updated_at'>): Promise<SharedTask> {
    const now = new Date().toISOString();
    const newTask: SharedTask = {
      ...task,
      id: this.nextId('shared_tasks'),
      created_at: now,
      updated_at: now,
    };
    this.store.shared_tasks.push(newTask);
    await this.save();
    return { ...newTask };
  }

  async updateSharedTask(id: number, updates: Partial<Omit<SharedTask, 'id' | 'created_at'>>): Promise<SharedTask | null> {
    const idx = this.store.shared_tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    this.store.shared_tasks[idx] = {
      ...this.store.shared_tasks[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    await this.save();
    return { ...this.store.shared_tasks[idx] };
  }

  async deleteSharedTask(id: number): Promise<void> {
    this.store.shared_tasks = this.store.shared_tasks.filter(t => t.id !== id);
    await this.save();
  }

  async applySharedTaskToRooms(sharedTaskId: number, roomNames: string[]): Promise<void> {
    const template = this.getSharedTask(sharedTaskId);
    if (!template) return;
    for (const room of roomNames) {
      await this.createTask({
        name: template.name,
        description: template.description,
        room,
        estimated_hours: template.estimated_hours,
        estimated_minutes: template.estimated_minutes,
        effort_level: template.effort_level,
        materials: [...template.materials],
        status: 'pending',
        outdoor: template.outdoor,
        shared_task_id: sharedTaskId,
      });
    }
  }

  // ── Schedules ──────────────────────────────────────────────────────────────

  getSchedules(): Schedule[] {
    return [...this.store.schedules].sort((a, b) =>
      a.schedule_date.localeCompare(b.schedule_date) || a.person_id - b.person_id
    );
  }

  getAssignmentsForSchedule(scheduleId: number): TaskAssignment[] {
    const schedule = this.store.schedules.find(s => s.id === scheduleId);
    if (!schedule?.assignments) return [];
    return schedule.assignments.map(a => ({
      ...a,
      task_name: this.getTask(a.task_id)?.name,
      task_room: this.getTask(a.task_id)?.room,
    }));
  }

  async createSchedule(schedule: Omit<Schedule, 'id'>): Promise<Schedule> {
    const id = this.nextId('schedules');
    const assignments = (schedule.assignments ?? []).map(a => ({
      ...a,
      id: this.nextId('assignments'),
      schedule_id: id,
    }));
    const newSchedule: Schedule = {
      ...schedule,
      id,
      assignments,
    };
    this.store.schedules.push(newSchedule);
    await this.save();
    return { ...newSchedule, assignments: this.getAssignmentsForSchedule(id) };
  }

  async createAssignment(a: Omit<TaskAssignment, 'id'>): Promise<number> {
    const schedule = this.store.schedules.find(s => s.id === a.schedule_id);
    if (!schedule) throw new Error('Schedule not found');
    if (!schedule.assignments) schedule.assignments = [];
    const id = this.nextId('assignments');
    schedule.assignments.push({ ...a, id });
    await this.save();
    return id;
  }

  async updateAssignment(id: number, updates: Partial<TaskAssignment>): Promise<void> {
    for (const s of this.store.schedules) {
      if (!s.assignments) continue;
      const idx = s.assignments.findIndex(a => a.id === id);
      if (idx !== -1) {
        s.assignments[idx] = { ...s.assignments[idx], ...updates };
        await this.save();
        return;
      }
    }
  }

  async deleteSchedule(id: number): Promise<void> {
    this.store.schedules = this.store.schedules.filter(s => s.id !== id);
    await this.save();
  }

  async clearAllSchedules(): Promise<void> {
    this.store.schedules = [];
    await this.save();
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  getStats(): { total: number; pending: number; assigned: number; completed: number } {
    const tasks = this.store.tasks;
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      assigned: tasks.filter(t => t.status === 'assigned').length,
      completed: tasks.filter(t => t.status === 'completed').length,
    };
  }
}
