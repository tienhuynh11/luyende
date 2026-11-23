import type { Exam, ShortAnswerQuestion, TrueFalseQuestion } from '@shared/types';
import {
  buildGradeExams,
  fracLatex,
  makeMcq,
  type ExamBlueprint,
  type GradeGeneratorConfig,
} from './helpers';

const TOPICS = {
  HE_PHUONG_TRINH: 'Phương trình & Hệ phương trình bậc nhất hai ẩn',
  BAT_PHUONG_TRINH: 'Bất đẳng thức & Bất phương trình bậc nhất một ẩn',
  CAN_BAC_HAI: 'Căn bậc hai, Căn bậc ba & Biến đổi căn thức',
  LUONG_GIAC: 'Tỉ số lượng giác & Hệ thức lượng trong tam giác vuông',
  DUONG_TRON: 'Đường tròn, Tiếp tuyến, Góc ở tâm & Cung tròn',
} as const;

const mcqGenerators: GradeGeneratorConfig['mcqGenerators'] = [
  // 1. Nghiệm của hệ phương trình bậc nhất hai ẩn
  {
    topic: TOPICS.HE_PHUONG_TRINH,
    generate: (rng, id) => {
      const x = rng.int(1, 5);
      const y = rng.int(-3, 4) || 2;
      const s = x + y;
      const d = x - y;
      return makeMcq(
        rng,
        id,
        `Nghiệm của hệ phương trình $\\begin{cases} x + y = ${s} \\\\ x - y = ${d} \\end{cases}$ là:`,
        `$(${x}; ${y})$`,
        [`$(${y}; ${x})$`, `$(${-x}; ${y})$`, `$(${x + 1}; ${y - 1})$`],
        `Cộng vế theo vế hai phương trình của hệ:\n$2x = ${s + d} \\Rightarrow x = ${x}$.\nThay $x = ${x}$ vào phương trình đầu: $y = ${s} - ${x} = ${y}$.\nVậy hệ có nghiệm duy nhất $(x; y) = (${x}; ${y})$.`,
        TOPICS.HE_PHUONG_TRINH,
        'nhan-biet',
      );
    },
  },
  // 2. Phương trình tích
  {
    topic: TOPICS.HE_PHUONG_TRINH,
    generate: (rng, id) => {
      const a = rng.int(1, 6);
      const b = rng.int(2, 7);
      return makeMcq(
        rng,
        id,
        `Tập nghiệm của phương trình $(x - ${a})(x + ${b}) = 0$ là:`,
        `$S = \\{${a}; -${b}\\}$`,
        [`$S = \\{-${a}; ${b}\\}$`, `$S = \\{${a}; ${b}\\}$`, `$S = \\{${a}\\}$`],
        `Phương trình tích $(x - ${a})(x + ${b}) = 0 \\Leftrightarrow x - ${a} = 0$ hoặc $x + ${b} = 0 \\Leftrightarrow x = ${a}$ hoặc $x = -${b}$.\nVậy $S = \\{${a}; -${b}\\}$.`,
        TOPICS.HE_PHUONG_TRINH,
        'nhan-biet',
      );
    },
  },
  // 3. Điều kiện xác định phương trình chứa ẩn ở mẫu
  {
    topic: TOPICS.HE_PHUONG_TRINH,
    generate: (rng, id) => {
      const a = rng.int(1, 6);
      const b = rng.int(2, 7);
      return makeMcq(
        rng,
        id,
        `Điều kiện xác định của phương trình $\\dfrac{2}{x - ${a}} + \\dfrac{3}{x + ${b}} = 1$ là:`,
        `$x \\ne ${a}$ và $x \\ne -${b}$`,
        [`$x \\ne -${a}$ và $x \\ne ${b}$`, `$x \\ne ${a}$`, `$x \\ne -${b}$`],
        `Điều kiện xác định là các mẫu thức khác $0$:\n$x - ${a} \\ne 0 \\Leftrightarrow x \\ne ${a}$ và $x + ${b} \\ne 0 \\Leftrightarrow x \\ne -${b}$.`,
        TOPICS.HE_PHUONG_TRINH,
        'nhan-biet',
      );
    },
  },
  // 4. Bất phương trình bậc nhất một ẩn (đổi chiều khi chia số âm)
  {
    topic: TOPICS.BAT_PHUONG_TRINH,
    generate: (rng, id) => {
      const a = rng.int(2, 5);
      const k = rng.int(2, 6);
      const b = a * k;
      return makeMcq(
        rng,
        id,
        `Nghiệm của bất phương trình $-${a}x + ${b} > 0$ là:`,
        `$x < ${k}$`,
        [`$x > ${k}$`, `$x < -${k}$`, `$x \\le ${k}$`],
        `Ta có $-${a}x + ${b} > 0 \\Leftrightarrow -${a}x > -${b}$.\nChia cả hai vế cho $-${a} < 0$ (đổi chiều bất đẳng thức): $x < ${k}$.`,
        TOPICS.BAT_PHUONG_TRINH,
        'thong-hieu',
      );
    },
  },
  // 5. Liên hệ giữa thứ tự và phép nhân
  {
    topic: TOPICS.BAT_PHUONG_TRINH,
    generate: (rng, id) => {
      const k = rng.int(2, 5);
      return makeMcq(
        rng,
        id,
        `Cho $a < b$. Khẳng định nào sau đây **luôn đúng**?`,
        `$-${k}a > -${k}b$`,
        [`$-${k}a < -${k}b$`, `$${k}a > ${k}b$`, `$a + ${k} > b + ${k}$`],
        `Khi nhân cả hai vế của bất đẳng thức $a < b$ với cùng một số âm $-${k} < 0$, ta phải đổi chiều bất đẳng thức, được $-${k}a > -${k}b$.`,
        TOPICS.BAT_PHUONG_TRINH,
        'nhan-biet',
      );
    },
  },
  // 6. Điều kiện xác định của căn thức bậc hai
  {
    topic: TOPICS.CAN_BAC_HAI,
    generate: (rng, id) => {
      const a = rng.int(2, 5);
      const k = rng.int(1, 5);
      const b = a * k;
      return makeMcq(
        rng,
        id,
        `Căn thức $\\sqrt{${a}x - ${b}}$ xác định khi và chỉ khi:`,
        `$x \\ge ${k}$`,
        [`$x > ${k}$`, `$x \\le ${k}$`, `$x \\ge -${k}$`],
        `Biểu thức $\\sqrt{A}$ xác định khi $A \\ge 0$:\n$$${a}x - ${b} \\ge 0 \\Leftrightarrow ${a}x \\ge ${b} \\Leftrightarrow x \\ge ${k}.$$`,
        TOPICS.CAN_BAC_HAI,
        'nhan-biet',
      );
    },
  },
  // 7. Hằng đẳng thức sqrt(A^2) = |A|
  {
    topic: TOPICS.CAN_BAC_HAI,
    generate: (rng, id) => {
      const a = rng.pick([2, 3, 4]);
      const b = a * a + rng.int(1, 4); // sqrt(b) > a
      return makeMcq(
        rng,
        id,
        `Rút gọn biểu thức $\\sqrt{(${a} - \\sqrt{${b}})^2}$ ta được:`,
        `$\\sqrt{${b}} - ${a}$`,
        [`$${a} - \\sqrt{${b}}$`, `$${a} + \\sqrt{${b}}$`, `$${b} - ${a * a}$`],
        `Áp dụng $\\sqrt{A^2} = |A|$:\n$$\\sqrt{(${a} - \\sqrt{${b}})^2} = |${a} - \\sqrt{${b}}|.$$\nVì $${a} = \\sqrt{${a * a}} < \\sqrt{${b}}$ nên $${a} - \\sqrt{${b}} < 0$, suy ra $|${a} - \\sqrt{${b}}| = \\sqrt{${b}} - ${a}$.`,
        TOPICS.CAN_BAC_HAI,
        'thong-hieu',
      );
    },
  },
  // 8. Căn bậc ba
  {
    topic: TOPICS.CAN_BAC_HAI,
    generate: (rng, id) => {
      const n = rng.pick([-4, -3, -2, 3, 4, 5]);
      const cube = n * n * n;
      return makeMcq(
        rng,
        id,
        `Giá trị của $\\sqrt[3]{${cube}}$ bằng:`,
        `$${n}$`,
        [`$${-n}$`, `$${n * n}$`, `$${n + 1}$`],
        `Vì $(${n})^3 = ${cube}$ nên $\\sqrt[3]{${cube}} = ${n}$.`,
        TOPICS.CAN_BAC_HAI,
        'nhan-biet',
      );
    },
  },
  // 9. Rút gọn biểu thức chứa căn đồng dạng
  {
    topic: TOPICS.CAN_BAC_HAI,
    generate: (rng, id) => {
      const p = rng.pick([2, 3, 5]);
      const a = rng.int(2, 4);
      const b = rng.int(2, 5);
      const sum = a + b;
      return makeMcq(
        rng,
        id,
        `Kết quả rút gọn của biểu thức $\\sqrt{${a * a * p}} + \\sqrt{${b * b * p}}$ là:`,
        `$${sum}\\sqrt{${p}}$`,
        [`$\\sqrt{${(a * a + b * b) * p}}$`, `$${a * b}\\sqrt{${p}}$`, `$${sum + 1}\\sqrt{${p}}$`],
        `Đưa thừa số ra ngoài dấu căn:\n$$\\sqrt{${a * a * p}} + \\sqrt{${b * b * p}} = ${a}\\sqrt{${p}} + ${b}\\sqrt{${p}} = ${sum}\\sqrt{${p}}.$$`,
        TOPICS.CAN_BAC_HAI,
        'thong-hieu',
      );
    },
  },
  // 10. Tỉ số lượng giác trong tam giác vuông
  {
    topic: TOPICS.LUONG_GIAC,
    generate: (rng, id) => {
      const triples: [number, number, number][] = [
        [3, 4, 5],
        [6, 8, 10],
        [5, 12, 13],
        [8, 15, 17],
      ];
      const [ab, ac, bc] = rng.pick(triples);
      const sinB = fracLatex(ac, bc);
      return makeMcq(
        rng,
        id,
        `Cho $\\triangle ABC$ vuông tại $A$ có $AB = ${ab}\\text{ cm}, AC = ${ac}\\text{ cm}, BC = ${bc}\\text{ cm}$. Giá trị của $\\sin B$ bằng:`,
        `$${sinB}$`,
        [`$${fracLatex(ab, bc)}$`, `$${fracLatex(ac, ab)}$`, `$${fracLatex(ab, ac)}$`],
        `Trong $\\triangle ABC$ vuông tại $A$, tỉ số lượng giác $\\sin B$ bằng cạnh đối chia cạnh huyền:\n$$\\sin B = \\dfrac{AC}{BC} = ${sinB}.$$`,
        TOPICS.LUONG_GIAC,
        'nhan-biet',
      );
    },
  },
  // 11. Góc phụ nhau & giá trị lượng giác đặc biệt
  {
    topic: TOPICS.LUONG_GIAC,
    generate: (rng, id) => {
      const cases = [
        { q: 'Giá trị của biểu thức $\\sin 30^\\circ + \\cos 60^\\circ$ bằng:', a: '$1$', w: ['$\\dfrac{1}{2}$', '$\\sqrt{3}$', '$\\dfrac{\\sqrt{3}}{2}$'], e: 'Ta có $\\sin 30^\\circ = \\dfrac{1}{2}$ và $\\cos 60^\\circ = \\dfrac{1}{2}$, suy ra tổng bằng $\\dfrac{1}{2} + \\dfrac{1}{2} = 1$.' },
        { q: 'Giá trị của $\\tan 45^\\circ + \\cot 45^\\circ$ bằng:', a: '$2$', w: ['$1$', '$0$', '$\\sqrt{2}$'], e: 'Vì $\\tan 45^\\circ = 1$ và $\\cot 45^\\circ = 1$ nên $\\tan 45^\\circ + \\cot 45^\\circ = 2$.' },
        { q: 'Với hai góc nhọn phụ nhau $\\alpha + \\beta = 90^\\circ$, đẳng thức nào sau đây **đúng**?', a: '$\\sin \\alpha = \\cos \\beta$', w: ['$\\sin \\alpha = \\sin \\beta$', '$\\tan \\alpha = \\tan \\beta$', '$\\cos \\alpha = \\tan \\beta$'], e: 'Hai góc phụ nhau thì sin góc này bằng côsin góc kia ($\\sin \\alpha = \\cos \\beta$) và tang góc này bằng côtang góc kia.' },
      ];
      const c = rng.pick(cases);
      return makeMcq(rng, id, c.q, c.a, c.w, c.e, TOPICS.LUONG_GIAC, 'nhan-biet');
    },
  },
  // 12. Vị trí tương đối của đường thẳng và đường tròn
  {
    topic: TOPICS.DUONG_TRON,
    generate: (rng, id) => {
      const R = rng.int(4, 10);
      const d = R - rng.int(1, 3);
      return makeMcq(
        rng,
        id,
        `Cho đường tròn $(O; ${R}\\text{ cm})$ và đường thẳng $a$. Biết khoảng cách từ tâm $O$ đến đường thẳng $a$ là $d = ${d}\\text{ cm}$. Vị trí tương đối của đường thẳng $a$ và đường tròn $(O)$ là:`,
        'Cắt nhau (có $2$ điểm chung)',
        ['Tiếp xúc nhau (có $1$ điểm chung)', 'Không giao nhau (không có điểm chung)', 'Trùng nhau'],
        `So sánh khoảng cách $d = ${d}\\text{ cm}$ với bán kính $R = ${R}\\text{ cm}$: vì $d < R$ nên đường thẳng $a$ và đường tròn $(O)$ cắt nhau tại $2$ điểm phân biệt.`,
        TOPICS.DUONG_TRON,
        'nhan-biet',
      );
    },
  },
  // 13. Góc ở tâm và góc nội tiếp
  {
    topic: TOPICS.DUONG_TRON,
    generate: (rng, id) => {
      const inscribed = rng.int(25, 75);
      const central = inscribed * 2;
      return makeMcq(
        rng,
        id,
        `Trên đường tròn $(O)$, góc ở tâm $\\widehat{AOB} = ${central}^\\circ$. Số đo góc nội tiếp $\\widehat{AMB}$ cùng chắn cung nhỏ $AB$ bằng:`,
        `$${inscribed}^\\circ$`,
        [`$${central}^\\circ$`, `$${180 - central}^\\circ$`, `$${inscribed + 15}^\\circ$`],
        `Trong một đường tròn, số đo góc nội tiếp bằng nửa số đo góc ở tâm cùng chắn một cung:\n$$\\widehat{AMB} = \\dfrac{1}{2}\\widehat{AOB} = \\dfrac{${central}^\\circ}{2} = ${inscribed}^\\circ.$$`,
        TOPICS.DUONG_TRON,
        'thong-hieu',
      );
    },
  },
  // 14. Độ dài cung tròn
  {
    topic: TOPICS.DUONG_TRON,
    generate: (rng, id) => {
      const R = rng.pick([3, 6, 9, 12]);
      const n = rng.pick([60, 90, 120]);
      const num = R * n;
      const den = 180;
      const coeff = fracLatex(num, den);
      const ans = coeff === '1' ? '$\\pi\\text{ cm}$' : `$${coeff}\\pi\\text{ cm}$`;
      return makeMcq(
        rng,
        id,
        `Độ dài cung tròn $n = ${n}^\\circ$ của đường tròn có bán kính $R = ${R}\\text{ cm}$ là:`,
        ans,
        [`$${R}\\pi\\text{ cm}$`, `$${2 * R}\\pi\\text{ cm}$`, `$${fracLatex(num, 360)}\\pi\\text{ cm}$`],
        `Công thức độ dài cung tròn $l = \\dfrac{\\pi R n}{180}$:\n$$l = \\dfrac{\\pi \\cdot ${R} \\cdot ${n}}{180} = ${coeff === '1' ? '' : coeff}\\pi\\text{ (cm)}.$$`,
        TOPICS.DUONG_TRON,
        'thong-hieu',
      );
    },
  },
  // 15. Tính chất hai tiếp tuyến cắt nhau
  {
    topic: TOPICS.DUONG_TRON,
    generate: (rng, id) => {
      const r = rng.pick([3, 5, 6, 8]);
      const om = r === 3 ? 5 : r === 5 ? 13 : r === 6 ? 10 : 17;
      const ma = Math.sqrt(om * om - r * r);
      return makeMcq(
        rng,
        id,
        `Từ điểm $M$ nằm ngoài đường tròn $(O; ${r}\\text{ cm})$, kẻ tiếp tuyến $MA$ ($A$ là tiếp điểm). Biết $OM = ${om}\\text{ cm}$, độ dài đoạn tiếp tuyến $MA$ bằng:`,
        `$${ma}\\text{ cm}$`,
        [`$${om - r}\\text{ cm}$`, `$${om + r}\\text{ cm}$`, `$${ma + 2}\\text{ cm}$`],
        `Vì $MA$ là tiếp tuyến của $(O)$ tại $A$ nên $OA \\perp MA$, suy ra $\\triangle OAM$ vuông tại $A$.\nTheo định lí Pythagore: $MA = \\sqrt{OM^2 - OA^2} = \\sqrt{${om}^2 - ${r}^2} = ${ma}\\text{ (cm)}$.`,
        TOPICS.DUONG_TRON,
        'thong-hieu',
      );
    },
  },
];

