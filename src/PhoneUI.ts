import { Sport, SPORTS_CONFIG } from './types';

type SportsChangeCallback = (enabledSports: Sport[]) => void;

const STORAGE_KEY = 'enabled-sports';

export class PhoneUI {
  private listContainer: HTMLElement;
  private statusEl: HTMLElement;
  private enabledIds: Set<string>;
  private availableSports: Sport[] = [...SPORTS_CONFIG];
  private onSportsChange: SportsChangeCallback | null = null;

  constructor() {
    this.listContainer = document.getElementById('sport-list')!;
    this.statusEl = document.getElementById('status')!;
    this.enabledIds = this.loadEnabledIds();
    this.buildList();
  }

  setOnSportsChange(cb: SportsChangeCallback): void {
    this.onSportsChange = cb;
  }

  setStatus(msg: string, ok: boolean): void {
    this.statusEl.textContent = msg;
    this.statusEl.className = ok ? 'connected' : '';
  }

  setAvailableSports(sports: Sport[]): void {
    this.availableSports = sports;
    const availableIds = new Set(sports.map((s) => s.id));
    const validIds = [...this.enabledIds].filter((id) => availableIds.has(id));
    this.enabledIds = validIds.length > 0 ? new Set(validIds) : new Set(sports.map((s) => s.id));
    this.saveEnabledIds();
    this.buildList();
  }

  getEnabledSports(): Sport[] {
    return this.availableSports.filter((s) => this.enabledIds.has(s.id));
  }

  private loadEnabledIds(): Set<string> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        const valid = ids.filter((id) => this.availableSports.some((s) => s.id === id));
        if (valid.length > 0) return new Set(valid);
      }
    } catch {
      /* ignore */
    }
    return new Set(this.availableSports.map((s) => s.id));
  }

  private saveEnabledIds(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.enabledIds]));
    } catch {
      /* ignore */
    }
  }

  private buildList(): void {
    this.listContainer.textContent = '';

    if (this.availableSports.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'no-tournaments';
      msg.textContent = 'No active tournaments';
      this.listContainer.appendChild(msg);
      return;
    }

    for (const sport of this.availableSports) {
      const row = document.createElement('label');
      row.className = 'sport-row';

      const info = document.createElement('div');
      info.className = 'sport-info';

      const icon = document.createElement('span');
      icon.className = 'sport-icon';
      icon.textContent = sport.icon;
      info.appendChild(icon);

      const details = document.createElement('div');
      details.className = 'sport-details';

      const name = document.createElement('span');
      name.className = 'sport-name';
      name.textContent = sport.name;
      details.appendChild(name);

      const compCount = document.createElement('span');
      compCount.className = 'sport-competitions';
      compCount.textContent = `${sport.competitions.length} competition${sport.competitions.length !== 1 ? 's' : ''}`;
      details.appendChild(compCount);

      info.appendChild(details);
      row.appendChild(info);

      const toggle = document.createElement('div');
      toggle.className = 'toggle';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.enabledIds.has(sport.id);
      checkbox.addEventListener('change', () => this.toggleSport(sport.id, checkbox.checked));
      toggle.appendChild(checkbox);

      const slider = document.createElement('span');
      slider.className = 'toggle-slider';
      toggle.appendChild(slider);

      row.appendChild(toggle);
      this.listContainer.appendChild(row);
    }
  }

  private toggleSport(sportId: string, enabled: boolean): void {
    if (enabled) {
      this.enabledIds.add(sportId);
    } else {
      if (this.enabledIds.size <= 1) {
        this.buildList();
        return;
      }
      this.enabledIds.delete(sportId);
    }
    this.saveEnabledIds();
    this.onSportsChange?.(this.getEnabledSports());
  }
}
