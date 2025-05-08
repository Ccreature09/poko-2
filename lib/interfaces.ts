/**
 * @fileoverview Defines all interfaces and data types used in the application.
 */
import { Timestamp } from "firebase/firestore";

// ===========================
// 🔹 User Roles
// ===========================
/**
 * Defines the possible roles a user can have within the system.
 */
export type Role = "admin" | "teacher" | "student" | "parent";

// ===========================
// 🔹 Student Reviews
// ===========================
/**
 * Represents a review given to a student by a teacher.
 */
export type StudentReview = {
  /** The unique identifier for the review. */
  reviewId: string;
  /** The ID of the student who received the review. */
  studentId: string;
  /** The ID of the teacher who wrote the review. */
  teacherId: string;
  /** The name of the teacher who wrote the review. */
  teacherName: string;
  /** The ID of the subject related to the review (optional). */
  subjectId?: string;
  /** The name of the subject related to the review (optional). */
  subjectName?: string;
  /** The title of the review. */
  title: string;
  /** The main content of the review. */
  content: string;
  /** The type of the review (e.g., positive, negative). */
  type: ReviewType;
  /** The date the review was given. */
  date: Timestamp;
  /** The timestamp when the review was created. */
  createdAt: Timestamp;
};

/**
 * Defines the possible types for a student review.
 */
export type ReviewType = "positive" | "negative";

// ===========================
// 🔹 User Interface
// ===========================
/**
 * Represents the common data structure for a user in the system.
 */
export interface UserData {
  /** The unique identifier for the user (optional, usually assigned by the system). */
  userId?: string;
  /** The user's first name. */
  firstName: string;
  /** The user's last name. */
  lastName: string;
  /** The user's email address. */
  email: string;
  /** The user's phone number. */
  phoneNumber: string;
  /** The user's role in the system. */
  role: Role;
  /** The user's gender. */
  gender: "male" | "female" | string;
  /** The user's password (optional, used during creation/update). */
  password?: string;

  /** The ID of the school the user belongs to (optional). */
  schoolId?: string;
  /** The encrypted password of the user (optional, stored in the database). */
  encryptedPassword?: string;

  /** The ID of the homeroom class for students or homeroom teachers. */
  homeroomClassId?: string;
  /** An array of student IDs, applicable if the user is a parent. */
  childrenIds?: string[];
  /** An array of class IDs that the teacher teaches. */
  teachesClasses?: string[];

  /** The grade number of the class (e.g., 10 for 10th grade). */
  gradeNumber?: number;
  /** The letter of the class (e.g., "A", "B"). */
  classLetter?: string;
  /** A custom name for the class, if applicable. */
  customClassName?: string;
  /** The naming format for the class ("graded" or "custom"). */
  classNamingFormat?: ClassNamingFormat;

  /** The user's inbox for messages. */
  inbox?: Inbox;
}

/**
 * Base user type, an alias for UserData for clarity in certain contexts.
 */
export type UserBase = UserData;

/**
 * Represents the data structure for user forms, omitting certain system-managed fields.
 */
export type UserFormData = Omit<
  UserData,
  "schoolId" | "encryptedPassword" | "inbox" | "password"
>;

/**
 * Represents user data specifically for bulk import operations.
 */
export type BulkImportUserData = UserData;

/**
 * Defines the data structure for creating users in bulk.
 */
export interface BulkUserData {
  /** The user's first name. */
  firstName: string;
  /** The user's last name. */
  lastName: string;
  /** The user's role. */
  role: Role;
  /** The user's phone number. */
  phoneNumber: string;
  /** The ID of the user's homeroom class (optional). */
  homeroomClassId?: string;
  /** The ID of the school the user belongs to. */
  schoolId: string;
}

// ===========================
// 🔹 User Types
// ===========================
/**
 * Represents an administrator user, extending the base user data.
 */
export type Admin = UserBase & {
  role: "admin";
};

