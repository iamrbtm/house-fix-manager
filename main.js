/*
THIS IS A GENERATED/COMPILED FILE AND SHOULD NOT BE EDITED DIRECTLY!
See the src/ directory for source files.
*/

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => HouseFixPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian14 = require("obsidian");

// src/database.ts
var EMPTY_STORE = {
  tasks: [],
  people: [],
  shared_tasks: [],
  schedules: [],
  rooms: [],
  _nextId: { tasks: 1, people: 1, shared_tasks: 1, schedules: 1, assignments: 1 }
};
var HouseFixDatabase = class {
  constructor(app, fileName) {
    this.store = JSON.parse(JSON.stringify(EMPTY_STORE));
    this.app = app;
    this.fileName = fileName.replace(/\.db$/, ".json");
  }
  // ── Lifecycle ──────────────────────────────────────────────────────────────
  async initialize() {
    var _a;
    try {
      const exists = await this.app.vault.adapter.exists(this.fileName);
      if (exists) {
        const raw = await this.app.vault.adapter.read(this.fileName);
        const parsed = JSON.parse(raw);
        this.store = {
          ...JSON.parse(JSON.stringify(EMPTY_STORE)),
          ...parsed,
          _nextId: {
            ...EMPTY_STORE._nextId,
            ...(_a = parsed._nextId) != null ? _a : {}
          }
        };
      }
    } catch (e) {
      console.warn("[HouseFix] Could not load database, starting fresh:", e);
      this.store = JSON.parse(JSON.stringify(EMPTY_STORE));
    }
    await this.save();
  }
  async save() {
    await this.app.vault.adapter.write(
      this.fileName,
      JSON.stringify(this.store, null, 2)
    );
  }
  close() {
  }
  // ── ID generation ──────────────────────────────────────────────────────────
  nextId(table) {
    if (!this.store._nextId[table])
      this.store._nextId[table] = 1;
    return this.store._nextId[table]++;
  }
  // ── Tasks ──────────────────────────────────────────────────────────────────
  getTasks(room) {
    const tasks = room ? this.store.tasks.filter((t) => t.room === room) : [...this.store.tasks];
    return tasks.sort((a, b) => {
      if (a.room < b.room)
        return -1;
      if (a.room > b.room)
        return 1;
      return b.created_at.localeCompare(a.created_at);
    });
  }
  getTask(id) {
    var _a;
    return (_a = this.store.tasks.find((t) => t.id === id)) != null ? _a : null;
  }
  async createTask(task) {
    const newTask = {
      ...task,
      id: this.nextId("tasks"),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.store.tasks.push(newTask);
    await this.ensureRoom(task.room, task.outdoor);
    await this.save();
    return { ...newTask };
  }
  async updateTask(id, updates) {
    const idx = this.store.tasks.findIndex((t) => t.id === id);
    if (idx === -1)
      return null;
    this.store.tasks[idx] = { ...this.store.tasks[idx], ...updates };
    await this.save();
    return { ...this.store.tasks[idx] };
  }
  async deleteTask(id) {
    this.store.tasks = this.store.tasks.filter((t) => t.id !== id);
    for (const s of this.store.schedules) {
      if (s.assignments) {
        s.assignments = s.assignments.filter((a) => a.task_id !== id);
      }
    }
    await this.save();
  }
  getTasksByStatus(status) {
    return this.store.tasks.filter((t) => t.status === status).sort((a, b) => a.room.localeCompare(b.room) || b.effort_level - a.effort_level);
  }
  // ── Rooms ──────────────────────────────────────────────────────────────────
  getRooms() {
    return this.store.rooms.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)).map((r) => {
      const roomTasks = this.store.tasks.filter((t) => t.room === r.name);
      return {
        name: r.name,
        outdoor: r.outdoor,
        sort_order: r.sort_order,
        task_count: roomTasks.length,
        completed_count: roomTasks.filter((t) => t.status === "completed").length
      };
    });
  }
  async ensureRoom(name, outdoor = false) {
    if (this.store.rooms.some((r) => r.name === name))
      return;
    const maxOrder = this.store.rooms.reduce((m, r) => Math.max(m, r.sort_order), 0);
    this.store.rooms.push({ name, outdoor, sort_order: maxOrder + 1 });
  }
  async createRoom(name, outdoor = false) {
    await this.ensureRoom(name, outdoor);
    await this.save();
  }
  async renameRoom(oldName, newName) {
    const room = this.store.rooms.find((r) => r.name === oldName);
    if (room)
      room.name = newName;
    for (const t of this.store.tasks) {
      if (t.room === oldName)
        t.room = newName;
    }
    await this.save();
  }
  async deleteRoom(name) {
    this.store.rooms = this.store.rooms.filter((r) => r.name !== name);
    this.store.tasks = this.store.tasks.filter((t) => t.room !== name);
    await this.save();
  }
  async setRoomOutdoor(name, outdoor) {
    const room = this.store.rooms.find((r) => r.name === name);
    if (room)
      room.outdoor = outdoor;
    await this.save();
  }
  async reorderRooms(orderedNames) {
    for (let i = 0; i < orderedNames.length; i++) {
      const room = this.store.rooms.find((r) => r.name === orderedNames[i]);
      if (room)
        room.sort_order = i;
    }
    await this.save();
  }
  // ── People ─────────────────────────────────────────────────────────────────
  getPeople() {
    return [...this.store.people].sort((a, b) => a.name.localeCompare(b.name));
  }
  getPerson(id) {
    var _a;
    return (_a = this.store.people.find((p) => p.id === id)) != null ? _a : null;
  }
  async createPerson(person) {
    const newPerson = {
      ...person,
      id: this.nextId("people"),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.store.people.push(newPerson);
    await this.save();
    return { ...newPerson };
  }
  async updatePerson(id, updates) {
    const idx = this.store.people.findIndex((p) => p.id === id);
    if (idx === -1)
      return null;
    this.store.people[idx] = { ...this.store.people[idx], ...updates };
    await this.save();
    return { ...this.store.people[idx] };
  }
  async deletePerson(id) {
    this.store.people = this.store.people.filter((p) => p.id !== id);
    this.store.schedules = this.store.schedules.filter((s) => s.person_id !== id);
    await this.save();
  }
  // ── Shared Tasks ───────────────────────────────────────────────────────────
  getSharedTasks() {
    return [...this.store.shared_tasks].sort(
      (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    );
  }
  getSharedTask(id) {
    var _a;
    return (_a = this.store.shared_tasks.find((t) => t.id === id)) != null ? _a : null;
  }
  async createSharedTask(task) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newTask = {
      ...task,
      id: this.nextId("shared_tasks"),
      created_at: now,
      updated_at: now
    };
    this.store.shared_tasks.push(newTask);
    await this.save();
    return { ...newTask };
  }
  async updateSharedTask(id, updates) {
    const idx = this.store.shared_tasks.findIndex((t) => t.id === id);
    if (idx === -1)
      return null;
    this.store.shared_tasks[idx] = {
      ...this.store.shared_tasks[idx],
      ...updates,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.save();
    return { ...this.store.shared_tasks[idx] };
  }
  async deleteSharedTask(id) {
    this.store.shared_tasks = this.store.shared_tasks.filter((t) => t.id !== id);
    await this.save();
  }
  async applySharedTaskToRooms(sharedTaskId, roomNames) {
    const template = this.getSharedTask(sharedTaskId);
    if (!template)
      return;
    for (const room of roomNames) {
      await this.createTask({
        name: template.name,
        description: template.description,
        room,
        estimated_hours: template.estimated_hours,
        estimated_minutes: template.estimated_minutes,
        effort_level: template.effort_level,
        materials: [...template.materials],
        status: "pending",
        outdoor: template.outdoor,
        shared_task_id: sharedTaskId
      });
    }
  }
  // ── Schedules ──────────────────────────────────────────────────────────────
  getSchedules() {
    return [...this.store.schedules].sort(
      (a, b) => a.schedule_date.localeCompare(b.schedule_date) || a.person_id - b.person_id
    );
  }
  getAssignmentsForSchedule(scheduleId) {
    const schedule = this.store.schedules.find((s) => s.id === scheduleId);
    if (!(schedule == null ? void 0 : schedule.assignments))
      return [];
    return schedule.assignments.map((a) => {
      var _a, _b;
      return {
        ...a,
        task_name: (_a = this.getTask(a.task_id)) == null ? void 0 : _a.name,
        task_room: (_b = this.getTask(a.task_id)) == null ? void 0 : _b.room
      };
    });
  }
  async createSchedule(schedule) {
    var _a;
    const id = this.nextId("schedules");
    const assignments = ((_a = schedule.assignments) != null ? _a : []).map((a) => ({
      ...a,
      id: this.nextId("assignments"),
      schedule_id: id
    }));
    const newSchedule = {
      ...schedule,
      id,
      assignments
    };
    this.store.schedules.push(newSchedule);
    await this.save();
    return { ...newSchedule, assignments: this.getAssignmentsForSchedule(id) };
  }
  async createAssignment(a) {
    const schedule = this.store.schedules.find((s) => s.id === a.schedule_id);
    if (!schedule)
      throw new Error("Schedule not found");
    if (!schedule.assignments)
      schedule.assignments = [];
    const id = this.nextId("assignments");
    schedule.assignments.push({ ...a, id });
    await this.save();
    return id;
  }
  async updateAssignment(id, updates) {
    for (const s of this.store.schedules) {
      if (!s.assignments)
        continue;
      const idx = s.assignments.findIndex((a) => a.id === id);
      if (idx !== -1) {
        s.assignments[idx] = { ...s.assignments[idx], ...updates };
        await this.save();
        return;
      }
    }
  }
  async deleteSchedule(id) {
    this.store.schedules = this.store.schedules.filter((s) => s.id !== id);
    await this.save();
  }
  async clearAllSchedules() {
    this.store.schedules = [];
    await this.save();
  }
  // ── Stats ──────────────────────────────────────────────────────────────────
  getStats() {
    const tasks = this.store.tasks;
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      assigned: tasks.filter((t) => t.status === "assigned").length,
      completed: tasks.filter((t) => t.status === "completed").length
    };
  }
};

// src/ai.ts
var import_obsidian = require("obsidian");
var GITHUB_MODELS_ENDPOINT = "https://models.inference.ai.azure.com/chat/completions";
var GitHubModelsClient = class {
  constructor(accessToken, model) {
    this.token = accessToken;
    this.model = model;
  }
  // ─── Task Analysis ────────────────────────────────────────────────────────
  async analyzeTask(description) {
    var _a, _b, _c, _d, _e, _f;
    if (!this.token) {
      return this.fallbackAnalysis(description);
    }
    const prompt = `You are an expert in home improvement and maintenance tasks. Analyze the following task and provide accurate estimates.

Task: "${description}"

Respond with a JSON object containing ONLY these fields:
{
  "time_hours": <integer, total hours>,
  "time_minutes": <integer 0-59, additional minutes>,
  "effort_level": <integer 1-10, physical/skill effort required>,
  "materials": <array of strings listing required materials>,
  "enhanced_description": "<2-3 sentence detailed description of the task>"
}

Consider: complexity, tools needed, prep time, cleanup. Be realistic and practical.`;
    try {
      const response = await (0, import_obsidian.requestUrl)({
        url: GITHUB_MODELS_ENDPOINT,
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: "You are an expert in home improvement and maintenance tasks. Provide accurate estimates for task completion and clear, actionable descriptions. Always respond with valid JSON only."
            },
            { role: "user", content: prompt }
          ],
          model: this.model,
          temperature: 0.3,
          max_tokens: 800
        }),
        throw: false
      });
      if (response.status >= 400) {
        console.error("GitHub Models API error:", response.status, response.text);
        return this.fallbackAnalysis(description);
      }
      const data = response.json;
      const content = ((_c = (_b = (_a = data.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content) || "";
      const parsed = this.extractJson(content);
      return {
        time_hours: Math.max(0, Math.round((_d = parsed == null ? void 0 : parsed.time_hours) != null ? _d : 1)),
        time_minutes: Math.max(0, Math.min(59, Math.round((_e = parsed == null ? void 0 : parsed.time_minutes) != null ? _e : 0))),
        effort_level: Math.max(1, Math.min(10, Math.round((_f = parsed == null ? void 0 : parsed.effort_level) != null ? _f : 5))),
        materials: Array.isArray(parsed == null ? void 0 : parsed.materials) ? parsed.materials : [],
        enhanced_description: (parsed == null ? void 0 : parsed.enhanced_description) || description,
        reasoning: `GitHub Models AI analysis using ${this.model}`
      };
    } catch (e) {
      console.error("Task analysis error:", e);
      return this.fallbackAnalysis(description);
    }
  }
  // ─── Schedule Generation ──────────────────────────────────────────────────
  async generateSchedules(people, tasks, startDate, numDays) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!this.token) {
      return this.fallbackSchedule(people, tasks, startDate, numDays);
    }
    const prompt = this.buildSchedulingPrompt(people, tasks, startDate, numDays);
    try {
      const response = await (0, import_obsidian.requestUrl)({
        url: GITHUB_MODELS_ENDPOINT,
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: "You are an expert task scheduling AI. Generate optimal daily schedules that respect constraints, maximize efficiency through task grouping, and provide clear reasoning. Always respond with valid JSON only."
            },
            { role: "user", content: prompt }
          ],
          model: this.model,
          temperature: 0.4,
          max_tokens: 4e3
        }),
        throw: false
      });
      if (response.status >= 400) {
        console.error("Schedule generation API error:", response.status);
        return this.fallbackSchedule(people, tasks, startDate, numDays);
      }
      const data = response.json;
      const content = ((_c = (_b = (_a = data.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content) || "";
      const parsed = this.extractJson(content);
      return {
        schedules: (_d = parsed == null ? void 0 : parsed.schedules) != null ? _d : [],
        task_groupings: (_e = parsed == null ? void 0 : parsed.task_groupings) != null ? _e : [],
        unscheduled_tasks: (_f = parsed == null ? void 0 : parsed.unscheduled_tasks) != null ? _f : [],
        reasoning: (_g = parsed == null ? void 0 : parsed.reasoning) != null ? _g : "AI schedule generated",
        warnings: (_h = parsed == null ? void 0 : parsed.warnings) != null ? _h : [],
        ai_model: this.model,
        generated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (e) {
      console.error("Schedule generation error:", e);
      return this.fallbackSchedule(people, tasks, startDate, numDays);
    }
  }
  async testConnection() {
    if (!this.token) {
      return { success: false, message: "Not signed in to GitHub. Use Settings \u2192 Sign in with GitHub." };
    }
    try {
      const response = await (0, import_obsidian.requestUrl)({
        url: GITHUB_MODELS_ENDPOINT,
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: 'Say "OK" in one word.' }],
          model: this.model,
          max_tokens: 10
        }),
        throw: false
      });
      if (response.status < 400) {
        return { success: true, message: `Connected successfully using model: ${this.model}` };
      } else if (response.status === 401) {
        return { success: false, message: "GitHub token is invalid or expired \u2014 please sign in again via Settings (401 Unauthorized)" };
      } else if (response.status === 403) {
        return { success: false, message: "Your GitHub account does not have GitHub Models access (403 Forbidden). Visit github.com/marketplace/models to enable it." };
      } else {
        return { success: false, message: `API error: ${response.status}` };
      }
    } catch (e) {
      return { success: false, message: `Connection failed: ${e.message}` };
    }
  }
  // ─── Prompts ──────────────────────────────────────────────────────────────
  buildSchedulingPrompt(people, tasks, startDate, numDays) {
    const taskList = tasks.slice(0, 20).map(
      (t) => `  - ID:${t.id} "${t.name}" | Room: ${t.room} | Effort: ${t.effort_level}/10 | Time: ${t.estimated_hours}h${t.estimated_minutes}m | Outdoor: ${t.outdoor}`
    ).join("\n");
    const peopleList = people.map((p) => {
      const slots = Object.entries(p.availability).map(
        ([day, timeSlots]) => `    ${day}: ${timeSlots.map((s) => `${s.start}-${s.end}(effort\u2264${s.effort_capacity})`).join(", ")}`
      ).join("\n");
      return `  - ID:${p.id} "${p.name}" | Max tasks/day: ${p.max_tasks_per_day} | Limitations: ${p.physical_limitations || "none"}
    Availability:
${slots}`;
    }).join("\n");
    return `Generate an optimized work schedule.

Start date: ${startDate}
Duration: ${numDays} days

PEOPLE:
${peopleList}

TASKS (pending/assigned):
${taskList}
${tasks.length > 20 ? `  ... and ${tasks.length - 20} more tasks` : ""}

CONSTRAINTS:
1. Match task effort_level to person's available effort_capacity in each time slot
2. Respect physical limitations (avoid high-effort tasks for people with limitations)
3. Group tasks in the same room when possible (assigned to same person on same day)
4. Prioritize indoor tasks on days with bad weather
5. Distribute tasks fairly across people
6. Respect max_tasks_per_day limit per person
7. Assign start_time and end_time based on availability slots
8. Only schedule tasks that fit within available time slots

Respond with a JSON object:
{
  "schedules": [
    {
      "person_id": <number>,
      "person_name": "<string>",
      "date": "YYYY-MM-DD",
      "assignments": [
        {
          "task_id": <number>,
          "task_name": "<string>",
          "start_time": "HH:MM",
          "end_time": "HH:MM",
          "is_grouped": <boolean>,
          "grouped_task_ids": [],
          "group_description": "<string or empty>",
          "estimated_minutes": <number>,
          "notes": "<brief scheduling note>"
        }
      ]
    }
  ],
  "task_groupings": [],
  "unscheduled_tasks": [<task ids that could not be scheduled>],
  "reasoning": "<brief explanation of scheduling decisions>",
  "warnings": ["<any constraint violations or notes>"]
}`;
  }
  // ─── Fallbacks ────────────────────────────────────────────────────────────
  fallbackAnalysis(description) {
    const lower = description.toLowerCase();
    let time_hours = 1, time_minutes = 0, effort_level = 5;
    const materials = [];
    if (/paint|stain|varnish|primer/.test(lower)) {
      time_hours = 3;
      effort_level = 6;
      materials.push("Paint", "Paintbrush", "Roller", "Drop cloth", "Painter's tape");
    } else if (/clean|wash|scrub|dust|mop|vacuum/.test(lower)) {
      time_hours = 1;
      time_minutes = 30;
      effort_level = 3;
      materials.push("Cleaning solution", "Microfiber cloth", "Bucket");
    } else if (/repair|fix|patch|seal|caulk/.test(lower)) {
      time_hours = 2;
      effort_level = 7;
      materials.push("Repair materials", "Tools");
    } else if (/install|replace|mount|hang/.test(lower)) {
      time_hours = 2;
      time_minutes = 30;
      effort_level = 6;
      materials.push("Hardware", "Tools", "Screws");
    } else if (/organiz|sort|arrang|declutter/.test(lower)) {
      time_hours = 1;
      effort_level = 3;
    }
    return {
      time_hours,
      time_minutes,
      effort_level,
      materials,
      enhanced_description: description,
      reasoning: "Local keyword-based fallback (not signed in to GitHub)"
    };
  }
  fallbackSchedule(people, tasks, startDate, numDays) {
    const schedules = [];
    const unscheduled = [];
    const start = new Date(startDate);
    let taskIndex = 0;
    for (let day = 0; day < numDays && taskIndex < tasks.length; day++) {
      const date = new Date(start);
      date.setDate(date.getDate() + day);
      const dateStr = date.toISOString().split("T")[0];
      for (const person of people) {
        if (taskIndex >= tasks.length)
          break;
        const assignments = [];
        let tasksToday = 0;
        while (taskIndex < tasks.length && tasksToday < person.max_tasks_per_day) {
          const task = tasks[taskIndex];
          const totalMins = task.estimated_hours * 60 + task.estimated_minutes || 60;
          const startHour = 9 + tasksToday * 2;
          const endHour = startHour + Math.ceil(totalMins / 60);
          assignments.push({
            task_id: task.id,
            task_name: task.name,
            start_time: `${String(startHour).padStart(2, "0")}:00`,
            end_time: `${String(Math.min(endHour, 18)).padStart(2, "0")}:00`,
            is_grouped: false,
            grouped_task_ids: [],
            group_description: "",
            estimated_minutes: totalMins,
            notes: "Rule-based assignment"
          });
          taskIndex++;
          tasksToday++;
        }
        if (assignments.length > 0) {
          schedules.push({ person_id: person.id, person_name: person.name, date: dateStr, assignments });
        }
      }
    }
    while (taskIndex < tasks.length) {
      unscheduled.push(tasks[taskIndex++].id);
    }
    return {
      schedules,
      task_groupings: [],
      unscheduled_tasks: unscheduled,
      reasoning: "Rule-based fallback schedule (not signed in to GitHub)",
      warnings: unscheduled.length > 0 ? [`${unscheduled.length} tasks could not be scheduled in ${numDays} days`] : [],
      ai_model: "rule-based",
      generated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  // ─── Helpers ──────────────────────────────────────────────────────────────
  extractJson(content) {
    try {
      return JSON.parse(content);
    } catch (e) {
    }
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
      }
    }
    return null;
  }
};

