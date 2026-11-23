export type SubjectId = 'toan' | 'ngu-van' | 'tieng-anh' | 'khtn' | 'ls-dl';

export type GradeLevel = 6 | 7 | 8 | 9;

export type TextbookSeries = 'kntt' | 'ctst' | 'cd' | 'chung';

export type ExamCategory = 'cuoi-hk1' | 'giua-hk1' | 'kiem-tra-15p' | 'on-tap-chuong';

export type DifficultyLevel = 'nhan-biet' | 'thong-hieu' | 'van-dung' | 'van-dung-cao';

export type UserRole = 'teacher' | 'student';

export interface AccountPublic {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  grade: GradeLevel | null;
  createdAt: string;
}

export interface StudentSummary {
  id: string;
  username: string;
  fullName: string;
  grade: GradeLevel | null;
  createdAt: string;
  submissionCount: number;
  avgScore: number | null;
}

export type ResultReleaseMode = 'immediate' | 'after-review';

export interface AssignmentInfo {
  id: string;
  teacherId: string;
  teacherName?: string;
  studentId: string | null; // null = giao cho tất cả học sinh
  studentName?: string;
  examId: string;
  examTitle: string;
  grade: GradeLevel;
  note: string;
  dueAt: string | null;
  resultMode: ResultReleaseMode;
  createdAt: string;
  submissionCount?: number;
  myBestScore?: number | null;
  mySubmittedAt?: string | null;
  myPendingReview?: boolean;
}

export interface SubmissionRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentUsername: string;
  assignmentId: string | null;
  examId: string;
  examTitle: string;
  grade: GradeLevel;
  category: ExamCategory;
  mode: 'exam' | 'practice';
  score: number;
  adjustedScore: number | null;
  correctCount: number;
  totalQuestions: number;
  durationSeconds: number;
  answers?: Record<string, UserAnswer>;
  teacherNote: string;
  questionNotes?: Record<string, string>;
  submittedAt: string;
  reviewedAt: string | null;
  feedbackAt: string | null;
  publishedAt: string | null; // null = đang chờ gia sư xác nhận công bố kết quả
}

export interface TheoryNote {
  id: string;
  teacherId: string;
  teacherName?: string;
  studentId: string | null; // null = tất cả học sinh
  studentName?: string;
  subjectId: SubjectId;
  grade: GradeLevel;
  title: string;
  summary: string;
  content: string; // Markdown + KaTeX $...$ / $$...$$
  imageDataUrl: string | null;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  kind: 'new-submission' | 'pending-assignment' | 'overdue-assignment' | 'teacher-feedback' | 'live-class';
  title: string;
  detail: string;
  link: string;
  urgent: boolean;
  timestamp: string;
  submissionId?: string;
}

export interface WhiteboardPoint {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
}

export type WhiteboardTool = 'pen' | 'highlighter' | 'line' | 'rect' | 'circle' | 'text' | 'eraser' | 'laser';

export type WhiteboardItem =
  | {
      id: string;
      kind: 'stroke';
      tool: 'pen' | 'highlighter' | 'line' | 'rect' | 'circle' | 'eraser';
      authorName: string;
      color: string;
      width: number;
      points: WhiteboardPoint[];
    }
  | {
      id: string;
      kind: 'text';
      authorName: string;
      color: string;
      fontSize: number;
      x: number;
      y: number;
      text: string;
    };

export interface BoardPage {
  id: string;
  title: string;
  backgroundImage: string | null; // compressed data:image/jpeg;base64,...
  items: WhiteboardItem[];
}

export interface LiveChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  role: UserRole;
  text: string;
  createdAt: string;
}

export interface LiveRoomState {
  active: boolean;
  hostName: string;
  startedAt: string | null;
  examId: string | null;
  questionIndex: number;
  showSolution: boolean;
  studentCanDraw: boolean;
  gridPaper: boolean;
  meetUrl: string;
  pages: BoardPage[];
  currentPageIndex: number;
  messages: LiveChatMessage[];
  participants: Array<{ id: string; name: string; role: UserRole }>;
}

export interface SubjectMeta {
  id: SubjectId;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  color: string;
  available: boolean;
}

export interface McqQuestion {
  id: string;
  type: 'mcq';
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  topic: string;
  difficulty: DifficultyLevel;
}

export interface TrueFalseStatement {
  label: 'a' | 'b' | 'c' | 'd';
  text: string;
  isTrue: boolean;
}

export interface TrueFalseQuestion {
  id: string;
  type: 'true-false';
  prompt: string;
  statements: [TrueFalseStatement, TrueFalseStatement, TrueFalseStatement, TrueFalseStatement];
  explanation: string;
  topic: string;
  difficulty: DifficultyLevel;
}

export interface ShortAnswerQuestion {
  id: string;
  type: 'short-answer';
  prompt: string;
  acceptedAnswers: string[];
  displayAnswer: string;
  unit?: string;
  explanation: string;
  topic: string;
  difficulty: DifficultyLevel;
}

export interface MultiSelectQuestion {
  id: string;
  type: 'multi-select';
  prompt: string;
  options: [string, string, string, string];
  correctIndices: number[]; // e.g. [0, 2]
  explanation: string;
  topic: string;
  difficulty: DifficultyLevel;
}

export type Question = McqQuestion | MultiSelectQuestion | TrueFalseQuestion | ShortAnswerQuestion;

export interface Exam {
  id: string;
  subjectId: SubjectId;
  grade: GradeLevel;
  title: string;
  subtitle: string;
  category: ExamCategory;
  textbook: TextbookSeries;
  term: 'HK1' | 'HK2';
  schoolYear: string;
  durationMinutes: number;
  topics: string[];
  questions: Question[];
  sourceNote?: string;
}

export type UserAnswer =
  | { type: 'mcq'; selectedIndex: number }
  | { type: 'multi-select'; selectedIndices: number[] }
  | { type: 'true-false'; values: Record<'a' | 'b' | 'c' | 'd', boolean | null> }
  | { type: 'short-answer'; text: string };

export interface QuestionResult {
  questionId: string;
  earnedPoints: number;
  maxPoints: number;
  isFullyCorrect: boolean;
  isAnswered: boolean;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  subjectId: SubjectId;
  grade: GradeLevel;
  examTitle: string;
  category: ExamCategory;
  mode: 'exam' | 'practice';
  startedAt: number;
  submittedAt: number;
  durationSeconds: number;
  score: number;
  correctCount: number;
  totalQuestions: number;
  answers: Record<string, UserAnswer>;
}

export interface UserProgress {
  version: number;
  updatedAt: number;
  attempts: ExamAttempt[];
}

export const TEXTBOOK_LABELS: Record<TextbookSeries, string> = {
  kntt: 'Kết nối tri thức',
  ctst: 'Chân trời sáng tạo',
  cd: 'Cánh diều',
  chung: 'Dùng chung 3 bộ sách',
};

export const CATEGORY_LABELS: Record<ExamCategory, string> = {
  'cuoi-hk1': 'Cuối HK1',
  'giua-hk1': 'Giữa HK1',
  'kiem-tra-15p': '15 phút',
  'on-tap-chuong': 'Ôn tập chương',
};

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  'nhan-biet': 'Nhận biết',
  'thong-hieu': 'Thông hiểu',
  'van-dung': 'Vận dụng',
  'van-dung-cao': 'Vận dụng cao',
};
