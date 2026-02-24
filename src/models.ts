// Data models mirroring the existing Flask/SQLAlchemy models
// (ShoppingCartItem and PriceCache excluded — cart feature not included)

export type TaskStatus = 'pending' | 'assigned' | 'completed';
export type ScheduleStatus = 'draft' | 'confirmed' | 'in_progress' | 'completed';
export type EffortLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface Task {
  id: number;
  name: string;
  description: string;
  room: string;
  estimated_hours: number;
  estimated_minutes: number;
  effort_level: number;
  materials: string[];       // stored as JSON string in DB
  status: TaskStatus;
  outdoor: boolean;
  shared_task_id: number | null;
  created_at: string;        // ISO date string
}

export interface Person {
  id: number;
  name: string;
  availability: PersonAvailability;  // stored as JSON string in DB
  max_tasks_per_day: number;
  physical_limitations: string;
  created_at: string;
}

// Availability: maps day name → array of time slots with effort capacity
export type TimeSlot = {
  start: string;    // "09:00"
  end: string;      // "12:00"
  effort_capacity: number;  // 1–10
};
export type PersonAvailability = Record<string, TimeSlot[]>;

export interface SharedTask {
  id: number;
  name: string;
  description: string;
  room: string;
  estimated_hours: number;
  estimated_minutes: number;
  effort_level: number;
  materials: string[];
  status: TaskStatus;
  outdoor: boolean;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: number;
  person_id: number;
  schedule_date: string;   // "YYYY-MM-DD"
  status: ScheduleStatus;
  ai_generated: boolean;
  generation_metadata: Record<string, unknown>;
  assignments?: TaskAssignment[];
}

export interface TaskAssignment {
  id: number;
  schedule_id: number;
  task_id: number;
  start_time: string;      // "09:00"
  end_time: string;        // "11:30"
  is_grouped: boolean;
  grouped_task_ids: number[];
  group_description: string;
  estimated_minutes: number;
  notes: string;
  order: number;
  // Joined fields (not stored)
  task_name?: string;
  task_room?: string;
}

export interface Room {
  name: string;
  outdoor: boolean;
  task_count: number;
  completed_count: number;
  sort_order: number;
}

// AI analysis result
export interface TaskAnalysis {
  time_hours: number;
  time_minutes: number;
  effort_level: number;
  materials: string[];
  enhanced_description: string;
  reasoning: string;
}

// AI schedule generation result
export interface ScheduleResult {
  schedules: Array<{
    person_id: number;
    person_name: string;
    date: string;
    assignments: Array<{
      task_id: number;
      task_name: string;
      start_time: string;
      end_time: string;
      is_grouped: boolean;
      grouped_task_ids?: number[];
      group_description?: string;
      estimated_minutes: number;
      notes: string;
    }>;
  }>;
  task_groupings: unknown[];
  unscheduled_tasks: number[];
  reasoning: string;
  warnings: string[];
  ai_model: string;
  generated_at: string;
}

// Plugin settings
export interface HouseFixSettings {
  /** OAuth access token obtained via GitHub Device Flow */
  githubAccessToken: string;
  /** Display name / login of the signed-in GitHub user */
  githubUser: string;
  githubModel: string;
  dbFileName: string;
  /** Set of room names the user has collapsed on the dashboard */
  collapsedRooms: string[];
}

export const DEFAULT_SETTINGS: HouseFixSettings = {
  githubAccessToken: '',
  githubUser: '',
  githubModel: 'gpt-4o-mini',
  dbFileName: 'house-fix.json',
  collapsedRooms: [],
};

export const GITHUB_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Recommended)' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'o1-mini', label: 'o1 Mini' },
  { value: 'o1-preview', label: 'o1 Preview' },
];

export const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];