// src/models.ts
var DEFAULT_SETTINGS = {
  githubAccessToken: "",
  githubUser: "",
  githubModel: "gpt-4o-mini",
  dbFileName: "house-fix.json",
  collapsedRooms: []
};
var GITHUB_MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Recommended)" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "o1-mini", label: "o1 Mini" },
  { value: "o1-preview", label: "o1 Preview" }
];
var DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

// src/views/SidebarView.ts
var import_obsidian11 = require("obsidian");

// src/views/DashboardView.ts
var import_obsidian4 = require("obsidian");

// src/components/TaskModal.ts
var import_obsidian2 = require("obsidian");
var TaskModal = class extends import_obsidian2.Modal {
  constructor(app, plugin, onSave, existingTask, defaultRoom) {
    super(app);
    this.analysisResult = null;
    this.datalistEl = null;
    this.plugin = plugin;
    this.onSave = onSave;
    this.isEdit = !!existingTask;
    this.task = existingTask ? { ...existingTask } : {
      name: "",
      description: "",
      room: defaultRoom || "",
      estimated_hours: 0,
      estimated_minutes: 0,
      effort_level: 5,
      materials: [],
      status: "pending",
      outdoor: false,
      shared_task_id: null
    };
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("hf-task-modal");
    this.renderStep1();
  }
  renderStep1() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.isEdit ? "Edit Task" : "New Task" });
    const form = contentEl.createDiv({ cls: "hf-form" });
    const nameGroup = form.createDiv({ cls: "hf-form-group" });
    nameGroup.createEl("label", { text: "Task Name *", cls: "hf-label" });
    const nameInput = nameGroup.createEl("input", {
      type: "text",
      cls: "hf-input",
      placeholder: "e.g., Paint the bedroom walls"
    });
    nameInput.value = this.task.name || "";
    const roomGroup = form.createDiv({ cls: "hf-form-group" });
    roomGroup.createEl("label", { text: "Room *", cls: "hf-label" });
    const rooms = this.plugin.db.getRooms();
    const datalistId = "hf-rooms-datalist-" + Date.now();
    this.datalistEl = document.createElement("datalist");
    this.datalistEl.id = datalistId;
    for (const r of rooms) {
      const opt = document.createElement("option");
      opt.value = r.name;
      this.datalistEl.appendChild(opt);
    }
    document.body.appendChild(this.datalistEl);
    const roomInput = roomGroup.createEl("input", {
      type: "text",
      cls: "hf-input",
      placeholder: "e.g., Master Bedroom"
    });
    roomInput.setAttribute("list", datalistId);
    roomInput.value = this.task.room || "";
    const descGroup = form.createDiv({ cls: "hf-form-group" });
    descGroup.createEl("label", { text: "Description", cls: "hf-label" });
    const descInput = descGroup.createEl("textarea", { cls: "hf-textarea", placeholder: "Describe the task in detail for better AI analysis..." });
    descInput.rows = 4;
    descInput.value = this.task.description || "";
    const outdoorGroup = form.createDiv({ cls: "hf-form-group hf-form-row" });
    const outdoorLabel = outdoorGroup.createEl("label", { cls: "hf-label" });
    outdoorLabel.createEl("span", { text: "Outdoor Task" });
    const outdoorToggle = outdoorGroup.createEl("input", { type: "checkbox", cls: "hf-checkbox" });
    outdoorToggle.checked = this.task.outdoor || false;
    const btnRow = contentEl.createDiv({ cls: "hf-modal-buttons" });
    const cancelBtn = btnRow.createEl("button", { text: "Cancel", cls: "hf-btn" });
    cancelBtn.addEventListener("click", () => this.close());
    const analyzeBtn = btnRow.createEl("button", { text: "\u2728 Analyze with AI", cls: "hf-btn hf-btn-secondary" });
    analyzeBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim();
      const room = roomInput.value.trim();
      const description = descInput.value.trim();
      if (!name) {
        new import_obsidian2.Notice("Please enter a task name.");
        return;
      }
      if (!room) {
        new import_obsidian2.Notice("Please enter a room.");
        return;
      }
      this.task.name = name;
      this.task.room = room;
      this.task.description = description;
      this.task.outdoor = outdoorToggle.checked;
      await this.runAiAnalysis(analyzeBtn);
    });
    const saveBtn = btnRow.createEl("button", {
      text: this.isEdit ? "Save Changes" : "Add Task",
      cls: "hf-btn hf-btn-primary"
    });
    saveBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim();
      const room = roomInput.value.trim();
      if (!name) {
        new import_obsidian2.Notice("Please enter a task name.");
        return;
      }
      if (!room) {
        new import_obsidian2.Notice("Please enter a room.");
        return;
      }
      this.task.name = name;
      this.task.room = room;
      this.task.description = descInput.value.trim();
      this.task.outdoor = outdoorToggle.checked;
      await this.saveTask();
    });
  }
  async runAiAnalysis(btn) {
    btn.setAttr("disabled", "true");
    btn.textContent = "\u23F3 Analyzing...";
    try {
      const ai = this.plugin.getAI();
      const analysisText = this.task.description || this.task.name || "";
      this.analysisResult = await ai.analyzeTask(analysisText);
      this.renderStep2();
    } catch (e) {
      new import_obsidian2.Notice(`AI analysis failed: ${e.message}`);
      btn.removeAttribute("disabled");
      btn.textContent = "\u2728 Analyze with AI";
    }
  }
  renderStep2() {
    const { contentEl } = this;
    const r = this.analysisResult;
    contentEl.empty();
    contentEl.createEl("h2", { text: "\u2728 AI Analysis Results" });
    contentEl.createEl("p", { text: `Task: "${this.task.name}"`, cls: "hf-modal-subtitle" });
    const grid = contentEl.createDiv({ cls: "hf-analysis-grid" });
    const timeCard = grid.createDiv({ cls: "hf-analysis-card" });
    timeCard.createEl("div", { text: "\u23F1 Estimated Time", cls: "hf-analysis-label" });
    const timeRow = timeCard.createDiv({ cls: "hf-analysis-inputs" });
    const hoursInput = timeRow.createEl("input", { type: "number", cls: "hf-input hf-input-sm" });
    hoursInput.min = "0";
    hoursInput.max = "99";
    hoursInput.value = String(r.time_hours);
    timeRow.createEl("span", { text: "h" });
    const minsInput = timeRow.createEl("input", { type: "number", cls: "hf-input hf-input-sm" });
    minsInput.min = "0";
    minsInput.max = "59";
    minsInput.value = String(r.time_minutes);
    timeRow.createEl("span", { text: "m" });
    const effortCard = grid.createDiv({ cls: "hf-analysis-card" });
    effortCard.createEl("div", { text: "\u{1F4AA} Effort Level", cls: "hf-analysis-label" });
    const effortInput = effortCard.createEl("input", { type: "range", cls: "hf-slider" });
    effortInput.min = "1";
    effortInput.max = "10";
    effortInput.value = String(r.effort_level);
    const effortVal = effortCard.createEl("div", { text: `${r.effort_level} / 10`, cls: "hf-slider-value" });
    effortInput.addEventListener("input", () => {
      effortVal.textContent = `${effortInput.value} / 10`;
    });
    const materialsCard = contentEl.createDiv({ cls: "hf-analysis-materials" });
    materialsCard.createEl("div", { text: "\u{1F527} Materials Needed", cls: "hf-analysis-label" });
    const materialsList = materialsCard.createDiv({ cls: "hf-materials-tags" });
    const materialsData = [...r.materials];
    const renderMaterials = () => {
      materialsList.empty();
      for (let i = 0; i < materialsData.length; i++) {
        const tag = materialsList.createDiv({ cls: "hf-tag" });
        tag.createEl("span", { text: materialsData[i] });
        const rm = tag.createEl("button", { text: "\xD7", cls: "hf-tag-remove" });
        const idx = i;
        rm.addEventListener("click", () => {
          materialsData.splice(idx, 1);
          renderMaterials();
        });
      }
      const addInput = materialsList.createEl("input", {
        type: "text",
        cls: "hf-input hf-input-inline",
        placeholder: "+ Add material"
      });
      addInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && addInput.value.trim()) {
          materialsData.push(addInput.value.trim());
          renderMaterials();
        }
      });
    };
    renderMaterials();
    const descCard = contentEl.createDiv({ cls: "hf-analysis-desc" });
    descCard.createEl("div", { text: "\u{1F4DD} Enhanced Description", cls: "hf-analysis-label" });
    const descArea = descCard.createEl("textarea", { cls: "hf-textarea" });
    descArea.rows = 3;
    descArea.value = r.enhanced_description || this.task.description || "";
    const reasoningEl = contentEl.createDiv({ cls: "hf-analysis-reasoning" });
    reasoningEl.createEl("span", { text: `\u{1F916} ${r.reasoning}`, cls: "hf-reasoning-text" });
    const btnRow = contentEl.createDiv({ cls: "hf-modal-buttons" });
    const backBtn = btnRow.createEl("button", { text: "\u2190 Back", cls: "hf-btn" });
    backBtn.addEventListener("click", () => this.renderStep1());
    const saveBtn = btnRow.createEl("button", {
      text: this.isEdit ? "Save Changes" : "Add Task",
      cls: "hf-btn hf-btn-primary"
    });
    saveBtn.addEventListener("click", async () => {
      this.task.estimated_hours = parseInt(hoursInput.value) || 0;
      this.task.estimated_minutes = parseInt(minsInput.value) || 0;
      this.task.effort_level = parseInt(effortInput.value) || 5;
      this.task.materials = [...materialsData];
      this.task.description = descArea.value.trim();
      await this.saveTask();
    });
  }
  async saveTask() {
    try {
      let saved;
      if (this.isEdit && this.task.id) {
        const { id, created_at, ...updates } = this.task;
        saved = await this.plugin.db.updateTask(this.task.id, updates);
      } else {
        saved = await this.plugin.db.createTask({
          name: this.task.name || "",
          description: this.task.description || "",
          room: this.task.room || "",
          estimated_hours: this.task.estimated_hours || 0,
          estimated_minutes: this.task.estimated_minutes || 0,
          effort_level: this.task.effort_level || 5,
          materials: this.task.materials || [],
          status: this.task.status || "pending",
          outdoor: this.task.outdoor || false,
          shared_task_id: this.task.shared_task_id || null
        });
      }
      this.close();
      this.onSave(saved);
      new import_obsidian2.Notice(this.isEdit ? "Task updated." : "Task created.");
    } catch (e) {
      new import_obsidian2.Notice(`Failed to save task: ${e.message}`);
    }
  }
  onClose() {
    if (this.datalistEl) {
      this.datalistEl.remove();
      this.datalistEl = null;
    }
    this.contentEl.empty();
  }
};

