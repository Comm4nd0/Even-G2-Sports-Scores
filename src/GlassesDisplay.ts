import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  OsEventTypeList,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk';
import { Sport, Competition, Match, GlassesScreen, NavigationState, SPORTS_CONFIG } from './types';

type StatusCallback = (msg: string, ok: boolean) => void;
type SportSelectCallback = (sport: Sport) => void;
type CompetitionSelectCallback = (sport: Sport, competition: Competition) => void;

const DISPLAY_WIDTH = 576;
const DISPLAY_HEIGHT = 288;
const MAX_VISIBLE_ITEMS = 4;

export class GlassesDisplay {
  private bridge: EvenAppBridge | null = null;
  private connected = false;
  private startupRendered = false;
  private pushInFlight = false;
  private pendingContent: string | null = null;

  private onStatus: StatusCallback | null = null;
  private onSportSelect: SportSelectCallback | null = null;
  private onCompetitionSelect: CompetitionSelectCallback | null = null;

  private enabledSports: Sport[] = [...SPORTS_CONFIG];

  private state: NavigationState = {
    screen: GlassesScreen.SPORT_SELECT,
    sportIndex: 0,
    competitionIndex: 0,
    cursorIndex: 0,
    scrollOffset: 0,
  };

  private currentMatches: Match[] = [];

  setOnStatus(cb: StatusCallback): void {
    this.onStatus = cb;
  }
  setOnSportSelect(cb: SportSelectCallback): void {
    this.onSportSelect = cb;
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
      cursorIndex: 0,
      scrollOffset: 0,
    };
    this.currentMatches = [];
    this.render();
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

      const result = await withTimeout(this.createStartupPage(), 8_000);
      if (result !== StartUpPageCreateResult.success) {
        this.reportStatus(`Page create returned ${result}`, false);
        return false;
      }

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

