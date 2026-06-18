// Renders a heard sound percept (from the hearing sense) into a player-facing log line. Mirrors
// log-text.js's role for actions. The rule:
//   - an un-understood vocalization → you hear that a *language* was shouted, not what it meant;
//   - an understood vocalization (or a non-verbal sound) → you hear what it conveys.
// Either way the imprecise compass direction it reached you from is appended.

const DIRECTION_WORDS = {
  N: 'north', NE: 'northeast', E: 'east', SE: 'southeast',
  S: 'south', SW: 'southwest', W: 'west', NW: 'northwest',
};

// Flavor adjective per language for the un-understood case. Falls back to the bare language name.
const LANGUAGE_FLAVOR = {
  orcish: 'guttural orcish',
};

function languagePhrase(language) {
  return LANGUAGE_FLAVOR[language] ?? language;
}

// What the sound conveys, before the direction suffix.
function describeWhat({ understood, language, message }) {
  if (language && !understood) return `${languagePhrase(language)} shouting`;

  switch (message?.kind) {
    case 'enemy-report': {
      // Understood order — the player knows the language, so they get the meaning, including the
      // direction the shouter encoded (distinct from the direction the player heard it from).
      const where = DIRECTION_WORDS[message.direction];
      return where ? `a shout: an enemy to the ${where}` : 'a shouted warning';
    }
    default:
      return 'a noise';
  }
}

export function describeSound(percept) {
  const word = DIRECTION_WORDS[percept.perceivedDirection];
  const suffix = word ? ` to the ${word}` : ' nearby';
  return `You hear ${describeWhat(percept)}${suffix}.`;
}