// src/components/ConfirmModal.ts
var import_obsidian3 = require("obsidian");
var ConfirmModal = class extends import_obsidian3.Modal {
  constructor(app, message, onConfirm, confirmText = "Delete", isDangerous = true) {
    super(app);
    this.message = message;
    this.onConfirm = onConfirm;
    this.confirmText = confirmText;
    this.isDangerous = isDangerous;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("hf-confirm-modal");
    contentEl.createEl("h3", { text: "Confirm Action" });
    contentEl.createEl("p", { text: this.message, cls: "hf-confirm-message" });
    const btnRow = contentEl.createDiv({ cls: "hf-modal-buttons" });
    const cancelBtn = btnRow.createEl("button", { text: "Cancel", cls: "hf-btn" });
    cancelBtn.addEventListener("click", () => this.close());
    const confirmBtn = btnRow.createEl("button", {
      text: this.confirmText,
      cls: this.isDangerous ? "hf-btn hf-btn-danger" : "hf-btn hf-btn-primary"
    });
    confirmBtn.addEventListener("click", async () => {
      this.close();
      await this.onConfirm();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/views/DashboardView.ts
var DashboardView = class {
  constructor(el, plugin) {
    this.el = el;
    this.plugin = plugin;
  }
  render() {
    this.el.empty();
    this.el.addClass("hf-view");
    const header = this.el.createDiv({ cls: "hf-view-header" });
    header.createEl("h2", { text: "Dashboard", cls: "hf-view-title" });
    const newBtn = header.createEl("button", { text: "+ New Task", cls: "hf-btn hf-btn-primary" });
    newBtn.addEventListener("click", () => this.openNewTaskModal());
    const stats = this.plugin.db.getStats();
    const statsRow = this.el.createDiv({ cls: "hf-stats-row" });
    this.statCard(statsRow, String(stats.total), "Total Tasks", "hf-stat-total");
    this.statCard(statsRow, String(stats.pending), "Pending", "hf-stat-pending");
    this.statCard(statsRow, String(stats.assigned), "In Progress", "hf-stat-assigned");
    this.statCard(statsRow, String(stats.completed), "Completed", "hf-stat-completed");
    const rooms = this.plugin.db.getRooms();
    if (rooms.length === 0) {
      const empty = this.el.createDiv({ cls: "hf-empty-state" });
      empty.createEl("div", { text: "\u{1F3D7}\uFE0F", cls: "hf-empty-icon" });
      empty.createEl("p", { text: "No tasks yet. Add your first task or upload a task list!" });
      const addBtn = empty.createEl("button", { text: "+ Add First Task", cls: "hf-btn hf-btn-primary" });
      addBtn.addEventListener("click", () => this.openNewTaskModal());
      return;
    }
    const roomsContainer = this.el.createDiv({ cls: "hf-rooms-container" });
    for (const room of rooms) {
      this.renderRoom(roomsContainer, room);
    }
  }
  statCard(parent, value, label, cls) {
    const card = parent.createDiv({ cls: `hf-stat-card ${cls}` });
    card.createEl("div", { text: value, cls: "hf-stat-value" });
    card.createEl("div", { text: label, cls: "hf-stat-label" });
  }
  renderRoom(parent, room) {
    var _a;
    const tasks = this.plugin.db.getTasks(room.name);
    const pct = room.task_count > 0 ? Math.round(room.completed_count / room.task_count * 100) : 0;
    const section = parent.createDiv({ cls: "hf-room-section" });
    section.dataset.room = room.name;
    const sectionHeader = section.createDiv({ cls: "hf-room-header" });
    const toggleBtn = sectionHeader.createEl("button", { cls: "hf-room-toggle" });
    toggleBtn.textContent = "\u25BC";
    const titleArea = sectionHeader.createDiv({ cls: "hf-room-title-area" });
    titleArea.createEl("span", { text: room.outdoor ? "\u{1F33F}" : "\u{1F3E0}", cls: "hf-room-icon" });
    titleArea.createEl("span", { text: room.name, cls: "hf-room-name" });
    if (room.outdoor) {
      titleArea.createEl("span", { text: "Outdoor", cls: "hf-badge hf-badge-outdoor" });
    }
    const rightArea = sectionHeader.createDiv({ cls: "hf-room-right" });
    rightArea.createEl("span", { text: `${room.completed_count}/${room.task_count}`, cls: "hf-room-count" });
    const progressBar = sectionHeader.createDiv({ cls: "hf-progress-bar" });
    const fill = progressBar.createDiv({ cls: "hf-progress-fill" });
    fill.style.width = `${pct}%`;
    if (pct === 100)
      fill.addClass("hf-progress-complete");
    rightArea.appendChild(progressBar);
    const tableContainer = section.createDiv({ cls: "hf-task-table-container" });
    this.renderTaskTable(tableContainer, tasks, room.name);
    const collapsedRooms = (_a = this.plugin.settings.collapsedRooms) != null ? _a : [];
    if (collapsedRooms.includes(room.name)) {
      section.addClass("hf-collapsed");
      toggleBtn.textContent = "\u25B6";
    }
    toggleBtn.addEventListener("click", async () => {
      var _a2, _b, _c;
      const collapsed = section.hasClass("hf-collapsed");
      if (collapsed) {
        section.removeClass("hf-collapsed");
        toggleBtn.textContent = "\u25BC";
        this.plugin.settings.collapsedRooms = ((_a2 = this.plugin.settings.collapsedRooms) != null ? _a2 : []).filter((r) => r !== room.name);
      } else {
        section.addClass("hf-collapsed");
        toggleBtn.textContent = "\u25B6";
        if (!((_b = this.plugin.settings.collapsedRooms) != null ? _b : []).includes(room.name)) {
          this.plugin.settings.collapsedRooms = [...(_c = this.plugin.settings.collapsedRooms) != null ? _c : [], room.name];
        }
      }
      await this.plugin.saveSettings();
    });
  }
  renderTaskTable(parent, tasks, roomName) {
    if (tasks.length === 0) {
      const empty = parent.createDiv({ cls: "hf-room-empty" });
      empty.createEl("span", { text: "No tasks in this room. " });
      const addLink = empty.createEl("a", { text: "Add one?", cls: "hf-link", href: "#" });
      addLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.openNewTaskModal(roomName);
      });
      return;
    }
    const table = parent.createEl("table", { cls: "hf-table" });
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    for (const h of ["", "Task", "Time", "Effort", "Materials", "Status", ""]) {
      headerRow.createEl("th", { text: h, cls: "hf-th" });
    }
    const tbody = table.createEl("tbody");
    for (const task of tasks) {
      this.renderTaskRow(tbody, task);
    }
  }
  renderTaskRow(tbody, task) {
    const tr = tbody.createEl("tr", { cls: `hf-tr hf-status-${task.status}` });
    const checkTd = tr.createEl("td", { cls: "hf-td hf-td-check" });
    const checkbox = checkTd.createEl("input", { type: "checkbox", cls: "hf-check" });
    checkbox.checked = task.status === "completed";
    checkbox.addEventListener("change", async () => {
      await this.plugin.db.updateTask(task.id, {
        status: checkbox.checked ? "completed" : "pending"
      });
      tr.className = `hf-tr hf-status-${checkbox.checked ? "completed" : "pending"}`;
    });
    const nameTd = tr.createEl("td", { cls: "hf-td" });
    const nameSpan = nameTd.createEl("span", { text: task.name, cls: "hf-task-name" });
    if (task.description) {
      nameSpan.title = task.description;
    }
    const timeTd = tr.createEl("td", { cls: "hf-td hf-td-time" });
    const timeText = this.formatTime(task.estimated_hours, task.estimated_minutes);
    timeTd.createEl("span", { text: timeText, cls: "hf-time-text" });
    const effortTd = tr.createEl("td", { cls: "hf-td hf-td-effort" });
    const effortBadge = effortTd.createDiv({ cls: `hf-effort-badge hf-effort-${this.effortClass(task.effort_level)}` });
    effortBadge.textContent = `${task.effort_level}/10`;
    const matTd = tr.createEl("td", { cls: "hf-td hf-td-materials" });
    if (task.materials.length > 0) {
      const matSpan = matTd.createEl("span", { cls: "hf-materials-summary" });
      matSpan.textContent = task.materials.slice(0, 2).join(", ");
      if (task.materials.length > 2) {
        matSpan.textContent += ` +${task.materials.length - 2}`;
      }
      matSpan.title = task.materials.join(", ");
    }
    const statusTd = tr.createEl("td", { cls: "hf-td" });
    const statusSel = statusTd.createEl("select", { cls: "hf-status-select" });
    for (const [val, label] of [["pending", "Pending"], ["assigned", "In Progress"], ["completed", "Done"]]) {
      const opt = statusSel.createEl("option", { value: val, text: label });
      if (task.status === val)
        opt.selected = true;
    }
    statusSel.addEventListener("change", async () => {
      await this.plugin.db.updateTask(task.id, { status: statusSel.value });
      tr.className = `hf-tr hf-status-${statusSel.value}`;
      checkbox.checked = statusSel.value === "completed";
    });
    const actionsTd = tr.createEl("td", { cls: "hf-td hf-td-actions" });
    const editBtn = actionsTd.createEl("button", { text: "\u270F\uFE0F", cls: "hf-icon-btn", title: "Edit task" });
    editBtn.addEventListener("click", () => {
      new TaskModal(this.plugin.app, this.plugin, (updated) => {
        this.render();
      }, task).open();
    });
    const deleteBtn = actionsTd.createEl("button", { text: "\u{1F5D1}\uFE0F", cls: "hf-icon-btn hf-btn-delete", title: "Delete task" });
    deleteBtn.addEventListener("click", () => {
      new ConfirmModal(
        this.plugin.app,
        `Delete task "${task.name}"? This cannot be undone.`,
        async () => {
          await this.plugin.db.deleteTask(task.id);
          new import_obsidian4.Notice(`Task "${task.name}" deleted.`);
          this.render();
        }
      ).open();
    });
  }
  /** Navigate to the dashboard, expand the given room, and scroll it into view. */
  scrollToRoom(roomName) {
    var _a;
    if (((_a = this.plugin.settings.collapsedRooms) != null ? _a : []).includes(roomName)) {
      this.plugin.settings.collapsedRooms = this.plugin.settings.collapsedRooms.filter((r) => r !== roomName);
      this.plugin.saveSettings();
      this.render();
    }
    const section = this.el.querySelector(`[data-room="${CSS.escape(roomName)}"]`);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  openNewTaskModal(defaultRoom) {
    new TaskModal(this.plugin.app, this.plugin, () => {
      this.render();
    }, void 0, defaultRoom).open();
  }
  formatTime(hours, minutes) {
    if (!hours && !minutes)
      return "\u2014";
    const parts = [];
    if (hours)
      parts.push(`${hours}h`);
    if (minutes)
      parts.push(`${minutes}m`);
    return parts.join(" ");
  }
  effortClass(level) {
    if (level <= 3)
      return "low";
    if (level <= 6)
      return "medium";
    return "high";
  }
};

// src/views/RoomsView.ts
var import_obsidian5 = require("obsidian");
var RoomsView = class {
  constructor(el, plugin, onRoomClick) {
    this.el = el;
    this.plugin = plugin;
    this.onRoomClick = onRoomClick != null ? onRoomClick : () => {
    };
  }
  render() {
    this.el.empty();
    this.el.addClass("hf-view");
    const header = this.el.createDiv({ cls: "hf-view-header" });
    header.createEl("h2", { text: "Rooms", cls: "hf-view-title" });
    const addBtn = header.createEl("button", { text: "+ Add Room", cls: "hf-btn hf-btn-primary" });
    addBtn.addEventListener("click", () => this.showAddRoomForm());
    const rooms = this.plugin.db.getRooms();
    if (rooms.length === 0) {
      const empty = this.el.createDiv({ cls: "hf-empty-state" });
      empty.createEl("div", { text: "\u{1F3E0}", cls: "hf-empty-icon" });
      empty.createEl("p", { text: "No rooms yet. Add a room to get started." });
      return;
    }
    const list = this.el.createDiv({ cls: "hf-rooms-list" });
    for (const room of rooms) {
      this.renderRoomCard(list, room);
    }
  }
  renderRoomCard(parent, room) {
    const pct = room.task_count > 0 ? Math.round(room.completed_count / room.task_count * 100) : 0;
    const card = parent.createDiv({ cls: "hf-room-card" });
    const cardHeader = card.createDiv({ cls: "hf-room-card-header" });
    const titleArea = cardHeader.createDiv({ cls: "hf-room-card-title" });
    const iconEl = titleArea.createEl("span", { text: room.outdoor ? "\u{1F33F}" : "\u{1F3E0}", cls: "hf-room-card-icon hf-room-card-link" });
    iconEl.title = `Go to ${room.name} on dashboard`;
    iconEl.addEventListener("click", () => this.onRoomClick(room.name));
    const nameEl = titleArea.createEl("span", { text: room.name, cls: "hf-room-card-name hf-room-card-link" });
    nameEl.title = `Go to ${room.name} on dashboard`;
    nameEl.addEventListener("click", () => this.onRoomClick(room.name));
    nameEl.addEventListener("dblclick", () => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = room.name;
      input.className = "hf-input hf-input-inline";
      nameEl.replaceWith(input);
      input.focus();
      input.select();
      const commit = async () => {
        const newName = input.value.trim();
        if (newName && newName !== room.name) {
          await this.plugin.db.renameRoom(room.name, newName);
          new import_obsidian5.Notice(`Room renamed to "${newName}".`);
          this.render();
        } else {
          this.render();
        }
      };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          this.render();
        }
      });
    });
    const metaRow = cardHeader.createDiv({ cls: "hf-room-card-meta" });
    const badgeArea = metaRow.createDiv({ cls: "hf-room-card-badges" });
    if (room.outdoor) {
      badgeArea.createEl("span", { text: "Outdoor", cls: "hf-badge hf-badge-outdoor" });
    } else {
      badgeArea.createEl("span", { text: "Indoor", cls: "hf-badge hf-badge-indoor" });
    }
    const actions = metaRow.createDiv({ cls: "hf-room-card-actions" });
    const toggleBtn = actions.createEl("button", {
      text: room.outdoor ? "\u{1F3E0} Set Indoor" : "\u{1F33F} Set Outdoor",
      cls: "hf-btn hf-btn-sm",
      title: "Toggle indoor/outdoor"
    });
    toggleBtn.addEventListener("click", async () => {
      await this.plugin.db.setRoomOutdoor(room.name, !room.outdoor);
      this.render();
    });
    const deleteBtn = actions.createEl("button", { text: "\u{1F5D1}\uFE0F", cls: "hf-icon-btn hf-btn-delete", title: "Delete room and all its tasks" });
    deleteBtn.addEventListener("click", () => {
      new ConfirmModal(
        this.plugin.app,
        `Delete room "${room.name}" and all ${room.task_count} task(s) in it? This cannot be undone.`,
        async () => {
          await this.plugin.db.deleteRoom(room.name);
          new import_obsidian5.Notice(`Room "${room.name}" deleted.`);
          this.render();
        }
      ).open();
    });
    const progressSection = card.createDiv({ cls: "hf-room-card-progress" });
    const progressInfo = progressSection.createDiv({ cls: "hf-room-card-progress-info" });
    progressInfo.createEl("span", { text: `${room.completed_count} of ${room.task_count} tasks complete`, cls: "hf-room-progress-text" });
    progressInfo.createEl("span", { text: `${pct}%`, cls: "hf-room-progress-pct" });
    const bar = progressSection.createDiv({ cls: "hf-progress-bar" });
    const fill = bar.createDiv({ cls: "hf-progress-fill" });
    fill.style.width = `${pct}%`;
    if (pct === 100)
      fill.addClass("hf-progress-complete");
  }
  showAddRoomForm() {
    const form = this.el.createDiv({ cls: "hf-inline-form" });
    const input = form.createEl("input", { type: "text", cls: "hf-input", placeholder: "Room name..." });
    const outdoorCheck = form.createEl("input", { type: "checkbox", cls: "hf-checkbox" });
    form.createEl("label", { text: " Outdoor", cls: "hf-inline-label" });
    const addBtn = form.createEl("button", { text: "Add", cls: "hf-btn hf-btn-primary hf-btn-sm" });
    const cancelBtn = form.createEl("button", { text: "Cancel", cls: "hf-btn hf-btn-sm" });
    input.focus();
    const submit = async () => {
      const name = input.value.trim();
      if (!name) {
        new import_obsidian5.Notice("Please enter a room name.");
        return;
      }
      await this.plugin.db.createRoom(name, outdoorCheck.checked);
      new import_obsidian5.Notice(`Room "${name}" created.`);
      this.render();
    };
    addBtn.addEventListener("click", submit);
    cancelBtn.addEventListener("click", () => this.render());
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter")
        submit();
      if (e.key === "Escape")
        this.render();
    });
    form.scrollIntoView({ behavior: "smooth" });
  }
};

