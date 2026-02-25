import { Competition, Match, SPORTS_CONFIG } from './types';

const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3';
const CACHE_DURATION = 5 * 60 * 1000;

interface CacheEntry {
  data: Match[];
  timestamp: number;
}

export class SportsService {
  private cache = new Map<string, CacheEntry>();

  getCompetitions(sportId: string): Competition[] {
    const sport = SPORTS_CONFIG.find((s) => s.id === sportId);
    return sport?.competitions ?? [];
  }

  async getScores(competition: Competition): Promise<Match[]> {
    const cacheKey = competition.leagueId;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    try {
      const matches = await this.fetchScores(competition);
      this.cache.set(cacheKey, { data: matches, timestamp: Date.now() });
      return matches;
    } catch (e) {
      console.error(`[SportsService] Error fetching ${competition.name}:`, e);
      return cached?.data ?? [];
    }
  }

  private async fetchScores(competition: Competition): Promise<Match[]> {
    const [pastRes, nextRes] = await Promise.allSettled([
      fetch(`${API_BASE}/eventspastleague.php?id=${competition.leagueId}`),
      fetch(`${API_BASE}/eventsnextleague.php?id=${competition.leagueId}`),
    ]);

    const matches: Match[] = [];

    if (pastRes.status === 'fulfilled' && pastRes.value.ok) {
      const data = await pastRes.value.json();
      if (data.events) {
        for (const event of data.events.slice(0, 10)) {
          matches.push(this.parseEvent(event, 'finished'));
        }
      }
    }

    if (nextRes.status === 'fulfilled' && nextRes.value.ok) {
      const data = await nextRes.value.json();
      if (data.events) {
        for (const event of data.events.slice(0, 5)) {
          matches.push(this.parseEvent(event, 'upcoming'));
        }
      }
    }

    return matches;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseEvent(event: any, defaultStatus: 'finished' | 'upcoming'): Match {
    return {
      id: event.idEvent || '',
      homeTeam: this.shortenName(event.strHomeTeam || 'TBD'),
      awayTeam: this.shortenName(event.strAwayTeam || 'TBD'),
      homeScore: event.intHomeScore ?? null,
      awayScore: event.intAwayScore ?? null,
      status: event.intHomeScore !== null ? 'finished' : defaultStatus,
      date: event.dateEvent || '',
      time: event.strTime?.substring(0, 5) || '',
      round: event.intRound ? `R${event.intRound}` : '',
    };
  }

  private shortenName(name: string): string {
    if (name.length <= 16) return name;
    const shortened = name
      .replace(/United/g, 'Utd')
      .replace(/Wanderers/g, 'W')
      .replace(/Athletic/g, 'Ath')
      .replace(/Football Club/g, 'FC')
      .replace(/ FC$/g, '');
    return shortened.length <= 16 ? shortened : shortened.substring(0, 15) + '.';
  }
}
