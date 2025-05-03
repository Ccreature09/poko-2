import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  Timestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Define a User interface to properly type the return value of getUserByEmail
export interface UserData {
  userId: string;
  name: string;
  email: string;
  role: "student" | "teacher" | "parent" | "admin";
  [key: string]: unknown; // Allow for additional properties with safer 'unknown' type
}

/**
 * Finds a user by email in a specific school
 * @param schoolId The ID of the school
 * @param email The email to search for
 * @returns User object if found, null otherwise
 */
export async function getUserByEmail(
  schoolId: string,
  email: string
): Promise<UserData | null> {
  try {
    const userQuery = query(
      collection(db, "schools", schoolId, "users"),
      where("email", "==", email)
    );

    const querySnapshot = await getDocs(userQuery);

    if (querySnapshot.empty) {
      return null;
    }

    // Return the first matching user
    const userData = querySnapshot.docs[0].data();
    return {
      ...userData,
      userId: querySnapshot.docs[0].id,
    } as UserData;
  } catch (error) {
    console.error("Error finding user by email:", error);
    return null;
  }
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

/**
 * Formats a timestamp to a relative time string (e.g., "5 minutes ago", "2 days ago")
 * @param timestamp Firestore timestamp or any date-like object
 * @returns Formatted relative time string in Bulgarian
 */
export function formatRelativeTime(
  timestamp: Timestamp | Date | string | number
): string {
  if (!timestamp) return "";

  let date: Date;

  // Convert input to Date object
  if (timestamp instanceof Timestamp) {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === "string") {
    date = new Date(timestamp);
  } else if (typeof timestamp === "number") {
    date = new Date(timestamp);
  } else {
    return "";
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Less than a minute
  if (diffInSeconds < 60) {
    return "току-що";
  }

  // Less than an hour
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `преди ${minutes} ${minutes === 1 ? "минута" : "минути"}`;
  }

  // Less than a day
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `преди ${hours} ${hours === 1 ? "час" : "часа"}`;
  }

  // Less than a week
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `преди ${days} ${days === 1 ? "ден" : "дни"}`;
  }

  // Less than a month
  if (diffInSeconds < 2592000) {
    const weeks = Math.floor(diffInSeconds / 604800);
    return `преди ${weeks} ${weeks === 1 ? "седмица" : "седмици"}`;
  }

  // Less than a year
  if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000);
    return `преди ${months} ${months === 1 ? "месец" : "месеца"}`;
  }

  // More than a year
  const years = Math.floor(diffInSeconds / 31536000);
  return `преди ${years} ${years === 1 ? "година" : "години"}`;
}