/**
 * Represents a teacher user, extending the base user data.
 */
export type Teacher = UserBase & {
  role: "teacher";
  /** An array of class IDs that the teacher teaches. */
  teachesClasses: string[];
  /** The teacher's timetable. */
  timetable: Timetable;
};

/**
 * Represents a student user, extending the base user data.
 */
export type Student = UserBase & {
  role: "student";
  /** The ID of the student's homeroom class. */
  homeroomClassId: string;
  /** An array of subject IDs the student is enrolled in. */
  enrolledSubjects: string[];
  /** The student's timetable. */
  timetable: Timetable;
};

/**
 * Represents a parent user, extending the base user data.
 */
export type Parent = UserBase & {
  role: "parent";
  /** An array of student IDs representing the parent's children. */
  childrenIds: string[];
};

// ===========================
// 🔹 Timetable (for users)
// ===========================
/**
 * Represents a user's timetable, mapping days to class sessions.
 */
export type Timetable = {
  [key: string]: ClassSession[];
};

/**
 * Represents a single session in a class, occurring on a specific day and period.
 */
export type ClassSession = {
  /** An array of entries detailing the specifics of each class period. */
  entries: {
    /** The day of the week for this session (e.g., "Monday"). */
    day: string;
    /** The period number within the day (e.g., 1 for the first period). */
    period: number;
    /** The ID of the class. */
    classId: string;
    /** The ID of the subject being taught. */
    subjectId: string;
    /** The ID of the teacher conducting the session. */
    teacherId: string;
    /** The start time of the session (e.g., "09:00"). */
    startTime: string;
    /** The end time of the session (e.g., "10:30"). */
    endTime: string;
    /** Indicates if this is a free period (optional). */
    isFreePeriod?: boolean;
  }[];
  /** The ID of the homeroom class (optional, as teacher timetables might not have one). */
  homeroomClassId?: string;
  /** The ID of the teacher (added for teacher timetables). */
  teacherId?: string;
  /** Defines the periods with their start and end times. */
  periods?: {
    /** The period number. */
    period: number;
    /** The start time of the period. */
    startTime: string;
    /** The end time of the period. */
    endTime: string;
  }[];
};

// ===========================
// 🔹 Classes
// ===========================
/**
 * Defines the format for naming classes.
 * 'graded': Standard naming based on grade and letter (e.g., "10A").
 * 'custom': Custom naming (e.g., "Advanced Biology Class").
 */
export type ClassNamingFormat = "graded" | "custom";

/**
 * Represents a homeroom class, typically with an assigned homeroom teacher.
 */
export type HomeroomClass = {
  /** The unique identifier for the class. */
  classId: string;
  /** The name of the class (e.g., "10A" or "Class 1"). */
  className: string;
  /** The naming format used for this class. */
  namingFormat: ClassNamingFormat;

  /** The grade number (e.g., 10 for 10th grade), used if namingFormat is "graded". */
  gradeNumber?: number;
  /** The class letter (e.g., "A"), used if namingFormat is "graded". */
  classLetter?: string;

  /** The custom name of the class, used if namingFormat is "custom". */
  customName?: string;
  /** The ID of the homeroom teacher for this class. */
  classTeacherId: string;
  /** An array of student IDs belonging to this class. */
  studentIds: string[];
  /** An array of teacher-subject pairs for subjects taught in this class. */
  teacherSubjectPairs: Array<{
    /** The ID of the teacher. */
    teacherId: string;
    /** The ID of the subject. */
    subjectId: string;
    /** Indicates if this teacher is the homeroom teacher for this subject (optional). */
    isHomeroom?: boolean;
  }>;
};

/**
 * Represents a class specific to a particular subject, often used for display purposes.
 */
