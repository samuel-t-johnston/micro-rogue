/**
 * @file Language flavor: the adjective phrase for an un-understood vocalization in each `language`,
 * used when the hearer doesn't know the tongue (e.g. "guttural orcish shouting"). Content, read by
 * structure by sound-text (src/engine/log/text/sound-text.js), which falls back to the bare language
 * name for any language absent here. A fork adds a language's flavor by adding an entry.
 */
export const LANGUAGE_FLAVOR = {
  orcish: 'guttural orcish',
};
