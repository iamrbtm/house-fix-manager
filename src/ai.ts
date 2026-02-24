import { requestUrl } from 'obsidian';
import type { Task, Person, TaskAnalysis, ScheduleResult } from './models';

const GITHUB_MODELS_ENDPOINT = 'https://models.inference.ai.azure.com/chat/completions';

export class GitHubModelsClient {
  private token: string;  // GitHub OAuth access token
  private model: string;

  constructor(accessToken: string, model: string) {
    this.token = accessToken;
    this.model = model;
  }

  // ─── Task Analysis ────────────────────────────────────────────────────────

  async analyzeTask(description: string): Promise<TaskAnalysis> {
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
      const response = await requestUrl({
        url: GITHUB_MODELS_ENDPOINT,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are an expert in home improvement and maintenance tasks. Provide accurate estimates for task completion and clear, actionable descriptions. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
          ],
          model: this.model,
          temperature: 0.3,
          max_tokens: 800,
        }),
        throw: false,
      });

      if (response.status >= 400) {
        console.error('GitHub Models API error:', response.status, response.text);
        return this.fallbackAnalysis(description);
      }

      const data = response.json as {
        choices: Array<{ message: { content: string } }>;
      };
      const content = data.choices?.[0]?.message?.content || '';
      const parsed = this.extractJson<Partial<TaskAnalysis>>(content);

      return {
        time_hours: Math.max(0, Math.round(parsed?.time_hours ?? 1)),
        time_minutes: Math.max(0, Math.min(59, Math.round(parsed?.time_minutes ?? 0))),
        effort_level: Math.max(1, Math.min(10, Math.round(parsed?.effort_level ?? 5))),
        materials: Array.isArray(parsed?.materials) ? parsed!.materials : [],
        enhanced_description: parsed?.enhanced_description || description,
        reasoning: `GitHub Models AI analysis using ${this.model}`,
      };
    } catch (e) {
      console.error('Task analysis error:', e);
      return this.fallbackAnalysis(description);
    }
  }

  // ─── Schedule Generation ──────────────────────────────────────────────────

  async generateSchedules(
    people: Person[],
    tasks: Task[],
    startDate: string,
    numDays: number,
  ): Promise<ScheduleResult> {
    if (!this.token) {
      return this.fallbackSchedule(people, tasks, startDate, numDays);
    }

    const prompt = this.buildSchedulingPrompt(people, tasks, startDate, numDays);

    try {
      const response = await requestUrl({
        url: GITHUB_MODELS_ENDPOINT,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are an expert task scheduling AI. Generate optimal daily schedules that respect constraints, maximize efficiency through task grouping, and provide clear reasoning. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
          ],
          model: this.model,
          temperature: 0.4,
          max_tokens: 4000,
        }),
        throw: false,
      });

      if (response.status >= 400) {
        console.error('Schedule generation API error:', response.status);
        return this.fallbackSchedule(people, tasks, startDate, numDays);
      }

      const data = response.json as {
        choices: Array<{ message: { content: string } }>;
      };
      const content = data.choices?.[0]?.message?.content || '';
      const parsed = this.extractJson<Partial<ScheduleResult>>(content);

      return {
        schedules: parsed?.schedules ?? [],
        task_groupings: parsed?.task_groupings ?? [],
        unscheduled_tasks: parsed?.unscheduled_tasks ?? [],
        reasoning: parsed?.reasoning ?? 'AI schedule generated',
        warnings: parsed?.warnings ?? [],
        ai_model: this.model,
        generated_at: new Date().toISOString(),
      };
    } catch (e) {
      console.error('Schedule generation error:', e);
      return this.fallbackSchedule(people, tasks, startDate, numDays);
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.token) {
      return { success: false, message: 'Not signed in to GitHub. Use Settings → Sign in with GitHub.' };
    }
    try {
      const response = await requestUrl({
        url: GITHUB_MODELS_ENDPOINT,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Say "OK" in one word.' }],
          model: this.model,
          max_tokens: 10,
        }),
        throw: false,
      });
      if (response.status < 400) {
        return { success: true, message: `Connected successfully using model: ${this.model}` };
      } else if (response.status === 401) {
        return { success: false, message: 'GitHub token is invalid or expired — please sign in again via Settings (401 Unauthorized)' };
      } else if (response.status === 403) {
        return { success: false, message: 'Your GitHub account does not have GitHub Models access (403 Forbidden). Visit github.com/marketplace/models to enable it.' };
      } else {
        return { success: false, message: `API error: ${response.status}` };
      }
    } catch (e) {
      return { success: false, message: `Connection failed: ${(e as Error).message}` };
    }
  }

  // ─── Prompts ──────────────────────────────────────────────────────────────

  private buildSchedulingPrompt(people: Person[], tasks: Task[], startDate: string, numDays: number): string {
    const taskList = tasks.slice(0, 20).map(t =>
      `  - ID:${t.id} "${t.name}" | Room: ${t.room} | Effort: ${t.effort_level}/10 | Time: ${t.estimated_hours}h${t.estimated_minutes}m | Outdoor: ${t.outdoor}`
    ).join('\n');

    const peopleList = people.map(p => {
      const slots = Object.entries(p.availability).map(([day, timeSlots]) =>
        `    ${day}: ${(timeSlots as Array<{start:string;end:string;effort_capacity:number}>).map(s => `${s.start}-${s.end}(effort≤${s.effort_capacity})`).join(', ')}`
      ).join('\n');
      return `  - ID:${p.id} "${p.name}" | Max tasks/day: ${p.max_tasks_per_day} | Limitations: ${p.physical_limitations || 'none'}\n    Availability:\n${slots}`;
    }).join('\n');

    return `Generate an optimized work schedule.

Start date: ${startDate}
Duration: ${numDays} days

PEOPLE:
${peopleList}

TASKS (pending/assigned):
${taskList}
${tasks.length > 20 ? `  ... and ${tasks.length - 20} more tasks` : ''}

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

  private fallbackAnalysis(description: string): TaskAnalysis {
    const lower = description.toLowerCase();
    let time_hours = 1, time_minutes = 0, effort_level = 5;
    const materials: string[] = [];

    if (/paint|stain|varnish|primer/.test(lower)) {
      time_hours = 3; effort_level = 6;
      materials.push('Paint', 'Paintbrush', 'Roller', 'Drop cloth', "Painter's tape");
    } else if (/clean|wash|scrub|dust|mop|vacuum/.test(lower)) {
      time_hours = 1; time_minutes = 30; effort_level = 3;
      materials.push('Cleaning solution', 'Microfiber cloth', 'Bucket');
    } else if (/repair|fix|patch|seal|caulk/.test(lower)) {
      time_hours = 2; effort_level = 7;
      materials.push('Repair materials', 'Tools');
    } else if (/install|replace|mount|hang/.test(lower)) {
      time_hours = 2; time_minutes = 30; effort_level = 6;
      materials.push('Hardware', 'Tools', 'Screws');
    } else if (/organiz|sort|arrang|declutter/.test(lower)) {
      time_hours = 1; effort_level = 3;
    }

    return {
      time_hours,
      time_minutes,
      effort_level,
      materials,
      enhanced_description: description,
      reasoning: 'Local keyword-based fallback (not signed in to GitHub)',
    };
  }

  private fallbackSchedule(people: Person[], tasks: Task[], startDate: string, numDays: number): ScheduleResult {
    const schedules: ScheduleResult['schedules'] = [];
    const unscheduled: number[] = [];
    const start = new Date(startDate);
    let taskIndex = 0;

    for (let day = 0; day < numDays && taskIndex < tasks.length; day++) {
      const date = new Date(start);
      date.setDate(date.getDate() + day);
      const dateStr = date.toISOString().split('T')[0];

      for (const person of people) {
        if (taskIndex >= tasks.length) break;
        const assignments: ScheduleResult['schedules'][0]['assignments'] = [];
        let tasksToday = 0;

        while (taskIndex < tasks.length && tasksToday < person.max_tasks_per_day) {
          const task = tasks[taskIndex];
          const totalMins = task.estimated_hours * 60 + task.estimated_minutes || 60;
          const startHour = 9 + tasksToday * 2;
          const endHour = startHour + Math.ceil(totalMins / 60);
          assignments.push({
            task_id: task.id,
            task_name: task.name,
            start_time: `${String(startHour).padStart(2, '0')}:00`,
            end_time: `${String(Math.min(endHour, 18)).padStart(2, '0')}:00`,
            is_grouped: false,
            grouped_task_ids: [],
            group_description: '',
            estimated_minutes: totalMins,
            notes: 'Rule-based assignment',
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
      reasoning: 'Rule-based fallback schedule (not signed in to GitHub)',
      warnings: unscheduled.length > 0 ? [`${unscheduled.length} tasks could not be scheduled in ${numDays} days`] : [],
      ai_model: 'rule-based',
      generated_at: new Date().toISOString(),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private extractJson<T>(content: string): T | null {
    // Try direct parse first
    try {
      return JSON.parse(content) as T;
    } catch { /* fall through */ }

    // Try regex extraction
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch { /* fall through */ }
    }
    return null;
  }
}