export type SubjectClass = {
  /** The unique identifier for the class. */
  classId: string;
  /** The name of the subject. */
  subject: string;
  /** Information about the teacher of this subject class. */
  teacher: {
    firstName: string;
    lastName: string;
  };
  /** An array of students enrolled in this subject class. */
  students: {
    userId: string;
    firstName: string;
    lastName: string;
  }[];
};

// ===========================
// 🔹 Subjects
// ===========================
/**
 * Represents an academic subject taught in the school.
 */
export type Subject = {
  /** The unique identifier for the subject. */
  subjectId: string;
  /** The name of the subject. */
  name: string;
  /** A description of the subject. */
  description: string;
  /** An array of teacher-subject pairs, indicating which teachers teach this subject. */
  teacherSubjectPairs: Array<{ teacherId: string; subjectId: string }>;
  /** An array of student IDs enrolled in this subject. */
  studentIds: string[];
  /** The category of the subject (e.g., "core", "elective", "specialized"). */
  category?: string;
  /** The number of hours this subject is taught per week (optional). */
  weeklyHours?: number;
  /** An array of grade levels for which this subject is intended (e.g., [9, 10, 11]). */
  gradeLevel?: number[];
};

/**
 * Represents an assignment of a teacher to teach a specific subject to one or more classes.
 */
export type TeacherSubjectAssignment = {
  /** The unique identifier for the assignment. */
  assignmentId: string;
  /** The ID of the teacher. */
  teacherId: string;
  /** The ID of the subject. */
  subjectId: string;
  /** An array of homeroom class IDs to which this teacher teaches this subject. */
  classIds: string[];
  /** The academic year for this assignment (e.g., "2024-2025"). */
  schoolYear: string;
  /** Optional schedule information for this assignment. */
  schedule?: {
    [dayOfWeek: string]: {
      periodNumber: number;
      classId: string;
    }[];
  };
};

/**
 * Represents the mapping of subjects (and their teachers) to a specific class.
 */
export type ClassSubjectsMapping = {
  /** The ID of the class. */
  classId: string;
  /** The name of the class. */
  className: string;
  /** An array of subjects taught in this class, along with their assigned teachers. */
  subjects: {
    subjectId: string;
    teacherId: string;
  }[];
};

// ===========================
// 🔹 Grades
// ===========================
/**
 * Represents a grade given to a student for a specific subject or assignment.
 */
export type Grade = {
  /** The unique identifier for the grade (optional). */
  id?: string;
  /** The ID of the student who received the grade. */
  studentId: string;
  /** The ID of the subject for which the grade was given. */
  subjectId: string;
  /** The ID of the teacher who assigned the grade. */
  teacherId: string;
  /** The numerical value of the grade (e.g., in a 2-6 system). */
  value: number;
  /** The title or name of the graded item (e.g., "Midterm Exam"). */
  title: string;
  /** A description or comments about the grade (optional). */
  description?: string;
  /** The type of the grade (e.g., "exam", "homework"). */
  type: GradeType;
  /** The date the grade was assigned. */
  date: Timestamp;
  /** The timestamp when the grade was created. */
  createdAt: Timestamp;
  /** The name of the subject (optional, for UI display). */
  subjectName?: string;
  /** The name of the teacher (optional, for UI display). */
  teacherName?: string;
  /** The name of the student (optional, for UI display). */
  studentName?: string;
};

/**
 * Defines the possible types for a grade.
 */
export type GradeType =
  | "exam"
  | "homework"
  | "participation"
  | "project"
  | "test"
  | "other";

// ===========================
// 🔹 Assignments
// ===========================
/**
 * Represents an assignment given to students.
 */
