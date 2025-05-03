// Дефиниции на всички интерфейси и типове данни, използвани в приложението
import { Timestamp } from "firebase/firestore";

// ===========================
// 🔹 Потребителски роли
// ===========================
export type Role = "admin" | "teacher" | "student" | "parent";

// ===========================
// 🔹 Отзиви за ученици
// ===========================
export type StudentReview = {
  reviewId: string;
  studentId: string;
  teacherId: string;
  teacherName: string;
  subjectId?: string;
  subjectName?: string;
  title: string;
  content: string;
  type: ReviewType;
  date: Timestamp;
  createdAt: Timestamp;
};

export type ReviewType = "positive" | "negative";

// ===========================
// 🔹 Базов потребителски интерфейс
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
  homeroomClassId?: string; // ID на класа, в който е ученикът или класният ръководител

  yearGroup?: number; // Учебна година/клас (например 10-ти клас)
  classLetter?: string; // Буква на паралелката (напр. "А", "Б")

  // Персонализиран формат (напр. "Class 1", "Class 2")
  customClassName?: string; // Персонализирано име на клас

  // Формат на наименуването на класа за този потребител
  classNamingFormat?: ClassNamingFormat; // "graded" или "custom"

  inbox: Inbox; // Входяща кутия за съобщения
};

// Данни за масово създаване на потребители
export interface BulkUserData {
  firstName: string;
  lastName: string;
  role: Role;
  phoneNumber: string;
  homeroomClassId?: string;
  schoolId: string;
}

// ===========================
// 🔹 Типове потребители
// ===========================
// Администратор
export type Admin = UserBase & {
  role: "admin";
};

// Учител
export type Teacher = UserBase & {
  role: "teacher";
  teachesClasses: string[]; // ID-та на класовете, в които преподава учителят
  timetable: Timetable; // Програма на учителя
};

// Ученик
export type Student = UserBase & {
  role: "student";
  homeroomClassId: string; // ID на класа, в който е ученикът
  enrolledSubjects: string[]; // ID-та на предметите, в които е записан ученикът
  timetable: Timetable; // Програма на ученика
};

// Родител
export type Parent = UserBase & {
  role: "parent";
  childrenIds: string[]; // ID-та на децата (ученици) на родителя
};

// ===========================
// 🔹 Програма (за потребители)
// ===========================
export type Timetable = {
  [key: string]: ClassSession[];
};

export type ClassSession = {
  entries: {
    day: string; // Ден от седмицата
    period: number; // Номер на час за деня
    classId: string; // ID на класа
    subjectId: string; // ID на предмета
    teacherId: string; // ID на учителя
    startTime: string; // Начален час, например "09:00"
    endTime: string; // Краен час, например "10:30"
  }[];
  homeroomClassId: string;
  periods?: {
    period: number;
    startTime: string;
    endTime: string;
  }[];
};

// ===========================
// 🔹 Класове
// ===========================
// Тип за формат на наименуване на класовете
export type ClassNamingFormat = "graded" | "custom";

// Клас с класен ръководител
export type HomeroomClass = {
  classId: string;
  className: string; // напр. "10А" (graded) или "Class 1" (custom)
  namingFormat: ClassNamingFormat; // Формат за наименоване на класа

  // За формат "graded"
  gradeNumber?: number; // Номер на класа (напр. 10 за 10-ти клас)
  classLetter?: string; // Буква на паралелката (напр. "А")

  // За формат "custom"
  customName?: string; // Персонализирано име (напр. "Class 1")
  classTeacherId: string; // ID на класния ръководител
  studentIds: string[]; // ID-та на учениците в класа
  teacherIds: string[]; // ID-та на учителите, които преподават в класа
};

