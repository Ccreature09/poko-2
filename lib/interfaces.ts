// ===========================
// 🔹 User Roles

import { Timestamp } from "firebase/firestore";

// ===========================
type Role = "admin" | "teacher" | "student";

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
  studentId: string;
  subjectId: string;
  teacherId: string;
  value: number; // e.g., 5.5
  timestamp: Timestamp// ISO format
};

// ===========================
// 🔹 Messaging System
// ===========================
export type Inbox = {
  conversations: Conversation[];
};

export type Conversation = {
  conversationId: string;
  participants: string[]; // User IDs
  messages: Message[];
  isGroup: boolean;
  groupName?: string;
  createdAt: string;
};

type Message = {
  messageId: string;
  senderId: string;
  content: string;
  timestamp: string;
  attachments?: Attachment[];
  readBy: string[]; // User IDs
  replyTo?: string;
};

type Attachment = {
  attachmentId: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  sizeInBytes: number;
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
  chapters: Chapter[];
  classIds: string[];
  createdAt: Timestamp;
};

type Chapter = {
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

export type Quiz = {
  quizId: string;
  teacherId: string;
  classIds: string[];
  createdAt: Timestamp;
  isActive: boolean;
  title: string;
  description: string;
  questions: Question[];
  points: number; // Added points field
  tookTest: string[]; // Added tookTest field
};

export type Question = {
  questionId: string;
  text: string;
  type: QuestionType;
  choices?: Choice[];
  correctAnswer?: string | string[];
  points: number; // Required points field
};

export type QuizResult = {
  quizId: string;
  userId: string;
  answers: Record<string, string | string[]>;
  score: number;
  totalPoints: number;
  timestamp: Timestamp;
};

export type Choice = {
  choiceId: string;
  text: string;
};

export type QuestionType = "multipleChoice" | "singleChoice" | "openEnded";


