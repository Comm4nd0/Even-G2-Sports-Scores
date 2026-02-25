import { GlassesDisplay } from './GlassesDisplay';
import { PhoneUI } from './PhoneUI';
import { SportsService } from './SportsService';
import { Sport, Competition } from './types';

console.log('[Main] Sports Scores app loaded');

const glassesDisplay = new GlassesDisplay();
const phoneUI = new PhoneUI();
const sportsService = new SportsService();

// Glasses status → phone status display
glassesDisplay.setOnStatus((msg, ok) => {
  phoneUI.setStatus(msg, ok);
});

// Phone: user toggles sports → update glasses with enabled sports
phoneUI.setOnSportsChange((enabledSports: Sport[]) => {
  glassesDisplay.setEnabledSports(enabledSports);
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
      phoneUI.setStatus('Glasses not connected', false);
      return;
    }
    phoneUI.setStatus('Connected to glasses', true);
    glassesDisplay.setEnabledSports(phoneUI.getEnabledSports());
  })
  .catch((err) => {
    console.error('[Main] Glasses init error:', err);
    phoneUI.setStatus('Glasses not connected', false);
  });