const tfPool: GradeGeneratorConfig['tfPool'] = [
  (rng, id): TrueFalseQuestion => {
    const x0 = rng.int(2, 5);
    const y0 = rng.int(1, 4);
    const c1 = 2 * x0 + y0;
    const c2 = x0 - y0;
    return {
      id,
      type: 'true-false',
      prompt: `Cho hệ phương trình $\\begin{cases} 2x + y = ${c1} \\\\ x - y = ${c2} \\end{cases}$. Xét tính Đúng/Sai của các khẳng định sau:`,
      statements: [
        { label: 'a', text: `Hệ phương trình có nghiệm duy nhất.`, isTrue: true },
        { label: 'b', text: `Nghiệm của hệ là $(x; y) = (${x0}; ${y0})$.`, isTrue: true },
        { label: 'c', text: `Tổng $x + y = ${x0 + y0 + 2}$.`, isTrue: false },
        { label: 'd', text: `Tích $x \\cdot y = ${x0 * y0}$.`, isTrue: true },
      ],
      explanation: `Cộng hai phương trình ta được $3x = ${c1 + c2} \\Rightarrow x = ${x0}$. Thay vào phương trình dưới: $y = x - ${c2} = ${y0}$.\n• a) Đúng.\n• b) Đúng.\n• c) Sai vì $x + y = ${x0 + y0}$.\n• d) Đúng vì $x \\cdot y = ${x0 * y0}$.`,
      topic: TOPICS.HE_PHUONG_TRINH,
      difficulty: 'thong-hieu',
    };
  },
  (rng, id): TrueFalseQuestion => {
    const R = rng.pick([6, 8, 10]);
    const angle = 60;
    const S_sector = (R * R * angle) / 360;
    const S_str = fracLatex(R * R, 6);
    return {
      id,
      type: 'true-false',
      prompt: `Cho đường tròn $(O; ${R}\\text{ cm})$ và hình quạt tròn ứng với cung $60^\\circ$. Xét các khẳng định sau:`,
      statements: [
        { label: 'a', text: `Chu vi đường tròn $(O)$ là $${2 * R}\\pi\\text{ cm}$.`, isTrue: true },
        { label: 'b', text: `Diện tích hình tròn $(O)$ là $${R * R}\\pi\\text{ cm}^2$.`, isTrue: true },
        { label: 'c', text: `Diện tích hình quạt tròn ứng với cung $60^\\circ$ là $${S_str}\\pi\\text{ cm}^2$.`, isTrue: true },
        { label: 'd', text: `Góc nội tiếp chắn cung $60^\\circ$ có số đo bằng $60^\\circ$.`, isTrue: false },
      ],
      explanation: `• a) Đúng: $C = 2\\pi R = ${2 * R}\\pi\\text{ cm}$.\n• b) Đúng: $S = \\pi R^2 = ${R * R}\\pi\\text{ cm}^2$.\n• c) Đúng: $S_q = \\dfrac{\\pi R^2 \\cdot 60}{360} = ${S_str}\\pi\\text{ cm}^2$ ($\\approx ${(S_sector * Math.PI).toFixed(2)}\\text{ cm}^2$).\n• d) Sai: Góc nội tiếp bằng nửa số đo cung bị chắn nên bằng $30^\\circ$.`,
      topic: TOPICS.DUONG_TRON,
      difficulty: 'thong-hieu',
    };
  },
  (rng, id): TrueFalseQuestion => {
    const a = rng.int(1, 5);
    return {
      id,
      type: 'true-false',
      prompt: `Cho biểu thức $P = \\dfrac{\\sqrt{x} + ${a}}{\\sqrt{x} - 1}$ với $x \\ge 0, x \\ne 1$. Xét các khẳng định sau:`,
      statements: [
        { label: 'a', text: `Điều kiện xác định của $P$ là $x \\ge 0$ và $x \\ne 1$.`, isTrue: true },
        { label: 'b', text: `Khi $x = 4$, giá trị của $P$ là $${2 + a}$.`, isTrue: true },
        { label: 'c', text: `Khi $x = 0$, giá trị của $P$ là $${a}$.`, isTrue: false },
        { label: 'd', text: `Khi $x = 9$, mẫu thức $\\sqrt{x} - 1$ bằng $2$.`, isTrue: true },
      ],
      explanation: `• a) Đúng vì cần $x \\ge 0$ và $\\sqrt{x} - 1 \\ne 0 \\Leftrightarrow x \\ne 1$.\n• b) Đúng: $x = 4 \\Rightarrow P = \\dfrac{2 + ${a}}{2 - 1} = ${2 + a}$.\n• c) Sai: $x = 0 \\Rightarrow P = \\dfrac{0 + ${a}}{0 - 1} = -${a}$.\n• d) Đúng: $\\sqrt{9} - 1 = 3 - 1 = 2$.`,
      topic: TOPICS.CAN_BAC_HAI,
      difficulty: 'thong-hieu',
    };
  },
];

