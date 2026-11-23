import type { Exam, ShortAnswerQuestion, TrueFalseQuestion } from '@shared/types';
import {
  buildGradeExams,
  makeMcq,
  type ExamBlueprint,
  type GradeGeneratorConfig,
} from './helpers';

const TOPICS = {
  DA_THUC: 'Đơn thức & Đa thức nhiều biến',
  HANG_DANG_THUC: 'Hằng đẳng thức & Phân tích đa thức',
  TU_GIAC: 'Tứ giác đặc biệt (Hình thang, Hình bình hành, HCN, Hình thoi, Hình vuông)',
  THALES: 'Định lí Thalès & Đường trung bình, Phân giác',
  HINH_CHOP: 'Hình chóp đều & Định lí Pythagore',
  DU_LIEU: 'Dữ liệu & Biểu đồ',
} as const;

const mcqGenerators: GradeGeneratorConfig['mcqGenerators'] = [
  // 1. Bậc của đơn thức
  {
    topic: TOPICS.DA_THUC,
    generate: (rng, id) => {
      const c = rng.pick([-5, -3, 2, 4, 7]);
      const a = rng.int(2, 5);
      const b = rng.int(2, 4);
      const d = rng.int(1, 3);
      const deg = a + b + d;
      return makeMcq(
        rng,
        id,
        `Bậc của đơn thức $${c}x^{${a}}y^{${b}}z^{${d}}$ là:`,
        `$${deg}$`,
        [`$${a + b}$`, `$${a * b}$`, `$${deg + 1}$`],
        `Bậc của đơn thức có hệ số khác $0$ là tổng số mũ của tất cả các biến có trong đơn thức:\n$$${a} + ${b} + ${d} = ${deg}.$$`,
        TOPICS.DA_THUC,
        'nhan-biet',
      );
    },
  },
  // 2. Nhân đơn thức với đa thức
  {
    topic: TOPICS.DA_THUC,
    generate: (rng, id) => {
      const a = rng.int(2, 5);
      const b = rng.int(2, 6);
      const c = rng.int(1, 5);
      return makeMcq(
        rng,
        id,
        `Kết quả của phép nhân $${a}x(${b}x - ${c})$ là:`,
        `$${a * b}x^2 - ${a * c}x$`,
        [`$${a * b}x^2 - ${c}x$`, `$${a + b}x^2 - ${a * c}x$`, `$${a * b}x - ${a * c}$`],
        `Áp dụng quy tắc nhân đơn thức với đa thức:\n$$${a}x(${b}x - ${c}) = ${a}x \\cdot ${b}x - ${a}x \\cdot ${c} = ${a * b}x^2 - ${a * c}x.$$`,
        TOPICS.DA_THUC,
        'nhan-biet',
      );
    },
  },
  // 3. Chia đa thức cho đơn thức
  {
    topic: TOPICS.DA_THUC,
    generate: (rng, id) => {
      const k = rng.int(2, 5);
      const p = rng.int(2, 6);
      const q = rng.int(1, 5);
      return makeMcq(
        rng,
        id,
        `Thương của phép chia $(${k * p}x^3y^2 - ${k * q}x^2y) : (${k}x^2y)$ là:`,
        `$${p}xy - ${q}$`,
        [`$${p}xy - ${k * q}$`, `$${p}x^2y - ${q}$`, `$${p}xy + ${q}$`],
        `Chia từng hạng tử của đa thức cho đơn thức $${k}x^2y$:\n$$\\dfrac{${k * p}x^3y^2}{${k}x^2y} - \\dfrac{${k * q}x^2y}{${k}x^2y} = ${p}xy - ${q}.$$`,
        TOPICS.DA_THUC,
        'thong-hieu',
      );
    },
  },
  // 4. Hằng đẳng thức (a + b)^2
  {
    topic: TOPICS.HANG_DANG_THUC,
    generate: (rng, id) => {
      const a = rng.int(2, 5);
      const b = rng.int(1, 6);
      return makeMcq(
        rng,
        id,
        `Khai triển hằng đẳng thức $(${a}x + ${b})^2$ ta được:`,
        `$${a * a}x^2 + ${2 * a * b}x + ${b * b}$`,
        [
          `$${a * a}x^2 + ${a * b}x + ${b * b}$`,
          `$${a}x^2 + ${2 * a * b}x + ${b * b}$`,
          `$${a * a}x^2 + ${b * b}$`,
        ],
        `Áp dụng hằng đẳng thức $(A + B)^2 = A^2 + 2AB + B^2$:\n$$(${a}x + ${b})^2 = (${a}x)^2 + 2 \\cdot ${a}x \\cdot ${b} + ${b}^2 = ${a * a}x^2 + ${2 * a * b}x + ${b * b}.$$`,
        TOPICS.HANG_DANG_THUC,
        'nhan-biet',
      );
    },
  },
  // 5. Hiệu hai bình phương
  {
    topic: TOPICS.HANG_DANG_THUC,
    generate: (rng, id) => {
      const a = rng.int(2, 6);
      const b = rng.int(2, 7);
      return makeMcq(
        rng,
        id,
        `Phân tích đa thức $${a * a}x^2 - ${b * b}$ thành nhân tử ta được:`,
        `$(${a}x - ${b})(${a}x + ${b})$`,
        [
          `$(${a * a}x - ${b})(${a * a}x + ${b})$`,
          `$(${a}x - ${b})^2$`,
          `$(${a}x - ${b * b})(${a}x + ${b * b})$`,
        ],
        `Áp dụng hằng đẳng thức hiệu hai bình phương $A^2 - B^2 = (A - B)(A + B)$:\n$$${a * a}x^2 - ${b * b} = (${a}x)^2 - ${b}^2 = (${a}x - ${b})(${a}x + ${b}).$$`,
        TOPICS.HANG_DANG_THUC,
        'nhan-biet',
      );
    },
  },
  // 6. Tính nhanh bằng hằng đẳng thức
  {
    topic: TOPICS.HANG_DANG_THUC,
    generate: (rng, id) => {
      const base = rng.pick([40, 50, 60, 70, 80, 100]);
      const d = rng.pick([1, 2, 3]);
      const a = base + d;
      const b = base - d;
      const ans = a * a - b * b;
      return makeMcq(
        rng,
        id,
        `Giá trị của biểu thức $${a}^2 - ${b}^2$ là:`,
        `$${ans}$`,
        [`$${(a - b) * (a - b)}$`, `$${ans + 200}$`, `$${a + b}$`],
        `Áp dụng hằng đẳng thức $A^2 - B^2 = (A - B)(A + B)$:\n$$${a}^2 - ${b}^2 = (${a} - ${b})(${a} + ${b}) = ${2 * d} \\cdot ${2 * base} = ${ans}.$$`,
        TOPICS.HANG_DANG_THUC,
        'thong-hieu',
      );
    },
  },
  // 7. Phân tích đa thức đặt nhân tử chung + hằng đẳng thức
  {
    topic: TOPICS.HANG_DANG_THUC,
    generate: (rng, id) => {
      const k = rng.int(2, 5);
      const a = rng.int(2, 6);
      return makeMcq(
        rng,
        id,
        `Phân tích đa thức $${k}x^2 - ${k * a * a}$ thành nhân tử:`,
        `$${k}(x - ${a})(x + ${a})$`,
        [
          `$${k}(x - ${a})^2$`,
          `$(${k}x - ${a})(${k}x + ${a})$`,
          `$${k}(x - ${a * a})(x + ${a * a})$`,
        ],
        `Đặt nhân tử chung $${k}$, sau đó dùng hiệu hai bình phương:\n$$${k}x^2 - ${k * a * a} = ${k}(x^2 - ${a * a}) = ${k}(x - ${a})(x + ${a}).$$`,
        TOPICS.HANG_DANG_THUC,
        'thong-hieu',
      );
    },
  },
  // 8. Tổng 4 góc trong tứ giác
  {
    topic: TOPICS.TU_GIAC,
    generate: (rng, id) => {
      const A = rng.int(65, 115);
      const B = rng.int(70, 110);
      const C = rng.int(60, 100);
      const D = 360 - A - B - C;
      return makeMcq(
        rng,
        id,
        `Cho tứ giác $ABCD$ có $\\widehat{A} = ${A}^\\circ, \\widehat{B} = ${B}^\\circ, \\widehat{C} = ${C}^\\circ$. Số đo góc $\\widehat{D}$ là:`,
        `$${D}^\\circ$`,
        [`$${180 - C}^\\circ$`, `$${D + 15}^\\circ$`, `$${D - 10}^\\circ$`],
        `Tổng bốn góc của một tứ giác bằng $360^\\circ$:\n$$\\widehat{D} = 360^\\circ - (${A}^\\circ + ${B}^\\circ + ${C}^\\circ) = 360^\\circ - ${A + B + C}^\\circ = ${D}^\\circ.$$`,
        TOPICS.TU_GIAC,
        'nhan-biet',
      );
    },
  },
  // 9. Dấu hiệu nhận biết tứ giác đặc biệt
  {
    topic: TOPICS.TU_GIAC,
    generate: (rng, id) => {
      const cases = [
        {
          q: 'Hình bình hành có **hai đường chéo bằng nhau** là:',
          a: 'Hình chữ nhật',
          w: ['Hình thoi', 'Hình thang cân', 'Hình vuông'],
          e: 'Theo dấu hiệu nhận biết hình chữ nhật: Hình bình hành có hai đường chéo bằng nhau là hình chữ nhật.',
        },
        {
          q: 'Hình bình hành có **hai đường chéo vuông góc với nhau** là:',
          a: 'Hình thoi',
          w: ['Hình chữ nhật', 'Hình thang vuông', 'Hình vuông'],
          e: 'Theo dấu hiệu nhận biết hình thoi: Hình bình hành có hai đường chéo vuông góc với nhau là hình thoi.',
        },
        {
          q: 'Hình chữ nhật có **hai cạnh kề bằng nhau** là:',
          a: 'Hình vuông',
          w: ['Hình thoi (không vuông)', 'Hình thang cân', 'Hình bình hành'],
          e: 'Hình chữ nhật có hai cạnh kề bằng nhau (hoặc có hai đường chéo vuông góc) là hình vuông.',
        },
        {
          q: 'Hình thang có **hai đường chéo bằng nhau** là:',
          a: 'Hình thang cân',
          w: ['Hình bình hành', 'Hình chữ nhật', 'Hình thoi'],
          e: 'Theo dấu hiệu nhận biết: Hình thang có hai đường chéo bằng nhau là hình thang cân.',
        },
      ];
      const c = rng.pick(cases);
      return makeMcq(rng, id, c.q, c.a, c.w, c.e, TOPICS.TU_GIAC, 'nhan-biet');
    },
  },
  // 10. Đường trung bình của tam giác
  {
    topic: TOPICS.THALES,
    generate: (rng, id) => {
      const mn = rng.int(5, 16);
      const bc = mn * 2;
      return makeMcq(
        rng,
        id,
        `Cho $\\triangle ABC$, gọi $M, N$ lần lượt là trung điểm của $AB$ và $AC$. Biết $BC = ${bc}\\text{ cm}$, độ dài đoạn thẳng $MN$ là:`,
        `$${mn}\\text{ cm}$`,
        [`$${bc}\\text{ cm}$`, `$${bc * 2}\\text{ cm}$`, `$${mn + 2}\\text{ cm}$`],
        `$MN$ là đường trung bình của $\\triangle ABC$ nên $MN \\parallel BC$ và $MN = \\dfrac{BC}{2} = \\dfrac{${bc}}{2} = ${mn}\\text{ cm}$.`,
        TOPICS.THALES,
        'nhan-biet',
      );
    },
  },
  // 11. Định lí Thalès trong tam giác
  {
    topic: TOPICS.THALES,
    generate: (rng, id) => {
      const am = rng.int(3, 6);
      const mb = rng.int(2, 5);
      const k = rng.int(2, 3);
      const an = am * k;
      const nc = mb * k;
      return makeMcq(
        rng,
        id,
        `Cho $\\triangle ABC$, đường thẳng $DE \\parallel BC$ ($D \\in AB, E \\in AC$). Biết $AD = ${am}\\text{ cm}, DB = ${mb}\\text{ cm}, AE = ${an}\\text{ cm}$. Độ dài đoạn thẳng $EC$ bằng:`,
        `$${nc}\\text{ cm}$`,
        [`$${mb}\\text{ cm}$`, `$${nc + 2}\\text{ cm}$`, `$${an + mb}\\text{ cm}$`],
        `Vì $DE \\parallel BC$, áp dụng định lí Thalès trong $\\triangle ABC$:\n$$\\dfrac{AD}{DB} = \\dfrac{AE}{EC} \\Rightarrow \\dfrac{${am}}{${mb}} = \\dfrac{${an}}{EC} \\Rightarrow EC = \\dfrac{${mb} \\cdot ${an}}{${am}} = ${nc}\\text{ (cm)}.$$`,
        TOPICS.THALES,
        'thong-hieu',
      );
    },
  },
  // 12. Tính chất đường phân giác trong tam giác
  {
    topic: TOPICS.THALES,
    generate: (rng, id) => {
      const ab = rng.int(4, 8);
      const ac = ab + rng.int(2, 6);
      const db = rng.int(2, 5);
      // Để dc nguyên, chọn tỉ số chẵn: ab = 2k, ac = 3k hoặc ab = 3k, ac = 4k
      const ratios: [number, number][] = [
        [2, 3],
        [3, 4],
        [2, 5],
        [3, 5],
      ];
      const [r1, r2] = rng.pick(ratios);
      const s = rng.int(2, 3);
      const AB = r1 * s;
      const AC = r2 * s;
      const DB = r1 * 2;
      const DC = r2 * 2;
      void ab;
      void ac;
      void db;
      return makeMcq(
        rng,
        id,
        `Cho $\\triangle ABC$ có $AD$ là tia phân giác của $\\widehat{BAC}$ ($D \\in BC$). Biết $AB = ${AB}\\text{ cm}, AC = ${AC}\\text{ cm}, DB = ${DB}\\text{ cm}$. Độ dài $DC$ bằng:`,
        `$${DC}\\text{ cm}$`,
        [`$${DB}\\text{ cm}$`, `$${DC + 2}\\text{ cm}$`, `$${AB + AC}\\text{ cm}$`],
        `Theo tính chất đường phân giác trong tam giác:\n$$\\dfrac{DB}{DC} = \\dfrac{AB}{AC} \\Rightarrow \\dfrac{${DB}}{DC} = \\dfrac{${AB}}{${AC}} \\Rightarrow DC = \\dfrac{${DB} \\cdot ${AC}}{${AB}} = ${DC}\\text{ (cm)}.$$`,
        TOPICS.THALES,
        'thong-hieu',
      );
    },
  },
  // 13. Định lí Pythagore
  {
    topic: TOPICS.HINH_CHOP,
    generate: (rng, id) => {
      const triples: [number, number, number][] = [
        [3, 4, 5],
        [6, 8, 10],
        [5, 12, 13],
        [9, 12, 15],
        [8, 15, 17],
      ];
      const [a, b, c] = rng.pick(triples);
      return makeMcq(
        rng,
        id,
        `Cho $\\triangle ABC$ vuông tại $A$ có $AB = ${a}\\text{ cm}, AC = ${b}\\text{ cm}$. Độ dài cạnh huyền $BC$ bằng:`,
        `$${c}\\text{ cm}$`,
        [`$${a + b}\\text{ cm}$`, `$${c + 2}\\text{ cm}$`, `$${c - 1}\\text{ cm}$`],
        `Áp dụng định lí Pythagore cho $\\triangle ABC$ vuông tại $A$:\n$$BC^2 = AB^2 + AC^2 = ${a}^2 + ${b}^2 = ${a * a + b * b} \\Rightarrow BC = \\sqrt{${c * c}} = ${c}\\text{ (cm)}.$$`,
        TOPICS.HINH_CHOP,
        'nhan-biet',
      );
    },
  },
  // 14. Thể tích hình chóp tứ giác đều
  {
    topic: TOPICS.HINH_CHOP,
    generate: (rng, id) => {
      const a = rng.pick([3, 6, 9, 12]);
      const h = rng.int(4, 10);
      const V = (a * a * h) / 3;
      return makeMcq(
        rng,
        id,
        `Một hình chóp tứ giác đều có cạnh đáy bằng $${a}\\text{ cm}$ và chiều cao bằng $${h}\\text{ cm}$. Thể tích của hình chóp đó là:`,
        `$${V}\\text{ cm}^3$`,
        [`$${a * a * h}\\text{ cm}^3$`, `$${(a * h) / 3}\\text{ cm}^3$`, `$${V * 2}\\text{ cm}^3$`],
        `Thể tích hình chóp tứ giác đều: $V = \\dfrac{1}{3} S_{\\text{đáy}} \\cdot h = \\dfrac{1}{3} \\cdot ${a}^2 \\cdot ${h} = ${V}\\text{ (cm}^3\\text{)}$.`,
        TOPICS.HINH_CHOP,
        'thong-hieu',
      );
    },
  },
  // 15. Phân loại dữ liệu
  {
    topic: TOPICS.DU_LIEU,
    generate: (rng, id) => {
      const items = [
        {
          q: 'Dữ liệu nào sau đây là **dữ liệu số (định lượng)**?',
          a: 'Chiều cao (cm) của các bạn học sinh lớp 8A',
          w: ['Tên các câu lạc bộ trong trường', 'Xếp loại hạnh kiểm của học sinh', 'Màu sắc yêu thích của các bạn'],
          e: 'Chiều cao đo bằng số (cm) là dữ liệu số (dữ liệu định lượng). Ba phương án còn lại là dữ liệu không phải là số (dữ liệu định tính).',
        },
        {
          q: 'Để biểu diễn sự thay đổi của nhiệt độ trung bình qua các tháng trong năm, loại biểu đồ nào thích hợp nhất?',
          a: 'Biểu đồ đoạn thẳng',
          w: ['Biểu đồ hình quạt tròn', 'Biểu đồ tranh', 'Bảng tần số rời rạc'],
          e: 'Biểu đồ đoạn thẳng là lựa chọn tối ưu để thể hiện xu hướng thay đổi của một đại lượng theo thời gian.',
        },
      ];
      const it = rng.pick(items);
      return makeMcq(rng, id, it.q, it.a, it.w, it.e, TOPICS.DU_LIEU, 'nhan-biet');
    },
  },
];

