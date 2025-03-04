// ===========================
// 🔹 User Roles

import { Timestamp } from "firebase/firestore";

// ===========================
export type Role = "admin" | "teacher" | "student";

// ===========================
// 🔹 User Base
// ===========================
export type UserBase = {
  userId: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  password: string;
  schoolId: string;
  role: Role;
  gender: "male" | "female";
  homeroomClassId?: string;
  yearGroup?: number;
  inbox: Inbox;
};

export interface BulkUserData {
  firstName: string;
  lastName: string;
  role: Role;
  phoneNumber: string;
  homeroomClassId?: string;
  schoolId: string;
}

// ===========================
// 🔹 User Types
// ===========================
export type Admin = UserBase & {
  role: "admin";
};

export type Teacher = UserBase & {
  role: "teacher";
  teachesClasses: string[]; // Class IDs
  timetable: Timetable;
};

export type Student = UserBase & {
  role: "student";
  homeroomClassId: string;
  enrolledSubjects: string[]; // Subject IDs
  timetable: Timetable;
};

// ===========================
// 🔹 Timetable (For Users)
// ===========================
export type Timetable = {
  [key: string]: ClassSession[];
};

export type ClassSession = {
  entries:{
  day: string;
  period: number;
  classId: string;
  subjectId: string;
  teacherId: string;
  startTime: string; // e.g., "09:00"
  endTime: string; // e.g., "10:30"
  }[];
  homeroomClassId: string;
  periods?: {
    period: number;
    startTime: string;
    endTime: string;
  }[];
};

// ===========================
// 🔹 Classes
// ===========================
export type HomeroomClass = {
  classId: string;
  className: string; // e.g., "10A"
  yearGroup: number;
  classTeacherId: string;
  studentIds: string[];
};

export type SubjectClass = {
  classId: string;
  subject: string;
  teacher: {
    firstName: string;
    lastName: string;
  };
  students: {
    userId: string;
    firstName: string;
    lastName: string;
  }[];
};

// ===========================
// 🔹 Subjects
// ===========================
export type Subject = {
  subjectId: string;
  name: string;
  description: string;
  teacherIds: string[];
  studentIds: string[];
};

// ===========================
// 🔹 Grades
// ===========================
export type Grade = {
  id?: string;
  studentId: string;
  subjectId: string;
  teacherId: string;
  value: number; // Bulgarian grading system: 2-6
  title: string;
  description?: string;
  type: GradeType;
  date: Timestamp;
  createdAt: Timestamp;
};

export type GradeType = 'exam' | 'homework' | 'participation' | 'project' | 'test' | 'other';

// ===========================
// 🔹 Assignments
// ===========================
export type Assignment = {
  assignmentId: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  dueDate: Timestamp;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  classIds: string[]; // Assigned to which classes
  studentIds: string[]; // Assigned to specific students (if any)
  allowLateSubmission: boolean;
  allowResubmission: boolean;
  status: AssignmentStatus;
};

export type AssignmentStatus = "active" | "draft" | "archived";

export type AssignmentSubmission = {
  submissionId: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  content: string;
  submittedAt: Timestamp;
  lastEditedAt?: Timestamp;
  status: SubmissionStatus;
  feedback?: AssignmentFeedback;
};

export type SubmissionStatus = "submitted" | "graded" | "late" | "resubmitted";

export type AssignmentFeedback = {
  teacherId: string;
  comment: string;
  grade?: number;
  gradedAt: Timestamp;
};

// ===========================
// 🔹 Messaging System
// ===========================
export type Inbox = {
  conversations: Conversation[];
  unreadCount: number; // Total unread messages across all conversations
};

export type Conversation = {
  conversationId: string;
  participants: string[]; // User IDs
  participantRoles?: Record<string, Role>; // To store roles of participants for permission checks
  messages: Message[];
  isGroup: boolean;
  groupName?: string;
  createdAt: string;
  updatedAt: string; // Last message timestamp
  lastMessage?: Message; // Last message for preview
  type: ConversationType;
  unreadCount: number; // Number of unread messages in this conversation
};

export type ConversationType = 
  | "one-to-one" 
  | "class" // For teacher to class messages
  | "announcement" // For admin announcements
  | "group"; // Custom group conversations

export type Message = {
  messageId: string;
  senderId: string;
  content: string;
  timestamp: string | Timestamp;
  readBy: string[]; // User IDs that have read the message
  replyTo?: string; // ID of message being replied to
  status: MessageStatus;
  isSystemMessage?: boolean; // For system notifications
};

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

// New types for the messaging system

export type MessageFilter = {
  sender?: string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
  unreadOnly?: boolean;
};

