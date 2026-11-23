import type { Exam, ShortAnswerQuestion, TrueFalseQuestion } from '@shared/types';
import {
  buildGradeExams,
  gcd,
  lcm,
  makeMcq,
  type ExamBlueprint,
  type GradeGeneratorConfig,
  type Rng,
} from './helpers';

const TOPICS = {
  TAP_HOP: 'Tập hợp & Số tự nhiên',
  LUY_THUA: 'Lũy thừa & Thứ tự phép tính',
  CHIA_HET: 'Chia hết, Số nguyên tố, ƯCLN - BCNN',
  SO_NGUYEN: 'Số nguyên & Phép tính số nguyên',
  HINH_HOC: 'Hình học trực quan & Chu vi, Diện tích',
  DOI_XUNG: 'Tính đối xứng của hình phẳng',
} as const;

const mcqGenerators: GradeGeneratorConfig['mcqGenerators'] = [
  // 1. Tập hợp & số phần tử
  {
    topic: TOPICS.TAP_HOP,
    generate: (rng, id) => {
      const a = rng.int(2, 12);
      const b = a + rng.int(4, 10);
      const count = b - a + 1;
      return makeMcq(
        rng,
        id,
        `Cho tập hợp $A = \\{x \\in \\mathbb{N} \\mid ${a} \\le x \\le ${b}\\}$. Số phần tử của tập hợp $A$ là:`,
        `$${count}$`,
        [`$${count - 1}$`, `$${count + 1}$`, `$${count - 2}$`],
        `Các số tự nhiên $x$ thỏa mãn $${a} \\le x \\le ${b}$ là $${a}, ${a + 1}, \\dots, ${b}$.\nSố phần tử của tập hợp $A$ là: $${b} - ${a} + 1 = ${count}$ (phần tử).`,
        TOPICS.TAP_HOP,
        'nhan-biet',
      );
    },
  },
  // 2. Nhân hai lũy thừa cùng cơ số
  {
    topic: TOPICS.LUY_THUA,
    generate: (rng, id) => {
      const base = rng.pick([2, 3, 5, 7]);
      const m = rng.int(2, 6);
      const n = rng.int(2, 5);
      return makeMcq(
        rng,
        id,
        `Viết kết quả phép tính $${base}^{${m}} \\cdot ${base}^{${n}}$ dưới dạng một lũy thừa:`,
        `$${base}^{${m + n}}$`,
        [`$${base}^{${m * n}}$`, `$${base * 2}^{${m + n}}$`, `$${base}^{${Math.abs(m - n) + 1}}$`],
        `Áp dụng quy tắc nhân hai lũy thừa cùng cơ số $a^m \\cdot a^n = a^{m+n}$, ta có:\n$$${base}^{${m}} \\cdot ${base}^{${n}} = ${base}^{${m} + ${n}} = ${base}^{${m + n}}.$$`,
        TOPICS.LUY_THUA,
        'nhan-biet',
      );
    },
  },
  // 3. Thứ tự thực hiện phép tính
  {
    topic: TOPICS.LUY_THUA,
    generate: (rng, id) => {
      const a = rng.int(2, 5);
      const b = rng.int(2, 4);
      const c = rng.int(3, 9);
      const d = rng.int(1, 5);
      const ans = a * Math.pow(b, 2) + c * d;
      return makeMcq(
        rng,
        id,
        `Giá trị của biểu thức $${a} \\cdot ${b}^2 + ${c} \\cdot ${d}$ là:`,
        `$${ans}$`,
        [`$${a * b * 2 + c * d}$`, `$${Math.pow(a * b, 2) + c * d}$`, `$${ans + b}$`],
        `Thực hiện theo thứ tự: Lũy thừa $\\to$ Nhân $\\to$ Cộng:\n$$${a} \\cdot ${b}^2 + ${c} \\cdot ${d} = ${a} \\cdot ${b * b} + ${c * d} = ${a * b * b} + ${c * d} = ${ans}.$$`,
        TOPICS.LUY_THUA,
        'thong-hieu',
      );
    },
  },
  // 4. Tìm x với số tự nhiên
  {
    topic: TOPICS.TAP_HOP,
    generate: (rng, id) => {
      const x = rng.int(4, 15);
      const a = rng.int(2, 6);
      const b = rng.int(5, 20);
      const rhs = a * x + b;
      return makeMcq(
        rng,
        id,
        `Tìm số tự nhiên $x$ biết $${a}x + ${b} = ${rhs}$:`,
        `$x = ${x}$`,
        [`$x = ${x + 1}$`, `$x = ${x - 1}$`, `$x = ${x + 2}$`],
        `Ta có:\n$${a}x + ${b} = ${rhs}$\n$${a}x = ${rhs} - ${b} = ${a * x}$\n$x = ${a * x} : ${a} = ${x}$.`,
        TOPICS.TAP_HOP,
        'thong-hieu',
      );
    },
  },
  // 5. Dấu hiệu chia hết cho 3 và 9
  {
    topic: TOPICS.CHIA_HET,
    generate: (rng, id) => {
      const d1 = rng.int(1, 7);
      const d2 = rng.int(1, 8);
      const sum = d1 + d2;
      const missing = (9 - (sum % 9)) % 9;
      const wrong1 = (missing + 3) % 9;
      const wrong2 = (missing + 1) % 9;
      const wrong3 = (missing + 5) % 9;
      return makeMcq(
        rng,
        id,
        `Tìm chữ số $x$ để số $\\overline{${d1}${d2}x}$ chia hết cho $9$:`,
        `$x = ${missing}$`,
        [`$x = ${wrong1}$`, `$x = ${wrong2}$`, `$x = ${wrong3}$`],
        `Một số chia hết cho $9$ khi tổng các chữ số của nó chia hết cho $9$.\nTa có tổng các chữ số là $${d1} + ${d2} + x = ${sum} + x$.\nVì $0 \\le x \\le 9$ và $(${sum} + x) \\vdots 9$ nên $x = ${missing}$ (tổng bằng $${sum + missing}$ chia hết cho $9$).`,
        TOPICS.CHIA_HET,
        'thong-hieu',
      );
    },
  },
  // 6. Số nguyên tố
  {
    topic: TOPICS.CHIA_HET,
    generate: (rng, id) => {
      const primes = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43];
      const composites = [15, 21, 25, 27, 33, 35, 39, 45, 49, 51, 57, 63];
      const p = rng.pick(primes);
      const c = rng.shuffle(composites).slice(0, 3);
      return makeMcq(
        rng,
        id,
        `Trong các số sau, số nào là **số nguyên tố**?`,
        `$${p}$`,
        [`$${c[0]}$`, `$${c[1]}$`, `$${c[2]}$`],
        `Số nguyên tố là số tự nhiên lớn hơn $1$, chỉ có hai ước là $1$ và chính nó.\nTrong các phương án trên, $${p}$ chỉ chia hết cho $1$ và $${p}$, còn các số $${c[0]}, ${c[1]}, ${c[2]}$ đều là hợp số.`,
        TOPICS.CHIA_HET,
        'nhan-biet',
      );
    },
  },
  // 7. ƯCLN của hai số
  {
    topic: TOPICS.CHIA_HET,
    generate: (rng, id) => {
      const g = rng.pick([4, 6, 8, 9, 12, 15]);
      const pairs: [number, number][] = [
        [2, 3],
        [3, 4],
        [2, 5],
        [3, 5],
        [4, 5],
      ];
      const [u, v] = rng.pick(pairs);
      const a = g * u;
      const b = g * v;
      return makeMcq(
        rng,
        id,
        `Ước chung lớn nhất $\\text{ƯCLN}(${a}, ${b})$ bằng:`,
        `$${g}$`,
        [`$${g * 2}$`, `$${Math.max(1, g / 2 === Math.floor(g / 2) ? g / 2 : g - 2)}$`, `$${a * b / g}$`],
        `Ta có $${a} = ${g} \\cdot ${u}$ và $${b} = ${g} \\cdot ${v}$.\nVì $\\text{ƯCLN}(${u}, ${v}) = 1$ nên $\\text{ƯCLN}(${a}, ${b}) = ${g}$.`,
        TOPICS.CHIA_HET,
        'thong-hieu',
      );
    },
  },
  // 8. BCNN của hai số
  {
    topic: TOPICS.CHIA_HET,
    generate: (rng, id) => {
      const pairs: [number, number][] = [
        [6, 8],
        [8, 12],
        [10, 15],
        [12, 18],
        [9, 12],
        [14, 21],
        [15, 20],
      ];
      const [a, b] = rng.pick(pairs);
      const L = lcm(a, b);
      const G = gcd(a, b);
      return makeMcq(
        rng,
        id,
        `Bội chung nhỏ nhất $\\text{BCNN}(${a}, ${b})$ bằng:`,
        `$${L}$`,
        [`$${G}$`, `$${a * b}$`, `$${L * 2}$`],
        `Ta có $\\text{ƯCLN}(${a}, ${b}) = ${G}$.\nDo đó $\\text{BCNN}(${a}, ${b}) = \\dfrac{${a} \\cdot ${b}}{${G}} = ${L}$.`,
        TOPICS.CHIA_HET,
        'thong-hieu',
      );
    },
  },
  // 9. Cộng hai số nguyên khác dấu
  {
    topic: TOPICS.SO_NGUYEN,
    generate: (rng, id) => {
      const a = -rng.int(15, 48);
      const b = rng.int(10, 45);
      const sum = a + b;
      return makeMcq(
        rng,
        id,
        `Kết quả của phép tính $(${a}) + ${b}$ là:`,
        `$${sum}$`,
        [`$${-sum}$`, `$${a - b}$`, `$${Math.abs(a) + b}$`],
        `Cộng hai số nguyên khác dấu: lấy số có giá trị tuyệt đối lớn hơn trừ đi số có giá trị tuyệt đối nhỏ hơn rồi đặt dấu của số có giá trị tuyệt đối lớn hơn:\n$$(${a}) + ${b} = ${sum}.$$`,
        TOPICS.SO_NGUYEN,
        'nhan-biet',
      );
    },
  },
  // 10. Trừ số nguyên & quy tắc dấu ngoặc
  {
    topic: TOPICS.SO_NGUYEN,
    generate: (rng, id) => {
      const a = rng.int(8, 25);
      const b = rng.int(12, 35);
      const c = rng.int(5, 18);
      const ans = a - (b - c);
      return makeMcq(
        rng,
        id,
        `Tính giá trị của biểu thức $A = ${a} - (${b} - ${c})$:`,
        `$${ans}$`,
        [`$${a - b - c}$`, `$${a + b - c}$`, `$${-ans}$`],
        `Áp dụng quy tắc dấu ngoặc (khi bỏ dấu ngoặc có dấu "$-$" đằng trước, ta phải đổi dấu tất cả các số hạng trong ngoặc):\n$$A = ${a} - ${b} + ${c} = ${a - b} + ${c} = ${ans}.$$`,
        TOPICS.SO_NGUYEN,
        'thong-hieu',
      );
    },
  },
  // 11. Nhân hai số nguyên
  {
    topic: TOPICS.SO_NGUYEN,
    generate: (rng, id) => {
      const a = -rng.int(4, 12);
      const b = -rng.int(3, 9);
      const prod = a * b;
      return makeMcq(
        rng,
        id,
        `Tích $(${a}) \\cdot (${b})$ có kết quả bằng:`,
        `$${prod}$`,
        [`$${-prod}$`, `$${a + b}$`, `$${prod - Math.abs(a)}$`],
        `Tích của hai số nguyên âm là một số nguyên dương:\n$$(${a}) \\cdot (${b}) = ${Math.abs(a)} \\cdot ${Math.abs(b)} = ${prod}.$$`,
        TOPICS.SO_NGUYEN,
        'nhan-biet',
      );
    },
  },
  // 12. Tìm x trong tập số nguyên
  {
    topic: TOPICS.SO_NGUYEN,
    generate: (rng, id) => {
      const x = -rng.int(2, 12);
      const a = rng.int(2, 5);
      const b = rng.int(4, 16);
      const rhs = a * x + b;
      return makeMcq(
        rng,
        id,
        `Tìm số nguyên $x$ biết $${a}x + ${b} = ${rhs}$:`,
        `$x = ${x}$`,
        [`$x = ${-x}$`, `$x = ${x - 2}$`, `$x = ${x + 2}$`],
        `Ta có:\n$${a}x + ${b} = ${rhs}$\n$${a}x = ${rhs} - ${b} = ${a * x}$\n$x = (${a * x}) : ${a} = ${x}$.`,
        TOPICS.SO_NGUYEN,
        'thong-hieu',
      );
    },
  },
  // 13. Chu vi và diện tích hình thoi
  {
    topic: TOPICS.HINH_HOC,
    generate: (rng, id) => {
      const d1 = rng.int(4, 12) * 2;
      const d2 = rng.int(3, 10) * 2;
      const area = (d1 * d2) / 2;
      return makeMcq(
        rng,
        id,
        `Một hình thoi có độ dài hai đường chéo lần lượt là $${d1}\\text{ cm}$ và $${d2}\\text{ cm}$. Diện tích của hình thoi đó là:`,
        `$${area}\\text{ cm}^2$`,
        [`$${d1 * d2}\\text{ cm}^2$`, `$${(d1 + d2) * 2}\\text{ cm}^2$`, `$${area + d1}\\text{ cm}^2$`],
        `Diện tích hình thoi bằng nửa tích độ dài hai đường chéo:\n$$S = \\dfrac{1}{2} \\cdot ${d1} \\cdot ${d2} = ${area}\\text{ (cm}^2\\text{)}.$$`,
        TOPICS.HINH_HOC,
        'nhan-biet',
      );
    },
  },
  // 14. Diện tích hình thang cân
  {
    topic: TOPICS.HINH_HOC,
    generate: (rng, id) => {
      const a = rng.int(6, 14);
      const b = a + rng.int(2, 8) * 2;
      const h = rng.int(4, 10);
      const area = ((a + b) * h) / 2;
      return makeMcq(
        rng,
        id,
        `Một hình thang cân có hai đáy dài $${a}\\text{ cm}$ và $${b}\\text{ cm}$, chiều cao bằng $${h}\\text{ cm}$. Diện tích hình thang cân đó là:`,
        `$${area}\\text{ cm}^2$`,
        [`$${(a + b) * h}\\text{ cm}^2$`, `$${a * b}\\text{ cm}^2$`, `$${area - h}\\text{ cm}^2$`],
        `Áp dụng công thức tính diện tích hình thang $S = \\dfrac{(a + b) \\cdot h}{2}$:\n$$S = \\dfrac{(${a} + ${b}) \\cdot ${h}}{2} = \\dfrac{${a + b} \\cdot ${h}}{2} = ${area}\\text{ (cm}^2\\text{)}.$$`,
        TOPICS.HINH_HOC,
        'thong-hieu',
      );
    },
  },
  // 15. Tính đối xứng của hình phẳng
  {
    topic: TOPICS.DOI_XUNG,
    generate: (rng, id) => {
      const variants = [
        {
          prompt: 'Hình nào sau đây **vừa có trục đối xứng, vừa có tâm đối xứng**?',
          correct: 'Hình chữ nhật',
          wrongs: ['Tam giác đều', 'Hình thang cân', 'Tam giác vuông cân'],
          exp: 'Hình chữ nhật có 2 trục đối xứng (hai đường thẳng đi qua trung điểm hai cạnh đối) và 1 tâm đối xứng (giao điểm hai đường chéo). Tam giác đều và hình thang cân có trục đối xứng nhưng không có tâm đối xứng.',
        },
        {
          prompt: 'Hình nào sau đây có **tâm đối xứng** nhưng **không có trục đối xứng** (trong trường hợp tổng quát)?',
          correct: 'Hình bình hành',
          wrongs: ['Hình vuông', 'Hình thoi', 'Hình lục giác đều'],
          exp: 'Hình bình hành tổng quát có tâm đối xứng là giao điểm của hai đường chéo, nhưng không có trục đối xứng.',
        },
        {
          prompt: 'Hình vuông có bao nhiêu trục đối xứng?',
          correct: '$4$ trục đối xứng',
          wrongs: ['$2$ trục đối xứng', '$1$ trục đối xứng', '$8$ trục đối xứng'],
          exp: 'Hình vuông có $4$ trục đối xứng gồm: $2$ đường chéo và $2$ đường thẳng đi qua trung điểm các cặp cạnh đối diện.',
        },
        {
          prompt: 'Tam giác đều có bao nhiêu trục đối xứng?',
          correct: '$3$ trục đối xứng',
          wrongs: ['$1$ trục đối xứng', '$2$ trục đối xứng', '$6$ trục đối xứng'],
          exp: 'Tam giác đều có $3$ trục đối xứng là $3$ đường trung trực (cũng là đường cao, trung tuyến) ứng với ba cạnh của tam giác.',
        },
      ];
      const v = rng.pick(variants);
      return makeMcq(rng, id, v.prompt, v.correct, v.wrongs, v.exp, TOPICS.DOI_XUNG, 'nhan-biet');
    },
  },
  // 16. Bài toán thực tế số nguyên (nhiệt độ / độ cao)
  {
    topic: TOPICS.SO_NGUYEN,
    generate: (rng, id) => {
      const t0 = -rng.int(2, 9);
      const rise = rng.int(4, 12);
      const drop = rng.int(3, 10);
      const finalT = t0 + rise - drop;
      return makeMcq(
        rng,
        id,
        `Lúc 6 giờ sáng, nhiệt độ tại một đỉnh núi là $${t0}^\\circ\\text{C}$. Đến trưa nhiệt độ tăng thêm $${rise}^\\circ\\text{C}$, rồi đến tối lại giảm đi $${drop}^\\circ\\text{C}$. Nhiệt độ lúc tối là:`,
        `$${finalT}^\\circ\\text{C}$`,
        [`$${t0 + rise + drop}^\\circ\\text{C}$`, `$${t0 - rise + drop}^\\circ\\text{C}$`, `$${-finalT}^\\circ\\text{C}$`],
        `Nhiệt độ lúc tối là:\n$$(${t0}) + ${rise} - ${drop} = ${t0 + rise} - ${drop} = ${finalT}^\\circ\\text{C}.$$`,
        TOPICS.SO_NGUYEN,
        'van-dung',
      );
    },
  },
];