const saGenerators: GradeGeneratorConfig['saGenerators'] = [
  {
    topic: TOPICS.HE_PHUONG_TRINH,
    generate: (rng, id): ShortAnswerQuestion => {
      const a = rng.int(20, 45);
      const b = rng.int(15, 35);
      const total = a + b;
      const diff = Math.abs(a - b);
      const bigger = Math.max(a, b);
      return {
        id,
        type: 'short-answer',
        prompt: `Tổng của hai số là $${total}$ và hiệu của số lớn trừ số bé là $${diff}$. Tìm số lớn.`,
        acceptedAnswers: [`${bigger}`],
        displayAnswer: `$${bigger}$`,
        explanation: `Gọi số lớn là $x$, số bé là $y$. Ta có hệ $\\begin{cases} x + y = ${total} \\\\ x - y = ${diff} \\end{cases}$.\nCộng hai phương trình: $2x = ${total + diff} \\Rightarrow x = ${bigger}$.`,
        topic: TOPICS.HE_PHUONG_TRINH,
        difficulty: 'van-dung',
      };
    },
  },
  {
    topic: TOPICS.BAT_PHUONG_TRINH,
    generate: (rng, id): ShortAnswerQuestion => {
      const a = rng.int(2, 5);
      const maxInt = rng.int(3, 9);
      const rhs = a * maxInt + 1;
      return {
        id,
        type: 'short-answer',
        prompt: `Tìm số nguyên $x$ **lớn nhất** thỏa mãn bất phương trình $${a}x < ${rhs}$.`,
        acceptedAnswers: [`${maxInt}`],
        displayAnswer: `$${maxInt}$`,
        explanation: `Ta có $${a}x < ${rhs} \\Leftrightarrow x < \\dfrac{${rhs}}{${a}} = ${(rhs / a).toFixed(2)}$.\nSố nguyên $x$ lớn nhất nhỏ hơn $\\dfrac{${rhs}}{${a}}$ là $x = ${maxInt}$.`,
        topic: TOPICS.BAT_PHUONG_TRINH,
        difficulty: 'van-dung',
      };
    },
  },
  {
    topic: TOPICS.CAN_BAC_HAI,
    generate: (rng, id): ShortAnswerQuestion => {
      const k = rng.int(3, 8);
      const b = rng.int(2, 7);
      const x = k * k - b;
      return {
        id,
        type: 'short-answer',
        prompt: `Tìm nghiệm $x$ của phương trình $\\sqrt{x + ${b}} = ${k}$.`,
        acceptedAnswers: [`${x}`],
        displayAnswer: `$${x}$`,
        explanation: `Điều kiện $x \\ge -${b}$. Bình phương hai vế:\n$$x + ${b} = ${k}^2 = ${k * k} \\Rightarrow x = ${x}\\text{ (thỏa mãn)}.$$`,
        topic: TOPICS.CAN_BAC_HAI,
        difficulty: 'thong-hieu',
      };
    },
  },
  {
    topic: TOPICS.LUONG_GIAC,
    generate: (rng, id): ShortAnswerQuestion => {
      const dist = rng.int(10, 30);
      // góc nâng 45 độ -> chiều cao bằng khoảng cách
      return {
        id,
        type: 'short-answer',
        prompt: `Một người đứng cách chân một tòa nhà $${dist}\\text{ m}$ nhìn lên đỉnh tòa nhà theo góc nâng $45^\\circ$ (bỏ qua chiều cao mắt người quan sát). Tính chiều cao của tòa nhà (đơn vị mét).`,
        acceptedAnswers: [`${dist}`],
        displayAnswer: `$${dist}$`,
        unit: 'm',
        explanation: `Trong tam giác vuông, chiều cao tòa nhà là:\n$$h = ${dist} \\cdot \\tan 45^\\circ = ${dist} \\cdot 1 = ${dist}\\text{ (m)}.$$`,
        topic: TOPICS.LUONG_GIAC,
        difficulty: 'van-dung',
      };
    },
  },
  {
    topic: TOPICS.DUONG_TRON,
    generate: (rng, id): ShortAnswerQuestion => {
      const r = rng.pick([5, 10, 13, 17]);
      const d = r === 5 ? 3 : r === 10 ? 6 : r === 13 ? 5 : 8;
      const half = Math.sqrt(r * r - d * d);
      const chord = 2 * half;
      return {
        id,
        type: 'short-answer',
        prompt: `Cho đường tròn $(O; ${r}\\text{ cm})$ và dây cung $AB$ cách tâm $O$ một khoảng bằng $${d}\\text{ cm}$. Tính độ dài dây cung $AB$ (đơn vị $\\text{cm}$).`,
        acceptedAnswers: [`${chord}`],
        displayAnswer: `$${chord}$`,
        unit: 'cm',
        explanation: `Gọi $H$ là chân đường vuông góc từ $O$ xuống $AB$, suy ra $H$ là trung điểm của $AB$.\nTheo định lí Pythagore: $HA = \\sqrt{R^2 - OH^2} = \\sqrt{${r}^2 - ${d}^2} = ${half}\\text{ cm}$.\nVậy $AB = 2 \\cdot HA = ${chord}\\text{ (cm)}$.`,
        topic: TOPICS.DUONG_TRON,
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
      sourceNote: 'Chuẩn ma trận Cuối HK1 Toán 9 — GDPT 2018 (Ôn thi vào 10)',
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
      subtitle: 'Hệ phương trình, Bất phương trình & Tỉ số lượng giác góc nhọn',
      category: 'giua-hk1',
      textbook: books[idx % books.length],
      durationMinutes: 60,
      topics: [TOPICS.HE_PHUONG_TRINH, TOPICS.BAT_PHUONG_TRINH, TOPICS.LUONG_GIAC],
      sourceNote: 'Bám sát ma trận Giữa HK1 Toán 9 — GDPT 2018',
      mcqCount: 12,
      tfCount: 2,
      saCount: 2,
      topicFilter: [TOPICS.HE_PHUONG_TRINH, TOPICS.BAT_PHUONG_TRINH, TOPICS.LUONG_GIAC],
    };
  }),
  {
    index: 15,
    title: 'Kiểm tra 15 phút — Hệ phương trình bậc nhất hai ẩn',
    subtitle: '8 Trắc nghiệm + 2 Trả lời ngắn',
    category: 'kiem-tra-15p',
    textbook: 'chung',
    durationMinutes: 15,
    topics: [TOPICS.HE_PHUONG_TRINH],
    sourceNote: 'Chuyên đề Chương 1 — Toán 9',
    mcqCount: 8,
    tfCount: 0,
    saCount: 2,
    topicFilter: [TOPICS.HE_PHUONG_TRINH],
  },
  {
    index: 16,
    title: 'Kiểm tra 15 phút — Bất đẳng thức & Bất phương trình',
    subtitle: '8 Trắc nghiệm + 2 Trả lời ngắn',
    category: 'kiem-tra-15p',
    textbook: 'kntt',
    durationMinutes: 15,
    topics: [TOPICS.BAT_PHUONG_TRINH],
    sourceNote: 'Chuyên đề Chương 2 — Toán 9',
    mcqCount: 8,
    tfCount: 0,
    saCount: 2,
    topicFilter: [TOPICS.BAT_PHUONG_TRINH],
  },
  {
    index: 17,
    title: 'Kiểm tra 15 phút — Căn bậc hai & Căn bậc ba',
    subtitle: '8 Trắc nghiệm + 2 Trả lời ngắn',
    category: 'kiem-tra-15p',
    textbook: 'ctst',
    durationMinutes: 15,
    topics: [TOPICS.CAN_BAC_HAI],
    sourceNote: 'Chuyên đề Chương 3 — Toán 9',
    mcqCount: 8,
    tfCount: 0,
    saCount: 2,
    topicFilter: [TOPICS.CAN_BAC_HAI],
  },
  {
    index: 18,
    title: 'Kiểm tra 15 phút — Tỉ số lượng giác của góc nhọn',
    subtitle: '8 Trắc nghiệm + 2 Trả lời ngắn',
    category: 'kiem-tra-15p',
    textbook: 'cd',
    durationMinutes: 15,
    topics: [TOPICS.LUONG_GIAC],
    sourceNote: 'Chuyên đề Lượng giác — Toán 9',
    mcqCount: 8,
    tfCount: 0,
    saCount: 2,
    topicFilter: [TOPICS.LUONG_GIAC],
  },
  {
    index: 19,
    title: 'Kiểm tra 15 phút — Đường tròn & Tiếp tuyến',
    subtitle: '8 Trắc nghiệm + 2 Trả lời ngắn',
    category: 'kiem-tra-15p',
    textbook: 'chung',
    durationMinutes: 15,
    topics: [TOPICS.DUONG_TRON],
    sourceNote: 'Chuyên đề Đường tròn — Toán 9',
    mcqCount: 8,
    tfCount: 0,
    saCount: 2,
    topicFilter: [TOPICS.DUONG_TRON],
  },
  {
    index: 20,
    title: 'Kiểm tra 15 phút — Tổng hợp Đại số HK1',
    subtitle: '10 câu trắc nghiệm nhanh kèm lời giải chi tiết',
    category: 'kiem-tra-15p',
    textbook: 'chung',
    durationMinutes: 15,
    topics: [TOPICS.HE_PHUONG_TRINH, TOPICS.BAT_PHUONG_TRINH, TOPICS.CAN_BAC_HAI],
    sourceNote: 'Tổng hợp Đại số HK1 — Toán 9',
    mcqCount: 10,
    tfCount: 0,
    saCount: 0,
    topicFilter: [TOPICS.HE_PHUONG_TRINH, TOPICS.BAT_PHUONG_TRINH, TOPICS.CAN_BAC_HAI],
  },
  {
    index: 21,
    title: 'Ôn tập Chương 1 & 2 — Phương trình, Hệ PT & Bất PT',
    subtitle: '12 Trắc nghiệm + 3 Trả lời ngắn (45 phút)',
    category: 'on-tap-chuong',
    textbook: 'kntt',
    durationMinutes: 45,
    topics: [TOPICS.HE_PHUONG_TRINH, TOPICS.BAT_PHUONG_TRINH],
    sourceNote: 'Ôn tập Đại số — Toán 9',
    mcqCount: 12,
    tfCount: 0,
    saCount: 3,
    topicFilter: [TOPICS.HE_PHUONG_TRINH, TOPICS.BAT_PHUONG_TRINH],
  },
  {
    index: 22,
    title: 'Ôn tập Chương 3 — Căn bậc hai và Căn bậc ba',
    subtitle: '12 Trắc nghiệm + 3 Trả lời ngắn (45 phút)',
    category: 'on-tap-chuong',
    textbook: 'ctst',
    durationMinutes: 45,
    topics: [TOPICS.CAN_BAC_HAI],
    sourceNote: 'Ôn tập Chương 3 — Toán 9',
    mcqCount: 12,
    tfCount: 0,
    saCount: 3,
    topicFilter: [TOPICS.CAN_BAC_HAI],
  },
  {
    index: 23,
    title: 'Ôn tập Chương 4 — Hệ thức lượng trong tam giác vuông',
    subtitle: '12 Trắc nghiệm + 3 Trả lời ngắn (45 phút)',
    category: 'on-tap-chuong',
    textbook: 'cd',
    durationMinutes: 45,
    topics: [TOPICS.LUONG_GIAC],
    sourceNote: 'Ôn tập Chương 4 — Toán 9',
    mcqCount: 12,
    tfCount: 0,
    saCount: 3,
    topicFilter: [TOPICS.LUONG_GIAC],
  },
  {
    index: 24,
    title: 'Ôn tập Chương 5 — Đường tròn, Góc ở tâm & Cung tròn',
    subtitle: '12 Trắc nghiệm + 3 Trả lời ngắn (45 phút)',
    category: 'on-tap-chuong',
    textbook: 'chung',
    durationMinutes: 45,
    topics: [TOPICS.DUONG_TRON],
    sourceNote: 'Ôn tập Chương 5 — Toán 9',
    mcqCount: 12,
    tfCount: 0,
    saCount: 3,
    topicFilter: [TOPICS.DUONG_TRON],
  },
];

export const GRADE_9_CONFIG: GradeGeneratorConfig = {
  grade: 9,
  blueprints,
  mcqGenerators,
  tfPool,
  saGenerators,
};

export const GRADE_9_EXAMS: Exam[] = buildGradeExams(GRADE_9_CONFIG);
