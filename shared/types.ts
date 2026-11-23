export type SubjectId = 'toan' | 'ngu-van' | 'tieng-anh' | 'khtn' | 'ls-dl';

export type GradeLevel = 6 | 7 | 8 | 9;

export type TextbookSeries = 'kntt' | 'ctst' | 'cd' | 'chung';

export type ExamCategory = 'cuoi-hk1' | 'giua-hk1' | 'kiem-tra-15p' | 'on-tap-chuong';

export type DifficultyLevel = 'nhan-biet' | 'thong-hieu' | 'van-dung' | 'van-dung-cao';

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
  prompt: string; // Supports inline $...$ and block $$...$$ LaTeX
  options: [string, string, string, string]; // A, B, C, D
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string; // Detailed step-by-step solution with LaTeX
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
  acceptedAnswers: string[]; // Normalized strings e.g. ["12", "-3/2", "-1.5"]
  displayAnswer: string; // Pretty LaTeX display e.g. "$-\\frac{3}{2}$" or "$12$"
  unit?: string;
  explanation: string;
  topic: string;
  difficulty: DifficultyLevel;
}

export type Question = McqQuestion | TrueFalseQuestion | ShortAnswerQuestion;

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
  score: number; // Out of 10
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
  'cuoi-hk1': 'Cuối Học kì 1',
  'giua-hk1': 'Giữa Học kì 1',
  'kiem-tra-15p': 'Kiểm tra 15 phút',
  'on-tap-chuong': 'Ôn tập chương',
};

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  'nhan-biet': 'Nhận biết',
  'thong-hieu': 'Thông hiểu',
  'van-dung': 'Vận dụng',
  'van-dung-cao': 'Vận dụng cao',
};