const tfPool: GradeGeneratorConfig['tfPool'] = [
  (rng, id): TrueFalseQuestion => {
    const a = rng.pick([24, 36, 48]);
    const b = rng.pick([18, 30, 42]);
    const g = gcd(a, b);
    const l = lcm(a, b);
    return {
      id,
      type: 'true-false',
      prompt: `Cho hai số tự nhiên $a = ${a}$ và $b = ${b}$. Xét tính Đúng/Sai của các khẳng định sau:`,
      statements: [
        { label: 'a', text: `Cả hai số $a$ và $b$ đều chia hết cho $6$.`, isTrue: a % 6 === 0 && b % 6 === 0 },
        { label: 'b', text: `$\\text{ƯCLN}(a, b) = ${g}$.`, isTrue: true },
        { label: 'c', text: `$\\text{BCNN}(a, b) = ${l + 6}$.`, isTrue: false },
        { label: 'd', text: `Tích $a \\cdot b = \\text{ƯCLN}(a, b) \\cdot \\text{BCNN}(a, b)$.`, isTrue: true },
      ],
      explanation: `• a) Đúng vì $${a} = 6 \\cdot ${a / 6}$ và $${b} = 6 \\cdot ${b / 6}$ đều chia hết cho $6$.\n• b) Đúng vì $\\text{ƯCLN}(${a}, ${b}) = ${g}$.\n• c) Sai vì $\\text{BCNN}(${a}, ${b}) = \\dfrac{${a} \\cdot ${b}}{${g}} = ${l} \\ne ${l + 6}$.\n• d) Đúng, đây là tính chất cơ bản của $\\text{ƯCLN}$ và $\\text{BCNN}$.`,
      topic: TOPICS.CHIA_HET,
      difficulty: 'thong-hieu',
    };
  },
  (rng, id): TrueFalseQuestion => {
    const a = rng.int(8, 16);
    const b = rng.int(4, 7);
    const P = 2 * (a + b);
    const S = a * b;
    return {
      id,
      type: 'true-false',
      prompt: `Một mảnh vườn hình chữ nhật có chiều dài $${a}\\text{ m}$ và chiều rộng $${b}\\text{ m}$. Xét các khẳng định sau:`,
      statements: [
        { label: 'a', text: `Chu vi mảnh vườn là $${P}\\text{ m}$.`, isTrue: true },
        { label: 'b', text: `Diện tích mảnh vườn là $${S + 4}\\text{ m}^2$.`, isTrue: false },
        { label: 'c', text: `Hình chữ nhật có $2$ trục đối xứng và $1$ tâm đối xứng.`, isTrue: true },
        { label: 'd', text: `Hai đường chéo của hình chữ nhật vuông góc với nhau.`, isTrue: false },
      ],
      explanation: `• a) Đúng: Chu vi $C = 2(${a} + ${b}) = ${P}\\text{ m}$.\n• b) Sai: Diện tích $S = ${a} \\cdot ${b} = ${S}\\text{ m}^2 \\ne ${S + 4}\\text{ m}^2$.\n• c) Đúng: Hình chữ nhật có $2$ trục đối xứng và $1$ tâm đối xứng.\n• d) Sai: Hai đường chéo hình chữ nhật bằng nhau và cắt nhau tại trung điểm mỗi đường, không nhất thiết vuông góc (chỉ vuông góc khi là hình vuông).`,
      topic: TOPICS.HINH_HOC,
      difficulty: 'thong-hieu',
    };
  },
  (rng, id): TrueFalseQuestion => {
    const x = -rng.int(5, 14);
    const y = rng.int(3, 10);
    return {
      id,
      type: 'true-false',
      prompt: `Cho hai số nguyên $x = ${x}$ và $y = ${y}$. Xét các khẳng định sau:`,
      statements: [
        { label: 'a', text: `Số đối của $x$ là $${-x}$.`, isTrue: true },
        { label: 'b', text: `Tổng $x + y = ${x + y}$.`, isTrue: true },
        { label: 'c', text: `Tích $x \\cdot y$ là một số nguyên dương.`, isTrue: false },
        { label: 'd', text: `$x < y$ trên trục số nguyên.`, isTrue: true },
      ],
      explanation: `• a) Đúng: Số đối của $${x}$ là $- (${x}) = ${-x}$.\n• b) Đúng: $${x} + ${y} = ${x + y}$.\n• c) Sai: $x$ âm, $y$ dương nên tích $x \\cdot y = ${x * y} < 0$ (số nguyên âm).\n• d) Đúng: Mọi số nguyên âm đều nhỏ hơn số nguyên dương nên $${x} < ${y}$.`,
      topic: TOPICS.SO_NGUYEN,
      difficulty: 'nhan-biet',
    };
  },
  (rng, id): TrueFalseQuestion => {
    const n = rng.int(3, 6);
    return {
      id,
      type: 'true-false',
      prompt: `Cho biểu thức $M = 2^{${n}} + 2^0 - 5$. Xét các khẳng định sau:`,
      statements: [
        { label: 'a', text: `$2^0 = 1$.`, isTrue: true },
        { label: 'b', text: `$2^{${n}} = ${2 * n}$.`, isTrue: false },
        { label: 'c', text: `Giá trị của biểu thức $M$ là $${Math.pow(2, n) + 1 - 5}$.`, isTrue: true },
        { label: 'd', text: `Biểu thức $M$ chia hết cho $2$.`, isTrue: (Math.pow(2, n) - 4) % 2 === 0 },
      ],
      explanation: `• a) Đúng theo quy ước $a^0 = 1\\ (a \\ne 0)$.\n• b) Sai vì $2^{${n}} = ${Math.pow(2, n)}$, không phải $2 \\cdot ${n} = ${2 * n}$.\n• c) Đúng: $M = ${Math.pow(2, n)} + 1 - 5 = ${Math.pow(2, n) - 4}$.\n• d) Đúng vì $${Math.pow(2, n) - 4}$ là số chẵn nên chia hết cho $2$.`,
      topic: TOPICS.LUY_THUA,
      difficulty: 'thong-hieu',
    };
  },
];

