import { Sport, Match, SPORTS_CONFIG } from './types';

type SportSelectCallback = (sport: Sport) => void;

export class PhoneUI {
  private tabsContainer: HTMLElement;
  private scoresContainer: HTMLElement;
  private statusEl: HTMLElement;
  private activeSportId: string | null = null;
  private onSportSelect: SportSelectCallback | null = null;

  constructor() {
    this.tabsContainer = document.getElementById('sport-tabs')!;
    this.scoresContainer = document.getElementById('scores-container')!;
    this.statusEl = document.getElementById('status')!;
    this.buildTabs();
  }

  setOnSportSelect(cb: SportSelectCallback): void {
    this.onSportSelect = cb;
  }

  setStatus(msg: string, ok: boolean): void {
    this.statusEl.textContent = msg;
    this.statusEl.className = ok ? 'connected' : '';
  }

  private buildTabs(): void {
    for (const sport of SPORTS_CONFIG) {
      const tab = document.createElement('button');
      tab.className = 'sport-tab';
      tab.dataset.sportId = sport.id;

      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = sport.icon;
      tab.appendChild(icon);

      tab.appendChild(document.createTextNode(sport.name));

      tab.addEventListener('click', () => this.selectSport(sport));
      this.tabsContainer.appendChild(tab);
    }
  }

  private selectSport(sport: Sport): void {
    this.activeSportId = sport.id;

    const tabs = this.tabsContainer.querySelectorAll('.sport-tab');
    tabs.forEach((tab) => {
      const el = tab as HTMLElement;
      el.classList.toggle('active', el.dataset.sportId === sport.id);
    });

    this.scoresContainer.textContent = '';
    const loading = document.createElement('p');
    loading.className = 'loading-spinner';
    loading.textContent = 'Loading scores...';
    this.scoresContainer.appendChild(loading);

    this.onSportSelect?.(sport);
  }

  showScores(sport: Sport, competitionScores: Map<string, Match[]>): void {
    if (sport.id !== this.activeSportId) return;

    this.scoresContainer.textContent = '';
    let hasAnyScores = false;

    for (const comp of sport.competitions) {
      const matches = competitionScores.get(comp.id);
      if (!matches || matches.length === 0) continue;
      hasAnyScores = true;

      const section = document.createElement('div');
      section.className = 'competition-section';

      const heading = document.createElement('div');
      heading.className = 'competition-name';
      heading.textContent = comp.name;
      section.appendChild(heading);

      for (const match of matches) {
        const card = document.createElement('div');
        card.className = 'match-card';

        const teams = document.createElement('div');
        teams.className = 'match-teams';

        const home = document.createElement('div');
        home.className = 'match-team';
        home.textContent = match.homeTeam;
        teams.appendChild(home);

        const away = document.createElement('div');
        away.className = 'match-team';
        away.textContent = match.awayTeam;
        teams.appendChild(away);

        card.appendChild(teams);

        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'match-score';

        const score = document.createElement('span');
        score.className = 'score';
        if (match.homeScore !== null && match.awayScore !== null) {
          score.textContent = `${match.homeScore} - ${match.awayScore}`;
        } else {
          score.textContent = match.time || 'TBD';
          score.classList.add('upcoming');
        }
        scoreDiv.appendChild(score);

        const status = document.createElement('span');
        status.className = `match-status ${match.status}`;
        status.textContent =
          match.status === 'finished'
            ? 'FT'
            : match.status === 'live'
              ? 'LIVE'
              : match.date;
        scoreDiv.appendChild(status);

        card.appendChild(scoreDiv);
        section.appendChild(card);
      }

      this.scoresContainer.appendChild(section);
    }

    if (!hasAnyScores) {
      const p = document.createElement('p');
      p.className = 'placeholder';
      p.textContent = 'No scores available';
      this.scoresContainer.appendChild(p);
    }
  }
}
