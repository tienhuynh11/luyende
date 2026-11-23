import type { Exam, GradeLevel, SubjectId } from '@shared/types';
import { SUBJECTS, getSubjectMeta } from './subjects';
import { GRADE_6_CONFIG, GRADE_6_EXAMS } from './toan/grade6';
import { GRADE_7_CONFIG, GRADE_7_EXAMS } from './toan/grade7';
import { GRADE_8_CONFIG, GRADE_8_EXAMS } from './toan/grade8';
import { GRADE_9_CONFIG, GRADE_9_EXAMS } from './toan/grade9';
import { buildGradeExams, type GradeGeneratorConfig } from './toan/helpers';

export { SUBJECTS, getSubjectMeta };

// Sau này khi thêm môn mới (ngu-van, tieng-anh, khtn, ls-dl...), chỉ cần thêm bộ đề vào registry này!
const EXAMS_BY_SUBJECT: Record<SubjectId, Record<GradeLevel, Exam[]>> = {
  toan: {
    6: GRADE_6_EXAMS,
    7: GRADE_7_EXAMS,
    8: GRADE_8_EXAMS,
    9: GRADE_9_EXAMS,
  },
  'ngu-van': { 6: [], 7: [], 8: [], 9: [] },
  'tieng-anh': { 6: [], 7: [], 8: [], 9: [] },
  khtn: { 6: [], 7: [], 8: [], 9: [] },
  'ls-dl': { 6: [], 7: [], 8: [], 9: [] },
};

const TOAN_CONFIGS: Record<GradeLevel, GradeGeneratorConfig> = {
  6: GRADE_6_CONFIG,
  7: GRADE_7_CONFIG,
  8: GRADE_8_CONFIG,
  9: GRADE_9_CONFIG,
};

export function getExams(subjectId: SubjectId, grade: GradeLevel): Exam[] {
  return EXAMS_BY_SUBJECT[subjectId]?.[grade] ?? [];
}

export function getAllExams(): Exam[] {
  return Object.values(EXAMS_BY_SUBJECT).flatMap((byGrade) => Object.values(byGrade).flat());
}

export function getExamById(examId: string): Exam | undefined {
  return getAllExams().find((e) => e.id === examId);
}

export function generateCustomMathExam(grade: GradeLevel, seed: number): Exam {
  const cfg = TOAN_CONFIGS[grade];
  const customCfg: GradeGeneratorConfig = {
    ...cfg,
    blueprints: [
      {
        index: Math.abs(seed % 9000) + 100,
        title: `Đề luyện tập ngẫu nhiên Toán ${grade} (#${Math.abs(seed % 900) + 100})`,
        subtitle: 'Đề sinh tự động chuẩn cấu trúc Cuối HK1: 12 Trắc nghiệm + 2 Đúng/Sai + 4 Trả lời ngắn',
        category: 'cuoi-hk1',
        textbook: 'chung',
        durationMinutes: 45,
        topics: cfg.blueprints[0].topics,
        sourceNote: 'Sinh đề luyện tập ngẫu nhiên - Kèm lời giải chi tiết',
        mcqCount: 12,
        tfCount: 2,
        saCount: 4,
      },
    ],
  };
  const exam = buildGradeExams(customCfg)[0];
  return { ...exam, id: `toan-${grade}-random-${seed}` };
}
