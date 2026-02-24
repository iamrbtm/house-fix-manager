/**
 * Text/PDF heuristic parser for task lists.
 * Ported from text_parser.py in the original Flask app.
 */

export interface ParsedTask {
  name: string;
  description: string;
  room: string;
}

export interface ParseResult {
  tasks: ParsedTask[];
  rooms: string[];
  warnings: string[];
}

const ROOM_KEYWORDS = [
  'room', 'bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'office',
  'garage', 'basement', 'attic', 'hallway', 'laundry', 'closet', 'porch',
  'deck', 'yard', 'garden', 'exterior', 'interior', 'foyer', 'entryway',
  'playroom', 'den', 'study', 'sunroom', 'mudroom', 'pantry', 'utility',
];

const TASK_PREFIXES = /^[-•*✓✔☐☑□■▪▸→>]\s*/;
const CHECKBOX_PATTERNS = /^\[[ x]\]\s*/i;
const NUMBERED_LIST = /^\d+[.)]\s+/;

export class TaskParser {
  parse(text: string): ParseResult {
    const lines = text.split(/\r?\n/).map(l => l.trimEnd());
    const tasks: ParsedTask[] = [];
    const rooms = new Set<string>();
    const warnings: string[] = [];
    let currentRoom = 'General';
    let pendingDescription = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        pendingDescription = '';
        continue;
      }

      // Check if this looks like a room header
      if (this.isRoomHeader(trimmed, line)) {
        const roomName = this.extractRoomName(trimmed);
        currentRoom = roomName;
        rooms.add(roomName);
        pendingDescription = '';
        continue;
      }

      // Check if this looks like a task
      const taskName = this.extractTaskName(trimmed);
      if (taskName) {
        tasks.push({
          name: taskName,
          description: '',
          room: currentRoom,
        });
        rooms.add(currentRoom);
        pendingDescription = '';
        continue;
      }

      // If the line is indented or follows a task, treat as description continuation
      if (tasks.length > 0 && (line.startsWith('  ') || line.startsWith('\t'))) {
        const lastTask = tasks[tasks.length - 1];
        if (lastTask.description) {
          lastTask.description += ' ' + trimmed;
        } else {
          lastTask.description = trimmed;
        }
        continue;
      }

      // Plain text line — could be a task without formatting
      if (trimmed.length > 3 && trimmed.length < 200) {
        // Skip obvious headers/footers
        if (!this.isMetaLine(trimmed)) {
          tasks.push({
            name: trimmed,
            description: '',
            room: currentRoom,
          });
          rooms.add(currentRoom);
        }
      }
    }

    if (tasks.length === 0) {
      warnings.push('No tasks detected in the file. Check that the file contains task lists.');
    }

    return {
      tasks,
      rooms: Array.from(rooms),
      warnings,
    };
  }

  private isRoomHeader(trimmed: string, raw: string): boolean {
    // All-caps short line
    if (trimmed === trimmed.toUpperCase() && trimmed.length < 50 && /[A-Z]/.test(trimmed)) {
      return true;
    }
    // Line with no task prefix, followed by a colon
    if (trimmed.endsWith(':') && !TASK_PREFIXES.test(trimmed)) {
      return true;
    }
    // Contains room keyword and is short enough to be a header
    const lower = trimmed.toLowerCase();
    const hasRoomWord = ROOM_KEYWORDS.some(k => lower.includes(k));
    if (hasRoomWord && trimmed.length < 60 && !TASK_PREFIXES.test(trimmed) && !NUMBERED_LIST.test(trimmed)) {
      // Not starting with a verb (likely a header not a task)
      if (!/^(paint|clean|fix|repair|install|replace|check|remove|add|move|organiz)/i.test(trimmed)) {
        return true;
      }
    }
    // Non-indented, no task marker, fairly short
    if (!raw.startsWith(' ') && !raw.startsWith('\t') &&
        !TASK_PREFIXES.test(trimmed) && !NUMBERED_LIST.test(trimmed) &&
        trimmed.length < 40 && /[A-Z]/.test(trimmed[0])) {
      // Only treat as header if it reads like a heading (no verb phrase)
      if (!/[.!?]$/.test(trimmed) && !/\s(the|a|an|my|your|this|it|them)\s/i.test(trimmed)) {
        // Possibly a header — but be conservative, only if has room keyword
        return hasRoomWord;
      }
    }
    return false;
  }

  private extractRoomName(line: string): string {
    // Remove trailing colon and leading/trailing whitespace
    return line.replace(/:$/, '').trim();
  }

  private extractTaskName(trimmed: string): string | null {
    let cleaned = trimmed;

    // Strip checkbox patterns
    cleaned = cleaned.replace(CHECKBOX_PATTERNS, '');
    // Strip bullet/list prefixes
    cleaned = cleaned.replace(TASK_PREFIXES, '');
    // Strip numbered list prefix
    cleaned = cleaned.replace(NUMBERED_LIST, '');

    cleaned = cleaned.trim();

    if (cleaned.length < 3) return null;

    // If we stripped something, it was clearly a task item
    if (cleaned !== trimmed) {
      return this.capitalize(cleaned);
    }

    // Otherwise, only return if it looks like a task (starts with a verb)
    if (/^(paint|clean|fix|repair|install|replace|check|remove|add|move|organiz|wash|sand|caulk|patch|seal|hang|mount|replace|clear|sort|dust|vacuum|mop|strip|prime|finish|stain|varnish|trim|cut|build|assemble|disassemble|dispose|haul|buy|order|measure|inspect|test|update|upgrade|touch.up|re-?grout|re-?caulk|re-?paint|re-?stain|re-?finish)/i.test(cleaned)) {
      return this.capitalize(cleaned);
    }

    return null;
  }

  private isMetaLine(line: string): boolean {
    const lower = line.toLowerCase();
    // Skip page numbers, dates, metadata
    if (/^page \d+/i.test(line)) return true;
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line)) return true;
    if (/^(total|subtotal|count|items?:?\s*\d)/i.test(line)) return true;
    if (lower.includes('exported from') || lower.includes('reminders') && lower.length < 30) return true;
    return false;
  }

  private capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
