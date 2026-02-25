export interface Sport {
  id: string;
  name: string;
  icon: string;
  competitions: Competition[];
}

export interface Competition {
  id: string;
  name: string;
  leagueId: string;
}

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: string | null;
  awayScore: string | null;
  status: 'finished' | 'live' | 'upcoming';
  date: string;
  time: string;
  round: string;
}

export enum GlassesScreen {
  SPORT_SELECT = 'sport_select',
  COMPETITION_SELECT = 'competition_select',
  SCORES = 'scores',
}

export interface NavigationState {
  screen: GlassesScreen;
  sportIndex: number;
  competitionIndex: number;
  cursorIndex: number;
  scrollOffset: number;
}

export const SPORTS_CONFIG: Sport[] = [
  {
    id: 'soccer',
    name: 'Soccer',
    icon: '\u26BD',
    competitions: [
      { id: 'epl', name: 'Premier League', leagueId: '4328' },
      { id: 'ucl', name: 'Champions League', leagueId: '4480' },
      { id: 'laliga', name: 'La Liga', leagueId: '4335' },
      { id: 'seriea', name: 'Serie A', leagueId: '4332' },
      { id: 'bundesliga', name: 'Bundesliga', leagueId: '4331' },
    ],
  },
  {
    id: 'rugby',
    name: 'Rugby',
    icon: '\uD83C\uDFC9',
    competitions: [
      { id: 'sixnations', name: 'Six Nations', leagueId: '4720' },
      { id: 'rwc', name: 'Rugby World Cup', leagueId: '4721' },
      { id: 'premiership', name: 'Premiership', leagueId: '4723' },
    ],
  },
  {
    id: 'snooker',
    name: 'Snooker',
    icon: '\uD83C\uDFB1',
    competitions: [
      { id: 'wsc', name: 'World Championship', leagueId: '4726' },
      { id: 'ukc', name: 'UK Championship', leagueId: '4727' },
      { id: 'masters', name: 'The Masters', leagueId: '4728' },
    ],
  },
];
