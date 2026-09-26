import { t } from './i18n.js';

export function fieldLabel(field) {
  return field.label || t(`field.${field.id}`);
}
