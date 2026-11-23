import type {
  DifficultyLevel,
  Exam,
  ExamCategory,
  GradeLevel,
  McqQuestion,
  Question,
  ShortAnswerQuestion,
  TextbookSeries,
  TrueFalseQuestion,
} from '@shared/types';

export interface Rng {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(arr: readonly T[]) => T;
  shuffle: <T>(arr: readonly T[]) => T[];
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min;
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)];
  const shuffle = <T,>(arr: readonly T[]): T[] => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return { next, int, pick, shuffle };
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

export function lcm(a: number, b: number): number {
  return Math.abs(Math.trunc(a * b)) / gcd(a, b);
}

export function simplifyFraction(num: number, den: number): [number, number] {
  if (den < 0) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den);
  return [num / g, den / g];
}

export function fracLatex(num: number, den: number): string {
  const [n, d] = simplifyFraction(num, den);
  if (d === 1) return `${n}`;
  if (n < 0) return `-\\frac{${Math.abs(n)}}{${d}}`;
  return `\\frac{${n}}{${d}}`;
}

export function fracPlain(num: number, den: number): string[] {
  const [n, d] = simplifyFraction(num, den);
  if (d === 1) return [`${n}`];
  const out = [`${n}/${d}`];
  const dec = n / d;
  const decStr = Number(dec.toFixed(6)).toString();
  if (Math.abs(Number(decStr) - dec) < 1e-9 && decStr.length <= 8) {
    out.push(decStr);
  }
  return out;
}

export function makeMcq(
  rng: Rng,
  id: string,
  prompt: string,
  correct: string,
  distractors: string[],
  explanation: string,
  topic: string,
  difficulty: DifficultyLevel,
): McqQuestion {
  const uniqueWrong: string[] = [];
  for (const d of distractors) {
    if (d !== correct && !uniqueWrong.includes(d)) {
      uniqueWrong.push(d);
    }
    if (uniqueWrong.length === 3) break;
  }
  let fallback = 1;
  while (uniqueWrong.length < 3) {
    const cand = `$${fallback * 7 + 3}$`;
    if (cand !== correct && !uniqueWrong.includes(cand)) {
      uniqueWrong.push(cand);
    }
    fallback++;
  }
  const combined = rng.shuffle([
    { text: correct, isCorrect: true },
    { text: uniqueWrong[0], isCorrect: false },
    { text: uniqueWrong[1], isCorrect: false },
    { text: uniqueWrong[2], isCorrect: false },
  ]);
  const correctIndex = combined.findIndex((c) => c.isCorrect) as 0 | 1 | 2 | 3;
  return {
    id,
    type: 'mcq',
    prompt,
    options: [combined[0].text, combined[1].text, combined[2].text, combined[3].text],
    correctIndex,
    explanation,
    topic,
    difficulty,
  };
}

export function signedTerm(coef: number, variable = '', isFirst = false): string {
  if (coef === 0) return isFirst ? '0' : '';
  const abs = Math.abs(coef);
  const sign = coef < 0 ? (isFirst ? '-' : ' - ') : isFirst ? '' : ' + ';
  if (!variable) return `${sign}${abs}`;
  return `${sign}${abs === 1 ? '' : abs}${variable}`;
}

export interface ExamBlueprint {
  index: number;
  title: string;
  subtitle: string;
  category: ExamCategory;
  textbook: TextbookSeries;
  durationMinutes: number;
  topics: string[];
  sourceNote: string;
  mcqCount: number;
  tfCount: number;
  saCount: number;
  topicFilter?: string[];
}

export interface GradeGeneratorConfig {
  grade: GradeLevel;
  blueprints: ExamBlueprint[];
  mcqGenerators: Array<{ topic: string; generate: (rng: Rng, id: string) => McqQuestion }>;
  tfPool: Array<(rng: Rng, id: string) => TrueFalseQuestion>;
  saGenerators: Array<{ topic: string; generate: (rng: Rng, id: string) => ShortAnswerQuestion }>;
}

export function buildGradeExams(config: GradeGeneratorConfig): Exam[] {
  return config.blueprints.map((bp) => {
    const seed = config.grade * 10000 + bp.index * 137 + 42;
    const rng = createRng(seed);

    const allowedMcq = bp.topicFilter
      ? config.mcqGenerators.filter((g) => bp.topicFilter!.includes(g.topic))
      : config.mcqGenerators;
    const allowedSa = bp.topicFilter
      ? config.saGenerators.filter((g) => bp.topicFilter!.includes(g.topic))
      : config.saGenerators;

    const mcqPool = allowedMcq.length > 0 ? allowedMcq : config.mcqGenerators;
    const saPool = allowedSa.length > 0 ? allowedSa : config.saGenerators;

    const questions: Question[] = [];
    const shuffledMcq = rng.shuffle(mcqPool);
    for (let i = 0; i < bp.mcqCount; i++) {
      const gen = shuffledMcq[i % shuffledMcq.length];
      questions.push(gen.generate(rng, `t${config.grade}-d${bp.index}-mcq-${i + 1}`));
    }

    const shuffledTf = rng.shuffle(config.tfPool);
    for (let i = 0; i < bp.tfCount; i++) {
      const gen = shuffledTf[i % shuffledTf.length];
      questions.push(gen(rng, `t${config.grade}-d${bp.index}-tf-${i + 1}`));
    }

    const shuffledSa = rng.shuffle(saPool);
    for (let i = 0; i < bp.saCount; i++) {
      const gen = shuffledSa[i % shuffledSa.length];
      questions.push(gen.generate(rng, `t${config.grade}-d${bp.index}-sa-${i + 1}`));
    }

    return {
      id: `toan-${config.grade}-de-${String(bp.index).padStart(2, '0')}`,
      subjectId: 'toan',
      grade: config.grade,
      title: bp.title,
      subtitle: bp.subtitle,
      category: bp.category,
      textbook: bp.textbook,
      term: 'HK1',
      schoolYear: '2026-2027',
      durationMinutes: bp.durationMinutes,
      topics: bp.topics,
      questions,
      sourceNote: bp.sourceNote,
    };
  });
}