  private async createStartupPage(): Promise<StartUpPageCreateResult> {
    if (!this.bridge) throw new Error('No bridge');

    const config = {
      containerTotalNum: 2,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: 'evt',
          content: ' ',
          xPosition: 0,
          yPosition: 0,
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT,
          isEventCapture: 1,
          paddingLength: 0,
        }),
        new TextContainerProperty({
          containerID: 2,
          containerName: 'screen',
          content: 'Sports Scores\nLoading...',
          xPosition: 0,
          yPosition: 0,
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT,
          isEventCapture: 0,
          paddingLength: 0,
        }),
      ],
    };

    const result = await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer(config)
    );
    console.log('[Glasses] createStartUpPageContainer result:', result);
    if (result === StartUpPageCreateResult.success) {
      this.startupRendered = true;
    }
    return result;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onEvent(event: any): void {
    if (event.sysEvent) return;

    const evtType = event.textEvent?.eventType ?? event.listEvent?.eventType;
    if (!(event.textEvent || event.listEvent)) return;

    if (evtType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      this.navigateDown();
    } else if (evtType === OsEventTypeList.SCROLL_TOP_EVENT) {
      this.navigateUp();
    } else if (
      evtType === OsEventTypeList.CLICK_EVENT ||
      evtType === 0 ||
      evtType === undefined
    ) {
      this.selectItem();
    }
  }

  private navigateUp(): void {
    if (this.state.cursorIndex > 0) {
      this.state.cursorIndex--;
      if (this.state.cursorIndex < this.state.scrollOffset) {
        this.state.scrollOffset = this.state.cursorIndex;
      }
    }
    this.render();
  }

  private navigateDown(): void {
    const count = this.getItemCount();
    if (this.state.cursorIndex < count - 1) {
      this.state.cursorIndex++;
      if (this.state.cursorIndex >= this.state.scrollOffset + MAX_VISIBLE_ITEMS) {
        this.state.scrollOffset = this.state.cursorIndex - MAX_VISIBLE_ITEMS + 1;
      }
    }
    this.render();
  }

  private selectItem(): void {
    const { screen, cursorIndex } = this.state;

    switch (screen) {
      case GlassesScreen.SPORT_SELECT: {
        this.state.sportIndex = cursorIndex;
        this.state.screen = GlassesScreen.COMPETITION_SELECT;
        this.state.cursorIndex = 0;
        this.state.scrollOffset = 0;
        const sport = this.enabledSports[this.state.sportIndex];
        this.onSportSelect?.(sport);
        this.render();
        break;
      }
      case GlassesScreen.COMPETITION_SELECT: {
        if (cursorIndex === 0) {
          // Back
          this.state.screen = GlassesScreen.SPORT_SELECT;
          this.state.cursorIndex = this.state.sportIndex;
          this.state.scrollOffset = 0;
          this.render();
          return;
        }
        this.state.competitionIndex = cursorIndex - 1;
        this.state.screen = GlassesScreen.SCORES;
        this.state.cursorIndex = 0;
        this.state.scrollOffset = 0;
        const sport = this.enabledSports[this.state.sportIndex];
        const comp = sport.competitions[this.state.competitionIndex];
        this.onCompetitionSelect?.(sport, comp);
        this.pushContent(`${comp.name}\n\nLoading scores...`);
        break;
      }
      case GlassesScreen.SCORES: {
        if (cursorIndex === 0) {
          // Back
          this.state.screen = GlassesScreen.COMPETITION_SELECT;
          this.state.cursorIndex = this.state.competitionIndex + 1;
          this.state.scrollOffset = 0;
          this.render();
        }
        break;
      }
    }
  }

  private getItemCount(): number {
    switch (this.state.screen) {
      case GlassesScreen.SPORT_SELECT:
        return this.enabledSports.length;
      case GlassesScreen.COMPETITION_SELECT:
        return 1 + this.enabledSports[this.state.sportIndex].competitions.length;
      case GlassesScreen.SCORES:
        return 1 + this.currentMatches.length;
    }
  }

  updateScores(matches: Match[]): void {
    this.currentMatches = matches;
    this.render();
  }

  showInitialScreen(): void {
    this.state = {
      screen: GlassesScreen.SPORT_SELECT,
      sportIndex: 0,
      competitionIndex: 0,
      cursorIndex: 0,
      scrollOffset: 0,
    };
    this.render();
  }

  private render(): void {
    switch (this.state.screen) {
      case GlassesScreen.SPORT_SELECT:
        this.renderSportSelect();
        break;
      case GlassesScreen.COMPETITION_SELECT:
        this.renderCompetitionSelect();
        break;
      case GlassesScreen.SCORES:
        this.renderScores();
        break;
    }
  }

  private renderSportSelect(): void {
    const items = this.enabledSports.map((s) => s.name);
    this.pushContent(
      this.buildListScreen('SPORTS SCORES', items, this.state.cursorIndex, this.state.scrollOffset)
    );
  }

  private renderCompetitionSelect(): void {
    const sport = this.enabledSports[this.state.sportIndex];
    const items = ['< Back', ...sport.competitions.map((c) => c.name)];
    this.pushContent(
      this.buildListScreen(
        sport.name.toUpperCase(),
        items,
        this.state.cursorIndex,
        this.state.scrollOffset
      )
    );
  }

  private renderScores(): void {
    const comp = this.enabledSports[this.state.sportIndex].competitions[this.state.competitionIndex];

    if (this.currentMatches.length === 0) {
      this.pushContent(`${comp.name}\n--------------------\n  No scores available`);
      return;
    }

    const items = ['< Back', ...this.currentMatches.map((m) => this.formatMatch(m))];
    this.pushContent(
      this.buildListScreen(comp.name, items, this.state.cursorIndex, this.state.scrollOffset)
    );
  }

  private formatMatch(match: Match): string {
    if (match.homeScore !== null && match.awayScore !== null) {
      return `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`;
    }
    return `${match.homeTeam} v ${match.awayTeam}`;
  }

  private buildListScreen(
    title: string,
    items: string[],
    cursor: number,
    offset: number
  ): string {
    const lines: string[] = [title];

    if (offset > 0) {
      lines.push('------------ more --');
    } else {
      lines.push('--------------------');
    }

    const visible = items.slice(offset, offset + MAX_VISIBLE_ITEMS);
    for (let i = 0; i < visible.length; i++) {
      const globalIndex = offset + i;
      const prefix = globalIndex === cursor ? '> ' : '  ';
      lines.push(prefix + visible[i]);
    }

    if (offset + MAX_VISIBLE_ITEMS < items.length) {
      lines.push('------------ more --');
    }

    return lines.join('\n');
  }

  private async pushContent(content: string): Promise<void> {
    if (!this.connected || !this.bridge || !this.startupRendered) return;

    if (this.pushInFlight) {
      this.pendingContent = content;
      return;
    }

    this.pushInFlight = true;
    try {
      await this.bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: 2,
          containerName: 'screen',
          contentOffset: 0,
          contentLength: 2000,
          content,
        })
      );
    } catch {
      // Silently handle update failures
    } finally {
      this.pushInFlight = false;
      if (this.pendingContent !== null) {
        const next = this.pendingContent;
        this.pendingContent = null;
        this.pushContent(next);
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
