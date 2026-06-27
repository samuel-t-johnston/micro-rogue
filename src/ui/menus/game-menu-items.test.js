import { describe, it, expect, beforeEach } from 'vitest';
import { buildSettingsPage, buildCreditsPage } from './game-menu-items.js';
import { gameSettings } from '../../engine/config/settings.js';

const row = (id) => buildSettingsPage().rows.find((r) => r.id === id);

describe('settings page', () => {
  beforeEach(() => {
    localStorage.clear();
    gameSettings.reset();
  });

  it('exposes settings as rows (value lives in the control, not the label)', () => {
    const { title, rows } = buildSettingsPage();
    expect(title).toBe('Settings');
    expect(rows.map((r) => r.id)).toEqual([
      'handedness',
      'skipNewGameInstructions',
      'renderMode',
      'masterVolume',
      'sfxVolume',
      'musicVolume',
    ]);
    expect(row('skipNewGameInstructions').label).toBe('Skip new game instructions'); // no ": On/Off"
  });

  it('handedness row reflects the setting and persists a change', () => {
    expect(row('handedness').get()).toBe('right'); // default
    row('handedness').set('left');
    expect(gameSettings.get('handedness')).toBe('left');
    expect(row('handedness').get()).toBe('left'); // a freshly-built page reflects it
  });

  it('skip-instructions row maps On/Off to the boolean setting', () => {
    const r = row('skipNewGameInstructions');
    expect(r.options).toEqual([
      { label: 'On', value: true },
      { label: 'Off', value: false },
    ]);
    expect(r.get()).toBe(false); // default Off
    r.set(true);
    expect(gameSettings.get('skipNewGameInstructions')).toBe(true);
  });

  it('graphics row reflects renderMode and persists a change', () => {
    const r = row('renderMode');
    expect(r.options).toEqual([
      { label: 'Sprites', value: 'sprite' },
      { label: 'ASCII', value: 'glyph' },
    ]);
    expect(r.get()).toBe('sprite'); // default
    r.set('glyph');
    expect(gameSettings.get('renderMode')).toBe('glyph');
  });

  it('music volume row reflects the setting and persists a change', () => {
    const r = row('musicVolume');
    expect(r.options.map((o) => o.value)).toEqual([0, 0.33, 0.66, 1]);
    expect(r.get()).toBe(0.66); // default
    r.set(0.33);
    expect(gameSettings.get('musicVolume')).toBe(0.33);
    expect(row('musicVolume').get()).toBe(0.33); // a freshly-built page reflects it
  });
});

describe('credits page', () => {
  it('is a static text page (text, not items or rows)', () => {
    const page = buildCreditsPage();
    expect(page.title).toBe('Credits');
    expect(page.items).toBeUndefined();
    expect(page.rows).toBeUndefined();
    expect(page.text).toContain('Sam Johnston');
    expect(page.text).toContain('ELV Games');
  });
});