export type Assignment = {
  /** The unique identifier for the assignment. */
  assignmentId: string;
  /** The title of the assignment. */
  title: string;
  /** A detailed description of the assignment. */
  description: string;
  /** The ID of the teacher who created the assignment. */
  teacherId: string;
  /** The name of the teacher who created the assignment. */
  teacherName: string;
  /** The ID of the subject related to the assignment. */
  subjectId: string;
  /** The name of the subject related to the assignment. */
  subjectName: string;
  /** The due date for the assignment. */
  dueDate: Timestamp;
  /** The timestamp when the assignment was created. */
  createdAt: Timestamp;
  /** The timestamp when the assignment was last updated (optional). */
  updatedAt?: Timestamp;
  /** An array of class IDs to which this assignment is assigned. */
  classIds: string[];
  /** An array of specific student IDs this assignment is for (optional). */
  studentIds: string[];
  /** Indicates whether late submissions are allowed. */
  allowLateSubmission: boolean;
  /** Indicates whether resubmissions are allowed. */
  allowResubmission: boolean;
  /** The current status of the assignment. */
  status: AssignmentStatus;
};

/**
 * Defines the possible statuses for an assignment.
 */
export type AssignmentStatus = "active" | "draft" | "archived";

/**
 * Represents a student's submission for an assignment.
 */
export type AssignmentSubmission = {
  /** The unique identifier for the submission. */
  submissionId: string;
  /** The ID of the assignment this submission is for. */
  assignmentId: string;
  /** The ID of the student who made the submission. */
  studentId: string;
  /** The name of the student who made the submission. */
  studentName: string;
  /** The content of the submission. */
  content: string;
  /** The timestamp when the submission was made. */
  submittedAt: Timestamp;
  /** The timestamp when the submission was last edited (optional). */
  lastEditedAt?: Timestamp;
  /** The status of the submission. */
  status: SubmissionStatus;
  /** Feedback provided for this submission (optional). */
  feedback?: AssignmentFeedback;
};

/**
 * Defines the possible statuses for an assignment submission.
 */
export type SubmissionStatus = "submitted" | "graded" | "late" | "resubmitted";

/**
 * Represents feedback given by a teacher for an assignment submission.
 */
export type AssignmentFeedback = {
  /** The ID of the teacher who provided the feedback. */
  teacherId: string;
  /** The feedback comment. */
  comment: string;
  /** The grade given for the submission (optional). */
  grade?: number;
  /** The timestamp when the feedback was given. */
  gradedAt: Timestamp;
};

// ===========================
// 🔹 Messaging System
// ===========================
/**
 * Represents a user's inbox, containing conversations and unread message counts.
 */
export type Inbox = {
  /** An array of conversations in the inbox. */
  conversations: Conversation[];
  /** The total number of unread messages across all conversations. */
  unreadCount: number;
};

/**
 * Represents a conversation between two or more users.
 */
export type Conversation = {
  /** The unique identifier for the conversation. */
  conversationId: string;
  /** An array of user IDs participating in the conversation. */
  participants: string[];
  /** A record mapping participant IDs to their roles (optional, for permission checks). */
  participantRoles?: Record<string, Role>;
  /** An array of messages in the conversation. */
  messages: Message[];
  /** Indicates if the conversation is a group chat. */
  isGroup: boolean;
  /** The name of the group, if it's a group chat. */
  groupName?: string;
  /** The timestamp when the conversation was created. */
  createdAt: string;
  /** The timestamp of the last message in the conversation. */
  updatedAt: string;
  /** The last message in the conversation, for preview purposes (optional). */
  lastMessage?: Message;
  /** The type of the conversation. */
  type: ConversationType;
  /** A record mapping participant IDs to their unread message counts in this conversation. */
  unreadCount: Record<string, number>;
};

/**
 * Defines the types of conversations.
 */
export type ConversationType =
  | "one-to-one" // Private messages between two users
  | "class" // Messages from a teacher to a class
  | "announcement" // Messages from administrators
  | "group"; // Custom user-created groups

/**
 * Represents a single message within a conversation.
 */