// Клас за конкретен предмет
export type SubjectClass = {
  classId: string;
  subject: string; // Име на предмета
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
// 🔹 Предмети
// ===========================
export type Subject = {
  subjectId: string;
  name: string;
  description: string;
  teacherIds: string[]; // Учители, преподаващи този предмет
  studentIds: string[]; // Ученици, записани в предмета
  category?: string; // core, elective, specialized
  weeklyHours?: number; // Часове седмично
  gradeLevel?: number[]; // За кои класове (1-12) е предметът
};

// New type for teacher-class-subject assignments
export type TeacherSubjectAssignment = {
  assignmentId: string;
  teacherId: string;
  subjectId: string;
  classIds: string[]; // Homeroom class IDs this teacher teaches this subject to
  schoolYear: string; // Academic year (e.g., "2024-2025")
  schedule?: {
    [dayOfWeek: string]: {
      periodNumber: number;
      classId: string;
    }[];
  }; // Optional schedule information
};

// Type for homeroom classes with additional subject mapping
export type ClassSubjectsMapping = {
  classId: string;
  className: string;
  subjects: {
    subjectId: string;
    teacherId: string;
  }[];
};

// ===========================
// 🔹 Оценки
// ===========================
export type Grade = {
  id?: string;
  studentId: string;
  subjectId: string;
  teacherId: string;
  value: number; // Българска система за оценяване: 2-6
  title: string;
  description?: string;
  type: GradeType;
  date: Timestamp;
  createdAt: Timestamp;
};

// Тип на оценката
export type GradeType =
  | "exam"
  | "homework"
  | "participation"
  | "project"
  | "test"
  | "other";

// ===========================
// 🔹 Българска система за оценяване
// ===========================
export type BulgarianGradingScale = {
  poor: {
    // Слаб 2
    min: number;
    max: number;
  };
  average: {
    // Среден 3
    min: number;
    max: number;
  };
  good: {
    // Добър 4
    min: number;
    max: number;
  };
  veryGood: {
    // Мн. Добър 5
    min: number;
    max: number;
  };
  excellent: {
    // Отличен 6
    min: number;
    max: number;
  };
};

// Default Bulgarian grading scale
export const defaultGradingScale: BulgarianGradingScale = {
  poor: { min: 0, max: 49 },
  average: { min: 50, max: 62 },
  good: { min: 63, max: 74 },
  veryGood: { min: 75, max: 87 },
  excellent: { min: 88, max: 100 },
};

// ===========================
// 🔹 Задачи
// ===========================
export type Assignment = {
  assignmentId: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  dueDate: Timestamp; // Краен срок
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  classIds: string[]; // Асоциирани с кои класове
  studentIds: string[]; // Асоциирани с кои ученици (ако има такива)
  allowLateSubmission: boolean; // Разрешаване на късно предаване
  allowResubmission: boolean; // Разрешаване на повторно предаване
  status: AssignmentStatus;
  gradingScale?: BulgarianGradingScale; // Скала за оценяване по Българската система
};

export type AssignmentStatus = "active" | "draft" | "archived";

// Предаване на задача
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

// Обратна връзка за задача
export type AssignmentFeedback = {
  teacherId: string;
  comment: string;
  grade?: number;
  gradedAt: Timestamp;
};

// ===========================
// 🔹 Система за съобщения
// ===========================
export type Inbox = {
  conversations: Conversation[];
  unreadCount: number; // Общ брой непрочетени съобщения във всички разговори
};

export type Conversation = {
  conversationId: string;
  participants: string[]; // ID-та на потребителите
  participantRoles?: Record<string, Role>; // За съхранение на роли на участниците за проверка на разрешения
  messages: Message[];
  isGroup: boolean;
  groupName?: string;
  createdAt: string;
  updatedAt: string; // Timestamp на последното съобщение
  lastMessage?: Message; // Последно съобщение за преглед
  type: ConversationType;
  unreadCount: Record<string, number>; // Changed to Record<string, number> to track unread counts per participant
};

export type ConversationType =
  | "one-to-one" // Лични съобщения
  | "class" // За съобщения от учител към клас
  | "announcement" // За съобщения от администрация
  | "group"; // Персонализирани групи

export type Message = {
  messageId: string;
  senderId: string;
  content: string;
  timestamp: string | Timestamp;
  readBy: string[]; // ID-та на потребители, прочели съобщението
  replyTo?: string; // ID на съобщение, на което се отговаря
  status: MessageStatus;
  isSystemMessage?: boolean; // За системни известия
};

export type MessageStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

// Нови типове за системата за съобщения

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
// 🔹 Записи в програмата
// ===========================
export type TimetableEntry = {
  day: string;
  period: number;
  subjectName: string;
};

// ===========================
// 🔹 Курсове и материали
// ===========================
export type Course = {
  courseId: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string; // Име на учителя (firstName + lastName)
  subject: string; // Предмет, свързан с курса
  chapters: Chapter[];
  classIds: string[]; // ID-та на класовете (напр. "10A", "12Б")
  createdAt: Timestamp;
};

// Глава от курс
export type Chapter = {
  title: string;
  chapterId: string;
  subchapters?: Subchapter[];
};

// Подглава
export type Subchapter = {
  subchapterId: string;
  title: string;
  topics: Topic[];
};

// Тема в курса
export type Topic = {
  topicId: string;
  title: string;
  content: string;
  quiz?: Quiz;
};

// ===========================
// 🔹 Тестове и въпроси
// ===========================
export interface Quiz {
  quizId: string;
  title: string;
  description: string;
  questions: Question[];
  teacherId: string;
  createdAt: Timestamp; // Firestore Timestamp
  classIds: string[];
  timeLimit?: number; // Ограничение на времето в минути
  securityLevel?: string; // Ниво на сигурност
  showResults?: string; // Кога да се показват резултатите
  maxAttempts?: number; // Максимален брой опити
  availableFrom?: Timestamp; // Начало на теста
  availableTo?: Timestamp; // Край на теста
  randomizeQuestions?: boolean; // Разбъркване на въпросите
  randomizeChoices?: boolean; // Разбъркване на възможните отговори
  allowReview?: boolean; // Позволява преглед на отговорите след теста
  proctored?: boolean; // Дали тестът е наблюдаван
  tookTest?: string[]; // Списък на потребителите, направили теста
  points?: number; // Общ брой точки
  inProgress?: boolean;
  isAvailable?: boolean;
  status?: "draft" | "published" | "archived";
  activeUsers?: string[]; // Списък на потребителите, които в момента правят теста
  cheatingAttempts?: Record<string, CheatAttempt[]>; // Записи за опити за измама по потребител
  lastActiveTimestamp?: Timestamp; // Времеви печат на последната активност в теста
  gradingScale?: BulgarianGradingScale; // Скала за оценяване по Българската система
}

// Въпрос в тест
export type Question = {
  questionId: string;
  text: string;
  type: QuestionType;
  choices?: Choice[]; // Възможни отговори
  correctAnswer?: string | string[]; // Правилен отговор или отговори
  points: number; // Точки за въпроса
  image?: string; // Опционално URL на изображение към въпроса
  timeSpent?: number; // Време, прекарано на този въпрос (в секунди)
  explanation?: string; // Обяснение на верния отговор (показва се след приключване на теста)
};

// Резултат от тест
export type QuizResult = {
  quizId: string;
  userId: string;
  answers: Record<string, string | string[]>;
  score: number;
  totalPoints: number;
  timestamp: Timestamp;
  completed: boolean; // Дали тестът е завършен или все още е в процес
  startedAt: Timestamp; // Кога ученикът е започнал теста
  questionTimeSpent?: Record<string, number>; // Време, прекарано на всеки въпрос
  totalTimeSpent?: number; // Общо време, прекарано в теста (в секунди)
  securityViolations?: number; // Брой нарушения на сигурността
  studentName?: string; // Добавено за по-лесен достъп до името на ученика в прегледите
  questionProgress?: number; // Текущият индекс на въпроса, на който е ученикът
};

// Възможен отговор
export type Choice = {
  choiceId: string;
  text: string;
};

// Тип на въпроса
export type QuestionType =
  | "multipleChoice"
  | "singleChoice"
  | "openEnded"
  | "trueFalse"
  | "matching";

// Ниво на сигурност на теста
export type QuizSecurityLevel = "low" | "medium" | "high" | "extreme";

// Опит за измама
export type CheatAttempt = {
  timestamp: Timestamp;
  type: CheatAttemptType;
  description: string;
  quizId?: string; // За по-лесно филтриране
  studentId?: string; // За по-лесно филтриране
};

// Тип на опит за измама
export type CheatAttemptType =
  | "tab_switch" // Превключване на раздели
  | "window_blur" // Излизане от прозореца
  | "copy_detected" // Засечен е опит за копиране
  | "browser_close" // Затваряне на браузъра
  | "multiple_devices" // Използване на няколко устройства
  | "time_anomaly" // Аномалия във времето
  | "quiz_abandoned"; // Изоставен тест

// ===========================
// 🔹 Мониторинг на тестове
// ===========================
// Нов тип за мониторинг на тестове в реално време
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
  questionProgress: number; // Текущ номер на въпроса
  questionsAnswered: number; // Брой отговорени въпроси
  cheatingAttempts: CheatAttempt[]; // Опити за измама
  status: "active" | "idle" | "submitted" | "suspected_cheating";
};

