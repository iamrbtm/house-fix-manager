import { Notice } from 'obsidian';
import type HouseFixPlugin from '../main';
import type { Task, Room, Person } from '../models';

// ─── Small SVG chart helpers (no external library) ────────────────────────────

function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Resolve an Obsidian CSS variable to a concrete hex/rgb string. */
function cssVar(name: string, fallback = '#888'): string {
  return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
}

const STATUS_COLORS: Record<string, string> = {
  pending:   '--color-orange',
  assigned:  '--color-blue',
  completed: '--color-green',
};

const EFFORT_PALETTE = [
  '--color-green', '--color-green', '--color-green', '--color-green',
  '--color-yellow', '--color-yellow', '--color-yellow',
  '--color-orange', '--color-orange', '--color-red',
];

// ─── ReportsView ──────────────────────────────────────────────────────────────

export class ReportsView {
  private el: HTMLElement;
  private plugin: HouseFixPlugin;

  constructor(el: HTMLElement, plugin: HouseFixPlugin) {
    this.el = el;
    this.plugin = plugin;
  }

  render() {
    this.el.empty();
    this.el.addClass('hf-view');

    // ── Header ────────────────────────────────────────────────────────────────
    const header = this.el.createDiv({ cls: 'hf-view-header' });
    header.createEl('h2', { text: 'Reports', cls: 'hf-view-title' });
    const btnRow = header.createDiv({ cls: 'hf-report-export-btns' });
    const exportBtn = btnRow.createEl('button', { text: '⬇ Export PDF', cls: 'hf-btn hf-btn-secondary' });
    exportBtn.addEventListener('click', () => this.exportPdf());
    const mdBtn = btnRow.createEl('button', { text: '📝 Save as Note', cls: 'hf-btn hf-btn-secondary' });
    mdBtn.addEventListener('click', () => this.saveAsMarkdown());

    // ── Gather data ───────────────────────────────────────────────────────────
    const tasks   = this.plugin.db.getTasks();
    const rooms   = this.plugin.db.getRooms();
    const people  = this.plugin.db.getPeople();
    const stats   = this.plugin.db.getStats();
    const schedules = this.plugin.db.getSchedules();

    if (tasks.length === 0) {
      const empty = this.el.createDiv({ cls: 'hf-empty-state' });
      empty.createEl('div', { text: '📊', cls: 'hf-empty-icon' });
      empty.createEl('p', { text: 'No tasks yet. Add some tasks to see your reports.' });
      return;
    }

    const body = this.el.createDiv({ cls: 'hf-report-body' });

    // ── Section 1: Summary KPI cards ──────────────────────────────────────────
    this.renderSection(body, '📊 Overview', section => {
      const kpis = section.createDiv({ cls: 'hf-kpi-grid' });

      const totalHours = tasks.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
      const completedHours = tasks
        .filter(t => t.status === 'completed')
        .reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
      const avgEffort = tasks.length
        ? (tasks.reduce((s, t) => s + t.effort_level, 0) / tasks.length)
        : 0;
      const completionRate = stats.total ? (stats.completed / stats.total) * 100 : 0;
      const outdoorCount = tasks.filter(t => t.outdoor).length;
      const withMaterials = tasks.filter(t => t.materials.length > 0).length;

      this.kpi(kpis, 'Total Tasks',       String(stats.total),                  'hf-kpi-blue');
      this.kpi(kpis, 'Completed',         `${stats.completed}`,                  'hf-kpi-green', `${completionRate.toFixed(0)}% done`);
      this.kpi(kpis, 'In Progress',       `${stats.assigned}`,                   'hf-kpi-orange');
      this.kpi(kpis, 'Pending',           `${stats.pending}`,                    'hf-kpi-muted');
      this.kpi(kpis, 'Total Est. Hours',  `${totalHours.toFixed(1)} h`,          'hf-kpi-blue');
      this.kpi(kpis, 'Hours Completed',   `${completedHours.toFixed(1)} h`,      'hf-kpi-green');
      this.kpi(kpis, 'Avg Effort Level',  `${avgEffort.toFixed(1)} / 10`,        'hf-kpi-orange');
      this.kpi(kpis, 'Rooms',            `${rooms.length}`,                      'hf-kpi-muted');
      this.kpi(kpis, 'Outdoor Tasks',     `${outdoorCount}`,                     'hf-kpi-muted');
      this.kpi(kpis, 'Tasks w/ Materials',`${withMaterials}`,                    'hf-kpi-muted');
      this.kpi(kpis, 'People',            `${people.length}`,                    'hf-kpi-muted');
      this.kpi(kpis, 'Schedules',         `${schedules.length}`,                 'hf-kpi-muted');
    });

    // ── Section 2: Status breakdown ───────────────────────────────────────────
    this.renderSection(body, '✅ Task Status Breakdown', section => {
      const row = section.createDiv({ cls: 'hf-report-row' });

      // Donut chart
      const chartWrap = row.createDiv({ cls: 'hf-chart-wrap' });
      this.renderDonut(chartWrap, [
        { label: 'Pending',   value: stats.pending,   colorVar: '--color-orange' },
        { label: 'Assigned',  value: stats.assigned,  colorVar: '--color-blue'   },
        { label: 'Completed', value: stats.completed, colorVar: '--color-green'  },
      ], 'Tasks by Status');

      // Table
      const tableWrap = row.createDiv({ cls: 'hf-report-table-wrap' });
      const tbl = this.makeTable(tableWrap, ['Status', 'Count', 'Est. Hours', '% of Total']);
      for (const [status, colorVar] of [
        ['pending',   '--color-orange'],
        ['assigned',  '--color-blue'],
        ['completed', '--color-green'],
      ] as const) {
        const group = tasks.filter(t => t.status === status);
        const hrs = group.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
        const pct = stats.total ? ((group.length / stats.total) * 100).toFixed(1) : '0.0';
        const label = status.charAt(0).toUpperCase() + status.slice(1);
        this.tableRow(tbl, [this.dotCell(colorVar, label), String(group.length), `${hrs.toFixed(1)} h`, `${pct}%`]);
      }
    });

    // ── Section 3: Per-room breakdown ─────────────────────────────────────────
    this.renderSection(body, '🏠 Progress by Room', section => {
      if (rooms.length === 0) { section.createEl('p', { text: 'No rooms yet.', cls: 'hf-hint' }); return; }

      const row = section.createDiv({ cls: 'hf-report-row' });
      const chartWrap = row.createDiv({ cls: 'hf-chart-wrap hf-chart-wrap-wide' });

      // Stacked horizontal bar chart per room
      this.renderStackedBars(chartWrap, rooms, tasks);

      // Room table
      const tableWrap = row.createDiv({ cls: 'hf-report-table-wrap' });
      const tbl = this.makeTable(tableWrap, ['Room', 'Total', 'Done', '% Done', 'Est. Hrs']);
      const sorted = [...rooms].sort((a, b) => b.task_count - a.task_count);
      for (const r of sorted) {
        const roomTasks = tasks.filter(t => t.room === r.name);
        const hrs = roomTasks.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
        const pct = r.task_count ? ((r.completed_count / r.task_count) * 100).toFixed(0) : '0';
        const icon = r.outdoor ? '🌿 ' : '🏠 ';
        this.tableRow(tbl, [icon + r.name, String(r.task_count), String(r.completed_count), `${pct}%`, `${hrs.toFixed(1)} h`]);
      }
    });

    // ── Section 4: Effort distribution ───────────────────────────────────────
    this.renderSection(body, '💪 Effort Level Distribution', section => {
      const row = section.createDiv({ cls: 'hf-report-row' });

      // Bar chart 1–10
      const chartWrap = row.createDiv({ cls: 'hf-chart-wrap hf-chart-wrap-wide' });
      const effortBuckets: number[] = Array(10).fill(0);
      for (const t of tasks) effortBuckets[Math.max(0, Math.min(9, t.effort_level - 1))]++;
      this.renderBarChart(chartWrap, effortBuckets.map((v, i) => ({
        label: String(i + 1),
        value: v,
        colorVar: EFFORT_PALETTE[i],
      })), 'Tasks per Effort Level (1 = easiest, 10 = hardest)');

      // Stats table
      const tableWrap = row.createDiv({ cls: 'hf-report-table-wrap' });
      const tbl = this.makeTable(tableWrap, ['Effort', 'Tasks', 'Est. Hours', 'Avg Hours/Task']);
      for (let level = 1; level <= 10; level++) {
        const group = tasks.filter(t => t.effort_level === level);
        if (group.length === 0) continue;
        const hrs = group.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
        const avg = hrs / group.length;
        this.tableRow(tbl, [`Level ${level}`, String(group.length), `${hrs.toFixed(1)} h`, `${avg.toFixed(1)} h`]);
      }
    });

    // ── Section 5: Time estimates ─────────────────────────────────────────────
    this.renderSection(body, '⏱ Time Estimates', section => {
      const row = section.createDiv({ cls: 'hf-report-row' });

      // Bucket tasks into time ranges
      const buckets: Record<string, Task[]> = {
        '< 1 h':   tasks.filter(t => (t.estimated_hours + t.estimated_minutes / 60) < 1),
        '1–2 h':   tasks.filter(t => { const h = t.estimated_hours + t.estimated_minutes/60; return h >= 1 && h < 2; }),
        '2–4 h':   tasks.filter(t => { const h = t.estimated_hours + t.estimated_minutes/60; return h >= 2 && h < 4; }),
        '4–8 h':   tasks.filter(t => { const h = t.estimated_hours + t.estimated_minutes/60; return h >= 4 && h < 8; }),
        '8+ h':    tasks.filter(t => (t.estimated_hours + t.estimated_minutes / 60) >= 8),
        'No est.': tasks.filter(t => t.estimated_hours === 0 && t.estimated_minutes === 0),
      };
      const bucketColors = ['--color-green','--color-blue','--color-yellow','--color-orange','--color-red','--text-faint'];

      const chartWrap = row.createDiv({ cls: 'hf-chart-wrap' });
      this.renderDonut(chartWrap, Object.entries(buckets).map(([label, arr], i) => ({
        label,
        value: arr.length,
        colorVar: bucketColors[i],
      })).filter(b => b.value > 0), 'Tasks by Duration');

      const tableWrap = row.createDiv({ cls: 'hf-report-table-wrap' });
      const tbl = this.makeTable(tableWrap, ['Duration Range', 'Tasks', 'Total Hours']);
      for (const [label, group] of Object.entries(buckets)) {
        if (group.length === 0) continue;
        const hrs = group.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
        this.tableRow(tbl, [label, String(group.length), `${hrs.toFixed(1)} h`]);
      }
    });

    // ── Section 6: Top rooms by hours ─────────────────────────────────────────
    this.renderSection(body, '🏆 Top Rooms by Estimated Work', section => {
      const roomHours = rooms.map(r => {
        const roomTasks = tasks.filter(t => t.room === r.name);
        return {
          name: r.name,
          total: roomTasks.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0),
          remaining: roomTasks
            .filter(t => t.status !== 'completed')
            .reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0),
        };
      }).filter(r => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);

      const chartWrap = section.createDiv({ cls: 'hf-chart-wrap hf-chart-wrap-full' });
      this.renderBarChart(chartWrap, roomHours.map((r, i) => ({
        label: r.name.length > 14 ? r.name.slice(0, 12) + '…' : r.name,
        value: r.total,
        colorVar: '--interactive-accent',
      })), 'Estimated Hours per Room');

      const tbl = this.makeTable(section, ['Room', 'Total Hours', 'Remaining', 'Hours Done']);
      for (const r of roomHours) {
        const done = r.total - r.remaining;
        this.tableRow(tbl, [r.name, `${r.total.toFixed(1)} h`, `${r.remaining.toFixed(1)} h`, `${done.toFixed(1)} h`]);
      }
    });

    // ── Section 7: Materials master list ─────────────────────────────────────
    this.renderSection(body, '🧰 Materials Summary', section => {
      const materialMap = new Map<string, { count: number; tasks: string[] }>();
      for (const t of tasks) {
        for (const m of t.materials) {
          const key = m.trim().toLowerCase();
          if (!key) continue;
          if (!materialMap.has(key)) materialMap.set(key, { count: 0, tasks: [] });
          materialMap.get(key)!.count++;
          materialMap.get(key)!.tasks.push(t.name);
        }
      }

      if (materialMap.size === 0) {
        section.createEl('p', { text: 'No materials data yet. Run AI analysis on tasks to populate this.', cls: 'hf-hint' });
        return;
      }

      const sorted = [...materialMap.entries()].sort((a, b) => b[1].count - a[1].count);
      const top20 = sorted.slice(0, 20);

      const row = section.createDiv({ cls: 'hf-report-row' });

      const chartWrap = row.createDiv({ cls: 'hf-chart-wrap hf-chart-wrap-wide' });
      this.renderBarChart(chartWrap, top20.map(([label, data]) => ({
        label: label.length > 16 ? label.slice(0, 14) + '…' : label,
        value: data.count,
        colorVar: '--interactive-accent',
      })), `Top ${top20.length} Materials by Frequency`);

      const tableWrap = row.createDiv({ cls: 'hf-report-table-wrap' });
      const tbl = this.makeTable(tableWrap, ['Material', 'Tasks Needing It', 'Task Names']);
      for (const [mat, data] of top20) {
        const displayMat = mat.charAt(0).toUpperCase() + mat.slice(1);
        const taskNames = data.tasks.slice(0, 3).join(', ') + (data.tasks.length > 3 ? ` +${data.tasks.length - 3} more` : '');
        this.tableRow(tbl, [displayMat, String(data.count), taskNames]);
      }
    });

    // ── Section 8: People & schedules ────────────────────────────────────────
    if (people.length > 0) {
      this.renderSection(body, '👥 People & Workload', section => {
        const tbl = this.makeTable(section, ['Person', 'Assigned Tasks', 'Est. Hours Assigned', 'Scheduled Days', 'Max Tasks/Day']);
        for (const p of people) {
          const personSchedules = schedules.filter(s => s.person_id === p.id);
          const assignedTaskIds = new Set(
            personSchedules.flatMap(s => (s.assignments ?? []).map(a => a.task_id))
          );
          const assignedTasks = tasks.filter(t => assignedTaskIds.has(t.id));
          const hrs = assignedTasks.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
          const days = new Set(personSchedules.map(s => s.schedule_date)).size;
          this.tableRow(tbl, [
            p.name,
            String(assignedTaskIds.size),
            `${hrs.toFixed(1)} h`,
            String(days),
            String(p.max_tasks_per_day),
          ]);
        }
      });
    }

    // ── Section 9: All tasks detail table ────────────────────────────────────
    this.renderSection(body, '📋 All Tasks Detail', section => {
      const tbl = this.makeTable(section, ['Task', 'Room', 'Status', 'Effort', 'Est. Time', 'Outdoor', 'Materials']);
      const sorted = [...tasks].sort((a, b) => a.room.localeCompare(b.room) || a.name.localeCompare(b.name));
      for (const t of sorted) {
        const mins = t.estimated_hours * 60 + t.estimated_minutes;
        const timeStr = mins === 0 ? '—' : mins < 60 ? `${mins}m` : `${t.estimated_hours}h${t.estimated_minutes > 0 ? ` ${t.estimated_minutes}m` : ''}`;
        this.tableRow(tbl, [
          t.name,
          t.room,
          t.status,
          String(t.effort_level),
          timeStr,
          t.outdoor ? 'Yes' : 'No',
          t.materials.length ? t.materials.slice(0, 3).join(', ') + (t.materials.length > 3 ? ` +${t.materials.length - 3}` : '') : '—',
        ]);
      }
    });

    // ── Footer ────────────────────────────────────────────────────────────────
    const footer = body.createDiv({ cls: 'hf-report-footer' });
    footer.createEl('span', { text: `Generated ${new Date().toLocaleString()}`, cls: 'hf-hint' });
  }

  // ─── Layout helpers ───────────────────────────────────────────────────────

  private renderSection(parent: HTMLElement, title: string, cb: (el: HTMLElement) => void) {
    const section = parent.createDiv({ cls: 'hf-report-section' });
    section.createEl('h3', { text: title, cls: 'hf-report-section-title' });
    cb(section);
  }

  private kpi(parent: HTMLElement, label: string, value: string, colorCls: string, sub?: string) {
    const card = parent.createDiv({ cls: `hf-kpi-card ${colorCls}` });
    card.createEl('div', { text: value, cls: 'hf-kpi-value' });
    card.createEl('div', { text: label, cls: 'hf-kpi-label' });
    if (sub) card.createEl('div', { text: sub, cls: 'hf-kpi-sub' });
  }

  private makeTable(parent: HTMLElement, headers: string[]): HTMLElement {
    const wrap = parent.createDiv({ cls: 'hf-report-table-scroll' });
    const tbl = wrap.createEl('table', { cls: 'hf-report-table' });
    const thead = tbl.createEl('thead');
    const tr = thead.createEl('tr');
    for (const h of headers) tr.createEl('th', { text: h });
    tbl.createEl('tbody');
    return tbl;
  }

  private tableRow(tbl: HTMLElement, cells: Array<string | HTMLElement>) {
    const tbody = tbl.querySelector('tbody')!;
    const tr = tbody.createEl('tr');
    for (const c of cells) {
      const td = tr.createEl('td');
      if (c instanceof HTMLElement) {
        td.appendChild(c);
      } else {
        td.textContent = c;
      }
    }
  }

  /** Build a cell fragment with a colored dot followed by text. */
  private dotCell(colorVar: string, text: string): HTMLElement {
    const wrap = document.createDocumentFragment() as unknown as HTMLElement;
    const dot = document.createElement('span');
    dot.style.color = cssVar(colorVar);
    dot.textContent = '● ';
    const span = document.createElement('span');
    span.textContent = text;
    (wrap as unknown as DocumentFragment).appendChild(dot);
    (wrap as unknown as DocumentFragment).appendChild(span);
    // Return a wrapper div so it can be appended easily
    const container = document.createElement('span');
    container.appendChild(dot);
    container.appendChild(span);
    return container;
  }

  // ─── SVG Charts ──────────────────────────────────────────────────────────

  /** Animated donut/pie chart with a legend. */
  private renderDonut(
    parent: HTMLElement,
    slices: Array<{ label: string; value: number; colorVar: string }>,
    title: string,
  ) {
    const total = slices.reduce((s, x) => s + x.value, 0);
    if (total === 0) { parent.createEl('p', { text: 'No data.', cls: 'hf-hint' }); return; }

    parent.createEl('div', { text: title, cls: 'hf-chart-title' });

    const SIZE = 160;
    const R = 54;
    const CX = SIZE / 2, CY = SIZE / 2;

    const svg = svgEl('svg', { width: SIZE, height: SIZE, viewBox: `0 0 ${SIZE} ${SIZE}` });
    parent.appendChild(svg);

    let angle = -Math.PI / 2;
    for (const s of slices) {
      if (s.value === 0) continue;
      const sweep = (s.value / total) * 2 * Math.PI;
      const endAngle = angle + sweep;
      const x1 = CX + R * Math.cos(angle);
      const y1 = CY + R * Math.sin(angle);
      const x2 = CX + R * Math.cos(endAngle);
      const y2 = CY + R * Math.sin(endAngle);
      const large = sweep > Math.PI ? 1 : 0;
      const path = svgEl('path', {
        d: `M${CX},${CY} L${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} Z`,
        fill: cssVar(s.colorVar),
        opacity: '0.9',
      });
      svg.appendChild(path);
      angle = endAngle;
    }

    // Center hole (donut)
    svg.appendChild(svgEl('circle', { cx: CX, cy: CY, r: R * 0.5, fill: cssVar('--background-primary') }));

    // Center label
    const txt = svgEl('text', { x: CX, y: CY + 5, 'text-anchor': 'middle', fill: cssVar('--text-normal'), 'font-size': '14', 'font-weight': 'bold' });
    txt.textContent = String(total);
    svg.appendChild(txt);

    // Legend
    const legend = parent.createDiv({ cls: 'hf-chart-legend' });
    for (const s of slices) {
      if (s.value === 0) continue;
      const item = legend.createDiv({ cls: 'hf-legend-item' });
      const dot = item.createEl('span', { cls: 'hf-legend-dot' });
      dot.style.background = cssVar(s.colorVar);
      item.createEl('span', { text: `${s.label}: ${s.value} (${((s.value / total) * 100).toFixed(1)}%)`, cls: 'hf-legend-label' });
    }
  }

  /** Vertical bar chart. */
  private renderBarChart(
    parent: HTMLElement,
    bars: Array<{ label: string; value: number; colorVar: string }>,
    title: string,
  ) {
    const max = Math.max(...bars.map(b => b.value), 1);
    parent.createEl('div', { text: title, cls: 'hf-chart-title' });

    const chart = parent.createDiv({ cls: 'hf-bar-chart' });
    for (const b of bars) {
      const col = chart.createDiv({ cls: 'hf-bar-col' });
      const barWrap = col.createDiv({ cls: 'hf-bar-wrap' });

      // Value label above bar
      barWrap.createEl('span', { text: b.value > 0 ? String(b.value) : '', cls: 'hf-bar-val' });

      const bar = barWrap.createDiv({ cls: 'hf-bar' });
      const pct = (b.value / max) * 100;
      bar.style.height = `${Math.max(pct, b.value > 0 ? 4 : 0)}%`;
      bar.style.background = cssVar(b.colorVar);

      col.createEl('span', { text: b.label, cls: 'hf-bar-label' });
    }
  }

  /** Stacked horizontal progress bars per room. */
  private renderStackedBars(parent: HTMLElement, rooms: Room[], tasks: Task[]) {
    parent.createEl('div', { text: 'Task status per room', cls: 'hf-chart-title' });

    const sorted = [...rooms].sort((a, b) => b.task_count - a.task_count).slice(0, 15);
    const chart = parent.createDiv({ cls: 'hf-stacked-chart' });

    for (const room of sorted) {
      const roomTasks = tasks.filter(t => t.room === room.name);
      const total = roomTasks.length;
      if (total === 0) continue;

      const pending   = roomTasks.filter(t => t.status === 'pending').length;
      const assigned  = roomTasks.filter(t => t.status === 'assigned').length;
      const completed = roomTasks.filter(t => t.status === 'completed').length;

      const row = chart.createDiv({ cls: 'hf-stacked-row' });
      const namEl = row.createEl('span', { text: room.name, cls: 'hf-stacked-label' });
      if (room.outdoor) namEl.title = 'Outdoor';

      const barOuter = row.createDiv({ cls: 'hf-stacked-bar-outer' });

      if (completed) {
        const seg = barOuter.createDiv({ cls: 'hf-stacked-seg' });
        seg.style.width  = `${(completed / total) * 100}%`;
        seg.style.background = cssVar('--color-green');
        seg.title = `Completed: ${completed}`;
      }
      if (assigned) {
        const seg = barOuter.createDiv({ cls: 'hf-stacked-seg' });
        seg.style.width  = `${(assigned / total) * 100}%`;
        seg.style.background = cssVar('--color-blue');
        seg.title = `Assigned: ${assigned}`;
      }
      if (pending) {
        const seg = barOuter.createDiv({ cls: 'hf-stacked-seg' });
        seg.style.width  = `${(pending / total) * 100}%`;
        seg.style.background = cssVar('--color-orange', '#f59e0b');
        seg.title = `Pending: ${pending}`;
      }

      row.createEl('span', { text: `${completed}/${total}`, cls: 'hf-stacked-count' });
    }

    // Legend
    const legend = parent.createDiv({ cls: 'hf-chart-legend' });
    for (const [label, cv] of [['Completed', '--color-green'], ['Assigned', '--color-blue'], ['Pending', '--color-orange']] as const) {
      const item = legend.createDiv({ cls: 'hf-legend-item' });
      const dot = item.createEl('span', { cls: 'hf-legend-dot' });
      dot.style.background = cssVar(cv, '#888');
      item.createEl('span', { text: label, cls: 'hf-legend-label' });
    }
  }

  // ─── PDF Export ───────────────────────────────────────────────────────────

  private exportPdf() {
    // Collect the rendered report HTML
    const reportBody = this.el.querySelector('.hf-report-body');
    if (!reportBody) { new Notice('Nothing to export yet.'); return; }

    // Grab all stylesheets from the current document so charts/tables render correctly
    const styleSheets = Array.from(document.styleSheets)
      .map(ss => {
        try {
          return Array.from(ss.cssRules).map(r => r.cssText).join('\n');
        } catch { return ''; }
      })
      .join('\n');

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

    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      new Notice('Could not open print window. Check your popup blocker settings.');
      return;
    }
    popup.document.write(html);
    popup.document.close();
    // Give SVG charts a moment to paint before triggering print
    popup.onload = () => {
      setTimeout(() => {
        popup.focus();
        popup.print();
      }, 400);
    };
    // Fallback if onload already fired
    setTimeout(() => {
      if (!popup.closed) {
        popup.focus();
        popup.print();
      }
    }, 800);
  }

  // ─── Save as Markdown ─────────────────────────────────────────────────────

  private async saveAsMarkdown() {
    const md = this.generateMarkdown();
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `House Fix Report ${date}.md`;
    const vault = this.plugin.app.vault;

    try {
      const existing = vault.getAbstractFileByPath(fileName);
      if (existing) {
        await vault.modify(existing as import('obsidian').TFile, md);
        new Notice(`Updated "${fileName}" in vault.`);
      } else {
        await vault.create(fileName, md);
        new Notice(`Saved "${fileName}" to vault.`);
      }
      // Open the new note
      const file = vault.getAbstractFileByPath(fileName);
      if (file) {
        await this.plugin.app.workspace.getLeaf(true).openFile(file as import('obsidian').TFile);
      }
    } catch (e) {
      new Notice(`Failed to save note: ${(e as Error).message}`);
    }
  }

  private generateMarkdown(): string {
    const tasks    = this.plugin.db.getTasks();
    const rooms    = this.plugin.db.getRooms();
    const people   = this.plugin.db.getPeople();
    const stats    = this.plugin.db.getStats();
    const schedules = this.plugin.db.getSchedules();
    const date     = new Date().toLocaleString();

    const totalHours = tasks.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
    const completedHours = tasks
      .filter(t => t.status === 'completed')
      .reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
    const avgEffort = tasks.length
      ? (tasks.reduce((s, t) => s + t.effort_level, 0) / tasks.length).toFixed(1)
      : '0';
    const completionRate = stats.total ? ((stats.completed / stats.total) * 100).toFixed(0) : '0';

    const lines: string[] = [];

    lines.push(`# House Fix Report`);
    lines.push(`*Generated: ${date}*`);
    lines.push('');

    // Overview
    lines.push('## Overview');
    lines.push('');
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
    lines.push('');

    // Progress by Room
    lines.push('## Progress by Room');
    lines.push('');
    lines.push('| Room | Total | Done | % Done | Est. Hrs |');
    lines.push('|---|---|---|---|---|');
    const sortedRooms = [...rooms].sort((a, b) => b.task_count - a.task_count);
    for (const r of sortedRooms) {
      const roomTasks = tasks.filter(t => t.room === r.name);
      const hrs = roomTasks.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
      const pct = r.task_count ? ((r.completed_count / r.task_count) * 100).toFixed(0) : '0';
      const icon = r.outdoor ? '🌿' : '🏠';
      lines.push(`| ${icon} ${r.name} | ${r.task_count} | ${r.completed_count} | ${pct}% | ${hrs.toFixed(1)} h |`);
    }
    lines.push('');

    // People & Workload
    if (people.length > 0) {
      lines.push('## People & Workload');
      lines.push('');
      lines.push('| Person | Assigned Tasks | Est. Hours | Scheduled Days | Max Tasks/Day |');
      lines.push('|---|---|---|---|---|');
      for (const p of people) {
        const personSchedules = schedules.filter(s => s.person_id === p.id);
        const assignedTaskIds = new Set(
          personSchedules.flatMap(s => (s.assignments ?? []).map(a => a.task_id))
        );
        const assignedTasks = tasks.filter(t => assignedTaskIds.has(t.id));
        const hrs = assignedTasks.reduce((s, t) => s + t.estimated_hours + t.estimated_minutes / 60, 0);
        const days = new Set(personSchedules.map(s => s.schedule_date)).size;
        lines.push(`| ${p.name} | ${assignedTaskIds.size} | ${hrs.toFixed(1)} h | ${days} | ${p.max_tasks_per_day} |`);
      }
      lines.push('');
    }

    // All Tasks Detail
    lines.push('## All Tasks Detail');
    lines.push('');
    lines.push('| Task | Room | Status | Effort | Est. Time | Outdoor | Materials |');
    lines.push('|---|---|---|---|---|---|---|');
    const sortedTasks = [...tasks].sort((a, b) => a.room.localeCompare(b.room) || a.name.localeCompare(b.name));
    for (const t of sortedTasks) {
      const mins = t.estimated_hours * 60 + t.estimated_minutes;
      const timeStr = mins === 0 ? '—' : mins < 60 ? `${mins}m` : `${t.estimated_hours}h${t.estimated_minutes > 0 ? ` ${t.estimated_minutes}m` : ''}`;
      const mats = t.materials.length ? t.materials.join(', ') : '—';
      lines.push(`| ${t.name} | ${t.room} | ${t.status} | ${t.effort_level}/10 | ${timeStr} | ${t.outdoor ? 'Yes' : 'No'} | ${mats} |`);
    }
    lines.push('');
    lines.push(`---`);
    lines.push(`*House Fix Manager plugin*`);

    return lines.join('\n');
  }
}