// src/views/PeopleView.ts
var import_obsidian6 = require("obsidian");
var PersonModal = class extends import_obsidian6.Modal {
  constructor(app, plugin, onSave, existing) {
    super(app);
    this.plugin = plugin;
    this.onSave = onSave;
    this.isEdit = !!existing;
    this.person = existing ? { ...existing, availability: JSON.parse(JSON.stringify(existing.availability)) } : { name: "", availability: {}, max_tasks_per_day: 3, physical_limitations: "" };
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("hf-person-modal");
    contentEl.createEl("h2", { text: this.isEdit ? "Edit Person" : "Add Person" });
    const form = contentEl.createDiv({ cls: "hf-form" });
    const nameGroup = form.createDiv({ cls: "hf-form-group" });
    nameGroup.createEl("label", { text: "Name *", cls: "hf-label" });
    const nameInput = nameGroup.createEl("input", { type: "text", cls: "hf-input" });
    nameInput.value = this.person.name || "";
    const maxGroup = form.createDiv({ cls: "hf-form-group" });
    maxGroup.createEl("label", { text: "Max Tasks Per Day", cls: "hf-label" });
    const maxInput = maxGroup.createEl("input", { type: "number", cls: "hf-input hf-input-sm" });
    maxInput.min = "1";
    maxInput.max = "20";
    maxInput.value = String(this.person.max_tasks_per_day || 3);
    const limitGroup = form.createDiv({ cls: "hf-form-group" });
    limitGroup.createEl("label", { text: "Physical Limitations", cls: "hf-label" });
    const limitInput = limitGroup.createEl("textarea", { cls: "hf-textarea", placeholder: "e.g., No heavy lifting, bad knees..." });
    limitInput.rows = 2;
    limitInput.value = this.person.physical_limitations || "";
    const availGroup = form.createDiv({ cls: "hf-form-group" });
    availGroup.createEl("label", { text: "Availability", cls: "hf-label" });
    availGroup.createEl("p", { text: "Click a day to add/remove time slots.", cls: "hf-hint" });
    const availability = this.person.availability || {};
    const availGrid = availGroup.createDiv({ cls: "hf-avail-grid" });
    this.renderAvailabilityGrid(availGrid, availability);
    const btnRow = contentEl.createDiv({ cls: "hf-modal-buttons" });
    const cancelBtn = btnRow.createEl("button", { text: "Cancel", cls: "hf-btn" });
    cancelBtn.addEventListener("click", () => this.close());
    const saveBtn = btnRow.createEl("button", {
      text: this.isEdit ? "Save Changes" : "Add Person",
      cls: "hf-btn hf-btn-primary"
    });
    saveBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim();
      if (!name) {
        new import_obsidian6.Notice("Please enter a name.");
        return;
      }
      const personData = {
        name,
        availability,
        max_tasks_per_day: parseInt(maxInput.value) || 3,
        physical_limitations: limitInput.value.trim()
      };
      try {
        if (this.isEdit && this.person.id) {
          await this.plugin.db.updatePerson(this.person.id, personData);
          new import_obsidian6.Notice("Person updated.");
        } else {
          await this.plugin.db.createPerson(personData);
          new import_obsidian6.Notice(`${name} added.`);
        }
        this.close();
        this.onSave();
      } catch (e) {
        new import_obsidian6.Notice(`Error: ${e.message}`);
      }
    });
  }
  renderAvailabilityGrid(container, availability) {
    container.empty();
    for (const day of DAYS_OF_WEEK) {
      const dayRow = container.createDiv({ cls: "hf-avail-day" });
      const dayHeader = dayRow.createDiv({ cls: "hf-avail-day-header" });
      dayHeader.createEl("span", { text: day, cls: "hf-avail-day-name" });
      const addSlotBtn = dayHeader.createEl("button", { text: "+ Slot", cls: "hf-btn hf-btn-xs" });
      const slotsContainer = dayRow.createDiv({ cls: "hf-avail-slots" });
      if (!availability[day])
        availability[day] = [];
      const renderSlots = () => {
        slotsContainer.empty();
        const slots = availability[day] || [];
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          const slotEl = slotsContainer.createDiv({ cls: "hf-avail-slot" });
          const startInput = slotEl.createEl("input", { type: "time", cls: "hf-input hf-input-time" });
          startInput.value = slot.start || "09:00";
          slotEl.createEl("span", { text: "\u2014" });
          const endInput = slotEl.createEl("input", { type: "time", cls: "hf-input hf-input-time" });
          endInput.value = slot.end || "17:00";
          slotEl.createEl("span", { text: "\u26A1", cls: "hf-avail-effort-label", title: "Max effort capacity" });
          const effortInput = slotEl.createEl("input", { type: "number", cls: "hf-input hf-input-tiny" });
          effortInput.min = "1";
          effortInput.max = "10";
          effortInput.value = String(slot.effort_capacity || 7);
          const rmBtn = slotEl.createEl("button", { text: "\xD7", cls: "hf-tag-remove" });
          startInput.addEventListener("change", () => {
            slot.start = startInput.value;
          });
          endInput.addEventListener("change", () => {
            slot.end = endInput.value;
          });
          effortInput.addEventListener("change", () => {
            slot.effort_capacity = parseInt(effortInput.value) || 7;
          });
          rmBtn.addEventListener("click", () => {
            slots.splice(i, 1);
            renderSlots();
          });
        }
      };
      addSlotBtn.addEventListener("click", () => {
        availability[day].push({ start: "09:00", end: "17:00", effort_capacity: 7 });
        renderSlots();
      });
      renderSlots();
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var PeopleView = class {
  constructor(el, plugin) {
    this.el = el;
    this.plugin = plugin;
  }
  render() {
    this.el.empty();
    this.el.addClass("hf-view");
    const header = this.el.createDiv({ cls: "hf-view-header" });
    header.createEl("h2", { text: "People", cls: "hf-view-title" });
    const addBtn = header.createEl("button", { text: "+ Add Person", cls: "hf-btn hf-btn-primary" });
    addBtn.addEventListener("click", () => {
      new PersonModal(this.plugin.app, this.plugin, () => this.render()).open();
    });
    const people = this.plugin.db.getPeople();
    if (people.length === 0) {
      const empty = this.el.createDiv({ cls: "hf-empty-state" });
      empty.createEl("div", { text: "\u{1F465}", cls: "hf-empty-icon" });
      empty.createEl("p", { text: "No people yet. Add people to enable schedule generation." });
      return;
    }
    const grid = this.el.createDiv({ cls: "hf-people-grid" });
    for (const person of people) {
      this.renderPersonCard(grid, person);
    }
  }
  renderPersonCard(parent, person) {
    const card = parent.createDiv({ cls: "hf-person-card" });
    const cardHeader = card.createDiv({ cls: "hf-person-card-header" });
    const avatar = cardHeader.createDiv({ cls: "hf-person-avatar" });
    avatar.textContent = person.name.charAt(0).toUpperCase();
    const nameArea = cardHeader.createDiv({ cls: "hf-person-name-area" });
    nameArea.createEl("h3", { text: person.name, cls: "hf-person-name" });
    nameArea.createEl("span", { text: `Max ${person.max_tasks_per_day} tasks/day`, cls: "hf-person-meta" });
    const actions = cardHeader.createDiv({ cls: "hf-person-actions" });
    const editBtn = actions.createEl("button", { text: "\u270F\uFE0F", cls: "hf-icon-btn", title: "Edit" });
    editBtn.addEventListener("click", () => {
      new PersonModal(this.plugin.app, this.plugin, () => this.render(), person).open();
    });
    const deleteBtn = actions.createEl("button", { text: "\u{1F5D1}\uFE0F", cls: "hf-icon-btn hf-btn-delete", title: "Delete" });
    deleteBtn.addEventListener("click", () => {
      new ConfirmModal(
        this.plugin.app,
        `Remove "${person.name}" from the project? Their schedules will also be deleted.`,
        async () => {
          await this.plugin.db.deletePerson(person.id);
          new import_obsidian6.Notice(`${person.name} removed.`);
          this.render();
        }
      ).open();
    });
    const availSection = card.createDiv({ cls: "hf-person-avail" });
    const activeDays = Object.entries(person.availability).filter(([, slots]) => slots.length > 0).map(([day]) => day.slice(0, 3));
    if (activeDays.length > 0) {
      const dayChips = availSection.createDiv({ cls: "hf-day-chips" });
      for (const day of DAYS_OF_WEEK.map((d) => d.slice(0, 3))) {
        const chip = dayChips.createEl("span", { text: day, cls: "hf-day-chip" });
        if (activeDays.includes(day))
          chip.addClass("hf-day-chip-active");
      }
    } else {
      availSection.createEl("span", { text: "No availability set", cls: "hf-hint" });
    }
    if (person.physical_limitations) {
      const limEl = card.createDiv({ cls: "hf-person-limitations" });
      limEl.createEl("span", { text: "\u26A0\uFE0F ", cls: "hf-limitations-icon" });
      limEl.createEl("span", { text: person.physical_limitations, cls: "hf-limitations-text" });
    }
  }
};

// src/views/SchedulesView.ts
var import_obsidian7 = require("obsidian");
var SchedulesView = class {
  constructor(el, plugin) {
    this.el = el;
    this.plugin = plugin;
  }
  render() {
    this.el.empty();
    this.el.addClass("hf-view");
    const header = this.el.createDiv({ cls: "hf-view-header" });
    header.createEl("h2", { text: "Schedules", cls: "hf-view-title" });
    const people = this.plugin.db.getPeople();
    if (people.length === 0) {
      const empty = this.el.createDiv({ cls: "hf-empty-state" });
      empty.createEl("div", { text: "\u{1F4C5}", cls: "hf-empty-icon" });
      empty.createEl("p", { text: "Add people first before generating schedules." });
      return;
    }
    const controls = this.el.createDiv({ cls: "hf-schedule-controls hf-card" });
    controls.createEl("h3", { text: "\u2728 Generate AI Schedule", cls: "hf-card-title" });
    const form = controls.createDiv({ cls: "hf-form hf-form-inline" });
    const dateGroup = form.createDiv({ cls: "hf-form-group" });
    dateGroup.createEl("label", { text: "Start Date", cls: "hf-label" });
    const dateInput = dateGroup.createEl("input", { type: "date", cls: "hf-input" });
    dateInput.value = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const daysGroup = form.createDiv({ cls: "hf-form-group" });
    daysGroup.createEl("label", { text: "Days to Schedule", cls: "hf-label" });
    const daysInput = daysGroup.createEl("input", { type: "number", cls: "hf-input hf-input-sm" });
    daysInput.min = "1";
    daysInput.max = "30";
    daysInput.value = "7";
    const btnRow = controls.createDiv({ cls: "hf-schedule-btn-row" });
    if (!this.plugin.settings.githubAccessToken) {
      btnRow.createEl("p", { text: "\u26A0\uFE0F Configure your GitHub token in settings to use AI scheduling. Rule-based fallback will be used.", cls: "hf-warning" });
    }
    const generateBtn = btnRow.createEl("button", { text: "\u26A1 Generate Schedule", cls: "hf-btn hf-btn-primary" });
    const clearBtn = btnRow.createEl("button", { text: "\u{1F5D1} Clear All Schedules", cls: "hf-btn hf-btn-sm" });
    clearBtn.addEventListener("click", () => {
      new ConfirmModal(
        this.plugin.app,
        "Clear all schedules? This will delete all generated schedule data.",
        async () => {
          await this.plugin.db.clearAllSchedules();
          new import_obsidian7.Notice("All schedules cleared.");
          this.render();
        },
        "Clear All"
      ).open();
    });
    generateBtn.addEventListener("click", async () => {
      const startDate = dateInput.value;
      const numDays = parseInt(daysInput.value) || 7;
      if (!startDate) {
        new import_obsidian7.Notice("Please select a start date.");
        return;
      }
      generateBtn.setAttr("disabled", "true");
      generateBtn.textContent = "\u23F3 Generating...";
      try {
        const tasks = this.plugin.db.getTasksByStatus("pending");
        const assigned = this.plugin.db.getTasksByStatus("assigned");
        const allTasks = [...tasks, ...assigned];
        if (allTasks.length === 0) {
          new import_obsidian7.Notice("No pending tasks to schedule.");
          generateBtn.removeAttribute("disabled");
          generateBtn.textContent = "\u26A1 Generate Schedule";
          return;
        }
        const ai = this.plugin.getAI();
        const result = await ai.generateSchedules(people, allTasks, startDate, numDays);
        await this.plugin.db.clearAllSchedules();
        await this.persistScheduleResult(result, people);
        new import_obsidian7.Notice(`Schedule generated! ${result.schedules.length} day-person entries created.`);
        this.renderScheduleDisplay(result, people);
      } catch (e) {
        new import_obsidian7.Notice(`Schedule generation failed: ${e.message}`);
      } finally {
        generateBtn.removeAttribute("disabled");
        generateBtn.textContent = "\u26A1 Generate Schedule";
      }
    });
    const existingSchedules = this.plugin.db.getSchedules();
    if (existingSchedules.length > 0) {
      this.renderExistingSchedules(existingSchedules, people);
    } else {
      const hint = this.el.createDiv({ cls: "hf-empty-state hf-empty-small" });
      hint.createEl("p", { text: 'No schedules generated yet. Click "Generate Schedule" above to create one.' });
    }
  }
  async persistScheduleResult(result, people) {
    var _a, _b;
    for (const entry of result.schedules) {
      const person = people.find((p) => p.id === entry.person_id);
      if (!person)
        continue;
      await this.plugin.db.createSchedule({
        person_id: entry.person_id,
        schedule_date: entry.date,
        status: "draft",
        ai_generated: result.ai_model !== "rule-based",
        generation_metadata: { ai_model: result.ai_model, generated_at: result.generated_at },
        assignments: entry.assignments.map((a, idx) => ({
          id: 0,
          schedule_id: 0,
          task_id: a.task_id,
          start_time: a.start_time,
          end_time: a.end_time,
          is_grouped: a.is_grouped,
          grouped_task_ids: a.grouped_task_ids || [],
          group_description: a.group_description || "",
          estimated_minutes: a.estimated_minutes,
          notes: a.notes,
          order: idx
        }))
      });
    }
    if (((_a = result.warnings) == null ? void 0 : _a.length) > 0) {
      for (const w of result.warnings) {
        new import_obsidian7.Notice(`\u26A0\uFE0F ${w}`, 6e3);
      }
    }
    if (((_b = result.unscheduled_tasks) == null ? void 0 : _b.length) > 0) {
      new import_obsidian7.Notice(`${result.unscheduled_tasks.length} task(s) could not be scheduled in the given timeframe.`, 8e3);
    }
  }
  renderExistingSchedules(schedules, people) {
    const section = this.el.createDiv({ cls: "hf-schedules-section" });
    section.createEl("h3", { text: "Current Schedules", cls: "hf-section-title" });
    const byDate = /* @__PURE__ */ new Map();
    for (const s of schedules) {
      if (!byDate.has(s.schedule_date))
        byDate.set(s.schedule_date, []);
      byDate.get(s.schedule_date).push(s);
    }
    for (const [date, daySchedules] of Array.from(byDate.entries()).sort()) {
      const dateSection = section.createDiv({ cls: "hf-schedule-date-section" });
      const d = /* @__PURE__ */ new Date(date + "T00:00:00");
      const formatted = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      dateSection.createEl("h4", { text: formatted, cls: "hf-schedule-date-title" });
      const dayGrid = dateSection.createDiv({ cls: "hf-schedule-day-grid" });
      for (const sched of daySchedules) {
        const person = people.find((p) => p.id === sched.person_id);
        this.renderPersonScheduleCard(dayGrid, sched, (person == null ? void 0 : person.name) || `Person ${sched.person_id}`);
      }
    }
  }
  renderScheduleDisplay(result, people) {
    const schedules = this.plugin.db.getSchedules();
    const section = this.el.querySelector(".hf-schedules-section");
    if (section)
      section.remove();
    this.renderExistingSchedules(schedules, people);
    if (result.reasoning) {
      const reasoningEl = this.el.createDiv({ cls: "hf-schedule-reasoning hf-card" });
      reasoningEl.createEl("h4", { text: "\u{1F916} AI Reasoning", cls: "hf-card-title" });
      reasoningEl.createEl("p", { text: result.reasoning });
      reasoningEl.createEl("p", { text: `Model: ${result.ai_model}`, cls: "hf-hint" });
    }
  }
  renderPersonScheduleCard(parent, schedule, personName) {
    const card = parent.createDiv({ cls: "hf-schedule-card" });
    const cardHeader = card.createDiv({ cls: "hf-schedule-card-header" });
    const avatar = cardHeader.createDiv({ cls: "hf-person-avatar hf-avatar-sm" });
    avatar.textContent = personName.charAt(0).toUpperCase();
    cardHeader.createEl("span", { text: personName, cls: "hf-schedule-person-name" });
    const badges = cardHeader.createDiv({ cls: "hf-schedule-badges" });
    if (schedule.ai_generated) {
      badges.createEl("span", { text: "\u2728 AI", cls: "hf-badge hf-badge-ai" });
    }
    badges.createEl("span", { text: schedule.status, cls: `hf-badge hf-badge-status-${schedule.status}` });
    const assignments = schedule.assignments || [];
    if (assignments.length === 0) {
      card.createEl("p", { text: "No tasks assigned.", cls: "hf-hint" });
      return;
    }
    const list = card.createDiv({ cls: "hf-assignment-list" });
    for (const assignment of assignments) {
      const item = list.createDiv({ cls: "hf-assignment-item" });
      const timeEl = item.createEl("span", { cls: "hf-assignment-time" });
      timeEl.textContent = `${assignment.start_time}\u2013${assignment.end_time}`;
      const nameEl = item.createEl("span", { cls: "hf-assignment-name" });
      nameEl.textContent = assignment.task_name || `Task #${assignment.task_id}`;
      if (assignment.task_room) {
        item.createEl("span", { text: assignment.task_room, cls: "hf-badge hf-badge-room" });
      }
      if (assignment.notes) {
        item.createEl("span", { text: assignment.notes, cls: "hf-assignment-notes" });
      }
    }
  }
};

// src/views/SharedTasksView.ts
var import_obsidian8 = require("obsidian");
var SharedTaskModal = class extends import_obsidian8.Modal {
  constructor(app, plugin, onSave, existing) {
    super(app);
    this.plugin = plugin;
    this.onSave = onSave;
    this.isEdit = !!existing;
    this.task = existing ? { ...existing } : {
      name: "",
      description: "",
      room: "",
      estimated_hours: 0,
      estimated_minutes: 0,
      effort_level: 5,
      materials: [],
      status: "pending",
      outdoor: false,
      category: ""
    };
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("hf-task-modal");
    contentEl.createEl("h2", { text: this.isEdit ? "Edit Template" : "New Template" });
    const form = contentEl.createDiv({ cls: "hf-form" });
    const nameGroup = form.createDiv({ cls: "hf-form-group" });
    nameGroup.createEl("label", { text: "Template Name *", cls: "hf-label" });
    const nameInput = nameGroup.createEl("input", { type: "text", cls: "hf-input", placeholder: "e.g., Paint walls" });
    nameInput.value = this.task.name || "";
    const categoryGroup = form.createDiv({ cls: "hf-form-group" });
    categoryGroup.createEl("label", { text: "Category", cls: "hf-label" });
    const catInput = categoryGroup.createEl("input", { type: "text", cls: "hf-input", placeholder: "e.g., Painting, Cleaning" });
    catInput.value = this.task.category || "";
    const descGroup = form.createDiv({ cls: "hf-form-group" });
    descGroup.createEl("label", { text: "Description", cls: "hf-label" });
    const descInput = descGroup.createEl("textarea", { cls: "hf-textarea" });
    descInput.rows = 3;
    descInput.value = this.task.description || "";
    const timeRow = form.createDiv({ cls: "hf-form-row" });
    const hoursGroup = timeRow.createDiv({ cls: "hf-form-group" });
    hoursGroup.createEl("label", { text: "Hours", cls: "hf-label" });
    const hoursInput = hoursGroup.createEl("input", { type: "number", cls: "hf-input hf-input-sm" });
    hoursInput.min = "0";
    hoursInput.value = String(this.task.estimated_hours || 0);
    const minsGroup = timeRow.createDiv({ cls: "hf-form-group" });
    minsGroup.createEl("label", { text: "Minutes", cls: "hf-label" });
    const minsInput = minsGroup.createEl("input", { type: "number", cls: "hf-input hf-input-sm" });
    minsInput.min = "0";
    minsInput.max = "59";
    minsInput.value = String(this.task.estimated_minutes || 0);
    const effortGroup = form.createDiv({ cls: "hf-form-group" });
    effortGroup.createEl("label", { text: `Effort Level: ${this.task.effort_level || 5}/10`, cls: "hf-label" });
    const effortInput = effortGroup.createEl("input", { type: "range", cls: "hf-slider" });
    effortInput.min = "1";
    effortInput.max = "10";
    effortInput.value = String(this.task.effort_level || 5);
    effortInput.addEventListener("input", () => {
      effortGroup.querySelector(".hf-label").textContent = `Effort Level: ${effortInput.value}/10`;
    });
    const materialsGroup = form.createDiv({ cls: "hf-form-group" });
    materialsGroup.createEl("label", { text: "Materials (comma-separated)", cls: "hf-label" });
    const matInput = materialsGroup.createEl("input", { type: "text", cls: "hf-input", placeholder: "Paint, Roller, Drop cloth" });
    matInput.value = (this.task.materials || []).join(", ");
    const outdoorGroup = form.createDiv({ cls: "hf-form-group hf-form-row" });
    const outdoorLabel = outdoorGroup.createEl("label", { cls: "hf-label" });
    outdoorLabel.createEl("span", { text: "Outdoor Task" });
    const outdoorCheck = outdoorGroup.createEl("input", { type: "checkbox", cls: "hf-checkbox" });
    outdoorCheck.checked = this.task.outdoor || false;
    const btnRow = contentEl.createDiv({ cls: "hf-modal-buttons" });
    btnRow.createEl("button", { text: "Cancel", cls: "hf-btn" }).addEventListener("click", () => this.close());
    const saveBtn = btnRow.createEl("button", {
      text: this.isEdit ? "Save" : "Create Template",
      cls: "hf-btn hf-btn-primary"
    });
    saveBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim();
      if (!name) {
        new import_obsidian8.Notice("Please enter a template name.");
        return;
      }
      const data = {
        name,
        description: descInput.value.trim(),
        room: "",
        estimated_hours: parseInt(hoursInput.value) || 0,
        estimated_minutes: parseInt(minsInput.value) || 0,
        effort_level: parseInt(effortInput.value) || 5,
        materials: matInput.value.split(",").map((s) => s.trim()).filter(Boolean),
        status: "pending",
        outdoor: outdoorCheck.checked,
        category: catInput.value.trim()
      };
      try {
        if (this.isEdit && this.task.id) {
          await this.plugin.db.updateSharedTask(this.task.id, data);
          new import_obsidian8.Notice("Template updated.");
        } else {
          await this.plugin.db.createSharedTask(data);
          new import_obsidian8.Notice("Template created.");
        }
        this.close();
        this.onSave();
      } catch (e) {
        new import_obsidian8.Notice(`Error: ${e.message}`);
      }
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ApplyToRoomsModal = class extends import_obsidian8.Modal {
  constructor(app, plugin, template, onApply) {
    super(app);
    this.plugin = plugin;
    this.template = template;
    this.onApply = onApply;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: `Apply "${this.template.name}" to Rooms` });
    const rooms = this.plugin.db.getRooms();
    if (rooms.length === 0) {
      contentEl.createEl("p", { text: "No rooms available." });
      contentEl.createEl("button", { text: "Close", cls: "hf-btn" }).addEventListener("click", () => this.close());
      return;
    }
    contentEl.createEl("p", { text: "Select rooms to apply this template to:", cls: "hf-hint" });
    const checkboxes = [];
    const list = contentEl.createDiv({ cls: "hf-rooms-checklist" });
    for (const room of rooms) {
      const label = list.createEl("label", { cls: "hf-checklist-item" });
      const cb = label.createEl("input", { type: "checkbox", cls: "hf-checkbox" });
      label.createEl("span", { text: room.name });
      checkboxes.push({ name: room.name, el: cb });
    }
    const selectAllBtn = contentEl.createEl("button", { text: "Select All", cls: "hf-btn hf-btn-sm" });
    selectAllBtn.addEventListener("click", () => checkboxes.forEach((c) => {
      c.el.checked = true;
    }));
    const btnRow = contentEl.createDiv({ cls: "hf-modal-buttons" });
    btnRow.createEl("button", { text: "Cancel", cls: "hf-btn" }).addEventListener("click", () => this.close());
    const applyBtn = btnRow.createEl("button", { text: "Apply to Selected", cls: "hf-btn hf-btn-primary" });
    applyBtn.addEventListener("click", async () => {
      const selected = checkboxes.filter((c) => c.el.checked).map((c) => c.name);
      if (selected.length === 0) {
        new import_obsidian8.Notice("Select at least one room.");
        return;
      }
      await this.plugin.db.applySharedTaskToRooms(this.template.id, selected);
      new import_obsidian8.Notice(`Template applied to ${selected.length} room(s).`);
      this.close();
      this.onApply();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var SharedTasksView = class {
  constructor(el, plugin) {
    this.el = el;
    this.plugin = plugin;
  }
  render() {
    this.el.empty();
    this.el.addClass("hf-view");
    const header = this.el.createDiv({ cls: "hf-view-header" });
    header.createEl("h2", { text: "Task Templates", cls: "hf-view-title" });
    const addBtn = header.createEl("button", { text: "+ New Template", cls: "hf-btn hf-btn-primary" });
    addBtn.addEventListener("click", () => {
      new SharedTaskModal(this.plugin.app, this.plugin, () => this.render()).open();
    });
    const templates = this.plugin.db.getSharedTasks();
    if (templates.length === 0) {
      const empty = this.el.createDiv({ cls: "hf-empty-state" });
      empty.createEl("div", { text: "\u{1F4CC}", cls: "hf-empty-icon" });
      empty.createEl("p", { text: "No templates yet. Create reusable task templates to apply across multiple rooms." });
      return;
    }
    const applyAllRow = this.el.createDiv({ cls: "hf-apply-all-row" });
    const applyAllBtn = applyAllRow.createEl("button", { text: "\u26A1 Apply All to All Rooms", cls: "hf-btn hf-btn-secondary" });
    applyAllBtn.addEventListener("click", async () => {
      const rooms = this.plugin.db.getRooms();
      if (rooms.length === 0) {
        new import_obsidian8.Notice("No rooms to apply to.");
        return;
      }
      let count = 0;
      for (const t of templates) {
        await this.plugin.db.applySharedTaskToRooms(t.id, rooms.map((r) => r.name));
        count++;
      }
      new import_obsidian8.Notice(`Applied ${count} templates to ${rooms.length} room(s).`);
    });
    const categories = /* @__PURE__ */ new Map();
    for (const t of templates) {
      const cat = t.category || "Uncategorized";
      if (!categories.has(cat))
        categories.set(cat, []);
      categories.get(cat).push(t);
    }
    for (const [category, tasks] of categories) {
      const section = this.el.createDiv({ cls: "hf-templates-section" });
      section.createEl("h3", { text: category, cls: "hf-section-title" });
      const grid = section.createDiv({ cls: "hf-templates-grid" });
      for (const task of tasks) {
        this.renderTemplateCard(grid, task);
      }
    }
  }
  renderTemplateCard(parent, task) {
    const card = parent.createDiv({ cls: "hf-template-card" });
    const cardHeader = card.createDiv({ cls: "hf-template-card-header" });
    cardHeader.createEl("h4", { text: task.name, cls: "hf-template-name" });
    const actions = cardHeader.createDiv({ cls: "hf-template-actions" });
    const applyBtn = actions.createEl("button", { text: "+ Apply", cls: "hf-btn hf-btn-sm hf-btn-primary" });
    applyBtn.addEventListener("click", () => {
      new ApplyToRoomsModal(this.plugin.app, this.plugin, task, () => {
      }).open();
    });
    const editBtn = actions.createEl("button", { text: "\u270F\uFE0F", cls: "hf-icon-btn" });
    editBtn.addEventListener("click", () => {
      new SharedTaskModal(this.plugin.app, this.plugin, () => this.render(), task).open();
    });
    const deleteBtn = actions.createEl("button", { text: "\u{1F5D1}\uFE0F", cls: "hf-icon-btn hf-btn-delete" });
    deleteBtn.addEventListener("click", () => {
      new ConfirmModal(
        this.plugin.app,
        `Delete template "${task.name}"?`,
        async () => {
          await this.plugin.db.deleteSharedTask(task.id);
          new import_obsidian8.Notice(`Template "${task.name}" deleted.`);
          this.render();
        }
      ).open();
    });
    const meta = card.createDiv({ cls: "hf-template-meta" });
    const time = task.estimated_hours || task.estimated_minutes ? `${task.estimated_hours}h ${task.estimated_minutes}m` : "\u2014";
    meta.createEl("span", { text: `\u23F1 ${time}`, cls: "hf-template-time" });
    meta.createEl("span", { text: `\u{1F4AA} ${task.effort_level}/10`, cls: `hf-effort-badge hf-effort-${this.effortClass(task.effort_level)}` });
    if (task.outdoor)
      meta.createEl("span", { text: "\u{1F33F} Outdoor", cls: "hf-badge hf-badge-outdoor" });
    if (task.description) {
      card.createEl("p", { text: task.description, cls: "hf-template-desc" });
    }
    if (task.materials.length > 0) {
      const matEl = card.createDiv({ cls: "hf-template-materials" });
      matEl.createEl("span", { text: "\u{1F527} ", cls: "hf-materials-icon" });
      matEl.createEl("span", { text: task.materials.join(", "), cls: "hf-materials-list" });
    }
  }
  effortClass(level) {
    if (level <= 3)
      return "low";
    if (level <= 6)
      return "medium";
    return "high";
  }
};

// src/views/UploadView.ts
var import_obsidian9 = require("obsidian");

// src/parser.ts
var ROOM_KEYWORDS = [
  "room",
  "bedroom",
  "bathroom",
  "kitchen",
  "living",
  "dining",
  "office",
  "garage",
  "basement",
  "attic",
  "hallway",
  "laundry",
  "closet",
  "porch",
  "deck",
  "yard",
  "garden",
  "exterior",
  "interior",
  "foyer",
  "entryway",
  "playroom",
  "den",
  "study",
  "sunroom",
  "mudroom",
  "pantry",
  "utility"
];
var TASK_PREFIXES = /^[-•*✓✔☐☑□■▪▸→>]\s*/;
var CHECKBOX_PATTERNS = /^\[[ x]\]\s*/i;
var NUMBERED_LIST = /^\d+[.)]\s+/;
var TaskParser = class {
  parse(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trimEnd());
    const tasks = [];
    const rooms = /* @__PURE__ */ new Set();
    const warnings = [];
    let currentRoom = "General";
    let pendingDescription = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) {
        pendingDescription = "";
        continue;
      }
      if (this.isRoomHeader(trimmed, line)) {
        const roomName = this.extractRoomName(trimmed);
        currentRoom = roomName;
        rooms.add(roomName);
        pendingDescription = "";
        continue;
      }
      const taskName = this.extractTaskName(trimmed);
      if (taskName) {
        tasks.push({
          name: taskName,
          description: "",
          room: currentRoom
        });
        rooms.add(currentRoom);
        pendingDescription = "";
        continue;
      }
      if (tasks.length > 0 && (line.startsWith("  ") || line.startsWith("	"))) {
        const lastTask = tasks[tasks.length - 1];
        if (lastTask.description) {
          lastTask.description += " " + trimmed;
        } else {
          lastTask.description = trimmed;
        }
        continue;
      }
      if (trimmed.length > 3 && trimmed.length < 200) {
        if (!this.isMetaLine(trimmed)) {
          tasks.push({
            name: trimmed,
            description: "",
            room: currentRoom
          });
          rooms.add(currentRoom);
        }
      }
    }
    if (tasks.length === 0) {
      warnings.push("No tasks detected in the file. Check that the file contains task lists.");
    }
    return {
      tasks,
      rooms: Array.from(rooms),
      warnings
    };
  }
  isRoomHeader(trimmed, raw) {
    if (trimmed === trimmed.toUpperCase() && trimmed.length < 50 && /[A-Z]/.test(trimmed)) {
      return true;
    }
    if (trimmed.endsWith(":") && !TASK_PREFIXES.test(trimmed)) {
      return true;
    }
    const lower = trimmed.toLowerCase();
    const hasRoomWord = ROOM_KEYWORDS.some((k) => lower.includes(k));
    if (hasRoomWord && trimmed.length < 60 && !TASK_PREFIXES.test(trimmed) && !NUMBERED_LIST.test(trimmed)) {
      if (!/^(paint|clean|fix|repair|install|replace|check|remove|add|move|organiz)/i.test(trimmed)) {
        return true;
      }
    }
    if (!raw.startsWith(" ") && !raw.startsWith("	") && !TASK_PREFIXES.test(trimmed) && !NUMBERED_LIST.test(trimmed) && trimmed.length < 40 && /[A-Z]/.test(trimmed[0])) {
      if (!/[.!?]$/.test(trimmed) && !/\s(the|a|an|my|your|this|it|them)\s/i.test(trimmed)) {
        return hasRoomWord;
      }
    }
    return false;
  }
  extractRoomName(line) {
    return line.replace(/:$/, "").trim();
  }
  extractTaskName(trimmed) {
    let cleaned = trimmed;
    cleaned = cleaned.replace(CHECKBOX_PATTERNS, "");
    cleaned = cleaned.replace(TASK_PREFIXES, "");
    cleaned = cleaned.replace(NUMBERED_LIST, "");
    cleaned = cleaned.trim();
    if (cleaned.length < 3)
      return null;
    if (cleaned !== trimmed) {
      return this.capitalize(cleaned);
    }
    if (/^(paint|clean|fix|repair|install|replace|check|remove|add|move|organiz|wash|sand|caulk|patch|seal|hang|mount|replace|clear|sort|dust|vacuum|mop|strip|prime|finish|stain|varnish|trim|cut|build|assemble|disassemble|dispose|haul|buy|order|measure|inspect|test|update|upgrade|touch.up|re-?grout|re-?caulk|re-?paint|re-?stain|re-?finish)/i.test(cleaned)) {
      return this.capitalize(cleaned);
    }
    return null;
  }
  isMetaLine(line) {
    const lower = line.toLowerCase();
    if (/^page \d+/i.test(line))
      return true;
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line))
      return true;
    if (/^(total|subtotal|count|items?:?\s*\d)/i.test(line))
      return true;
    if (lower.includes("exported from") || lower.includes("reminders") && lower.length < 30)
      return true;
    return false;
  }
  capitalize(str) {
    if (!str)
      return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
};