// ===========================
// 🔹 Известия
// ===========================
export type NotificationType =
  | "new-assignment" // Нова задача
  | "assignment-due-soon" // Наближаващ краен срок
  | "assignment-graded" // Оценена задача
  | "assignment-feedback" // Обратна връзка за задача
  | "late-submission" // Късно предаване
  | "quiz-published" // Публикуван тест
  | "quiz-updated" // Актуализиран тест
  | "quiz-graded" // Оценен тест
  | "new-grade" // Нова оценка
  | "edited-grade" // Променена оценка
  | "deleted-grade"; // Изтрита оценка

// ===========================
// 🔹 Предаване на тест
// ===========================
export type QuizSubmission = {
  submissionId: string;
  quizId: string;
  studentId: string;
  studentName?: string;
  quizTitle: string;
  questions: Question[];
  answers: Record<string, string | string[]>; // Отговори на ученика
  score?: number; // Резултат
  maxScore?: number; // Максимален възможен резултат
  percentageScore?: number; // Процентен резултат
  grades?: Record<string, number>; // Оценки по въпроси
  feedback?: string; // Обратна връзка
  submittedAt: Timestamp;
  gradedAt?: Timestamp;
  status: "submitted" | "graded";
};

// ===========================
// 🔹 Attendance Tracking
// ===========================
export type AttendanceRecord = {
  attendanceId: string;
  studentId: string;
  studentName?: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  teacherId: string;
  teacherName?: string;
  date: Timestamp;
  status: AttendanceStatus;
  periodNumber: number;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  notifiedParent: boolean;
  justified: boolean;
  justificationNote?: string;
  justifiedBy?: string; // ID of admin or teacher who justified the absence
  justifiedAt?: Timestamp;
};

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type AttendanceReportPeriod = "day" | "week" | "month" | "term" | "year";

export type AttendanceReport = {
  studentId: string;
  startDate: Timestamp;
  endDate: Timestamp;
  totalDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  absenceRate: number; // Percentage
  tardyRate: number; // Percentage
  bySubject: {
    [subjectId: string]: {
      totalPeriods: number;
      absentPeriods: number;
      latePeriods: number;
      excusedPeriods: number;
    };
  };
};
