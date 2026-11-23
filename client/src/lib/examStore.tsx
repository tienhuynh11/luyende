import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Exam, GradeLevel, SubjectId } from '@shared/types';
import { getAllExams as getBuiltInExams } from '../content';
import { fetchStoredExams, type StoredExamDto } from './api';
import { useAuth } from './authContext';

interface ExamStoreValue {
  allExams: Exam[];
  loading: boolean;
  getExamsBySubjectGrade: (subjectId: SubjectId, grade: GradeLevel) => Exam[];
  getExam: (examId: string) => Exam | undefined;
  isBuiltIn: (examId: string) => boolean;
  isOverridden: (examId: string) => boolean;
  isCustom: (examId: string) => boolean;
  reloadExams: () => Promise<void>;
}

const ExamStoreContext = createContext<ExamStoreValue>({
  allExams: [],
  loading: false,
  getExamsBySubjectGrade: () => [],
  getExam: () => undefined,
  isBuiltIn: () => false,
  isOverridden: () => false,
  isCustom: () => false,
  reloadExams: async () => {},
});

export function ExamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const builtIn = useMemo(() => getBuiltInExams(), []);
  const builtInIds = useMemo(() => new Set(builtIn.map((e) => e.id)), [builtIn]);

  const [storedRows, setStoredRows] = useState<StoredExamDto[]>([]);
  const [loading, setLoading] = useState(true);

  const reloadExams = useCallback(async () => {
    try {
      const { exams } = await fetchStoredExams();
      setStoredRows(exams);
    } catch {
      setStoredRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadExams();
  }, [reloadExams, user?.id]);

  const { allExams, overriddenIds, customIds } = useMemo(() => {
    const storedMap = new Map<string, StoredExamDto>();
    for (const row of storedRows) {
      storedMap.set(row.exam.id, row);
    }

    const overridden = new Set<string>();
    const custom = new Set<string>();
    const merged: Exam[] = [];

    // Custom exams (not in built-in) shown first
    for (const row of storedRows) {
      if (!builtInIds.has(row.exam.id) && !row.isDeleted) {
        merged.push(row.exam);
        custom.add(row.exam.id);
      }
    }

    // Built-in exams (with overrides or hidden status)
    for (const base of builtIn) {
      const ov = storedMap.get(base.id);
      if (ov) {
        if (ov.isDeleted) continue;
        merged.push(ov.exam);
        overridden.add(base.id);
      } else {
        merged.push(base);
      }
    }

    return { allExams: merged, overriddenIds: overridden, customIds: custom };
  }, [builtIn, builtInIds, storedRows]);

  const getExamsBySubjectGrade = useCallback(
    (subjectId: SubjectId, grade: GradeLevel) =>
      allExams.filter((e) => e.subjectId === subjectId && e.grade === grade),
    [allExams],
  );

  const getExam = useCallback((examId: string) => allExams.find((e) => e.id === examId), [allExams]);
  const isBuiltIn = useCallback((examId: string) => builtInIds.has(examId), [builtInIds]);
  const isOverridden = useCallback((examId: string) => overriddenIds.has(examId), [overriddenIds]);
  const isCustom = useCallback((examId: string) => customIds.has(examId), [customIds]);

  return (
    <ExamStoreContext.Provider
      value={{
        allExams,
        loading,
        getExamsBySubjectGrade,
        getExam,
        isBuiltIn,
        isOverridden,
        isCustom,
        reloadExams,
      }}
    >
      {children}
    </ExamStoreContext.Provider>
  );
}

export function useExams() {
  return useContext(ExamStoreContext);
}
