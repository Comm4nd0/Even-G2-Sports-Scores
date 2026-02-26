import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
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
// Fixed dummy items in the event-capture list container.
// This container is never rebuilt, so no spurious events are fired.
const EVENT_ITEM_COUNT = 20;

export class GlassesDisplay {
  private bridge: EvenAppBridge | null = null;
  private connected = false;
  private startupRendered = false;
  private suppressEventsUntil = 0;
  private updateInFlight = false;
  private pendingUpdate = false;

  private onStatus: StatusCallback | null = null;
  private onCompetitionSelect: CompetitionSelectCallback | null = null;

  private enabledSports: Sport[] = [...SPORTS_CONFIG];

  private state = {
    screen: GlassesScreen.SPORT_SELECT as GlassesScreen,
    sportIndex: 0,
    competitionIndex: 0,
  };

  private cursorIndex = 0;
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
    this.cursorIndex = 0;
    this.currentMatches = [];
    this.updateDisplay();
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

      // Suppress spurious events during initial page creation
      this.suppressEventsUntil = Date.now() + 5000;

      const content = this.getDisplayText();
      const eventItems = Array.from({ length: EVENT_ITEM_COUNT }, () => ' ');

      const result = await withTimeout(
        bridge.createStartUpPageContainer(
          new CreateStartUpPageContainer({
            containerTotalNum: 2,
            textObject: [
              new TextContainerProperty({
                containerID: 1,
                containerName: 'display',
                content,
                xPosition: 0,
                yPosition: 0,
                width: DISPLAY_WIDTH,
                height: DISPLAY_HEIGHT,
                isEventCapture: 0,
                paddingLength: 0,
              }),
            ],
            listObject: [
              new ListContainerProperty({
                containerID: 2,
                containerName: 'events',
                xPosition: 0,
                yPosition: 0,
                width: DISPLAY_WIDTH,
                height: DISPLAY_HEIGHT,
                isEventCapture: 1,
                paddingLength: 0,
                itemContainer: new ListItemContainerProperty({
                  itemCount: EVENT_ITEM_COUNT,
                  itemWidth: 0,
                  isItemSelectBorderEn: 0,
                  itemName: eventItems,
                }),
              }),
            ],
          })
        ),
        8_000
      );

      if (result !== StartUpPageCreateResult.success) {
        this.reportStatus(`Page create returned ${result}`, false);
        return false;
      }

      this.startupRendered = true;
      this.connected = true;
      // Allow events after the list container finishes initializing
      this.suppressEventsUntil = Date.now() + 500;
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

    // Suppress spurious events after page creation
    if (Date.now() < this.suppressEventsUntil) {
      console.log('[Glasses] Suppressing event during initialization');
      return;
    }

    if (event.listEvent) {
      const evtType = event.listEvent.eventType;
      console.log(
        `[Glasses] Event: type=${evtType}, cursor=${this.cursorIndex}, screen=${this.state.screen}`
      );

      // Inverted scroll: SCROLL_BOTTOM → move cursor up, SCROLL_TOP → move cursor down
      if (evtType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
        this.navigateUp();
      } else if (evtType === OsEventTypeList.SCROLL_TOP_EVENT) {
        this.navigateDown();
      } else if (
        evtType === OsEventTypeList.CLICK_EVENT ||
        evtType === OsEventTypeList.DOUBLE_CLICK_EVENT ||
        evtType === 0 ||
        evtType === undefined
      ) {
        this.selectCurrentItem();
      }
      return;
    }
  }

  private navigateUp(): void {
    if (this.cursorIndex > 0) {
      this.cursorIndex--;
      this.updateDisplay();
    }
  }

  private navigateDown(): void {
    const itemCount = this.getItemCount();
    if (this.cursorIndex < itemCount - 1) {
      this.cursorIndex++;
      this.updateDisplay();
    }
  }

  private selectCurrentItem(): void {
    console.log(
      `[Glasses] Select: screen=${this.state.screen}, cursor=${this.cursorIndex}`
    );
    switch (this.state.screen) {
      case GlassesScreen.SPORT_SELECT: {
        if (this.cursorIndex < 0 || this.cursorIndex >= this.enabledSports.length) return;
        this.state.sportIndex = this.cursorIndex;
        this.state.screen = GlassesScreen.COMPETITION_SELECT;
        this.cursorIndex = 0;
        this.updateDisplay();
        break;
      }
      case GlassesScreen.COMPETITION_SELECT: {
        if (this.cursorIndex === 0) {
          this.state.screen = GlassesScreen.SPORT_SELECT;
          this.cursorIndex = this.state.sportIndex;
          this.updateDisplay();
          return;
        }
        const compIndex = this.cursorIndex - 1;
        const sport = this.enabledSports[this.state.sportIndex];
        if (compIndex >= sport.competitions.length) return;
        this.state.competitionIndex = compIndex;
        this.state.screen = GlassesScreen.SCORES;
        this.cursorIndex = 0;
        this.currentMatches = [];
        this.onCompetitionSelect?.(sport, sport.competitions[compIndex]);
        this.updateDisplay();
        break;
      }
      case GlassesScreen.SCORES: {
        if (this.cursorIndex === 0) {
          this.state.screen = GlassesScreen.COMPETITION_SELECT;
          this.cursorIndex = this.state.competitionIndex + 1;
          this.updateDisplay();
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
        return 1 + Math.max(this.currentMatches.length, 1);
    }
  }

  updateScores(matches: Match[]): void {
    this.currentMatches = matches;
    if (this.state.screen === GlassesScreen.SCORES) {
      this.updateDisplay();
    }
  }

  showInitialScreen(): void {
    this.state = {
      screen: GlassesScreen.SPORT_SELECT,
      sportIndex: 0,
      competitionIndex: 0,
    };
    this.cursorIndex = 0;
    this.updateDisplay();
  }

  private getScreenItems(): { title: string; items: string[] } {
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

  private getDisplayText(): string {
    const { title, items } = this.getScreenItems();
    const lines = [
      title,
      ...items.map((item, i) => (i === this.cursorIndex ? '> ' : '  ') + item),
    ];
    return lines.join('\n');
  }

  private formatMatch(match: Match): string {
    if (match.homeScore !== null && match.awayScore !== null) {
      return `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`;
    }
    return `${match.homeTeam} v ${match.awayTeam}`;
  }

  private async updateDisplay(): Promise<void> {
    if (!this.connected || !this.bridge || !this.startupRendered) return;

    // Coalesce rapid updates
    if (this.updateInFlight) {
      this.pendingUpdate = true;
      return;
    }

    this.updateInFlight = true;
    const content = this.getDisplayText();
    try {
      await this.bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: 1,
          containerName: 'display',
          content,
        })
      );
    } catch (e) {
      console.error('[Glasses] Display update failed:', e);
    } finally {
      this.updateInFlight = false;
      if (this.pendingUpdate) {
        this.pendingUpdate = false;
        this.updateDisplay();
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
