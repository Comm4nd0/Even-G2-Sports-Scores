import { GlassesDisplay } from './GlassesDisplay';
import { PhoneUI } from './PhoneUI';
import { SportsService } from './SportsService';
import { Sport, Competition, Match } from './types';

console.log('[Main] Sports Scores app loaded');

const glassesDisplay = new GlassesDisplay();
const phoneUI = new PhoneUI();
const sportsService = new SportsService();

// Glasses status → phone status display
glassesDisplay.setOnStatus((msg, ok) => {
  phoneUI.setStatus(msg, ok);
});

// Phone: user taps a sport → fetch all competitions for that sport
phoneUI.setOnSportSelect(async (sport: Sport) => {
  const allScores = new Map<string, Match[]>();

  const promises = sport.competitions.map(async (comp) => {
    const matches = await sportsService.getScores(comp);
    allScores.set(comp.id, matches);
  });

  await Promise.allSettled(promises);
  phoneUI.showScores(sport, allScores);
});

// Glasses: user selects a sport (navigation only, no fetch needed)
glassesDisplay.setOnSportSelect((_sport: Sport) => {
  // Navigation handled internally by GlassesDisplay
});

// Glasses: user selects a competition → fetch and display scores
glassesDisplay.setOnCompetitionSelect(async (_sport: Sport, competition: Competition) => {
  const matches = await sportsService.getScores(competition);
  glassesDisplay.updateScores(matches);
});

// Connect to glasses
glassesDisplay
  .init()
  .then(async (connected) => {
    if (!connected) {
      phoneUI.setStatus('Glasses not connected - use phone', false);
      return;
    }
    phoneUI.setStatus('Connected to glasses', true);
    glassesDisplay.showInitialScreen();
  })
  .catch((err) => {
    console.error('[Main] Glasses init error:', err);
    phoneUI.setStatus('Glasses not connected - use phone', false);
  });
