import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  ListContainerProperty,
  ListItemContainerProperty,
  OsEventTypeList,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk';
import { Sport, Competition, Match, GlassesScreen, SPORTS_CONFIG } from './types';

type StatusCallback = (msg: string, ok: boolean) => void;
type CompetitionSelectCallback = (sport: Sport, competition: Competition) => void;

const DISPLAY_WIDTH = 576;
const DISPLAY_HEIGHT = 288;
const HEADER_HEIGHT = 48;

export class GlassesDisplay {
  private bridge: EvenAppBridge | null = null;
  private connected = false;
  private startupRendered = false;
  private rebuildInFlight = false;
  private pendingRebuild: { title: string; items: string[] } | null = null;

  private onStatus: StatusCallback | null = null;
  private onCompetitionSelect: CompetitionSelectCallback | null = null;

  private enabledSports: Sport[] = [...SPORTS_CONFIG];

  private state = {
    screen: GlassesScreen.SPORT_SELECT as GlassesScreen,
    sportIndex: 0,
    competitionIndex: 0,
  };

  private currentMatches: Match[] = [];

  setOnStatus(cb: StatusCallback): void {
    this.onStatus = cb;
  }
  setOnCompetitionSelect(cb: CompetitionSelectCallback): void {
    this.onCompetitionSelect = cb;
  }

  setEnabledSports(sports: Sport[]): void {
    this.enabledSports = sports;
    this.state = {
      screen: GlassesScreen.SPORT_SELECT,
      sportIndex: 0,
      competitionIndex: 0,
    };
    this.currentMatches = [];
    this.renderScreen();
  }

  private reportStatus(msg: string, ok: boolean): void {
    console.log(`[Glasses] ${msg}`);
    this.onStatus?.(msg, ok);
  }

  async init(): Promise<boolean> {
    try {
      this.reportStatus('Waiting for bridge...', false);

      const bridge = await withTimeout(waitForEvenAppBridge(), 10_000);
      this.bridge = bridge;
      this.reportStatus('Bridge found, setting up display...', false);

      bridge.onEvenHubEvent((event) => {
        this.onEvent(event);
      });

      const { title, items } = this.getScreenContent();
      const result = await withTimeout(
        bridge.createStartUpPageContainer(
          new CreateStartUpPageContainer(this.buildPageConfig(title, items))
        ),
        8_000
      );

      if (result !== StartUpPageCreateResult.success) {
        this.reportStatus(`Page create returned ${result}`, false);
        return false;
      }

      this.startupRendered = true;
      this.connected = true;
      this.reportStatus('Connected', true);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.reportStatus(`Failed: ${msg}`, false);
      this.connected = false;
      return false;
    }
  }

  get isConnected(): boolean {
    return this.connected;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onEvent(event: any): void {
    if (event.sysEvent) return;

    if (event.listEvent) {
      const evtType = event.listEvent.eventType;
      if (
        evtType === OsEventTypeList.CLICK_EVENT ||
        evtType === OsEventTypeList.DOUBLE_CLICK_EVENT ||
        evtType === 0 ||
        evtType === undefined
      ) {
        const index = event.listEvent.currentSelectItemIndex;
        if (index != null) {
          this.handleListSelect(index);
        }
      }
      return;
    }

    // Text events not expected with list container
  }

  private handleListSelect(index: number): void {
    switch (this.state.screen) {
      case GlassesScreen.SPORT_SELECT: {
        if (index < 0 || index >= this.enabledSports.length) return;
        this.state.sportIndex = index;
        this.state.screen = GlassesScreen.COMPETITION_SELECT;
        this.renderScreen();
        break;
      }
      case GlassesScreen.COMPETITION_SELECT: {
        if (index === 0) {
          this.state.screen = GlassesScreen.SPORT_SELECT;
          this.renderScreen();
          return;
        }
        const compIndex = index - 1;
        const sport = this.enabledSports[this.state.sportIndex];
        if (compIndex >= sport.competitions.length) return;
        this.state.competitionIndex = compIndex;
        this.state.screen = GlassesScreen.SCORES;
        this.currentMatches = [];
        this.onCompetitionSelect?.(sport, sport.competitions[compIndex]);
        this.renderScreen();
        break;
      }
      case GlassesScreen.SCORES: {
        if (index === 0) {
          this.state.screen = GlassesScreen.COMPETITION_SELECT;
          this.renderScreen();
        }
        break;
      }
    }
  }

  updateScores(matches: Match[]): void {
    this.currentMatches = matches;
    if (this.state.screen === GlassesScreen.SCORES) {
      this.renderScreen();
    }
  }

  showInitialScreen(): void {
    this.state = {
      screen: GlassesScreen.SPORT_SELECT,
      sportIndex: 0,
      competitionIndex: 0,
    };
    this.renderScreen();
  }

  private getScreenContent(): { title: string; items: string[] } {
    switch (this.state.screen) {
      case GlassesScreen.SPORT_SELECT:
        return {
          title: 'SPORTS SCORES',
          items: this.enabledSports.map((s) => s.name),
        };
      case GlassesScreen.COMPETITION_SELECT: {
        const sport = this.enabledSports[this.state.sportIndex];
        return {
          title: sport.name.toUpperCase(),
          items: ['< Back', ...sport.competitions.map((c) => c.name)],
        };
      }
      case GlassesScreen.SCORES: {
        const comp =
          this.enabledSports[this.state.sportIndex].competitions[this.state.competitionIndex];
        if (this.currentMatches.length === 0) {
          return {
            title: comp.name,
            items: ['< Back', 'Loading scores...'],
          };
        }
        return {
          title: comp.name,
          items: ['< Back', ...this.currentMatches.map((m) => this.formatMatch(m))],
        };
      }
    }
  }

  private formatMatch(match: Match): string {
    if (match.homeScore !== null && match.awayScore !== null) {
      return `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`;
    }
    return `${match.homeTeam} v ${match.awayTeam}`;
  }

  private buildPageConfig(title: string, items: string[]) {
    return {
      containerTotalNum: 2,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: 'header',
          content: title,
          xPosition: 0,
          yPosition: 0,
          width: DISPLAY_WIDTH,
          height: HEADER_HEIGHT,
          isEventCapture: 0,
          paddingLength: 0,
        }),
      ],
      listObject: [
        new ListContainerProperty({
          containerID: 2,
          containerName: 'menu',
          xPosition: 0,
          yPosition: HEADER_HEIGHT,
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT - HEADER_HEIGHT,
          isEventCapture: 1,
          paddingLength: 0,
          itemContainer: new ListItemContainerProperty({
            itemCount: items.length,
            itemWidth: 0,
            isItemSelectBorderEn: 1,
            itemName: items,
          }),
        }),
      ],
    };
  }

  private renderScreen(): void {
    const { title, items } = this.getScreenContent();
    this.rebuildScreen(title, items);
  }

  private async rebuildScreen(title: string, items: string[]): Promise<void> {
    if (!this.connected || !this.bridge || !this.startupRendered) return;

    if (this.rebuildInFlight) {
      this.pendingRebuild = { title, items };
      return;
    }

    this.rebuildInFlight = true;
    try {
      await this.bridge.rebuildPageContainer(
        new RebuildPageContainer(this.buildPageConfig(title, items))
      );
    } catch {
      // Silently handle rebuild failures
    } finally {
      this.rebuildInFlight = false;
      if (this.pendingRebuild) {
        const { title: t, items: i } = this.pendingRebuild;
        this.pendingRebuild = null;
        this.rebuildScreen(t, i);
      }
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Timed out after ${ms}ms`));
    }, ms);

    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => window.clearTimeout(timer));
  });
}