const tfPool: GradeGeneratorConfig['tfPool'] = [
  (rng, id): TrueFalseQuestion => {
    const a = rng.int(2, 5);
    return {
      id,
      type: 'true-false',
      prompt: `Cho biểu thức $A = (x + ${a})^2 - x(x + ${2 * a})$. Xét tính Đúng/Sai của các khẳng định sau:`,
      statements: [
        { label: 'a', text: `$(x + ${a})^2 = x^2 + ${2 * a}x + ${a * a}$.`, isTrue: true },
        { label: 'b', text: `Sau khi rút gọn, $A = ${a * a}$.`, isTrue: true },
        { label: 'c', text: `Giá trị của biểu thức $A$ phụ thuộc vào biến $x$.`, isTrue: false },
        { label: 'd', text: `Với $x = 2026$, giá trị của $A$ lớn hơn $0$.`, isTrue: true },
      ],
      explanation: `Ta rút gọn: $A = (x^2 + ${2 * a}x + ${a * a}) - (x^2 + ${2 * a}x) = ${a * a}$.\n• a) Đúng.\n• b) Đúng.\n• c) Sai vì $A = ${a * a}$ là hằng số, không phụ thuộc vào $x$.\n• d) Đúng vì $${a * a} > 0$.`,
      topic: TOPICS.HANG_DANG_THUC,
      difficulty: 'thong-hieu',
    };
  },
  (rng, id): TrueFalseQuestion => {
    const a = rng.pick([6, 8, 10]);
    const b = a === 6 ? 8 : a === 8 ? 15 : 24;
    const c = Math.sqrt(a * a + b * b);
    return {
      id,
      type: 'true-false',
      prompt: `Cho hình chữ nhật $ABCD$ có $AB = ${a}\\text{ cm}$ và $BC = ${b}\\text{ cm}$. Gọi $O$ là giao điểm hai đường chéo. Xét các khẳng định sau:`,
      statements: [
        { label: 'a', text: `Độ dài đường chéo $AC = ${c}\\text{ cm}$.`, isTrue: true },
        { label: 'b', text: `$OA = OB = OC = OD = ${c / 2}\\text{ cm}$.`, isTrue: true },
        { label: 'c', text: `$AC \\perp BD$.`, isTrue: false },
        { label: 'd', text: `Diện tích hình chữ nhật $ABCD$ là $${a * b}\\text{ cm}^2$.`, isTrue: true },
      ],
      explanation: `• a) Đúng theo định lí Pythagore: $AC = \\sqrt{${a}^2 + ${b}^2} = ${c}\\text{ cm}$.\n• b) Đúng vì hai đường chéo hình chữ nhật bằng nhau và cắt nhau tại trung điểm mỗi đường.\n• c) Sai vì $AB \\ne BC$ nên $ABCD$ không phải hình vuông, hai đường chéo không vuông góc.\n• d) Đúng: $S = ${a} \\cdot ${b} = ${a * b}\\text{ cm}^2$.`,
      topic: TOPICS.TU_GIAC,
      difficulty: 'thong-hieu',
    };
  },
  (rng, id): TrueFalseQuestion => {
    const base = rng.pick([6, 8, 10]);
    const slant = rng.int(5, 9);
    const Sxq = 2 * base * slant; // 4 * (1/2 * base * slant)
    return {
      id,
      type: 'true-false',
      prompt: `Cho hình chóp tứ giác đều có cạnh đáy bằng $${base}\\text{ cm}$ và trung đoạn bằng $${slant}\\text{ cm}$. Xét các khẳng định sau:`,
      statements: [
        { label: 'a', text: `Mặt đáy của hình chóp là một hình vuông.`, isTrue: true },
        { label: 'b', text: `Hình chóp có $4$ mặt bên là các tam giác cân bằng nhau.`, isTrue: true },
        { label: 'c', text: `Diện tích xung quanh hình chóp là $${Sxq}\\text{ cm}^2$.`, isTrue: true },
        { label: 'd', text: `Diện tích toàn phần hình chóp là $${Sxq}\\text{ cm}^2$.`, isTrue: false },
      ],
      explanation: `• a), b) Đúng theo định nghĩa hình chóp tứ giác đều.\n• c) Đúng: $S_{\\text{xq}} = \\dfrac{1}{2} \\cdot (4 \\cdot ${base}) \\cdot ${slant} = ${Sxq}\\text{ cm}^2$.\n• d) Sai vì $S_{\\text{tp}} = S_{\\text{xq}} + S_{\\text{đáy}} = ${Sxq} + ${base * base} = ${Sxq + base * base}\\text{ cm}^2$.`,
      topic: TOPICS.HINH_CHOP,
      difficulty: 'thong-hieu',
    };
  },
];

