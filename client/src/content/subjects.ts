import type { SubjectMeta } from '@shared/types';

export const SUBJECTS: SubjectMeta[] = [
  {
    id: 'toan',
    name: 'Toán học',
    shortName: 'Toán',
    description: 'Đại số, Số học & Hình học THCS theo chương trình GDPT 2018',
    icon: '∑',
    color: '#1f5f4f',
    available: true,
  },
  {
    id: 'ngu-van',
    name: 'Ngữ văn',
    shortName: 'Văn',
    description: 'Đọc hiểu văn bản, Tiếng Việt & Làm văn (sắp bổ sung)',
    icon: '文',
    color: '#9a4d32',
    available: false,
  },
  {
    id: 'tieng-anh',
    name: 'Tiếng Anh',
    shortName: 'Anh',
    description: 'Ngữ pháp, Từ vựng, Phát âm & Đọc hiểu Global Success (sắp bổ sung)',
    icon: 'Aa',
    color: '#2b598a',
    available: false,
  },
  {
    id: 'khtn',
    name: 'Khoa học tự nhiên',
    shortName: 'KHTN',
    description: 'Vật lí, Hóa học & Sinh học tích hợp THCS (sắp bổ sung)',
    icon: '⚛',
    color: '#5a438c',
    available: false,
  },
  {
    id: 'ls-dl',
    name: 'Lịch sử & Địa lí',
    shortName: 'Sử - Địa',
    description: 'Lịch sử và Địa lí THCS theo GDPT 2018 (sắp bổ sung)',
    icon: '✦',
    color: '#8c6219',
    available: false,
  },
];

export function getSubjectMeta(id: string): SubjectMeta | undefined {
  return SUBJECTS.find((s) => s.id === id);
}