// src/views/UploadView.ts
var UploadView = class {
  constructor(el, plugin) {
    this.parsedTasks = [];
    this.el = el;
    this.plugin = plugin;
  }
  render() {
    this.el.empty();
    this.el.addClass("hf-view");
    const header = this.el.createDiv({ cls: "hf-view-header" });
    header.createEl("h2", { text: "Upload Tasks", cls: "hf-view-title" });
    const importSection = this.el.createDiv({ cls: "hf-import-section" });
    importSection.createEl("h3", { text: "Import from Flask App Export", cls: "hf-section-title" });
    importSection.createEl("p", {
      text: 'Download the export from the Flask app (navbar \u2192 "Export to Obsidian"), then load the house-fix.json file here.',
      cls: "hf-hint"
    });
    const jsonDropZone = importSection.createDiv({ cls: "hf-dropzone hf-dropzone-json" });
    jsonDropZone.createEl("div", { text: "\u{1F4E5}", cls: "hf-dropzone-icon" });
    jsonDropZone.createEl("p", { text: "Drop house-fix.json here, or click to browse", cls: "hf-dropzone-text" });
    const jsonInput = jsonDropZone.createEl("input", { type: "file", cls: "hf-file-input" });
    jsonInput.accept = ".json";
    jsonDropZone.addEventListener("click", () => jsonInput.click());
    jsonDropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      jsonDropZone.addClass("hf-dropzone-active");
    });
    jsonDropZone.addEventListener("dragleave", () => jsonDropZone.removeClass("hf-dropzone-active"));
    jsonDropZone.addEventListener("drop", async (e) => {
      var _a;
      e.preventDefault();
      jsonDropZone.removeClass("hf-dropzone-active");
      const file = (_a = e.dataTransfer) == null ? void 0 : _a.files[0];
      if (file)
        await this.handleJsonImport(file, importSection);
    });
    jsonInput.addEventListener("change", async () => {
      var _a;
      const file = (_a = jsonInput.files) == null ? void 0 : _a[0];
      if (file)
        await this.handleJsonImport(file, importSection);
    });
    importSection.createEl("hr", { cls: "hf-divider" });
    const dropZone = this.el.createDiv({ cls: "hf-dropzone" });
    dropZone.createEl("div", { text: "\u{1F4E4}", cls: "hf-dropzone-icon" });
    dropZone.createEl("p", { text: "Drop a .txt or .pdf file here, or click to browse", cls: "hf-dropzone-text" });
    dropZone.createEl("p", { text: "PDF files will be extracted as text", cls: "hf-hint" });
    const fileInput = dropZone.createEl("input", { type: "file", cls: "hf-file-input" });
    fileInput.accept = ".txt,.pdf,.text";
    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.addClass("hf-dropzone-active");
    });
    dropZone.addEventListener("dragleave", () => dropZone.removeClass("hf-dropzone-active"));
    dropZone.addEventListener("drop", async (e) => {
      var _a;
      e.preventDefault();
      dropZone.removeClass("hf-dropzone-active");
      const file = (_a = e.dataTransfer) == null ? void 0 : _a.files[0];
      if (file)
        await this.handleFile(file);
    });
    fileInput.addEventListener("change", async () => {
      var _a;
      const file = (_a = fileInput.files) == null ? void 0 : _a[0];
      if (file)
        await this.handleFile(file);
    });
    const orDivider = this.el.createDiv({ cls: "hf-or-divider" });
    orDivider.createEl("span", { text: "or paste text directly" });
    const pasteArea = this.el.createEl("textarea", { cls: "hf-textarea hf-paste-area", placeholder: "Paste your task list here...\n\nKitchen:\n- Paint the walls\n- Replace cabinet handles\n\nBathroom:\n- Recaulk tub" });
    pasteArea.rows = 10;
    const parseBtn = this.el.createEl("button", { text: "\u{1F50D} Parse Text", cls: "hf-btn hf-btn-secondary" });
    parseBtn.addEventListener("click", () => {
      const text = pasteArea.value.trim();
      if (!text) {
        new import_obsidian9.Notice("Please paste some text first.");
        return;
      }
      this.parseAndPreview(text);
    });
    this.el.createDiv({ cls: "hf-upload-preview", attr: { id: "hf-upload-preview" } });
  }
  async handleFile(file) {
    const loadingEl = this.el.createDiv({ cls: "hf-loading" });
    loadingEl.textContent = `Reading "${file.name}"...`;
    try {
      let text = "";
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        text = await this.extractTextFromPdf(file);
      } else {
        text = await file.text();
      }
      loadingEl.remove();
      this.parseAndPreview(text, file.name);
    } catch (e) {
      loadingEl.remove();
      new import_obsidian9.Notice(`Failed to read file: ${e.message}`);
    }
  }
  async extractTextFromPdf(file) {
    var _a;
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let text = "";
    const str = new TextDecoder("latin1").decode(bytes);
    const textMatches = str.match(/BT[\s\S]*?ET/g) || [];
    for (const block of textMatches) {
      const tjMatches = block.match(/\((.*?)\)\s*Tj/g) || [];
      for (const m of tjMatches) {
        const inner = ((_a = m.match(/\((.*?)\)\s*Tj/)) == null ? void 0 : _a[1]) || "";
        if (inner.trim())
          text += inner + "\n";
      }
    }
    if (!text.trim()) {
      const lines = str.split(/[\r\n]+/);
      for (const line of lines) {
        const cleaned = line.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
        if (cleaned.length > 3 && /[a-zA-Z]{2,}/.test(cleaned)) {
          text += cleaned + "\n";
        }
      }
    }
    return text || "Could not extract text from PDF. Please try copy-pasting the text directly.";
  }
  parseAndPreview(text, fileName) {
    const parser = new TaskParser();
    const result = parser.parse(text);
    this.parsedTasks = result.tasks;
    let preview = this.el.querySelector(".hf-upload-preview");
    if (!preview) {
      preview = this.el.createDiv({ cls: "hf-upload-preview" });
    }
    preview.empty();
    if (result.warnings.length > 0) {
      const warnings = preview.createDiv({ cls: "hf-upload-warnings" });
      for (const w of result.warnings) {
        warnings.createEl("p", { text: `\u26A0\uFE0F ${w}`, cls: "hf-warning" });
      }
    }
    if (result.tasks.length === 0) {
      preview.createEl("p", { text: "No tasks detected in the file.", cls: "hf-hint" });
      return;
    }
    const previewHeader = preview.createDiv({ cls: "hf-preview-header" });
    previewHeader.createEl("h3", { text: `Found ${result.tasks.length} task(s) in ${result.rooms.length} room(s)`, cls: "hf-preview-title" });
    if (fileName)
      previewHeader.createEl("span", { text: fileName, cls: "hf-hint" });
    const importOptions = preview.createDiv({ cls: "hf-import-options" });
    const importAllBtn = importOptions.createEl("button", { text: `\u2B07\uFE0F Import All ${result.tasks.length} Tasks`, cls: "hf-btn hf-btn-primary" });
    importAllBtn.addEventListener("click", () => this.importTasks(this.parsedTasks, importAllBtn));
    const taskList = preview.createDiv({ cls: "hf-preview-list" });
    const byRoom = /* @__PURE__ */ new Map();
    for (const t of result.tasks) {
      if (!byRoom.has(t.room))
        byRoom.set(t.room, []);
      byRoom.get(t.room).push(t);
    }
    for (const [room, tasks] of byRoom) {
      const roomEl = taskList.createDiv({ cls: "hf-preview-room" });
      const roomHeader = roomEl.createDiv({ cls: "hf-preview-room-header" });
      roomHeader.createEl("span", { text: room, cls: "hf-preview-room-name" });
      roomHeader.createEl("span", { text: `${tasks.length} tasks`, cls: "hf-badge" });
      const taskItems = roomEl.createDiv({ cls: "hf-preview-tasks" });
      for (const task of tasks) {
        const item = taskItems.createDiv({ cls: "hf-preview-task-item" });
        item.createEl("span", { text: task.name, cls: "hf-preview-task-name" });
        if (task.description) {
          item.createEl("span", { text: task.description, cls: "hf-preview-task-desc" });
        }
      }
    }
  }
  async importTasks(tasks, importBtn) {
    var _a, _b;
    if (tasks.length === 0)
      return;
    const preview = this.el.querySelector(".hf-upload-preview");
    if (!preview)
      return;
    importBtn.disabled = true;
    importBtn.textContent = "Importing...";
    preview.empty();
    const progressEl = preview.createDiv({ cls: "hf-import-progress" });
    const statusEl = progressEl.createEl("p", { cls: "hf-import-status", text: "Preparing import..." });
    const barOuter = progressEl.createDiv({ cls: "hf-progress-bar-outer" });
    const barInner = barOuter.createDiv({ cls: "hf-progress-bar-inner" });
    barInner.style.width = "0%";
    const detailEl = progressEl.createEl("p", { cls: "hf-import-detail hf-hint", text: "" });
    const existingRooms = this.plugin.db.getRooms();
    const roomMap = /* @__PURE__ */ new Map();
    for (const r of existingRooms) {
      roomMap.set(r.name.toLowerCase(), r.name);
    }
    const ai = this.plugin.getAI();
    let imported = 0;
    let failed = 0;
    let roomsCreated = 0;
    let roomsMatched = 0;
    const validTasks = tasks.filter((t) => t.name && t.name.trim());
    failed = tasks.length - validTasks.length;
    for (let i = 0; i < validTasks.length; i++) {
      const task = validTasks[i];
      const pct = Math.round(i / validTasks.length * 100);
      barInner.style.width = `${pct}%`;
      statusEl.textContent = `Analyzing task ${i + 1} of ${validTasks.length}...`;
      detailEl.textContent = task.name.trim();
      const roomKey = task.room.toLowerCase();
      let resolvedRoom;
      if (roomMap.has(roomKey)) {
        resolvedRoom = roomMap.get(roomKey);
        roomsMatched++;
      } else {
        resolvedRoom = task.room;
        roomMap.set(roomKey, task.room);
        await this.plugin.db.createRoom(task.room);
        roomsCreated++;
      }
      let estimated_hours = 0;
      let estimated_minutes = 0;
      let effort_level = 5;
      let materials = [];
      let description = task.description || "";
      try {
        const analysis = await ai.analyzeTask(
          task.description ? `${task.name}: ${task.description}` : task.name
        );
        estimated_hours = analysis.time_hours;
        estimated_minutes = analysis.time_minutes;
        effort_level = analysis.effort_level;
        materials = analysis.materials;
        if (analysis.enhanced_description)
          description = analysis.enhanced_description;
      } catch (e) {
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
          status: "pending",
          outdoor: (_b = (_a = existingRooms.find((r) => r.name === resolvedRoom)) == null ? void 0 : _a.outdoor) != null ? _b : false,
          shared_task_id: null
        });
        imported++;
      } catch (e) {
        failed++;
      }
    }
    barInner.style.width = "100%";
    barInner.addClass("hf-progress-bar-done");
    statusEl.textContent = `Import complete`;
    detailEl.textContent = "";
    const summaryParts = [`${imported} task${imported !== 1 ? "s" : ""} imported`];
    if (roomsCreated > 0)
      summaryParts.push(`${roomsCreated} room${roomsCreated !== 1 ? "s" : ""} created`);
    if (roomsMatched > 0)
      summaryParts.push(`${roomsMatched} room${roomsMatched !== 1 ? "s" : ""} matched`);
    if (failed > 0)
      summaryParts.push(`${failed} skipped`);
    progressEl.createEl("p", { text: `\u2713 ${summaryParts.join(", ")}.`, cls: "hf-success" });
    progressEl.createEl("p", { text: "Go to Dashboard to view your tasks.", cls: "hf-hint" });
    const msg = failed > 0 ? `Imported ${imported} tasks (${failed} skipped).` : `\u2713 Imported ${imported} task(s) successfully!`;
    new import_obsidian9.Notice(msg);
    importBtn.disabled = false;
    importBtn.textContent = "Import More";
    importBtn.onclick = () => this.render();
  }
  // ── Flask JSON export import ──────────────────────────────────────────────
  async handleJsonImport(file, container) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r;
    if (!file.name.endsWith(".json")) {
      new import_obsidian9.Notice("Please select a .json file exported from the Flask app.");
      return;
    }
    const progressEl = container.createDiv({ cls: "hf-import-progress" });
    const statusEl = progressEl.createEl("p", { cls: "hf-import-status", text: "Reading file..." });
    let store;
    try {
      const raw = await file.text();
      store = JSON.parse(raw);
    } catch (e) {
      statusEl.textContent = "Failed to parse JSON file.";
      new import_obsidian9.Notice("Could not parse the selected file. Make sure it is the house-fix.json exported from the Flask app.");
      return;
    }
    if (!Array.isArray(store.tasks) || !Array.isArray(store.rooms)) {
      statusEl.textContent = "Invalid export file format.";
      new import_obsidian9.Notice("The file does not look like a valid House Fix export.");
      return;
    }
    statusEl.textContent = "Importing rooms...";
    const existingRooms = this.plugin.db.getRooms();
    const existingRoomNames = new Set(existingRooms.map((r) => r.name.toLowerCase()));
    let roomsAdded = 0;
    for (const room of store.rooms) {
      if (!room.name)
        continue;
      if (!existingRoomNames.has(room.name.toLowerCase())) {
        await this.plugin.db.createRoom(room.name, (_a = room.outdoor) != null ? _a : false);
        existingRoomNames.add(room.name.toLowerCase());
        roomsAdded++;
      } else {
        await this.plugin.db.setRoomOutdoor(room.name, (_b = room.outdoor) != null ? _b : false);
      }
    }
    statusEl.textContent = "Importing tasks...";
    const existingTasks = this.plugin.db.getTasks();
    const existingKeys = new Set(existingTasks.map((t) => `${t.room}||${t.name}`));
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
        description: (_c = task.description) != null ? _c : "",
        room: task.room,
        estimated_hours: (_d = task.estimated_hours) != null ? _d : 0,
        estimated_minutes: (_e = task.estimated_minutes) != null ? _e : 0,
        effort_level: (_f = task.effort_level) != null ? _f : 5,
        materials: Array.isArray(task.materials) ? task.materials : [],
        status: (_g = task.status) != null ? _g : "pending",
        outdoor: (_h = task.outdoor) != null ? _h : false,
        shared_task_id: (_i = task.shared_task_id) != null ? _i : null
      });
      tasksAdded++;
    }
    const existingShared = this.plugin.db.getSharedTasks();
    const existingSharedNames = new Set(existingShared.map((s) => s.name.toLowerCase()));
    let sharedAdded = 0;
    for (const st of (_j = store.shared_tasks) != null ? _j : []) {
      if (!st.name || existingSharedNames.has(st.name.toLowerCase()))
        continue;
      existingSharedNames.add(st.name.toLowerCase());
      await this.plugin.db.createSharedTask({
        name: st.name,
        description: (_k = st.description) != null ? _k : "",
        room: (_l = st.room) != null ? _l : "",
        estimated_hours: (_m = st.estimated_hours) != null ? _m : 0,
        estimated_minutes: (_n = st.estimated_minutes) != null ? _n : 0,
        effort_level: (_o = st.effort_level) != null ? _o : 5,
        materials: Array.isArray(st.materials) ? st.materials : [],
        status: (_p = st.status) != null ? _p : "pending",
        outdoor: (_q = st.outdoor) != null ? _q : false,
        category: (_r = st.category) != null ? _r : ""
      });
      sharedAdded++;
    }
    statusEl.textContent = "Import complete";
    const parts = [];
    if (roomsAdded > 0)
      parts.push(`${roomsAdded} room${roomsAdded !== 1 ? "s" : ""} added`);
    if (tasksAdded > 0)
      parts.push(`${tasksAdded} task${tasksAdded !== 1 ? "s" : ""} imported`);
    if (tasksDuplicate > 0)
      parts.push(`${tasksDuplicate} duplicate${tasksDuplicate !== 1 ? "s" : ""} skipped`);
    if (sharedAdded > 0)
      parts.push(`${sharedAdded} shared task${sharedAdded !== 1 ? "s" : ""} added`);
    const summary = parts.length > 0 ? parts.join(", ") : "Nothing new to import";
    progressEl.createEl("p", { text: `\u2713 ${summary}.`, cls: "hf-success" });
    progressEl.createEl("p", { text: "Go to Dashboard to view your tasks.", cls: "hf-hint" });
    new import_obsidian9.Notice(`\u2713 Flask export imported: ${summary}.`);
  }
};

