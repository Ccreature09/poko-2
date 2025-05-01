import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats time spent in seconds to a human-readable string
 * @param seconds Total time in seconds
 * @returns Formatted time string (e.g., "2h 30m" or "45m 20s")
 */
export function formatTimeSpent(seconds: number): string {
  if (!seconds) return "0s";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  let result = "";
  
  if (hours > 0) {
    result += `${hours}h `;
  }
  
  if (minutes > 0 || hours > 0) {
    result += `${minutes}m `;
  }
  
  if (remainingSeconds > 0 && hours === 0) {
    result += `${remainingSeconds}s`;
  }
  
  return result.trim();
}