export type MessagePermissions = {
  canSendToStudents: boolean;
  canSendToTeachers: boolean;
  canSendToAdmins: boolean;
  canSendToClass: boolean;
  canSendAnnouncement: boolean;
  canModerateMessages: boolean;
};

export interface User extends UserBase {
  id: string;
}

// ===========================
// 🔹 Timetable Entry
// ===========================
export type TimetableEntry = {
  day: string;
  period: number;
  subjectName: string;
};

export type Course = {
  courseId: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string; // Teacher's name (firstName + lastName)
  subject: string; // Subject the course is related to
  chapters: Chapter[];
  classIds: string[]; // IDs of homeroom classes (e.g., "10A", "12B")
  createdAt: Timestamp;
};

export type Chapter = {
  title: string;
  chapterId: string;
  description: string;
  subchapters?: Subchapter[];
};

export type Subchapter = {
  subchapterId: string;
  title: string;
  topics: Topic[];
};
export type Topic = {
  topicId: string;
  title: string;
  content: string;
  quiz?: Quiz;
};

export interface Quiz {
  quizId: string;
  title: string;
  description: string;
  questions: Question[];
  teacherId: string;
  createdAt: Timestamp // Firestore Timestamp
  classIds: string[];
  timeLimit?: number;
  securityLevel?: string;
  showResults?: string;
  maxAttempts?: number;
  availableFrom?: Timestamp // Firestore Timestamp
  availableTo?: Timestamp // Firestore Timestamp
  randomizeQuestions?: boolean;
  randomizeChoices?: boolean;
  allowReview?: boolean;
  proctored?: boolean;
  tookTest?: string[];
  points?: number;
  inProgress?: boolean;
  isAvailable?: boolean;
  status?: "draft" | "published" | "archived";
  // Add missing properties
  activeUsers?: string[]; // List of users currently taking the quiz
  cheatingAttempts?: Record<string, CheatAttempt[]>; // Record of cheating attempts by user
}

export type Question = {
  questionId: string;
  text: string;
  type: QuestionType;
  choices?: Choice[];
  correctAnswer?: string | string[];
  points: number; // Required points field
  image?: string; // Optional image URL for the question
  timeSpent?: number; // Time spent on this question (in seconds)
  explanation?: string; // Explanation of the correct answer (shown after quiz completion if allowReview is true)
};

export type QuizResult = {
  quizId: string;
  userId: string;
  answers: Record<string, string | string[]>;
  score: number;
  totalPoints: number;
  timestamp: Timestamp;
  completed: boolean; // Whether the quiz has been completed or is still in progress
  startedAt: Timestamp; // When the student started the quiz
  questionTimeSpent?: Record<string, number>; // Time spent on each question
  totalTimeSpent?: number; // Total time spent on the quiz in seconds
  securityViolations?: number; // Count of security violations
  studentName?: string; // Added for easier access to student name in reviews
  questionProgress?: number; // Current question index the student is on
};

export type Choice = {
  choiceId: string;
  text: string;
};

export type QuestionType = "multipleChoice" | "singleChoice" | "openEnded" | "trueFalse" | "matching";

export type QuizSecurityLevel = "low" | "medium" | "high" | "extreme";

export type CheatAttempt = {
  timestamp: Timestamp;
  type: CheatAttemptType;
  description: string;
  quizId?: string; // For easier filtering
  studentId?: string; // For easier filtering
};

export type CheatAttemptType = 
  | "tab_switch" 
  | "window_blur" 
  | "copy_detected" 
  | "browser_close" 
  | "multiple_devices" 
  | "time_anomaly"
  | "quiz_abandoned";  // Adding the new type for quiz abandonment

// New type for live monitoring
export type LiveQuizSession = {
  quizId: string;
  activeStudents: LiveStudentSession[];
  startedAt: Timestamp;
};

export type LiveStudentSession = {
  studentId: string;
  studentName: string;
  startedAt: Timestamp;
  lastActive: Timestamp;
  questionProgress: number; // Current question number
  questionsAnswered: number;
  cheatingAttempts: CheatAttempt[];
  status: "active" | "idle" | "submitted" | "suspected_cheating";
};

export type NotificationType = 
  | "new-assignment" 
  | "assignment-due-soon" 
  | "assignment-graded" 
  | "assignment-feedback" 
  | "late-submission"
  | "quiz-published"
  | "quiz-updated"
  | "quiz-graded";

export type QuizSubmission = {
  submissionId: string;
  quizId: string;
  studentId: string;
  studentName?: string;
  quizTitle: string;
  questions: Question[];
  answers: Record<string, string | string[]>;
  score?: number;
  maxScore?: number;
  percentageScore?: number;
  grades?: Record<string, number>;
  feedback?: string;
  submittedAt: Timestamp;
  gradedAt?: Timestamp;
  status: "submitted" | "graded";
};