// src/views/ReportsView.ts
var import_obsidian10 = require("obsidian");
function svgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs))
    el.setAttribute(k, String(v));
  return el;
}
function cssVar(name, fallback = "#888") {
  return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
}
var EFFORT_PALETTE = [
  "--color-green",
  "--color-green",
  "--color-green",
  "--color-green",
  "--color-yellow",
  "--color-yellow",
  "--color-yellow",
  "--color-orange",
  "--color-orange",
  "--color-red"
];
var ReportsView = class {
  constructor(el, plugin) {
    this.el = el;
    this.plugin = plugin;
  }
  render() {
    this.el.empty();
    this.el.addClass("hf-view");
    const header = this.el.createDiv({ cls: "hf-view-header" });
    header.createEl("h2", { text: "Reports", cls: "hf-view-title" });
    const btnRow = header.createDiv({ cls: "hf-report-export-btns" });
    const exportBtn = btnRow.createEl("button", { text: "\u2B07 Export PDF", cls: "hf-btn hf-btn-secondary" });
    exportBtn.addEventListener("click", () => this.exportPdf());
    const mdBtn = btnRow.createEl("button", { text: "\u{1F4DD} Save as Note", cls: "hf-btn hf-btn-secondary" });
    mdBtn.addEventListener("click", () => this.saveAsMarkdown());
    const tasks = this.plugin.db.getTasks();
    const rooms = this.plugin.db.getRooms();
    const people = this.plugin.db.getPeople();
    const stats = this.plugin.db.getStats();
    const schedules = this.plugin.db.getSchedules();
    if (tasks.length === 0) {
      const empty = this.el.createDiv({ cls: "hf-empty-state" });
      empty.createEl("div", { text: "\u{1F4CA}", cls: "hf-empty-icon" });
      empty.createEl("p", { text: "No tasks yet. Add some tasks to see your reports." });
      return;
    }
    const body = this.el.createDiv({ cls: "hf-report-body" });
    this.renderSection(body, "\u{1F4CA} Overview", (section) => {
      const kpis = section.createDiv({ cls: "hf-kpi-grid" });
      const totalHours = tasks.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
      const completedHours = tasks.filter((t) => t.status === "completed").reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
      const avgEffort = tasks.length ? tasks.reduce((s, t) => s + t.effort_level, 0) / tasks.length : 0;
      const completionRate = stats.total ? stats.completed / stats.total * 100 : 0;
      const outdoorCount = tasks.filter((t) => t.outdoor).length;
      const withMaterials = tasks.filter((t) => t.materials.length > 0).length;
      this.kpi(kpis, "Total Tasks", String(stats.total), "hf-kpi-blue");
      this.kpi(kpis, "Completed", `${stats.completed}`, "hf-kpi-green", `${completionRate.toFixed(0)}% done`);
      this.kpi(kpis, "In Progress", `${stats.assigned}`, "hf-kpi-orange");
      this.kpi(kpis, "Pending", `${stats.pending}`, "hf-kpi-muted");
      this.kpi(kpis, "Total Est. Hours", `${totalHours.toFixed(1)} h`, "hf-kpi-blue");
      this.kpi(kpis, "Hours Completed", `${completedHours.toFixed(1)} h`, "hf-kpi-green");
      this.kpi(kpis, "Avg Effort Level", `${avgEffort.toFixed(1)} / 10`, "hf-kpi-orange");
      this.kpi(kpis, "Rooms", `${rooms.length}`, "hf-kpi-muted");
      this.kpi(kpis, "Outdoor Tasks", `${outdoorCount}`, "hf-kpi-muted");
      this.kpi(kpis, "Tasks w/ Materials", `${withMaterials}`, "hf-kpi-muted");
      this.kpi(kpis, "People", `${people.length}`, "hf-kpi-muted");
      this.kpi(kpis, "Schedules", `${schedules.length}`, "hf-kpi-muted");
    });
    this.renderSection(body, "\u2705 Task Status Breakdown", (section) => {
      const row = section.createDiv({ cls: "hf-report-row" });
      const chartWrap = row.createDiv({ cls: "hf-chart-wrap" });
      this.renderDonut(chartWrap, [
        { label: "Pending", value: stats.pending, colorVar: "--color-orange" },
        { label: "Assigned", value: stats.assigned, colorVar: "--color-blue" },
        { label: "Completed", value: stats.completed, colorVar: "--color-green" }
      ], "Tasks by Status");
      const tableWrap = row.createDiv({ cls: "hf-report-table-wrap" });
      const tbl = this.makeTable(tableWrap, ["Status", "Count", "Est. Hours", "% of Total"]);
      for (const [status, colorVar] of [
        ["pending", "--color-orange"],
        ["assigned", "--color-blue"],
        ["completed", "--color-green"]
      ]) {
        const group = tasks.filter((t) => t.status === status);
        const hrs = group.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
        const pct = stats.total ? (group.length / stats.total * 100).toFixed(1) : "0.0";
        const label = status.charAt(0).toUpperCase() + status.slice(1);
        this.tableRow(tbl, [this.dotCell(colorVar, label), String(group.length), `${hrs.toFixed(1)} h`, `${pct}%`]);
      }
    });
    this.renderSection(body, "\u{1F3E0} Progress by Room", (section) => {
      if (rooms.length === 0) {
        section.createEl("p", { text: "No rooms yet.", cls: "hf-hint" });
        return;
      }
      const row = section.createDiv({ cls: "hf-report-row" });
      const chartWrap = row.createDiv({ cls: "hf-chart-wrap hf-chart-wrap-wide" });
      this.renderStackedBars(chartWrap, rooms, tasks);
      const tableWrap = row.createDiv({ cls: "hf-report-table-wrap" });
      const tbl = this.makeTable(tableWrap, ["Room", "Total", "Done", "% Done", "Est. Hrs"]);
      const sorted = [...rooms].sort((a, b) => b.task_count - a.task_count);
      for (const r of sorted) {
        const roomTasks = tasks.filter((t) => t.room === r.name);
        const hrs = roomTasks.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
        const pct = r.task_count ? (r.completed_count / r.task_count * 100).toFixed(0) : "0";
        const icon = r.outdoor ? "\u{1F33F} " : "\u{1F3E0} ";
        this.tableRow(tbl, [icon + r.name, String(r.task_count), String(r.completed_count), `${pct}%`, `${hrs.toFixed(1)} h`]);
      }
    });
    this.renderSection(body, "\u{1F4AA} Effort Level Distribution", (section) => {
      const row = section.createDiv({ cls: "hf-report-row" });
      const chartWrap = row.createDiv({ cls: "hf-chart-wrap hf-chart-wrap-wide" });
      const effortBuckets = Array(10).fill(0);
      for (const t of tasks)
        effortBuckets[Math.max(0, Math.min(9, t.effort_level - 1))]++;
      this.renderBarChart(chartWrap, effortBuckets.map((v, i) => ({
        label: String(i + 1),
        value: v,
        colorVar: EFFORT_PALETTE[i]
      })), "Tasks per Effort Level (1 = easiest, 10 = hardest)");
      const tableWrap = row.createDiv({ cls: "hf-report-table-wrap" });
      const tbl = this.makeTable(tableWrap, ["Effort", "Tasks", "Est. Hours", "Avg Hours/Task"]);
      for (let level = 1; level <= 10; level++) {
        const group = tasks.filter((t) => t.effort_level === level);
        if (group.length === 0)
          continue;
        const hrs = group.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
        const avg = hrs / group.length;
        this.tableRow(tbl, [`Level ${level}`, String(group.length), `${hrs.toFixed(1)} h`, `${avg.toFixed(1)} h`]);
      }
    });
    this.renderSection(body, "\u23F1 Time Estimates", (section) => {
      const row = section.createDiv({ cls: "hf-report-row" });
      const buckets = {
        "< 1 h": tasks.filter((t) => t.estimated_hours + t.estimated_minutes / 60 < 1),
        "1\u20132 h": tasks.filter((t) => {
          const h = t.estimated_hours + t.estimated_minutes / 60;
          return h >= 1 && h < 2;
        }),
        "2\u20134 h": tasks.filter((t) => {
          const h = t.estimated_hours + t.estimated_minutes / 60;
          return h >= 2 && h < 4;
        }),
        "4\u20138 h": tasks.filter((t) => {
          const h = t.estimated_hours + t.estimated_minutes / 60;
          return h >= 4 && h < 8;
        }),
        "8+ h": tasks.filter((t) => t.estimated_hours + t.estimated_minutes / 60 >= 8),
        "No est.": tasks.filter((t) => t.estimated_hours === 0 && t.estimated_minutes === 0)
      };
      const bucketColors = ["--color-green", "--color-blue", "--color-yellow", "--color-orange", "--color-red", "--text-faint"];
      const chartWrap = row.createDiv({ cls: "hf-chart-wrap" });
      this.renderDonut(chartWrap, Object.entries(buckets).map(([label, arr], i) => ({
        label,
        value: arr.length,
        colorVar: bucketColors[i]
      })).filter((b) => b.value > 0), "Tasks by Duration");
      const tableWrap = row.createDiv({ cls: "hf-report-table-wrap" });
      const tbl = this.makeTable(tableWrap, ["Duration Range", "Tasks", "Total Hours"]);
      for (const [label, group] of Object.entries(buckets)) {
        if (group.length === 0)
          continue;
        const hrs = group.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
        this.tableRow(tbl, [label, String(group.length), `${hrs.toFixed(1)} h`]);
      }
    });
    this.renderSection(body, "\u{1F3C6} Top Rooms by Estimated Work", (section) => {
      const roomHours = rooms.map((r) => {
        const roomTasks = tasks.filter((t) => t.room === r.name);
        return {
          name: r.name,
          total: roomTasks.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0),
          remaining: roomTasks.filter((t) => t.status !== "completed").reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0)
        };
      }).filter((r) => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);
      const chartWrap = section.createDiv({ cls: "hf-chart-wrap hf-chart-wrap-full" });
      this.renderBarChart(chartWrap, roomHours.map((r, i) => ({
        label: r.name.length > 14 ? r.name.slice(0, 12) + "\u2026" : r.name,
        value: r.total,
        colorVar: "--interactive-accent"
      })), "Estimated Hours per Room");
      const tbl = this.makeTable(section, ["Room", "Total Hours", "Remaining", "Hours Done"]);
      for (const r of roomHours) {
        const done = r.total - r.remaining;
        this.tableRow(tbl, [r.name, `${r.total.toFixed(1)} h`, `${r.remaining.toFixed(1)} h`, `${done.toFixed(1)} h`]);
      }
    });
    this.renderSection(body, "\u{1F9F0} Materials Summary", (section) => {
      const materialMap = /* @__PURE__ */ new Map();
      for (const t of tasks) {
        for (const m of t.materials) {
          const key = m.trim().toLowerCase();
          if (!key)
            continue;
          if (!materialMap.has(key))
            materialMap.set(key, { count: 0, tasks: [] });
          materialMap.get(key).count++;
          materialMap.get(key).tasks.push(t.name);
        }
      }
      if (materialMap.size === 0) {
        section.createEl("p", { text: "No materials data yet. Run AI analysis on tasks to populate this.", cls: "hf-hint" });
        return;
      }
      const sorted = [...materialMap.entries()].sort((a, b) => b[1].count - a[1].count);
      const top20 = sorted.slice(0, 20);
      const row = section.createDiv({ cls: "hf-report-row" });
      const chartWrap = row.createDiv({ cls: "hf-chart-wrap hf-chart-wrap-wide" });
      this.renderBarChart(chartWrap, top20.map(([label, data]) => ({
        label: label.length > 16 ? label.slice(0, 14) + "\u2026" : label,
        value: data.count,
        colorVar: "--interactive-accent"
      })), `Top ${top20.length} Materials by Frequency`);
      const tableWrap = row.createDiv({ cls: "hf-report-table-wrap" });
      const tbl = this.makeTable(tableWrap, ["Material", "Tasks Needing It", "Task Names"]);
      for (const [mat, data] of top20) {
        const displayMat = mat.charAt(0).toUpperCase() + mat.slice(1);
        const taskNames = data.tasks.slice(0, 3).join(", ") + (data.tasks.length > 3 ? ` +${data.tasks.length - 3} more` : "");
        this.tableRow(tbl, [displayMat, String(data.count), taskNames]);
      }
    });
    if (people.length > 0) {
      this.renderSection(body, "\u{1F465} People & Workload", (section) => {
        const tbl = this.makeTable(section, ["Person", "Assigned Tasks", "Est. Hours Assigned", "Scheduled Days", "Max Tasks/Day"]);
        for (const p of people) {
          const personSchedules = schedules.filter((s) => s.person_id === p.id);
          const assignedTaskIds = new Set(
            personSchedules.flatMap((s) => {
              var _a;
              return ((_a = s.assignments) != null ? _a : []).map((a) => a.task_id);
            })
          );
          const assignedTasks = tasks.filter((t) => assignedTaskIds.has(t.id));
          const hrs = assignedTasks.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
          const days = new Set(personSchedules.map((s) => s.schedule_date)).size;
          this.tableRow(tbl, [
            p.name,
            String(assignedTaskIds.size),
            `${hrs.toFixed(1)} h`,
            String(days),
            String(p.max_tasks_per_day)
          ]);
        }
      });
    }
    this.renderSection(body, "\u{1F4CB} All Tasks Detail", (section) => {
      const tbl = this.makeTable(section, ["Task", "Room", "Status", "Effort", "Est. Time", "Outdoor", "Materials"]);
      const sorted = [...tasks].sort((a, b) => a.room.localeCompare(b.room) || a.name.localeCompare(b.name));
      for (const t of sorted) {
        const mins = t.estimated_hours * 60 + t.estimated_minutes;
        const timeStr = mins === 0 ? "\u2014" : mins < 60 ? `${mins}m` : `${t.estimated_hours}h${t.estimated_minutes > 0 ? ` ${t.estimated_minutes}m` : ""}`;
        this.tableRow(tbl, [
          t.name,
          t.room,
          t.status,
          String(t.effort_level),
          timeStr,
          t.outdoor ? "Yes" : "No",
          t.materials.length ? t.materials.slice(0, 3).join(", ") + (t.materials.length > 3 ? ` +${t.materials.length - 3}` : "") : "\u2014"
        ]);
      }
    });
    const footer = body.createDiv({ cls: "hf-report-footer" });
    footer.createEl("span", { text: `Generated ${(/* @__PURE__ */ new Date()).toLocaleString()}`, cls: "hf-hint" });
  }
  // ─── Layout helpers ───────────────────────────────────────────────────────
  renderSection(parent, title, cb) {
    const section = parent.createDiv({ cls: "hf-report-section" });
    section.createEl("h3", { text: title, cls: "hf-report-section-title" });
    cb(section);
  }
  kpi(parent, label, value, colorCls, sub) {
    const card = parent.createDiv({ cls: `hf-kpi-card ${colorCls}` });
    card.createEl("div", { text: value, cls: "hf-kpi-value" });
    card.createEl("div", { text: label, cls: "hf-kpi-label" });
    if (sub)
      card.createEl("div", { text: sub, cls: "hf-kpi-sub" });
  }
  makeTable(parent, headers) {
    const wrap = parent.createDiv({ cls: "hf-report-table-scroll" });
    const tbl = wrap.createEl("table", { cls: "hf-report-table" });
    const thead = tbl.createEl("thead");
    const tr = thead.createEl("tr");
    for (const h of headers)
      tr.createEl("th", { text: h });
    tbl.createEl("tbody");
    return tbl;
  }
  tableRow(tbl, cells) {
    const tbody = tbl.querySelector("tbody");
    const tr = tbody.createEl("tr");
    for (const c of cells) {
      const td = tr.createEl("td");
      if (c instanceof HTMLElement) {
        td.appendChild(c);
      } else {
        td.textContent = c;
      }
    }
  }
  /** Build a cell fragment with a colored dot followed by text. */
  dotCell(colorVar, text) {
    const wrap = document.createDocumentFragment();
    const dot = document.createElement("span");
    dot.style.color = cssVar(colorVar);
    dot.textContent = "\u25CF ";
    const span = document.createElement("span");
    span.textContent = text;
    wrap.appendChild(dot);
    wrap.appendChild(span);
    const container = document.createElement("span");
    container.appendChild(dot);
    container.appendChild(span);
    return container;
  }
  // ─── SVG Charts ──────────────────────────────────────────────────────────
  /** Animated donut/pie chart with a legend. */
  renderDonut(parent, slices, title) {
    const total = slices.reduce((s, x) => s + x.value, 0);
    if (total === 0) {
      parent.createEl("p", { text: "No data.", cls: "hf-hint" });
      return;
    }
    parent.createEl("div", { text: title, cls: "hf-chart-title" });
    const SIZE = 160;
    const R = 54;
    const CX = SIZE / 2, CY = SIZE / 2;
    const svg = svgEl("svg", { width: SIZE, height: SIZE, viewBox: `0 0 ${SIZE} ${SIZE}` });
    parent.appendChild(svg);
    let angle = -Math.PI / 2;
    for (const s of slices) {
      if (s.value === 0)
        continue;
      const sweep = s.value / total * 2 * Math.PI;
      const endAngle = angle + sweep;
      const x1 = CX + R * Math.cos(angle);
      const y1 = CY + R * Math.sin(angle);
      const x2 = CX + R * Math.cos(endAngle);
      const y2 = CY + R * Math.sin(endAngle);
      const large = sweep > Math.PI ? 1 : 0;
      const path = svgEl("path", {
        d: `M${CX},${CY} L${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} Z`,
        fill: cssVar(s.colorVar),
        opacity: "0.9"
      });
      svg.appendChild(path);
      angle = endAngle;
    }
    svg.appendChild(svgEl("circle", { cx: CX, cy: CY, r: R * 0.5, fill: cssVar("--background-primary") }));
    const txt = svgEl("text", { x: CX, y: CY + 5, "text-anchor": "middle", fill: cssVar("--text-normal"), "font-size": "14", "font-weight": "bold" });
    txt.textContent = String(total);
    svg.appendChild(txt);
    const legend = parent.createDiv({ cls: "hf-chart-legend" });
    for (const s of slices) {
      if (s.value === 0)
        continue;
      const item = legend.createDiv({ cls: "hf-legend-item" });
      const dot = item.createEl("span", { cls: "hf-legend-dot" });
      dot.style.background = cssVar(s.colorVar);
      item.createEl("span", { text: `${s.label}: ${s.value} (${(s.value / total * 100).toFixed(1)}%)`, cls: "hf-legend-label" });
    }
  }
  /** Vertical bar chart. */
  renderBarChart(parent, bars, title) {
    const max = Math.max(...bars.map((b) => b.value), 1);
    parent.createEl("div", { text: title, cls: "hf-chart-title" });
    const chart = parent.createDiv({ cls: "hf-bar-chart" });
    for (const b of bars) {
      const col = chart.createDiv({ cls: "hf-bar-col" });
      const barWrap = col.createDiv({ cls: "hf-bar-wrap" });
      barWrap.createEl("span", { text: b.value > 0 ? String(b.value) : "", cls: "hf-bar-val" });
      const bar = barWrap.createDiv({ cls: "hf-bar" });
      const pct = b.value / max * 100;
      bar.style.height = `${Math.max(pct, b.value > 0 ? 4 : 0)}%`;
      bar.style.background = cssVar(b.colorVar);
      col.createEl("span", { text: b.label, cls: "hf-bar-label" });
    }
  }
  /** Stacked horizontal progress bars per room. */
  renderStackedBars(parent, rooms, tasks) {
    parent.createEl("div", { text: "Task status per room", cls: "hf-chart-title" });
    const sorted = [...rooms].sort((a, b) => b.task_count - a.task_count).slice(0, 15);
    const chart = parent.createDiv({ cls: "hf-stacked-chart" });
    for (const room of sorted) {
      const roomTasks = tasks.filter((t) => t.room === room.name);
      const total = roomTasks.length;
      if (total === 0)
        continue;
      const pending = roomTasks.filter((t) => t.status === "pending").length;
      const assigned = roomTasks.filter((t) => t.status === "assigned").length;
      const completed = roomTasks.filter((t) => t.status === "completed").length;
      const row = chart.createDiv({ cls: "hf-stacked-row" });
      const namEl = row.createEl("span", { text: room.name, cls: "hf-stacked-label" });
      if (room.outdoor)
        namEl.title = "Outdoor";
      const barOuter = row.createDiv({ cls: "hf-stacked-bar-outer" });
      if (completed) {
        const seg = barOuter.createDiv({ cls: "hf-stacked-seg" });
        seg.style.width = `${completed / total * 100}%`;
        seg.style.background = cssVar("--color-green");
        seg.title = `Completed: ${completed}`;
      }
      if (assigned) {
        const seg = barOuter.createDiv({ cls: "hf-stacked-seg" });
        seg.style.width = `${assigned / total * 100}%`;
        seg.style.background = cssVar("--color-blue");
        seg.title = `Assigned: ${assigned}`;
      }
      if (pending) {
        const seg = barOuter.createDiv({ cls: "hf-stacked-seg" });
        seg.style.width = `${pending / total * 100}%`;
        seg.style.background = cssVar("--color-orange", "#f59e0b");
        seg.title = `Pending: ${pending}`;
      }
      row.createEl("span", { text: `${completed}/${total}`, cls: "hf-stacked-count" });
    }
    const legend = parent.createDiv({ cls: "hf-chart-legend" });
    for (const [label, cv] of [["Completed", "--color-green"], ["Assigned", "--color-blue"], ["Pending", "--color-orange"]]) {
      const item = legend.createDiv({ cls: "hf-legend-item" });
      const dot = item.createEl("span", { cls: "hf-legend-dot" });
      dot.style.background = cssVar(cv, "#888");
      item.createEl("span", { text: label, cls: "hf-legend-label" });
    }
  }
  // ─── PDF Export ───────────────────────────────────────────────────────────
  exportPdf() {
    const reportBody = this.el.querySelector(".hf-report-body");
    if (!reportBody) {
      new import_obsidian10.Notice("Nothing to export yet.");
      return;
    }
    const styleSheets = Array.from(document.styleSheets).map((ss) => {
      try {
        return Array.from(ss.cssRules).map((r) => r.cssText).join("\n");
      } catch (e) {
        return "";
      }
    }).join("\n");
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>House Fix Report</title>
  <style>
    ${styleSheets}
    body { background: #fff; color: #000; font-family: sans-serif; padding: 24px; }
    .hf-report-body { display: block !important; }
    .hf-report-section { page-break-inside: avoid; margin-bottom: 24px; }
    .hf-kpi-grid { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; }
    .hf-report-row { flex-direction: column !important; }
    .hf-bar-chart { height: 120px !important; }
    .hf-stacked-chart { font-size: 10px !important; }
    .hf-report-table { font-size: 10px !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>
  <h1 style="font-size:18px;margin-bottom:16px;">House Fix Report</h1>
  ${reportBody.innerHTML}
</body>
</html>`;
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      new import_obsidian10.Notice("Could not open print window. Check your popup blocker settings.");
      return;
    }
    popup.document.write(html);
    popup.document.close();
    popup.onload = () => {
      setTimeout(() => {
        popup.focus();
        popup.print();
      }, 400);
    };
    setTimeout(() => {
      if (!popup.closed) {
        popup.focus();
        popup.print();
      }
    }, 800);
  }
  // ─── Save as Markdown ─────────────────────────────────────────────────────
  async saveAsMarkdown() {
    const md = this.generateMarkdown();
    const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const fileName = `House Fix Report ${date}.md`;
    const vault = this.plugin.app.vault;
    try {
      const existing = vault.getAbstractFileByPath(fileName);
      if (existing) {
        await vault.modify(existing, md);
        new import_obsidian10.Notice(`Updated "${fileName}" in vault.`);
      } else {
        await vault.create(fileName, md);
        new import_obsidian10.Notice(`Saved "${fileName}" to vault.`);
      }
      const file = vault.getAbstractFileByPath(fileName);
      if (file) {
        await this.plugin.app.workspace.getLeaf(true).openFile(file);
      }
    } catch (e) {
      new import_obsidian10.Notice(`Failed to save note: ${e.message}`);
    }
  }
  generateMarkdown() {
    const tasks = this.plugin.db.getTasks();
    const rooms = this.plugin.db.getRooms();
    const people = this.plugin.db.getPeople();
    const stats = this.plugin.db.getStats();
    const schedules = this.plugin.db.getSchedules();
    const date = (/* @__PURE__ */ new Date()).toLocaleString();
    const totalHours = tasks.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
    const completedHours = tasks.filter((t) => t.status === "completed").reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
    const avgEffort = tasks.length ? (tasks.reduce((s, t) => s + t.effort_level, 0) / tasks.length).toFixed(1) : "0";
    const completionRate = stats.total ? (stats.completed / stats.total * 100).toFixed(0) : "0";
    const lines = [];
    lines.push(`# House Fix Report`);
    lines.push(`*Generated: ${date}*`);
    lines.push("");
    lines.push("## Overview");
    lines.push("");
    lines.push(`| Metric | Value |`);
    lines.push(`|---|---|`);
    lines.push(`| Total Tasks | ${stats.total} |`);
    lines.push(`| Completed | ${stats.completed} (${completionRate}%) |`);
    lines.push(`| In Progress | ${stats.assigned} |`);
    lines.push(`| Pending | ${stats.pending} |`);
    lines.push(`| Total Est. Hours | ${totalHours.toFixed(1)} h |`);
    lines.push(`| Hours Completed | ${completedHours.toFixed(1)} h |`);
    lines.push(`| Avg Effort Level | ${avgEffort} / 10 |`);
    lines.push(`| Rooms | ${rooms.length} |`);
    lines.push(`| People | ${people.length} |`);
    lines.push("");
    lines.push("## Progress by Room");
    lines.push("");
    lines.push("| Room | Total | Done | % Done | Est. Hrs |");
    lines.push("|---|---|---|---|---|");
    const sortedRooms = [...rooms].sort((a, b) => b.task_count - a.task_count);
    for (const r of sortedRooms) {
      const roomTasks = tasks.filter((t) => t.room === r.name);
      const hrs = roomTasks.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
      const pct = r.task_count ? (r.completed_count / r.task_count * 100).toFixed(0) : "0";
      const icon = r.outdoor ? "\u{1F33F}" : "\u{1F3E0}";
      lines.push(`| ${icon} ${r.name} | ${r.task_count} | ${r.completed_count} | ${pct}% | ${hrs.toFixed(1)} h |`);
    }
    lines.push("");
    if (people.length > 0) {
      lines.push("## People & Workload");
      lines.push("");
      lines.push("| Person | Assigned Tasks | Est. Hours | Scheduled Days | Max Tasks/Day |");
      lines.push("|---|---|---|---|---|");
      for (const p of people) {
        const personSchedules = schedules.filter((s) => s.person_id === p.id);
        const assignedTaskIds = new Set(
          personSchedules.flatMap((s) => {
            var _a;
            return ((_a = s.assignments) != null ? _a : []).map((a) => a.task_id);
          })
        );
        const assignedTasks = tasks.filter((t) => assignedTaskIds.has(t.id));
        const hrs = assignedTasks.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
        const days = new Set(personSchedules.map((s) => s.schedule_date)).size;
        lines.push(`| ${p.name} | ${assignedTaskIds.size} | ${hrs.toFixed(1)} h | ${days} | ${p.max_tasks_per_day} |`);
      }
      lines.push("");
    }
    lines.push("## All Tasks Detail");
    lines.push("");
    lines.push("| Task | Room | Status | Effort | Est. Time | Outdoor | Materials |");
    lines.push("|---|---|---|---|---|---|---|");
    const sortedTasks = [...tasks].sort((a, b) => a.room.localeCompare(b.room) || a.name.localeCompare(b.name));
    for (const t of sortedTasks) {
      const mins = t.estimated_hours * 60 + t.estimated_minutes;
      const timeStr = mins === 0 ? "\u2014" : mins < 60 ? `${mins}m` : `${t.estimated_hours}h${t.estimated_minutes > 0 ? ` ${t.estimated_minutes}m` : ""}`;
      const mats = t.materials.length ? t.materials.join(", ") : "\u2014";
      lines.push(`| ${t.name} | ${t.room} | ${t.status} | ${t.effort_level}/10 | ${timeStr} | ${t.outdoor ? "Yes" : "No"} | ${mats} |`);
    }
    lines.push("");
    lines.push(`---`);
    lines.push(`*House Fix Manager plugin*`);
    return lines.join("\n");
  }
};

// src/views/SidebarView.ts
var VIEW_TYPE_HOUSE_FIX = "house-fix-sidebar";
var NAV_ITEMS = [
  { key: "dashboard", icon: "\u{1F4CB}", label: "Dashboard" },
  { key: "rooms", icon: "\u{1F3E0}", label: "Rooms" },
  { key: "people", icon: "\u{1F465}", label: "People" },
  { key: "schedules", icon: "\u{1F4C5}", label: "Schedules" },
  { key: "shared", icon: "\u{1F4CC}", label: "Templates" },
  { key: "upload", icon: "\u{1F4E4}", label: "Upload" },
  { key: "reports", icon: "\u{1F4CA}", label: "Reports" }
];
var HouseFixSidebarView = class extends import_obsidian11.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.activeSection = "dashboard";
    this.sectionInstance = null;
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_HOUSE_FIX;
  }
  getDisplayText() {
    return "House Fix";
  }
  getIcon() {
    return "hammer";
  }
  async onOpen() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass("hf-sidebar-root");
    const header = root.createDiv({ cls: "hf-sidebar-header" });
    header.createEl("span", { text: "\u{1F3E0}", cls: "hf-sidebar-logo" });
    header.createEl("span", { text: "House Fix", cls: "hf-sidebar-title" });
    const nav = root.createEl("nav", { cls: "hf-nav" });
    for (const item of NAV_ITEMS) {
      const btn = nav.createEl("button", { cls: "hf-nav-item", attr: { "data-section": item.key } });
      btn.createEl("span", { text: item.icon, cls: "hf-nav-icon" });
      btn.createEl("span", { text: item.label, cls: "hf-nav-label" });
      btn.addEventListener("click", () => this.navigateTo(item.key));
    }
    this.contentEl2 = root.createDiv({ cls: "hf-sidebar-content" });
    this.renderSection();
  }
  navigateTo(section) {
    this.activeSection = section;
    this.renderSection();
    const root = this.containerEl.children[1];
    root.querySelectorAll(".hf-nav-item").forEach((btn) => {
      btn.removeClass("hf-nav-active");
      if (btn.dataset.section === section) {
        btn.addClass("hf-nav-active");
      }
    });
  }
  triggerNewTask() {
    const view = this.getActiveViewInstance();
    if (view instanceof DashboardView) {
      view.openNewTaskModal();
    }
  }
  navigateToDashboardRoom(roomName) {
    this.navigateTo("dashboard");
    setTimeout(() => {
      const view = this.getActiveViewInstance();
      if (view instanceof DashboardView) {
        view.scrollToRoom(roomName);
      }
    }, 50);
  }
  renderSection() {
    var _a;
    this.contentEl2.empty();
    const { plugin, activeSection } = this;
    switch (activeSection) {
      case "dashboard":
        this.sectionInstance = new DashboardView(this.contentEl2, plugin);
        break;
      case "rooms":
        this.sectionInstance = new RoomsView(this.contentEl2, plugin, (roomName) => this.navigateToDashboardRoom(roomName));
        break;
      case "people":
        this.sectionInstance = new PeopleView(this.contentEl2, plugin);
        break;
      case "schedules":
        this.sectionInstance = new SchedulesView(this.contentEl2, plugin);
        break;
      case "shared":
        this.sectionInstance = new SharedTasksView(this.contentEl2, plugin);
        break;
      case "upload":
        this.sectionInstance = new UploadView(this.contentEl2, plugin);
        break;
      case "reports":
        this.sectionInstance = new ReportsView(this.contentEl2, plugin);
        break;
    }
    (_a = this.sectionInstance) == null ? void 0 : _a.render();
  }
  getActiveViewInstance() {
    return this.sectionInstance;
  }
  async onClose() {
  }
};

