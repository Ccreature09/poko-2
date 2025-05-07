/**
 * Translations for cheating attempt descriptions to be shown on the Bulgarian interface
 */

type CheatTranslationMap = {
  [key: string]: string;
};

/**
 * Maps English cheat attempt descriptions to Bulgarian
 */
const cheatDescriptions: CheatTranslationMap = {
  // Tab switching
  "Excessive tab switching resulted in automatic submission":
    "Прекомерно превключване между раздели, което доведе до автоматично предаване",
  "User switched to another tab": "Потребителят превключи към друг раздел",

  // Window focus
  "User switched to another window": "Потребителят превключи към друг прозорец",
  "User was away from the quiz for": "Потребителят беше извън теста за", // Partial, will be combined with seconds

  // Copying
  "User attempted to copy content":
    "Потребителят се опита да копира съдържание",

  // Browser closure
  "User closed or refreshed the browser":
    "Потребителят затвори или опресни браузъра",
  "Student abandoned the quiz by closing the browser or navigating away":
    "Ученикът изостави теста като затвори браузъра или навигира извън него",

  // Device issues
  "Multiple devices detected for the same user account":
    "Установено е използване на няколко устройства с един и същ потребителски акаунт",

  // Time anomalies
  "Suspicious time anomaly detected":
    "Открита е подозрителна аномалия във времето",
};

/**
 * Translates an English cheating attempt description to Bulgarian
 * If the description contains dynamic content (like numbers), it handles those cases specially
 *
 * @param description The original English description
 * @returns The Bulgarian translation
 */
export function translateCheatDescription(description: string): string {
  // Check for exact matches first
  if (description in cheatDescriptions) {
    return cheatDescriptions[description];
  }

  // Check for partial matches with dynamic content
  if (description.startsWith("User was away from the quiz for")) {
    const secondsMatch = description.match(/(\d+) seconds/);
    if (secondsMatch && secondsMatch[1]) {
      return `${cheatDescriptions["User was away from the quiz for"]} ${secondsMatch[1]} секунди`;
    }
  }

  // Default fallback: return the original description
  return description;
}