export type Message = {
  /** The unique identifier for the message. */
  messageId: string;
  /** The ID of the user who sent the message. */
  senderId: string;
  /** The content of the message. */
  content: string;
  /** The timestamp when the message was sent. */
  timestamp: string | Timestamp;
  /** An array of user IDs who have read the message. */
  readBy: string[];
  /** The ID of the message being replied to (optional). */
  replyTo?: string;
  /** The status of the message. */
  status: MessageStatus;
  /** Indicates if this is a system-generated message (e.g., notifications) (optional). */
  isSystemMessage?: boolean;
};

/**
 * Defines the possible statuses for a message.
 */
export type MessageStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

/**
 * Defines filters for searching or retrieving messages.
 */
export type MessageFilter = {
  /** Filter by sender ID (optional). */
  sender?: string;
  /** Filter by keyword in message content (optional). */
  keyword?: string;
  /** Filter messages sent from this date (optional). */
  dateFrom?: string;
  /** Filter messages sent up to this date (optional). */
  dateTo?: string;
  /** Filter for unread messages only (optional). */
  unreadOnly?: boolean;
};

/**
 * Defines permissions related to the messaging system for a user.
 */
export type MessagePermissions = {
  /** Whether the user can send messages to students. */
  canSendToStudents: boolean;
  /** Whether the user can send messages to teachers. */
  canSendToTeachers: boolean;
  /** Whether the user can send messages to administrators. */
  canSendToAdmins: boolean;
  /** Whether the user can send messages to an entire class. */
  canSendToClass: boolean;
  /** Whether the user can send announcements. */
  canSendAnnouncement: boolean;
  /** Whether the user can moderate messages (e.g., delete messages). */
  canModerateMessages: boolean;
};

/**
 * Extends UserBase with a mandatory ID, typically used after a user is fetched or created.
 */
export interface User extends UserBase {
  /** The unique identifier for the user. */
  id: string;
}

// ===========================
// 🔹 Timetable Entries
// ===========================
/**
 * Represents a single entry in a timetable, detailing a subject for a specific day and period.
 */
export type TimetableEntry = {
  /** The day of the week (e.g., "Monday"). */
  day: string;
  /** The period number within the day. */
  period: number;
  /** The name of the subject for this entry. */
  subjectName: string;
};

// ===========================
// 🔹 Courses and Materials
// ===========================
/**
 * Represents an academic course, potentially containing chapters, subchapters, and topics.
 */
export type Course = {
  /** The unique identifier for the course. */
  courseId: string;
  /** The title of the course. */
  title: string;
  /** A description of the course. */
  description: string;
  /** The ID of the teacher responsible for the course. */
  teacherId: string;
  /** The name of the teacher (first name + last name). */
  teacherName: string;
  /** The subject associated with the course. */
  subject: string;
  /** An array of chapters within the course. */
  chapters: Chapter[];
  /** An array of class IDs to which this course is available (e.g., "10A", "12B"). */
  classIds: string[];
  /** The timestamp when the course was created. */
  createdAt: Timestamp;
};

/**
 * Represents a chapter within a course.
 */
export type Chapter = {
  /** The title of the chapter. */
  title: string;
  /** The unique identifier for the chapter. */
  chapterId: string;
  /** An array of subchapters within this chapter (optional). */
  subchapters?: Subchapter[];
};

/**
 * Represents a subchapter within a chapter.
 */
export type Subchapter = {
  /** The unique identifier for the subchapter. */
  subchapterId: string;
  /** The title of the subchapter. */
  title: string;
  /** An array of topics within this subchapter. */
  topics: Topic[];
};

/**
 * Represents a specific topic within a course structure (e.g., inside a subchapter).
 */
export type Topic = {
  /** The unique identifier for the topic. */
  topicId: string;
  /** The title of the topic. */
  title: string;
  /** The content or material for the topic. */
  content: string;
  /** An optional quiz associated with this topic. */
  quiz?: Quiz;
};

// ===========================
// 🔹 Quizzes and Questions
// ===========================
/**
 * Represents a quiz or test.
 */
