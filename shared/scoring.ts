import type { Exam, Question, QuestionResult, UserAnswer } from './types.js';

export function normalizeShortAnswer(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/−/g, '-')
    .replace(/°/g, '')
    .replace(/^=/, '');
}

function tryParseNumber(s: string): number | null {
  const norm = normalizeShortAnswer(s);
  if (!norm) return null;
  if (norm.includes('/')) {
    const parts = norm.split('/');
    if (parts.length === 2) {
      const num = Number(parts[0]);
      const den = Number(parts[1]);
      if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
        return num / den;
      }
    }
    return null;
  }
  const val = Number(norm);
  return Number.isFinite(val) ? val : null;
}

export function isShortAnswerCorrect(input: string, accepted: string[]): boolean {
  const normInput = normalizeShortAnswer(input);
  if (!normInput) return false;

  for (const ans of accepted) {
    const normAns = normalizeShortAnswer(ans);
    if (normInput === normAns) return true;
    const n1 = tryParseNumber(normInput);
    const n2 = tryParseNumber(normAns);
    if (n1 !== null && n2 !== null && Math.abs(n1 - n2) < 1e-6) {
      return true;
    }
  }
  return false;
}

export function getQuestionWeight(q: Question): number {
  if (q.type === 'true-false') return 4; // Equivalent to 1.0 pt when MCQ is 0.25 pt
  if (q.type === 'short-answer' || q.type === 'multi-select') return 2; // Equivalent to 0.5 pt
  return 1; // MCQ = 1 unit
}

export function gradeQuestion(q: Question, answer: UserAnswer | undefined, unitPoints: number): QuestionResult {
  const maxPoints = getQuestionWeight(q) * unitPoints;

  if (!answer) {
    return { questionId: q.id, earnedPoints: 0, maxPoints, isFullyCorrect: false, isAnswered: false };
  }

  if (q.type === 'mcq' && answer.type === 'mcq') {
    const ok = answer.selectedIndex === q.correctIndex;
    return {
      questionId: q.id,
      earnedPoints: ok ? maxPoints : 0,
      maxPoints,
      isFullyCorrect: ok,
      isAnswered: answer.selectedIndex >= 0,
    };
  }

  if (q.type === 'multi-select' && answer.type === 'multi-select') {
    const chosen = Array.from(new Set(answer.selectedIndices)).sort((a, b) => a - b);
    const expected = Array.from(new Set(q.correctIndices)).sort((a, b) => a - b);
    const ok =
      chosen.length === expected.length && chosen.every((val, idx) => val === expected[idx]);
    return {
      questionId: q.id,
      earnedPoints: ok ? maxPoints : 0,
      maxPoints,
      isFullyCorrect: ok,
      isAnswered: chosen.length > 0,
    };
  }

  if (q.type === 'true-false' && answer.type === 'true-false') {
    let correctCount = 0;
    let answeredCount = 0;
    for (const stmt of q.statements) {
      const val = answer.values[stmt.label];
      if (val !== null && val !== undefined) {
        answeredCount++;
        if (val === stmt.isTrue) correctCount++;
      }
    }
    // Chuẩn tính điểm Đúng/Sai GDPT 2018: 1 ý = 10%, 2 ý = 25%, 3 ý = 50%, 4 ý = 100%
    const ratio =
      correctCount === 4 ? 1 : correctCount === 3 ? 0.5 : correctCount === 2 ? 0.25 : correctCount === 1 ? 0.1 : 0;
    return {
      questionId: q.id,
      earnedPoints: maxPoints * ratio,
      maxPoints,
      isFullyCorrect: correctCount === 4,
      isAnswered: answeredCount > 0,
    };
  }

  if (q.type === 'short-answer' && answer.type === 'short-answer') {
    const trimmed = answer.text.trim();
    const ok = isShortAnswerCorrect(trimmed, q.acceptedAnswers);
    return {
      questionId: q.id,
      earnedPoints: ok ? maxPoints : 0,
      maxPoints,
      isFullyCorrect: ok,
      isAnswered: trimmed.length > 0,
    };
  }

  return { questionId: q.id, earnedPoints: 0, maxPoints, isFullyCorrect: false, isAnswered: false };
}

export function gradeExam(exam: Exam, answers: Record<string, UserAnswer>) {
  const totalWeight = exam.questions.reduce((acc, q) => acc + getQuestionWeight(q), 0);
  const unitPoints = totalWeight > 0 ? 10 / totalWeight : 0;

  const results = exam.questions.map((q) => gradeQuestion(q, answers[q.id], unitPoints));
  const rawScore = results.reduce((acc, r) => acc + r.earnedPoints, 0);
  const score = Math.round(rawScore * 100) / 100;
  const correctCount = results.filter((r) => r.isFullyCorrect).length;
  const answeredCount = results.filter((r) => r.isAnswered).length;

  return {
    score,
    correctCount,
    answeredCount,
    totalQuestions: exam.questions.length,
    results,
  };
}