const saGenerators: GradeGeneratorConfig['saGenerators'] = [
  {
    topic: TOPICS.HANG_DANG_THUC,
    generate: (rng, id): ShortAnswerQuestion => {
      const a = rng.int(2, 8);
      const x = rng.int(10, 20) + a;
      const val = (x - a) * (x - a);
      return {
        id,
        type: 'short-answer',
        prompt: `Tính giá trị của biểu thức $P = x^2 - ${2 * a}x + ${a * a}$ tại $x = ${x}$.`,
        acceptedAnswers: [`${val}`],
        displayAnswer: `$${val}$`,
        explanation: `Ta nhận thấy $P = x^2 - ${2 * a}x + ${a * a} = (x - ${a})^2$.\nThay $x = ${x}$ vào $P$, ta được: $P = (${x} - ${a})^2 = ${x - a}^2 = ${val}$.`,
        topic: TOPICS.HANG_DANG_THUC,
        difficulty: 'thong-hieu',
      };
    },
  },
  {
    topic: TOPICS.HANG_DANG_THUC,
    generate: (rng, id): ShortAnswerQuestion => {
      const a = rng.int(2, 7);
      return {
        id,
        type: 'short-answer',
        prompt: `Tìm giá trị dương của $x$ thỏa mãn $x^2 - ${a * a} = 0$.`,
        acceptedAnswers: [`${a}`],
        displayAnswer: `$${a}$`,
        explanation: `Ta có $x^2 - ${a * a} = 0 \\Leftrightarrow (x - ${a})(x + ${a}) = 0 \\Leftrightarrow x = ${a}$ hoặc $x = -${a}$.\nVì yêu cầu tìm giá trị dương nên $x = ${a}$.`,
        topic: TOPICS.HANG_DANG_THUC,
        difficulty: 'thong-hieu',
      };
    },
  },
  {
    topic: TOPICS.THALES,
    generate: (rng, id): ShortAnswerQuestion => {
      const mn = rng.int(7, 15);
      const bc = 2 * mn;
      return {
        id,
        type: 'short-answer',
        prompt: `Để đo khoảng cách giữa hai điểm $B$ và $C$ bị ngăn cách bởi một hồ nước, người ta chọn điểm $A$ và lấy trung điểm $M$ của $AB$, $N$ của $AC$. Đo được $MN = ${mn}\\text{ m}$. Tính khoảng cách $BC$ (đơn vị mét).`,
        acceptedAnswers: [`${bc}`],
        displayAnswer: `$${bc}$`,
        unit: 'm',
        explanation: `Vì $M, N$ là trung điểm của $AB, AC$ nên $MN$ là đường trung bình của $\\triangle ABC$.\nDo đó $BC = 2 \\cdot MN = 2 \\cdot ${mn} = ${bc}\\text{ (m)}$.`,
        topic: TOPICS.THALES,
        difficulty: 'van-dung',
      };
    },
  },
  {
    topic: TOPICS.HINH_CHOP,
    generate: (rng, id): ShortAnswerQuestion => {
      const triples: [number, number, number][] = [
        [6, 8, 10],
        [5, 12, 13],
        [9, 12, 15],
        [8, 15, 17],
      ];
      const [foot, height, ladder] = rng.pick(triples);
      return {
        id,
        type: 'short-answer',
        prompt: `Một chiếc thang dài $${ladder}\\text{ m}$ dựa vào một bức tường thẳng đứng, chân thang cách chân tường $${foot}\\text{ m}$. Hỏi đầu trên của thang cách mặt đất bao nhiêu mét?`,
        acceptedAnswers: [`${height}`],
        displayAnswer: `$${height}$`,
        unit: 'm',
        explanation: `Áp dụng định lí Pythagore cho tam giác vuông tạo bởi thang, tường và mặt đất:\n$$h = \\sqrt{${ladder}^2 - ${foot}^2} = \\sqrt{${ladder * ladder - foot * foot}} = ${height}\\text{ (m)}.$$`,
        topic: TOPICS.HINH_CHOP,
        difficulty: 'van-dung',
      };
    },
  },
  {
    topic: TOPICS.DA_THUC,
    generate: (rng, id): ShortAnswerQuestion => {
      const a = rng.int(2, 5);
      const b = rng.int(3, 8);
      const val = a * a + b;
      return {
        id,
        type: 'short-answer',
        prompt: `Rút gọn biểu thức $M = (x + ${a})(x - ${a}) - x^2 + ${val + a * a}$. Giá trị của $M$ là bao nhiêu?`,
        acceptedAnswers: [`${val}`],
        displayAnswer: `$${val}$`,
        explanation: `Ta có $(x + ${a})(x - ${a}) = x^2 - ${a * a}$.\nSuy ra $M = x^2 - ${a * a} - x^2 + ${val + a * a} = ${val}$.`,
        topic: TOPICS.DA_THUC,
        difficulty: 'van-dung',
      };
    },
  },
];