export interface Quiz {
  /** The unique identifier for the quiz. */
  quizId: string;
  /** The title of the quiz. */
  title: string;
  /** A description of the quiz. */
  description: string;
  /** An array of questions in the quiz. */
  questions: Question[];
  /** The ID of the teacher who created the quiz. */
  teacherId: string;
  /** The timestamp when the quiz was created. */
  createdAt: Timestamp;
  /** An array of class IDs for which this quiz is intended. */
  classIds: string[];
  /** The time limit for the quiz in minutes (optional). */
  timeLimit?: number;
  /** The security level for the quiz (optional). */
  securityLevel?: string;
  /** Defines when the quiz results should be shown to students (optional). */
  showResults?: string;
  /** The maximum number of attempts allowed for the quiz (optional). */
  maxAttempts?: number;
  /** The date and time from which the quiz is available (optional). */
  availableFrom?: Timestamp;
  /** The date and time until which the quiz is available (optional). */
  availableTo?: Timestamp;
  /** Whether to randomize the order of questions (optional). */
  randomizeQuestions?: boolean;
  /** Whether to randomize the order of choices within questions (optional). */
  randomizeChoices?: boolean;
  /** Whether students are allowed to review their answers after completing the quiz (optional). */
  allowReview?: boolean;
  /** Whether the quiz is proctored (optional). */
  proctored?: boolean;
  /** A list of user IDs who have taken the test (optional). */
  tookTest?: string[];
  /** The total number of points for the quiz (optional). */
  points?: number;
  /** Indicates if the quiz is currently in progress for any student (optional). */
  inProgress?: boolean;
  /** Indicates if the quiz is currently available to students (optional). */
  isAvailable?: boolean;
  /** The status of the quiz (e.g., "draft", "published", "archived"). */
  status?: "draft" | "published" | "archived";
  /** A list of user IDs currently taking the quiz (optional). */
  activeUsers?: string[];
  /** Records of cheating attempts, mapped by user ID (optional). */
  cheatingAttempts?: Record<string, CheatAttempt[]>;
  /** Timestamp of the last activity in the quiz (optional). */
  lastActiveTimestamp?: Timestamp;
}

/**
 * Represents a single question within a quiz.
 */
export type Question = {
  /** The unique identifier for the question. */
  questionId: string;
  /** The text of the question. */
  text: string;
  /** The type of the question (e.g., "multipleChoice", "openEnded"). */
  type: QuestionType;
  /** An array of choices for multiple-choice or single-choice questions (optional). */
  choices?: Choice[];
  /** The correct answer(s) for the question (optional). */
  correctAnswer?: string | string[];
  /** The number of points awarded for a correct answer to this question. */
  points: number;
  /** An optional URL for an image associated with the question. */
  image?: string;
  /** The time spent on this question in seconds (optional, tracked during quiz taking). */
  timeSpent?: number;
  /** An explanation of the correct answer, shown after the quiz (optional). */
  explanation?: string;
};

/**
 * Represents the result of a student's attempt at a quiz.
 */
export type QuizResult = {
  /** The ID of the quiz. */
  quizId: string;
  /** The ID of the user who took the quiz. */
  userId: string;
  /** A record of the student's answers, mapping question IDs to their answers. */
  answers: Record<string, string | string[]>;
  /** The student's score on the quiz. */
  score: number;
  /** The total possible points for the quiz. */
  totalPoints: number;
  /** The timestamp when the quiz result was recorded. */
  timestamp: Timestamp;
  /** Indicates whether the quiz attempt is completed or still in progress. */
  completed: boolean;
  /** The timestamp when the student started the quiz. */
  startedAt: Timestamp;
  /** A record of time spent on each question, in seconds (optional). */
  questionTimeSpent?: Record<string, number>;
  /** The total time spent on the quiz in seconds (optional). */
  totalTimeSpent?: number;
  /** The number of security violations detected during the quiz attempt (optional). */
  securityViolations?: number;
  /** The name of the student (optional, for easier display in reviews). */
  studentName?: string;
  /** The current question index the student is on (optional, for live tracking). */
  questionProgress?: number;
};