const saGenerators: GradeGeneratorConfig['saGenerators'] = [
  // 1. Bài toán chia nhóm dùng ƯCLN
  {
    topic: TOPICS.CHIA_HET,
    generate: (rng, id): ShortAnswerQuestion => {
      const g = rng.pick([6, 8, 12, 15, 18]);
      const m = rng.pick([2, 3]);
      const n = rng.pick([4, 5]);
      const a = g * m;
      const b = g * n;
      const realG = gcd(a, b);
      return {
        id,
        type: 'short-answer',
        prompt: `Cô giáo có $${a}$ quyển vở và $${b}$ chiếc bút bi, muốn chia đều vào các phần thưởng sao cho số vở và số bút ở mỗi phần đều như nhau. Hỏi có thể chia được **nhiều nhất** bao nhiêu phần thưởng?`,
        acceptedAnswers: [`${realG}`],
        displayAnswer: `$${realG}$`,
        unit: 'phần thưởng',
        explanation: `Số phần thưởng nhiều nhất chính là $\\text{ƯCLN}(${a}, ${b})$.\nTa tính được $\\text{ƯCLN}(${a}, ${b}) = ${realG}$.\nVậy có thể chia được nhiều nhất $${realG}$ phần thưởng.`,
        topic: TOPICS.CHIA_HET,
        difficulty: 'van-dung',
      };
    },
  },
  // 2. Tính tổng dãy số nguyên đối xứng
  {
    topic: TOPICS.SO_NGUYEN,
    generate: (rng, id): ShortAnswerQuestion => {
      const a = rng.int(12, 25);
      const b = a + rng.int(1, 3);
      // Tổng các số nguyên x thỏa mãn -a <= x <= b
      let sum = 0;
      for (let i = a + 1; i <= b; i++) sum += i;
      return {
        id,
        type: 'short-answer',
        prompt: `Tính tổng tất cả các số nguyên $x$ thỏa mãn $-${a} \\le x \\le ${b}$.`,
        acceptedAnswers: [`${sum}`],
        displayAnswer: `$${sum}$`,
        explanation: `Các cặp số đối nhau từ $-${a}$ đến $${a}$ có tổng bằng $0$.\nPhần còn lại gồm các số từ $${a + 1}$ đến $${b}$, có tổng bằng $${sum}$.`,
        topic: TOPICS.SO_NGUYEN,
        difficulty: 'van-dung',
      };
    },
  },
  // 3. Bài toán lát gạch / diện tích
  {
    topic: TOPICS.HINH_HOC,
    generate: (rng, id): ShortAnswerQuestion => {
      const len = rng.int(6, 12); // m
      const wid = rng.int(4, 8); // m
      const areaM2 = len * wid;
      const tiles = (areaM2 * 10000) / 2500; // gạch vuông cạnh 50cm -> 2500 cm^2
      return {
        id,
        type: 'short-answer',
        prompt: `Một căn phòng hình chữ nhật có chiều dài $${len}\\text{ m}$ và chiều rộng $${wid}\\text{ m}$. Người ta lát nền phòng bằng các viên gạch hình vuông cạnh $50\\text{ cm}$. Cần bao nhiêu viên gạch để lát kín nền phòng?`,
        acceptedAnswers: [`${tiles}`],
        displayAnswer: `$${tiles}$`,
        unit: 'viên gạch',
        explanation: `Diện tích nền phòng: $S = ${len} \\cdot ${wid} = ${areaM2}\\text{ m}^2 = ${areaM2 * 10000}\\text{ cm}^2$.\nDiện tích 1 viên gạch vuông cạnh $50\\text{ cm}$: $S_1 = 50 \\cdot 50 = 2500\\text{ cm}^2$.\nSố viên gạch cần dùng: $${areaM2 * 10000} : 2500 = ${tiles}$ (viên).`,
        topic: TOPICS.HINH_HOC,
        difficulty: 'van-dung',
      };
    },
  },
  // 4. Tính hợp lí với số nguyên
  {
    topic: TOPICS.SO_NGUYEN,
    generate: (rng, id): ShortAnswerQuestion => {
      const k = rng.int(13, 39);
      const a = rng.int(25, 65);
      const b = 100 - a;
      const ans = -k * 100;
      return {
        id,
        type: 'short-answer',
        prompt: `Tính giá trị biểu thức: $B = (-${k}) \\cdot ${a} + (-${k}) \\cdot ${b}$.`,
        acceptedAnswers: [`${ans}`],
        displayAnswer: `$${ans}$`,
        explanation: `Đặt nhân tử chung $(- ${k})$:\n$$B = (-${k}) \\cdot (${a} + ${b}) = (-${k}) \\cdot 100 = ${ans}.$$`,
        topic: TOPICS.SO_NGUYEN,
        difficulty: 'thong-hieu',
      };
    },
  },
  // 5. Bài toán BCNN (lịch trực / gặp nhau)
  {
    topic: TOPICS.CHIA_HET,
    generate: (rng, id): ShortAnswerQuestion => {
      const pairs: [number, number][] = [
        [4, 6],
        [6, 9],
        [8, 12],
        [10, 15],
        [6, 10],
      ];
      const [d1, d2] = rng.pick(pairs);
      const L = lcm(d1, d2);
      return {
        id,
        type: 'short-answer',
        prompt: `An và Bình cùng đến thư viện vào hôm nay. Biết cứ $${d1}$ ngày An đến thư viện một lần, còn cứ $${d2}$ ngày Bình đến thư viện một lần. Hỏi sau ít nhất bao nhiêu ngày thì hai bạn lại cùng đến thư viện một lần nữa?`,
        acceptedAnswers: [`${L}`],
        displayAnswer: `$${L}$`,
        unit: 'ngày',
        explanation: `Số ngày ít nhất để hai bạn lại gặp nhau chính là $\\text{BCNN}(${d1}, ${d2})$.\nTa có $\\text{BCNN}(${d1}, ${d2}) = ${L}$. Vậy sau ít nhất $${L}$ ngày hai bạn lại cùng đến thư viện.`,
        topic: TOPICS.CHIA_HET,
        difficulty: 'van-dung',
      };
    },
  },
  // 6. Tìm x với lũy thừa
  {
    topic: TOPICS.LUY_THUA,
    generate: (rng, id): ShortAnswerQuestion => {
      const x = rng.int(2, 6);
      const k = rng.int(3, 9);
      const rhs = Math.pow(3, x) + k;
      return {
        id,
        type: 'short-answer',
        prompt: `Tìm số tự nhiên $x$ thỏa mãn $3^x + ${k} = ${rhs}$.`,
        acceptedAnswers: [`${x}`],
        displayAnswer: `$${x}$`,
        explanation: `Ta có $3^x = ${rhs} - ${k} = ${Math.pow(3, x)} = 3^{${x}}$.\nSuy ra $x = ${x}$.`,
        topic: TOPICS.LUY_THUA,
        difficulty: 'van-dung',
      };
    },
  },
];