const blueprints: ExamBlueprint[] = [
  ...Array.from({ length: 8 }, (_, idx): ExamBlueprint => {
    const books = ['kntt', 'ctst', 'cd', 'chung'] as const;
    return {
      index: idx + 1,
      title: `Đề kiểm tra Cuối Học kì 1 — Đề số ${idx + 1}`,
      subtitle: 'Cấu trúc mới: 12 Trắc nghiệm + 2 Đúng/Sai + 4 Trả lời ngắn',
      category: 'cuoi-hk1',
      textbook: books[idx % books.length],
      durationMinutes: 90,
      topics: Object.values(TOPICS),
      sourceNote: 'Chuẩn ma trận Cuối HK1 Toán 8 — GDPT 2018',
      mcqCount: 12,
      tfCount: 2,
      saCount: 4,
    };
  }),
  ...Array.from({ length: 6 }, (_, idx): ExamBlueprint => {
    const books = ['kntt', 'ctst', 'cd'] as const;
    return {
      index: 9 + idx,
      title: `Đề kiểm tra Giữa Học kì 1 — Đề số ${idx + 1}`,
      subtitle: 'Đa thức, Hằng đẳng thức, Tứ giác đặc biệt & Hình chóp đều',
      category: 'giua-hk1',
      textbook: books[idx % books.length],
      durationMinutes: 60,
      topics: [TOPICS.DA_THUC, TOPICS.HANG_DANG_THUC, TOPICS.TU_GIAC, TOPICS.HINH_CHOP],
      sourceNote: 'Bám sát ma trận Giữa HK1 Toán 8 — GDPT 2018',
      mcqCount: 12,
      tfCount: 2,
      saCount: 2,
      topicFilter: [TOPICS.DA_THUC, TOPICS.HANG_DANG_THUC, TOPICS.TU_GIAC, TOPICS.HINH_CHOP],
    };
  }),
  {
    index: 15,
    title: 'Kiểm tra 15 phút — Đơn thức & Đa thức nhiều biến',
    subtitle: '10 câu trắc nghiệm nhanh kèm lời giải chi tiết',
    category: 'kiem-tra-15p',
    textbook: 'chung',
    durationMinutes: 15,
    topics: [TOPICS.DA_THUC],
    sourceNote: 'Chuyên đề Chương 1 — Toán 8',
    mcqCount: 10,
    tfCount: 0,
    saCount: 0,
    topicFilter: [TOPICS.DA_THUC],
  },
  {
    index: 16,
    title: 'Kiểm tra 15 phút — 7 Hằng đẳng thức đáng nhớ',
    subtitle: '8 Trắc nghiệm + 2 Trả lời ngắn',
    category: 'kiem-tra-15p',
    textbook: 'kntt',
    durationMinutes: 15,
    topics: [TOPICS.HANG_DANG_THUC],
    sourceNote: 'Chuyên đề Hằng đẳng thức — Toán 8',
    mcqCount: 8,
    tfCount: 0,
    saCount: 2,
    topicFilter: [TOPICS.HANG_DANG_THUC],
  },
  {
    index: 17,
    title: 'Kiểm tra 15 phút — Phân tích đa thức thành nhân tử',
    subtitle: '8 Trắc nghiệm + 2 Trả lời ngắn',
    category: 'kiem-tra-15p',
    textbook: 'ctst',
    durationMinutes: 15,
    topics: [TOPICS.HANG_DANG_THUC],
    sourceNote: 'Chuyên đề Phân tích đa thức — Toán 8',
    mcqCount: 8,
    tfCount: 0,
    saCount: 2,
    topicFilter: [TOPICS.HANG_DANG_THUC],
  },
  {
    index: 18,
    title: 'Kiểm tra 15 phút — Tứ giác & Các hình đặc biệt',
    subtitle: '10 câu trắc nghiệm nhanh kèm lời giải chi tiết',
    category: 'kiem-tra-15p',
    textbook: 'cd',
    durationMinutes: 15,
    topics: [TOPICS.TU_GIAC],
    sourceNote: 'Chuyên đề Tứ giác — Toán 8',
    mcqCount: 10,
    tfCount: 0,
    saCount: 0,
    topicFilter: [TOPICS.TU_GIAC],
  },
  {
    index: 19,
    title: 'Kiểm tra 15 phút — Định lí Thalès & Đường trung bình',
    subtitle: '8 Trắc nghiệm + 2 Trả lời ngắn',
    category: 'kiem-tra-15p',
    textbook: 'chung',
    durationMinutes: 15,
    topics: [TOPICS.THALES],
    sourceNote: 'Chuyên đề Định lí Thalès — Toán 8',
    mcqCount: 8,
    tfCount: 0,
    saCount: 2,
    topicFilter: [TOPICS.THALES],
  },
  {
    index: 20,
    title: 'Kiểm tra 15 phút — Định lí Pythagore & Hình chóp đều',
    subtitle: '8 Trắc nghiệm + 2 Trả lời ngắn',
    category: 'kiem-tra-15p',
    textbook: 'chung',
    durationMinutes: 15,
    topics: [TOPICS.HINH_CHOP],
    sourceNote: 'Chuyên đề Pythagore & Hình chóp — Toán 8',
    mcqCount: 8,
    tfCount: 0,
    saCount: 2,
    topicFilter: [TOPICS.HINH_CHOP],
  },
  {
    index: 21,
    title: 'Ôn tập Chương 1 — Đa thức & Phép toán đa thức',
    subtitle: '12 Trắc nghiệm + 3 Trả lời ngắn (45 phút)',
    category: 'on-tap-chuong',
    textbook: 'kntt',
    durationMinutes: 45,
    topics: [TOPICS.DA_THUC],
    sourceNote: 'Ôn tập Chương 1 — Toán 8',
    mcqCount: 12,
    tfCount: 0,
    saCount: 3,
    topicFilter: [TOPICS.DA_THUC],
  },
  {
    index: 22,
    title: 'Ôn tập Chương 2 — Hằng đẳng thức & Phân tích nhân tử',
    subtitle: '12 Trắc nghiệm + 3 Trả lời ngắn (45 phút)',
    category: 'on-tap-chuong',
    textbook: 'ctst',
    durationMinutes: 45,
    topics: [TOPICS.HANG_DANG_THUC],
    sourceNote: 'Ôn tập Chương 2 — Toán 8',
    mcqCount: 12,
    tfCount: 0,
    saCount: 3,
    topicFilter: [TOPICS.HANG_DANG_THUC],
  },
  {
    index: 23,
    title: 'Ôn tập Chương 3 — Tứ giác đặc biệt',
    subtitle: '12 Trắc nghiệm + 3 Trả lời ngắn (45 phút)',
    category: 'on-tap-chuong',
    textbook: 'cd',
    durationMinutes: 45,
    topics: [TOPICS.TU_GIAC, TOPICS.HINH_CHOP],
    sourceNote: 'Ôn tập Chương 3 — Toán 8',
    mcqCount: 12,
    tfCount: 0,
    saCount: 3,
    topicFilter: [TOPICS.TU_GIAC, TOPICS.HINH_CHOP],
  },
  {
    index: 24,
    title: 'Ôn tập Chương 4 & 5 — Định lí Thalès & Dữ liệu biểu đồ',
    subtitle: '12 Trắc nghiệm + 3 Trả lời ngắn (45 phút)',
    category: 'on-tap-chuong',
    textbook: 'chung',
    durationMinutes: 45,
    topics: [TOPICS.THALES, TOPICS.DU_LIEU],
    sourceNote: 'Ôn tập Thalès & Thống kê — Toán 8',
    mcqCount: 12,
    tfCount: 0,
    saCount: 3,
    topicFilter: [TOPICS.THALES, TOPICS.DU_LIEU],
  },
];

export const GRADE_8_CONFIG: GradeGeneratorConfig = {
  grade: 8,
  blueprints,
  mcqGenerators,
  tfPool,
  saGenerators,
};

export const GRADE_8_EXAMS: Exam[] = buildGradeExams(GRADE_8_CONFIG);