/**
 * Represents a single choice for a multiple-choice or single-choice question.
 */
export type Choice = {
  /** The unique identifier for the choice. */
  choiceId: string;
  /** The text of the choice. */
  text: string;
};

/**
 * Defines the types of questions that can be included in a quiz.
 */
export type QuestionType =
  | "multipleChoice" // Multiple correct answers possible
  | "singleChoice" // Only one correct answer
  | "openEnded" // Free text answer
  | "trueFalse" // True or false answer
  | "matching"; // Matching pairs

/**
 * Defines the security levels for a quiz.
 */
export type QuizSecurityLevel = "low" | "medium" | "high" | "extreme";

/**
 * Represents a detected attempt at cheating during a quiz.
 */
export type CheatAttempt = {
  /** The timestamp when the cheating attempt was detected. */
  timestamp: Timestamp;
  /** The type of cheating attempt. */
  type: CheatAttemptType;
  /** A description of the cheating attempt. */
  description: string;
  /** The ID of the quiz (optional, for easier filtering). */
  quizId?: string;
  /** The ID of the student (optional, for easier filtering). */
  studentId?: string;
};

/**
 * Defines the types of cheating attempts that can be detected.
 */
export type CheatAttemptType =
  | "tab_switch" // User switched browser tabs
  | "window_blur" // User navigated away from the quiz window
  | "copy_detected" // Copying text was detected
  | "browser_close" // Browser was closed during the quiz
  | "multiple_devices" // Use of multiple devices detected
  | "time_anomaly" // Unusual time patterns detected
  | "quiz_abandoned"; // Quiz was abandoned before completion

// ===========================
// 🔹 Quiz Monitoring
// ===========================
/**
 * Represents a live monitoring session for an active quiz.
 */
export type LiveQuizSession = {
  /** The ID of the quiz being monitored. */
  quizId: string;
  /** An array of live student sessions for this quiz. */
  activeStudents: LiveStudentSession[];
  /** The timestamp when the quiz session started. */
  startedAt: Timestamp;
};

/**
 * Represents the live session data for a single student taking a quiz.
 */
export type LiveStudentSession = {
  /** The ID of the student. */
  studentId: string;
  /** The name of the student. */
  studentName: string;
  /** The timestamp when the student started the quiz. */
  startedAt: Timestamp;
  /** The timestamp of the student's last activity. */
  lastActive: Timestamp;
  /** The current question number the student is on. */
  questionProgress: number;
  /** The number of questions the student has answered. */
  questionsAnswered: number;
  /** An array of cheating attempts detected for this student during the session. */
  cheatingAttempts: CheatAttempt[];
  /** The current status of the student's session. */
  status: "active" | "idle" | "submitted" | "suspected_cheating";
};

// ===========================
// 🔹 Notifications
// ===========================
/**
 * Defines the types of notifications that can be generated in the system.
 */
export type NotificationType =
  | "new-assignment" // A new assignment has been created
  | "assignment-due-soon" // An assignment is due soon
  | "assignment-graded" // An assignment has been graded
  | "assignment-feedback" // Feedback has been provided for an assignment
  | "late-submission" // An assignment was submitted late
  | "quiz-published" // A new quiz has been published
  | "quiz-updated" // A quiz has been updated
  | "quiz-graded" // A quiz has been graded
  | "new-grade" // A new grade has been entered
  | "edited-grade" // A grade has been edited
  | "deleted-grade"; // A grade has been deleted

// ===========================
// 🔹 Quiz Submission (Detailed)
// ===========================
/**
 * Represents a detailed record of a student's submission for a quiz, including answers and scores.
 */