// src/components/SettingsTab.ts
var import_obsidian13 = require("obsidian");

// src/components/GitHubOAuthModal.ts
var import_obsidian12 = require("obsidian");
var GITHUB_CLIENT_ID = "Ov23likHLKVE1ULzXoq3";
var DEVICE_SCOPES = "read:user";
var DEVICE_CODE_URL = "https://github.com/login/device/code";
var ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
var USER_API_URL = "https://api.github.com/user";
var GitHubOAuthModal = class extends import_obsidian12.Modal {
  constructor(app, plugin) {
    super(app);
    this.pollTimeout = null;
    this.cancelled = false;
    this.plugin = plugin;
  }
  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("hf-oauth-modal");
    contentEl.createEl("h2", { text: "Sign in with GitHub" });
    contentEl.createEl("p", {
      text: "Authorise House Fix Manager to use the GitHub Models AI API.",
      cls: "hf-settings-desc"
    });
    if (GITHUB_CLIENT_ID.includes("YOUR_CLIENT_ID_HERE")) {
      this.showClientIdError(contentEl);
      return;
    }
    const statusEl = contentEl.createDiv({ cls: "hf-oauth-status" });
    statusEl.createDiv({ cls: "hf-loading", text: "Requesting authorisation code\u2026" });
    try {
      const deviceData = await this.requestDeviceCode();
      this.renderCodeStep(contentEl, statusEl, deviceData);
    } catch (e) {
      statusEl.empty();
      statusEl.createEl("p", {
        text: `Failed to start sign-in: ${e.message}`,
        cls: "hf-warning"
      });
    }
  }
  onClose() {
    this.cancelled = true;
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
    this.contentEl.empty();
  }
  // ─── Step 1: request device + user code ─────────────────────────────────────
  async requestDeviceCode() {
    var _a, _b, _c, _d, _e, _f, _g;
    const res = await (0, import_obsidian12.requestUrl)({
      url: DEVICE_CODE_URL,
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        scope: DEVICE_SCOPES
      })
    });
    let data;
    const contentType = (_b = (_a = res.headers) == null ? void 0 : _a["content-type"]) != null ? _b : "";
    if (contentType.includes("application/x-www-form-urlencoded") || !contentType.includes("json")) {
      const params = new URLSearchParams(res.text);
      data = {
        device_code: (_c = params.get("device_code")) != null ? _c : "",
        user_code: (_d = params.get("user_code")) != null ? _d : "",
        verification_uri: (_e = params.get("verification_uri")) != null ? _e : "https://github.com/login/device",
        expires_in: parseInt((_f = params.get("expires_in")) != null ? _f : "900", 10),
        interval: parseInt((_g = params.get("interval")) != null ? _g : "5", 10)
      };
    } else {
      data = res.json;
    }
    console.log("[HouseFix] device code response:", JSON.stringify({ ...data, device_code: "***" }));
    if (!data.device_code) {
      throw new Error("Invalid response from GitHub (no device_code)");
    }
    return data;
  }
  // ─── Step 2: show user_code + poll ──────────────────────────────────────────
  renderCodeStep(contentEl, statusEl, deviceData) {
    var _a;
    statusEl.empty();
    statusEl.createEl("p", {
      text: '1. Copy the code below, then click "Open GitHub" to authorise.',
      cls: "hf-settings-desc"
    });
    const codeBox = statusEl.createDiv({ cls: "hf-oauth-code-box" });
    const codeEl = codeBox.createEl("span", {
      text: deviceData.user_code,
      cls: "hf-oauth-code"
    });
    const copyBtn = codeBox.createEl("button", { text: "Copy", cls: "hf-btn hf-btn-sm" });
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(deviceData.user_code).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = "Copy";
        }, 2e3);
      });
    });
    const openBtn = statusEl.createEl("button", {
      text: "Open GitHub \u2192",
      cls: "hf-btn hf-btn-primary"
    });
    openBtn.style.marginTop = "8px";
    openBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(deviceData.user_code);
      window.open(deviceData.verification_uri, "_blank");
      openBtn.textContent = "Opened \u2014 waiting for authorisation\u2026";
      openBtn.disabled = true;
    });
    const waitEl = statusEl.createDiv({ cls: "hf-oauth-waiting" });
    waitEl.createDiv({ cls: "hf-loading" });
    waitEl.createEl("span", {
      text: "Waiting for you to authorise in the browser\u2026",
      cls: "hf-settings-desc"
    });
    const expiresAt = Date.now() + deviceData.expires_in * 1e3;
    const expiryEl = statusEl.createEl("p", { cls: "hf-oauth-expiry" });
    const updateExpiry = () => {
      const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1e3));
      expiryEl.textContent = `Code expires in ${remaining}s`;
    };
    updateExpiry();
    const cancelBtn = statusEl.createEl("button", { text: "Cancel", cls: "hf-btn hf-btn-secondary" });
    cancelBtn.style.marginTop = "8px";
    cancelBtn.addEventListener("click", () => this.close());
    let currentIntervalMs = Math.max(((_a = deviceData.interval) != null ? _a : 5) * 1e3, 5e3);
    const schedulePoll = () => {
      this.pollTimeout = setTimeout(async () => {
        if (this.cancelled)
          return;
        updateExpiry();
        if (Date.now() > expiresAt) {
          waitEl.empty();
          waitEl.createEl("p", { text: "Code expired. Please try again.", cls: "hf-warning" });
          return;
        }
        const result = await this.pollAccessToken(deviceData.device_code);
        if (this.cancelled)
          return;
        if (result !== null && typeof result === "object" && result.access_token) {
          await this.handleSuccess(result.access_token, contentEl);
          return;
        }
        if (typeof result === "number") {
          currentIntervalMs = result * 1e3;
        }
        schedulePoll();
      }, currentIntervalMs);
    };
    schedulePoll();
  }
  // ─── Poll for token ──────────────────────────────────────────────────────────
  // Returns:
  //   null          → authorization_pending, keep polling at same interval
  //   number        → slow_down, value is the new minimum interval in seconds
  //   AccessTokenResponse → success, has access_token
  async pollAccessToken(deviceCode) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
      const res = await (0, import_obsidian12.requestUrl)({
        url: ACCESS_TOKEN_URL,
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code"
        })
      });
      let data;
      const contentType = (_b = (_a = res.headers) == null ? void 0 : _a["content-type"]) != null ? _b : "";
      if (contentType.includes("application/x-www-form-urlencoded") || !contentType.includes("json")) {
        const params = new URLSearchParams(res.text);
        data = {
          access_token: (_c = params.get("access_token")) != null ? _c : void 0,
          token_type: (_d = params.get("token_type")) != null ? _d : void 0,
          scope: (_e = params.get("scope")) != null ? _e : void 0,
          error: (_f = params.get("error")) != null ? _f : void 0,
          error_description: (_g = params.get("error_description")) != null ? _g : void 0
        };
      } else {
        data = res.json;
      }
      console.log("[HouseFix] poll response:", JSON.stringify(data));
      if (data.access_token)
        return data;
      if (data.error === "slow_down") {
        const newInterval = ((_h = data.interval) != null ? _h : 5) + 5;
        return newInterval;
      }
      if (data.error === "authorization_pending") {
        return null;
      }
      console.error("[HouseFix] OAuth terminal error:", data.error, data.error_description);
      return null;
    } catch (e) {
      console.error("[HouseFix] poll requestUrl error:", e);
      return null;
    }
  }
  // ─── Success ─────────────────────────────────────────────────────────────────
  async handleSuccess(accessToken, contentEl) {
    contentEl.empty();
    contentEl.createDiv({ cls: "hf-loading", text: "Fetching your GitHub profile\u2026" });
    let login = "GitHub User";
    try {
      const userRes = await (0, import_obsidian12.requestUrl)({
        url: USER_API_URL,
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/vnd.github+json"
        }
      });
      const user = userRes.json;
      login = user.name || user.login || "GitHub User";
    } catch (e) {
    }
    this.plugin.settings.githubAccessToken = accessToken;
    this.plugin.settings.githubUser = login;
    await this.plugin.saveSettings();
    contentEl.empty();
    contentEl.createEl("h2", { text: "Signed in!" });
    contentEl.createEl("p", {
      text: `Signed in as ${login}`,
      cls: "hf-success"
    });
    contentEl.createEl("p", {
      text: "AI features are now enabled. You can close this window.",
      cls: "hf-settings-desc"
    });
    const doneBtn = contentEl.createEl("button", { text: "Done", cls: "hf-btn hf-btn-primary" });
    doneBtn.style.marginTop = "8px";
    doneBtn.addEventListener("click", () => this.close());
    new import_obsidian12.Notice(`House Fix: Signed in as ${login}`, 4e3);
  }
  // ─── Client ID not configured ────────────────────────────────────────────────
  showClientIdError(contentEl) {
    const err = contentEl.createDiv({ cls: "hf-upload-warnings" });
    err.createEl("strong", { text: "GitHub OAuth App not configured" });
    err.createEl("p", {
      text: "The plugin needs a GitHub OAuth App Client ID before sign-in works. This is a one-time developer setup:"
    });
    const steps = err.createEl("ol");
    steps.createEl("li", { text: "Go to github.com \u2192 Settings \u2192 Developer settings \u2192 OAuth Apps \u2192 New OAuth App" });
    steps.createEl("li", { text: 'Name: "House Fix Manager", Homepage URL: https://github.com, Callback URL: https://github.com' });
    steps.createEl("li", { text: "Copy the Client ID (starts with Ov23\u2026)" });
    steps.createEl("li", { text: "Open the plugin source: src/components/GitHubOAuthModal.ts and replace YOUR_CLIENT_ID_HERE with your Client ID" });
    steps.createEl("li", { text: 'Run "npm run build" in the plugin folder to rebuild' });
    err.createEl("p", {
      text: "The Client ID is not a secret \u2014 it is safe to include in the plugin source.",
      cls: "hf-hint"
    });
  }
};

