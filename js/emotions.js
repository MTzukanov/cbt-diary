import { t } from './i18n.js';

// Presets are stored by key so entries re-label when the language changes.
export const PRESET_EMOTIONS = [
  'joy', 'pleasure', 'calm', 'interest', 'gratitude', 'pride', 'love',
  'sadness', 'disappointment', 'loneliness', 'hurt', 'anger', 'irritation',
  'dissatisfaction', 'fear', 'anxiety', 'shame', 'guilt', 'envy', 'helplessness',
];

// Identity used to compare and group emotions across entries.
export function emotionId(e) {
  return e.key ? `k:${e.key}` : `n:${e.name.trim().toLowerCase()}`;
}

export function emotionLabel(e) {
  return e.key ? t(`emotion.${e.key}`) : e.name;
}
