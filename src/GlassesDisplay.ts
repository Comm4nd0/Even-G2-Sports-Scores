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

// Debounce scroll-triggered renders so rapid scrolling triggers only ONE rebuild
const SCROLL_RENDER_DEBOUNCE_MS = 150;
// Suppress events after a rebuild to ignore spurious list-init events
const POST_REBUILD_SUPPRESS_MS = 200;

export class GlassesDisplay {
  private bridge: EvenAppBridge | null = null;
  private connected = false;
  private startupRendered = false;
  private rebuildInFlight = false;
  private suppressEventsUntil = 0;
  private scrollRenderTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.renderNow();
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

      // Suppress spurious events during startup
      this.suppressEventsUntil = Date.now() + 5000;

      const { title, displayItems } = this.getDisplayContent();
      const result = await withTimeout(
        bridge.createStartUpPageContainer(
          new CreateStartUpPageContainer(this.buildPageConfig(title, displayItems))
        ),
        8_000
      );

      if (result !== StartUpPageCreateResult.success) {
        this.reportStatus(`Page create returned ${result}`, false);
        return false;
      }

      this.startupRendered = true;
      this.connected = true;
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

    // Suppress spurious events fired by newly-created list containers
    if (Date.now() < this.suppressEventsUntil) {
      console.log('[Glasses] Suppressing event after rebuild');
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
      this.scheduleScrollRender();
    }
  }

  private navigateDown(): void {
    const itemCount = this.getItemCount();
    if (this.cursorIndex < itemCount - 1) {
      this.cursorIndex++;
      this.scheduleScrollRender();
    }
  }

  /**
   * Debounced render for scroll events.
   * Rapid scrolling only triggers one rebuild after scrolling stops,
   * preventing the rebuild→spurious-event cascade that was resetting cursorIndex.
   */
  private scheduleScrollRender(): void {
    if (this.scrollRenderTimer) {
      clearTimeout(this.scrollRenderTimer);
    }
    this.scrollRenderTimer = setTimeout(() => {
      this.scrollRenderTimer = null;
      this.renderNow();
    }, SCROLL_RENDER_DEBOUNCE_MS);
  }

  /** Immediate render for screen transitions. Cancels any pending scroll render. */
  private renderNow(): void {
    if (this.scrollRenderTimer) {
      clearTimeout(this.scrollRenderTimer);
      this.scrollRenderTimer = null;
    }
    const { title, displayItems } = this.getDisplayContent();
    this.rebuildScreen(title, displayItems);
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
        this.renderNow();
        break;
      }
      case GlassesScreen.COMPETITION_SELECT: {
        if (this.cursorIndex === 0) {
          this.state.screen = GlassesScreen.SPORT_SELECT;
          this.cursorIndex = this.state.sportIndex;
          this.renderNow();
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
        this.renderNow();
        break;
      }
      case GlassesScreen.SCORES: {
        if (this.cursorIndex === 0) {
          this.state.screen = GlassesScreen.COMPETITION_SELECT;
          this.cursorIndex = this.state.competitionIndex + 1;
          this.renderNow();
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
      this.renderNow();
    }
  }

  showInitialScreen(): void {
    this.state = {
      screen: GlassesScreen.SPORT_SELECT,
      sportIndex: 0,
      competitionIndex: 0,
    };
    this.cursorIndex = 0;
    this.renderNow();
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

  private getDisplayContent(): { title: string; displayItems: string[] } {
    const { title, items } = this.getScreenItems();
    const displayItems = items.map((item, i) => {
      return (i === this.cursorIndex ? '> ' : '  ') + item;
    });
    return { title, displayItems };
  }

  private formatMatch(match: Match): string {
    if (match.homeScore !== null && match.awayScore !== null) {
      return `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`;
    }
    return `${match.homeTeam} v ${match.awayTeam}`;
  }

  private buildPageConfig(title: string, displayItems: string[]) {
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
            itemCount: displayItems.length,
            itemWidth: 0,
            isItemSelectBorderEn: 0,
            itemName: displayItems,
          }),
        }),
      ],
    };
  }

  private async rebuildScreen(title: string, displayItems: string[]): Promise<void> {
    if (!this.connected || !this.bridge || !this.startupRendered) return;

    if (this.rebuildInFlight) return;

    this.rebuildInFlight = true;
    // Suppress events during the rebuild (catches events that fire before Promise resolves)
    this.suppressEventsUntil = Date.now() + 10_000;
    try {
      await this.bridge.rebuildPageContainer(
        new RebuildPageContainer(this.buildPageConfig(title, displayItems))
      );
    } catch {
      // Silently handle rebuild failures
    } finally {
      // Suppress spurious initialization events from the new list container
      this.suppressEventsUntil = Date.now() + POST_REBUILD_SUPPRESS_MS;
      this.rebuildInFlight = false;
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
