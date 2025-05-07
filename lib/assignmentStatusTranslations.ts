/**
 * Assignment status translations for Bulgarian language
 * This file centralizes all assignment submission status translations
 * to maintain consistency throughout the application.
 */

export type AssignmentStatus =
  | "submitted" // Submitted on time
  | "late" // Submitted after the deadline
  | "resubmitted" // Resubmitted (after feedback or corrections)
  | "graded" // Graded by teacher
  | "pending" // Not yet submitted
  | "overdue"; // Past deadline and not submitted

/**
 * Get Bulgarian translation for assignment status
 */
export const getAssignmentStatusInBulgarian = (
  status: AssignmentStatus
): string => {
  const translations: Record<AssignmentStatus, string> = {
    submitted: "Предадено",
    late: "Закъсняло",
    resubmitted: "Предадено отново",
    graded: "Оценено",
    pending: "Изчакващо",
    overdue: "Просрочено",
  };

  return translations[status] || status;
};

/**
 * Gets Bulgarian translation with className for styled badges
 */
export const getAssignmentStatusBadgeProps = (
  status: AssignmentStatus
): { text: string; className: string } => {
  const baseClassName = "bg-gray-50 text-gray-700 border-gray-200";

  switch (status) {
    case "submitted":
      return {
        text: getAssignmentStatusInBulgarian(status),
        className: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "late":
      return {
        text: getAssignmentStatusInBulgarian(status),
        className: "bg-yellow-50 text-yellow-700 border-yellow-200",
      };
    case "resubmitted":
      return {
        text: getAssignmentStatusInBulgarian(status),
        className: "bg-purple-50 text-purple-700 border-purple-200",
      };
    case "graded":
      return {
        text: getAssignmentStatusInBulgarian(status),
        className: "bg-green-50 text-green-700 border-green-200",
      };
    case "overdue":
      return {
        text: getAssignmentStatusInBulgarian(status),
        className: "bg-red-50 text-red-700 border-red-200",
      };
    case "pending":
    default:
      return {
        text: getAssignmentStatusInBulgarian(status),
        className: baseClassName,
      };
  }
};

/**
 * Helper function to determine submission status with special conditions
 */
export const determineAssignmentStatus = (
  assignment: { dueDate: { seconds: number } },
  submission?: { status?: string; submittedAt?: { seconds: number } }
): AssignmentStatus => {
  // If submission exists, use its status
  if (submission?.status) {
    return submission.status as AssignmentStatus;
  }

  // No submission - check if past due date
  const now = new Date();
  const dueDate = new Date(assignment.dueDate.seconds * 1000);

  if (now > dueDate) {
    return "overdue";
  }

  return "pending";
};