// src/components/SettingsTab.ts
var HouseFixSettingsTab = class extends import_obsidian13.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "House Fix Manager Settings" });
    containerEl.createEl("h3", { text: "GitHub Account" });
    containerEl.createEl("p", {
      text: "House Fix uses the GitHub Models AI API. Sign in with your GitHub account to enable AI-powered task analysis and schedule generation.",
      cls: "hf-settings-desc"
    });
    const isSignedIn = !!this.plugin.settings.githubAccessToken;
    if (isSignedIn) {
      new import_obsidian13.Setting(containerEl).setName("Signed in").setDesc(`Connected as: ${this.plugin.settings.githubUser || "GitHub User"}`).addButton((btn) => {
        btn.setButtonText("Sign out").setWarning().onClick(async () => {
          this.plugin.settings.githubAccessToken = "";
          this.plugin.settings.githubUser = "";
          await this.plugin.saveSettings();
          new import_obsidian13.Notice("House Fix: Signed out of GitHub");
          this.display();
        });
      });
      new import_obsidian13.Setting(containerEl).setName("Test AI Connection").setDesc("Verify the connection and model configuration work correctly.").addButton((btn) => {
        btn.setButtonText("Test Connection").setCta().onClick(async () => {
          btn.setButtonText("Testing\u2026");
          btn.setDisabled(true);
          const ai = this.plugin.getAI();
          const result = await ai.testConnection();
          btn.setButtonText("Test Connection");
          btn.setDisabled(false);
          if (result.success) {
            new import_obsidian13.Notice(`\u2713 ${result.message}`, 5e3);
          } else {
            new import_obsidian13.Notice(`\u2717 ${result.message}`, 8e3);
          }
        });
      });
    } else {
      new import_obsidian13.Setting(containerEl).setName("GitHub Account").setDesc("Sign in with GitHub to enable AI features (task analysis & schedule generation).").addButton((btn) => {
        btn.setButtonText("Sign in with GitHub").setCta().onClick(() => {
          new GitHubOAuthModal(this.app, this.plugin).open();
          const check = setInterval(() => {
            if (this.plugin.settings.githubAccessToken) {
              clearInterval(check);
              this.display();
            }
          }, 1e3);
          setTimeout(() => clearInterval(check), 6e5);
        });
      });
      const helpEl = containerEl.createDiv({ cls: "hf-settings-token-help" });
      helpEl.createEl("p", { text: "What happens when you sign in:" });
      const steps = helpEl.createEl("ol");
      steps.createEl("li", { text: "A short code is shown in Obsidian" });
      steps.createEl("li", { text: "You open github.com/login/device in your browser and enter the code" });
      steps.createEl("li", { text: "Obsidian detects the authorisation and saves your token automatically" });
      steps.createEl("li", { text: "No password is stored \u2014 only an OAuth access token" });
    }
    containerEl.createEl("h3", { text: "AI Model" });
    new import_obsidian13.Setting(containerEl).setName("Model").setDesc("Which GitHub Models AI model to use for analysis and scheduling.").addDropdown((drop) => {
      for (const m of GITHUB_MODELS) {
        drop.addOption(m.value, m.label);
      }
      drop.setValue(this.plugin.settings.githubModel);
      drop.onChange(async (value) => {
        this.plugin.settings.githubModel = value;
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "Database" });
    new import_obsidian13.Setting(containerEl).setName("Database File Name").setDesc("Name of the SQLite database file stored in your vault root. Restart Obsidian after changing.").addText((text) => {
      text.setPlaceholder("house-fix.db").setValue(this.plugin.settings.dbFileName).onChange(async (value) => {
        const trimmed = value.trim();
        if (trimmed) {
          this.plugin.settings.dbFileName = trimmed;
          await this.plugin.saveSettings();
        }
      });
    });
    containerEl.createEl("h3", { text: "About" });
    const about = containerEl.createDiv({ cls: "hf-settings-about" });
    about.createEl("p", { text: "House Fix Manager v1.0.0" });
    about.createEl("p", { text: "Manage home renovation tasks with AI-powered analysis and scheduling." });
  }
};

// src/main.ts
var HouseFixPlugin = class extends import_obsidian14.Plugin {
  async onload() {
    await this.loadSettings();
    this.db = new HouseFixDatabase(this.app, this.settings.dbFileName);
    try {
      await this.db.initialize();
    } catch (e) {
      new import_obsidian14.Notice(`House Fix: Failed to initialize database. ${e.message}`);
      console.error("House Fix DB init error:", e);
    }
    this.registerView(
      VIEW_TYPE_HOUSE_FIX,
      (leaf) => new HouseFixSidebarView(leaf, this)
    );
    this.addRibbonIcon("hammer", "House Fix Manager", () => {
      this.activateView();
    });
    const statusBarItem = this.addStatusBarItem();
    statusBarItem.setText("\u{1F3E0} House Fix");
    statusBarItem.addEventListener("click", () => this.activateView());
    this.addCommand({
      id: "open-house-fix",
      name: "Open House Fix Manager",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "house-fix-new-task",
      name: "New Task",
      callback: () => {
        this.activateView("dashboard");
        setTimeout(() => {
          const view = this.getView();
          if (view)
            view.triggerNewTask();
        }, 200);
      }
    });
    this.addCommand({
      id: "house-fix-generate-schedule",
      name: "Generate AI Schedule",
      callback: () => {
        this.activateView("schedules");
      }
    });
    this.addCommand({
      id: "house-fix-upload",
      name: "Upload Task File",
      callback: () => {
        this.activateView("upload");
      }
    });
    this.addSettingTab(new HouseFixSettingsTab(this.app, this));
  }
  onunload() {
    var _a;
    (_a = this.db) == null ? void 0 : _a.close();
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  getAI() {
    return new GitHubModelsClient(this.settings.githubAccessToken, this.settings.githubModel);
  }
  getView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_HOUSE_FIX);
    if (leaves.length > 0) {
      return leaves[0].view;
    }
    return null;
  }
  async activateView(section) {
    var _a;
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_HOUSE_FIX)[0];
    if (!leaf) {
      leaf = (_a = workspace.getLeftLeaf(false)) != null ? _a : workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE_HOUSE_FIX, active: true });
    }
    workspace.revealLeaf(leaf);
    if (section) {
      const view = leaf.view;
      view.navigateTo(section);
    }
  }
};
