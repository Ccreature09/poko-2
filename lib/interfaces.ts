// ===========================
// 🔹 User Roles
// ===========================
type Role = "admin" | "teacher" | "student";

// ===========================
// 🔹 User Base
// ===========================
export type UserBase = {
  userId: string;
  firstName: string;
  lastName: string;
  phoneNumber: number;
  schoolName: string;
  email: string;
  role: Role;
  inbox: Inbox;
};

export interface BulkUserData {
  firstName: string;
  lastName: string;
  role: "student" | "teacher" | "admin";
  phoneNumber: string;
  homeroomClass?: string;
  schoolName: string;
}

// ===========================
// 🔹 User Types
// ===========================
export type Admin = UserBase & {
  role: "admin";
};

export type Teacher = UserBase & {
  role: "teacher";
  subjectsTaught: SubjectClass[];
  timetable: Timetable;
  homeroomClass?: HomeroomClass;
};

export type Student = UserBase & {
  role: "student";
  timetable: Timetable;
  homeroomClass: HomeroomClass;
  enrolledSubjects: SubjectClass[];
};

// ===========================
// 🔹 Timetable (For Students)
// ===========================
export type Timetable = {
  [day in
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"]?: ClassSession[];
};

type ClassSession = {
  classId: string;
  subject: string;
  teacher: UserBase;
  startTime: string; // e.g., "09:00"
  endTime: string; // e.g., "10:30"
};

// ===========================
// 🔹 Class Types
// ===========================
export type SubjectClass = {
  classId: string;
  subject: string;
  teacher: UserBase;
  students: UserBase[];
};

export type HomeroomClass = {
  classId: string;
  className: string; // e.g., "12A"
  students: UserBase[];
  homeroomTeacher: UserBase;
};

// ===========================
// 🔹 Courses
// ===========================
export type Course = {
  courseId: string;
  title: string;
  description: string;
  chapters: Chapter[];
};

type Chapter = {
  chapterId: string;
  title: string;
  subchapters: Subchapter[];
};

type Subchapter = {
  subchapterId: string;
  title: string;
  topics: Topic[];
};

type Topic = {
  topicId: string;
  title: string;
  content: string; // Markdown or HTML content
  quiz?: Quiz;
};

// ===========================
// 🔹 Quizzes
// ===========================
export type Quiz = {
  quizId: string;
  questions: Question[];
};

type QuestionType = "multipleChoice" | "singleChoice" | "openEnded";

type Question = {
  questionId: string;
  text: string;
  type: QuestionType;
  choices?: Choice[]; // Only for multiple/single choice
  correctAnswer?: string | string[]; // Single string for single choice, array for multiple choice
};

type Choice = {
  choiceId: string;
  text: string;
};

// ===========================
// 🔹 Inbox & Messaging System
// ===========================
type Inbox = {
  conversations: Conversation[];
};

export type Conversation = {
  conversationId: string;
  participants: UserBase[];
  messages: Message[];
  isGroup: boolean;
  groupName?: string;
  createdAt: string;
};

type Message = {
  messageId: string;
  sender: UserBase;
  content: string;
  timestamp: string;
  attachments?: Attachment[];
  readBy: UserBase[];
  replyTo?: string;
};

type Attachment = {
  attachmentId: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  sizeInBytes: number;
};

export interface BulkUserData {
  firstName: string;
  lastName: string;
  role: "student" | "teacher" | "admin";
  phoneNumber: string;
  homeroomClass?: string;
}

export interface User extends BulkUserData {
  id: string;
  email: string;
  schoolName: string;
}