export type QuizSubmission = {
  /** The unique identifier for the submission. */
  submissionId: string;
  /** The ID of the quiz. */
  quizId: string;
  /** The ID of the student who made the submission. */
  studentId: string;
  /** The name of the student (optional). */
  studentName?: string;
  /** The title of the quiz. */
  quizTitle: string;
  /** An array of the questions in the quiz at the time of submission. */
  questions: Question[];
  /** A record of the student's answers, mapping question IDs to their answers. */
  answers: Record<string, string | string[]>;
  /** The student's score on the quiz (optional, assigned after grading). */
  score?: number;
  /** The maximum possible score for the quiz (optional). */
  maxScore?: number;
  /** The student's percentage score (optional). */
  percentageScore?: number;
  /** Grades for individual questions (optional). */
  grades?: Record<string, number>;
  /** General feedback for the quiz submission (optional). */
  feedback?: string;
  /** The timestamp when the quiz was submitted. */
  submittedAt: Timestamp;
  /** The timestamp when the quiz was graded (optional). */
  gradedAt?: Timestamp;
  /** The status of the submission. */
  status: "submitted" | "graded";
};

// ===========================
// 🔹 Attendance Tracking
// ===========================
/**
 * Represents a single attendance record for a student in a class session.
 */
export type AttendanceRecord = {
  /** The unique identifier for the attendance record. */
  attendanceId: string;
  /** The ID of the student. */
  studentId: string;
  /** The name of the student (optional). */
  studentName?: string;
  /** The ID of the class. */
  classId: string;
  /** The name of the class (optional). */
  className?: string;
  /** The ID of the subject. */
  subjectId: string;
  /** The name of the subject (optional). */
  subjectName?: string;
  /** The ID of the teacher. */
  teacherId: string;
  /** The name of the teacher (optional). */
  teacherName?: string;
  /** The date of the attendance record. */
  date: Timestamp;
  /** The attendance status (e.g., "present", "absent"). */
  status: AttendanceStatus;
  /** The period number for which this attendance is recorded. */
  periodNumber: number;
  /** The timestamp when the attendance record was created. */
  createdAt: Timestamp;
  /** The timestamp when the attendance record was last updated (optional). */
  updatedAt?: Timestamp;
  /** Indicates if the parent has been notified about this attendance record. */
  notifiedParent: boolean;
  /** Indicates if an absence has been justified. */
  justified: boolean;
  /** A note explaining the justification for an absence (optional). */
  justificationNote?: string;
  /** The ID of the admin or teacher who justified the absence (optional). */
  justifiedBy?: string;
  /** The timestamp when the absence was justified (optional). */
  justifiedAt?: Timestamp;
};

/**
 * Defines the possible statuses for an attendance record.
 */
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

/**
 * Defines the periods for which an attendance report can be generated.
 */
export type AttendanceReportPeriod = "day" | "week" | "month" | "term" | "year";

/**
 * Represents a summary report of a student's attendance over a specified period.
 */
export type AttendanceReport = {
  /** The ID of the student. */
  studentId: string;
  /** The start date of the reporting period. */
  startDate: Timestamp;
  /** The end date of the reporting period. */
  endDate: Timestamp;
  /** The total number of school days in the reporting period. */
  totalDays: number;
  /** The number of days the student was absent. */
  absentDays: number;
  /** The number of days the student was late. */
  lateDays: number;
  /** The number of days the student was excused. */
  excusedDays: number;
  /** The student's absence rate as a percentage. */
  absenceRate: number;
  /** The student's tardiness rate as a percentage. */
  tardyRate: number;
  /** A breakdown of attendance by subject. */
  bySubject: {
    [subjectId: string]: {
      /** Total number of periods for this subject in the reporting period. */
      totalPeriods: number;
      /** Number of periods the student was absent for this subject. */
      absentPeriods: number;
      /** Number of periods the student was late for this subject. */
      latePeriods: number;
      /** Number of periods the student was excused for this subject. */
      excusedPeriods: number;
    };
  };
};