const blueprints: ExamBlueprint[] = [
  // 8 Đề Cuối Học kì 1 (trọng tâm thời điểm hiện tại)
  ...Array.from({ length: 8 }, (_, idx): ExamBlueprint => {
    const books = ['kntt', 'ctst', 'cd', 'chung'] as const;
    const book = books[idx % books.length];
    const sources = [
      'Chuẩn cấu trúc Bộ GD&ĐT 2025-2026 (Sách Kết nối tri thức)',
      'Đề tham khảo Phòng GD&ĐT (Sách Chân trời sáng tạo)',
      'Đề chuẩn ma trận Cuối HK1 (Sách Cánh diều)',
      'Tổng hợp chuẩn đề các trường THCS trọng điểm',
    ];
    return {
      index: idx + 1,
      title: `Đề kiểm tra Cuối Học kì 1 - Đề số ${idx + 1}`,
      subtitle: 'Cấu trúc mới: 12 Trắc nghiệm + 2 Đúng/Sai + 4 Trả lời ngắn',
      category: 'cuoi-hk1',
      textbook: book,
      durationMinutes: 90,
      topics: Object.values(TOPICS),
      sourceNote: sources[idx % sources.length],
      mcqCount: 12,
      tfCount: 2,
      saCount: 4,
    };
  }),
  // 6 Đề Giữa Học kì 1
  ...Array.from({ length: 6 }, (_, idx): ExamBlueprint => {
    const books = ['kntt', 'ctst', 'cd'] as const;
    return {
      index: 9 + idx,
      title: `Đề kiểm tra Giữa Học kì 1 - Đề số ${idx + 1}`,
      subtitle: 'Số tự nhiên, Lũy thừa, Chia hết, ƯCLN-BCNN & Hình học trực quan',
      category: 'giua-hk1',
      textbook: books[idx % books.length],
      durationMinutes: 60,
      topics: [TOPICS.TAP_HOP, TOPICS.LUY_THUA, TOPICS.CHIA_HET, TOPICS.HINH_HOC],
      sourceNote: 'Bám sát ma trận Giữa HK1 chương trình GDPT 2018',
      mcqCount: 12,
      tfCount: 2,
      saCount: 2,
      topicFilter: [TOPICS.TAP_HOP, TOPICS.LUY_THUA, TOPICS.CHIA_HET, TOPICS.HINH_HOC],
    };
  }),
  // 6 Đề Kiểm tra 15 phút
  {
    index: 15,
    title: 'Kiểm tra 15 phút - Tập hợp & Phép tính số tự nhiên',
    subtitle: '10 câu trắc nghiệm nhanh kèm lời giải chi tiết',
    category: 'kiem-tra-15p',
    textbook: 'chung',
    durationMinutes: 15,
    topics: [TOPICS.TAP_HOP, TOPICS.LUY_THUA],
    sourceNote: 'Chuyên đề Chương 1 - Toán 6',
    mcqCount: 10,
    tfCount: 0,
    saCount: 0,
    topicFilter: [TOPICS.TAP_HOP, TOPICS.LUY_THUA],
  },
  {
    index: 16,
    title: 'Kiểm tra 15 phút - Quan hệ chia hết & Số nguyên tố',
    subtitle: '10 câu trắc nghiệm nhanh kèm lời giải chi tiết',
    category: 'kiem-tra-15p',
    textbook: 'kntt',
    durationMinutes: 15,
    topics: [TOPICS.CHIA_HET],
    sourceNote: 'Chuyên đề Chương 2 - Toán 6',
    mcqCount: 10,
    tfCount: 0,
    saCount: 0,
    topicFilter: [TOPICS.CHIA_HET],
  },
  {
    index: 17,
    title: 'Kiểm tra 15 phút - ƯCLN và BCNN',
    subtitle: '8 Trắc nghiệm + 2 Trả lời ngắn',
    category: 'kiem-tra-15p',
    textbook: 'ctst',
    durationMinutes: 15,
    topics: [TOPICS.CHIA_HET],
    sourceNote: 'Chuyên đề ƯCLN - BCNN - Toán 6',
    mcqCount: 8,
    tfCount: 0,
    saCount: 2,
    topicFilter: [TOPICS.CHIA_HET],
  },
  {
    index: 18,
    title: 'Kiểm tra 15 phút - Cộng, trừ số nguyên & Quy tắc dấu ngoặc',
    subtitle: '10 câu trắc nghiệm nhanh kèm lời giải chi tiết',
    category: 'kiem-tra-15p',
    textbook: 'chung',
    durationMinutes: 15,
    topics: [TOPICS.SO_NGUYEN],
    sourceNote: 'Chuyên đề Số nguyên - Toán 6',
    mcqCount: 10,
    tfCount: 0,
    saCount: 0,
    topicFilter: [TOPICS.SO_NGUYEN],
  },
  {
    index: 19,
    title: 'Kiểm tra 15 phút - Nhân, chia số nguyên & Bội, ước',
    subtitle: '8 Trắc nghiệm + 2 Trả lời ngắn',
    category: 'kiem-tra-15p',
    textbook: 'cd',
    durationMinutes: 15,
    topics: [TOPICS.SO_NGUYEN],
    sourceNote: 'Chuyên đề Số nguyên - Toán 6',
    mcqCount: 8,
    tfCount: 0,
    saCount: 2,
    topicFilter: [TOPICS.SO_NGUYEN],
  },
  {
    index: 20,
    title: 'Kiểm tra 15 phút - Hình học trực quan & Tính đối xứng',
    subtitle: '10 câu trắc nghiệm nhanh kèm lời giải chi tiết',
    category: 'kiem-tra-15p',
    textbook: 'chung',
    durationMinutes: 15,
    topics: [TOPICS.HINH_HOC, TOPICS.DOI_XUNG],
    sourceNote: 'Chuyên đề Hình học HK1 - Toán 6',
    mcqCount: 10,
    tfCount: 0,
    saCount: 0,
    topicFilter: [TOPICS.HINH_HOC, TOPICS.DOI_XUNG],
  },
  // 4 Đề Ôn tập Chương HK1
  {
    index: 21,
    title: 'Ôn tập Chương 1 - Tập hợp các số tự nhiên',
    subtitle: '12 Trắc nghiệm + 3 Trả lời ngắn (45 phút)',
    category: 'on-tap-chuong',
    textbook: 'kntt',
    durationMinutes: 45,
    topics: [TOPICS.TAP_HOP, TOPICS.LUY_THUA],
    sourceNote: 'Ôn tập chuyên sâu Chương 1 - Toán 6',
    mcqCount: 12,
    tfCount: 0,
    saCount: 3,
    topicFilter: [TOPICS.TAP_HOP, TOPICS.LUY_THUA],
  },
  {
    index: 22,
    title: 'Ôn tập Chương 2 - Tính chia hết trong tập số tự nhiên',
    subtitle: '12 Trắc nghiệm + 3 Trả lời ngắn (45 phút)',
    category: 'on-tap-chuong',
    textbook: 'ctst',
    durationMinutes: 45,
    topics: [TOPICS.CHIA_HET],
    sourceNote: 'Ôn tập chuyên sâu Chương 2 - Toán 6',
    mcqCount: 12,
    tfCount: 0,
    saCount: 3,
    topicFilter: [TOPICS.CHIA_HET],
  },
  {
    index: 23,
    title: 'Ôn tập Chương 3 - Số nguyên',
    subtitle: '12 Trắc nghiệm + 3 Trả lời ngắn (45 phút)',
    category: 'on-tap-chuong',
    textbook: 'cd',
    durationMinutes: 45,
    topics: [TOPICS.SO_NGUYEN],
    sourceNote: 'Ôn tập chuyên sâu Chương 3 - Toán 6',
    mcqCount: 12,
    tfCount: 0,
    saCount: 3,
    topicFilter: [TOPICS.SO_NGUYEN],
  },
  {
    index: 24,
    title: 'Ôn tập Chương 4 & 5 - Hình phẳng & Tính đối xứng',
    subtitle: '12 Trắc nghiệm + 3 Trả lời ngắn (45 phút)',
    category: 'on-tap-chuong',
    textbook: 'chung',
    durationMinutes: 45,
    topics: [TOPICS.HINH_HOC, TOPICS.DOI_XUNG],
    sourceNote: 'Ôn tập chuyên sâu Hình học HK1 - Toán 6',
    mcqCount: 12,
    tfCount: 0,
    saCount: 3,
    topicFilter: [TOPICS.HINH_HOC, TOPICS.DOI_XUNG],
  },
];

export const GRADE_6_CONFIG: GradeGeneratorConfig = {
  grade: 6,
  blueprints,
  mcqGenerators,
  tfPool,
  saGenerators,
};

export const GRADE_6_EXAMS: Exam[] = buildGradeExams(GRADE_6_CONFIG);
