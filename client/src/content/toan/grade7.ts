import type { Exam, ShortAnswerQuestion, TrueFalseQuestion } from '@shared/types';
import {
  buildGradeExams,
  fracLatex,
  fracPlain,
  makeMcq,
  type ExamBlueprint,
  type GradeGeneratorConfig,
} from './helpers';

const TOPICS = {
  SO_HUU_TI: 'Số hữu tỉ & Phép tính',
  SO_THUC: 'Số vô tỉ, Căn bậc hai & Số thực',
  HINH_KHOI: 'Hình học trực quan (Hình hộp, Lăng trụ)',
  GOC_SONG_SONG: 'Góc & Đường thẳng song song',
  TAM_GIAC: 'Tam giác & Hai tam giác bằng nhau',
  THONG_KE: 'Thu thập & Biểu diễn dữ liệu',
} as const;

const mcqGenerators: GradeGeneratorConfig['mcqGenerators'] = [
  // 1. Cộng trừ số hữu tỉ
  {
    topic: TOPICS.SO_HUU_TI,
    generate: (rng, id) => {
      const d = rng.pick([4, 6, 8, 12]);
      const a = rng.int(-5, 7) || 3;
      const b = rng.int(-5, 7) || -2;
      const num = a + b;
      const correct = `$${fracLatex(num, d)}$`;
      return makeMcq(
        rng,
        id,
        `Kết quả của phép tính $${fracLatex(a, d)} + \\left(${fracLatex(b, d)}\\right)$ là:`,
        correct,
        [`$${fracLatex(a - b, d)}$`, `$${fracLatex(num + 1, d)}$`, `$${fracLatex(-num, d)}$`],
        `Hai phân số cùng mẫu $${d}$ (sau khi quy đồng):\n$$${fracLatex(a, d)} + \\left(${fracLatex(b, d)}\\right) = \\dfrac{${a} + (${b})}{${d}} = ${fracLatex(num, d)}.$$`,
        TOPICS.SO_HUU_TI,
        'nhan-biet',
      );
    },
  },
  // 2. Lũy thừa của một số hữu tỉ
  {
    topic: TOPICS.SO_HUU_TI,
    generate: (rng, id) => {
      const m = rng.int(2, 4);
      const n = rng.int(2, 3);
      return makeMcq(
        rng,
        id,
        `Kết quả của phép tính $\\left[\\left(-\\dfrac{1}{2}\\right)^{${m}}\\right]^{${n}}$ dưới dạng một lũy thừa là:`,
        `$\\left(-\\dfrac{1}{2}\\right)^{${m * n}}$`,
        [
          `$\\left(-\\dfrac{1}{2}\\right)^{${m + n}}$`,
          `$\\left(-\\dfrac{1}{2}\\right)^{${m * n + 1}}$`,
          `$\\left(-\\dfrac{1}{4}\\right)^{${m + n}}$`,
        ],
        `Áp dụng công thức lũy thừa của lũy thừa $(x^m)^n = x^{m \\cdot n}$:\n$$\\left[\\left(-\\dfrac{1}{2}\\right)^{${m}}\\right]^{${n}} = \\left(-\\dfrac{1}{2}\\right)^{${m} \\cdot ${n}} = \\left(-\\dfrac{1}{2}\\right)^{${m * n}}.$$`,
        TOPICS.SO_HUU_TI,
        'nhan-biet',
      );
    },
  },
  // 3. Tìm x với số hữu tỉ
  {
    topic: TOPICS.SO_HUU_TI,
    generate: (rng, id) => {
      const a = rng.pick([2, 3, 4]);
      const b = rng.int(1, 5);
      const c = rng.int(6, 15);
      const ansLatex = fracLatex(c - b, a);
      return makeMcq(
        rng,
        id,
        `Tìm số hữu tỉ $x$ biết $${a}x + ${b} = ${c}$:`,
        `$x = ${ansLatex}$`,
        [`$x = ${fracLatex(c + b, a)}$`, `$x = ${fracLatex(c - b, a + 1)}$`, `$x = ${fracLatex(b - c, a)}$`],
        `Ta có:\n$${a}x = ${c} - ${b} = ${c - b}$\n$x = ${ansLatex}$.`,
        TOPICS.SO_HUU_TI,
        'thong-hieu',
      );
    },
  },
  // 4. Căn bậc hai số học
  {
    topic: TOPICS.SO_THUC,
    generate: (rng, id) => {
      const n = rng.pick([4, 5, 6, 7, 8, 9, 11, 12, 13, 15]);
      const sq = n * n;
      return makeMcq(
        rng,
        id,
        `Căn bậc hai số học của $${sq}$ là:`,
        `$${n}$`,
        [`$-${n}$`, `$\\pm ${n}$`, `$${sq / 2}$`],
        `Căn bậc hai số học của số $a \\ge 0$ là số **không âm** $x$ sao cho $x^2 = a$.\nVì $${n} > 0$ và $${n}^2 = ${sq}$ nên $\\sqrt{${sq}} = ${n}$.`,
        TOPICS.SO_THUC,
        'nhan-biet',
      );
    },
  },
  // 5. Giá trị tuyệt đối của số thực
  {
    topic: TOPICS.SO_THUC,
    generate: (rng, id) => {
      const a = rng.int(2, 9);
      const b = rng.int(1, 5);
      const val = a + b;
      return makeMcq(
        rng,
        id,
        `Giá trị của biểu thức $|- ${a}| + \\sqrt{${b * b}}$ là:`,
        `$${val}$`,
        [`$${-a + b}$`, `$${a - b}$`, `$${a + b * b}$`],
        `Ta có $|- ${a}| = ${a}$ và $\\sqrt{${b * b}} = ${b}$.\nDo đó $|- ${a}| + \\sqrt{${b * b}} = ${a} + ${b} = ${val}$.`,
        TOPICS.SO_THUC,
        'thong-hieu',
      );
    },
  },
  // 6. Số vô tỉ
  {
    topic: TOPICS.SO_THUC,
    generate: (rng, id) => {
      const irrationals = ['\\sqrt{2}', '\\sqrt{3}', '\\sqrt{5}', '\\sqrt{7}', '\\sqrt{11}', '\\pi'];
      const rationals = ['\\sqrt{9}', '\\frac{-3}{5}', '2{,}15', '-4', '0{,}(3)', '\\sqrt{16}'];
      const irr = rng.pick(irrationals);
      const rats = rng.shuffle(rationals).slice(0, 3);
      return makeMcq(
        rng,
        id,
        `Trong các số sau, số nào là **số vô tỉ**?`,
        `$${irr}$`,
        [`$${rats[0]}$`, `$${rats[1]}$`, `$${rats[2]}$`],
        `Số vô tỉ là số viết được dưới dạng số thập phân vô hạn không tuần hoàn.\nSố $${irr}$ là số vô tỉ; các số còn lại đều là số hữu tỉ.`,
        TOPICS.SO_THUC,
        'nhan-biet',
      );
    },
  },
  // 7. Làm tròn số
  {
    topic: TOPICS.SO_THUC,
    generate: (rng, id) => {
      const cases = [
        { raw: '3{,}14159', prec: '0{,}005', res: '3{,}14', w: ['3{,}1', '3{,}142', '3{,}15'], note: 'Độ chính xác $0{,}005$ ứng với làm tròn đến hàng phần trăm.' },
        { raw: '12{,}6784', prec: '0{,}05', res: '12{,}7', w: ['12{,}6', '12{,}68', '13'], note: 'Độ chính xác $0{,}05$ ứng với làm tròn đến hàng phần mười.' },
        { raw: '4582{,}3', prec: '50', res: '4600', w: ['4580', '4500', '5000'], note: 'Độ chính xác $50$ ứng với làm tròn đến hàng trăm.' },
        { raw: '7{,}8462', prec: '0{,}005', res: '7{,}85', w: ['7{,}84', '7{,}8', '7{,}846'], note: 'Độ chính xác $0{,}005$ ứng với làm tròn đến hàng phần trăm.' },
      ];
      const c = rng.pick(cases);
      return makeMcq(
        rng,
        id,
        `Làm tròn số $${c.raw}$ với độ chính xác $d = ${c.prec}$ ta được kết quả là:`,
        `$${c.res}$`,
        c.w.map((x) => `$${x}$`),
        `${c.note}\nLàm tròn $${c.raw}$ ta thu được $${c.res}$.`,
        TOPICS.SO_THUC,
        'thong-hieu',
      );
    },
  },
  // 8. Thể tích hình hộp chữ nhật
  {
    topic: TOPICS.HINH_KHOI,
    generate: (rng, id) => {
      const a = rng.int(4, 10);
      const b = rng.int(3, 7);
      const c = rng.int(2, 6);
      const V = a * b * c;
      const Sxq = 2 * (a + b) * c;
      return makeMcq(
        rng,
        id,
        `Một hình hộp chữ nhật có chiều dài $${a}\\text{ cm}$, chiều rộng $${b}\\text{ cm}$ và chiều cao $${c}\\text{ cm}$. Thể tích của hình hộp chữ nhật đó là:`,
        `$${V}\\text{ cm}^3$`,
        [`$${Sxq}\\text{ cm}^3$`, `$${a * b + c}\\text{ cm}^3$`, `$${2 * V}\\text{ cm}^3$`],
        `Thể tích hình hộp chữ nhật: $V = a \\cdot b \\cdot c = ${a} \\cdot ${b} \\cdot ${c} = ${V}\\text{ (cm}^3\\text{)}$.`,
        TOPICS.HINH_KHOI,
        'nhan-biet',
      );
    },
  },
  // 9. Diện tích xung quanh hình lăng trụ đứng tam giác
  {
    topic: TOPICS.HINH_KHOI,
    generate: (rng, id) => {
      const a = rng.int(3, 6);
      const b = rng.int(4, 7);
      const c = rng.int(5, 8);
      const h = rng.int(6, 12);
      const Sxq = (a + b + c) * h;
      return makeMcq(
        rng,
        id,
        `Một hình lăng trụ đứng tam giác có các cạnh đáy là $${a}\\text{ cm}, ${b}\\text{ cm}, ${c}\\text{ cm}$ và chiều cao $${h}\\text{ cm}$. Diện tích xung quanh của hình lăng trụ đó là:`,
        `$${Sxq}\\text{ cm}^2$`,
        [`$${(a + b) * h}\\text{ cm}^2$`, `$${Sxq / 2}\\text{ cm}^2$`, `$${a * b * c}\\text{ cm}^2$`],
        `Diện tích xung quanh hình lăng trụ đứng bằng chu vi đáy nhân với chiều cao:\n$$S_{\\text{xq}} = (${a} + ${b} + ${c}) \\cdot ${h} = ${a + b + c} \\cdot ${h} = ${Sxq}\\text{ (cm}^2\\text{)}.$$`,
        TOPICS.HINH_KHOI,
        'thong-hieu',
      );
    },
  },
  // 10. Góc kề bù & đối đỉnh
  {
    topic: TOPICS.GOC_SONG_SONG,
    generate: (rng, id) => {
      const angle = rng.int(35, 145);
      const supp = 180 - angle;
      return makeMcq(
        rng,
        id,
        `Cho hai góc kề bù $\\widehat{xOy}$ và $\\widehat{yOz}$. Biết $\\widehat{xOy} = ${angle}^\\circ$. Số đo góc $\\widehat{yOz}$ bằng:`,
        `$${supp}^\\circ$`,
        [`$${angle}^\\circ$`, `$${Math.abs(90 - angle)}^\\circ$`, `$${supp + 10}^\\circ$`],
        `Hai góc kề bù có tổng số đo bằng $180^\\circ$:\n$$\\widehat{yOz} = 180^\\circ - \\widehat{xOy} = 180^\\circ - ${angle}^\\circ = ${supp}^\\circ.$$`,
        TOPICS.GOC_SONG_SONG,
        'nhan-biet',
      );
    },
  },
  // 11. Tia phân giác của góc
  {
    topic: TOPICS.GOC_SONG_SONG,
    generate: (rng, id) => {
      const half = rng.int(22, 68);
      const full = half * 2;
      return makeMcq(
        rng,
        id,
        `Cho $\\widehat{xOy} = ${full}^\\circ$ và tia $Oz$ là tia phân giác của $\\widehat{xOy}$. Số đo góc $\\widehat{xOz}$ bằng:`,
        `$${half}^\\circ$`,
        [`$${full}^\\circ$`, `$${180 - full}^\\circ$`, `$${half + 10}^\\circ$`],
        `Vì $Oz$ là tia phân giác của $\\widehat{xOy}$ nên:\n$$\\widehat{xOz} = \\dfrac{\\widehat{xOy}}{2} = \\dfrac{${full}^\\circ}{2} = ${half}^\\circ.$$`,
        TOPICS.GOC_SONG_SONG,
        'nhan-biet',
      );
    },
  },
  // 12. Hai đường thẳng song song (góc trong cùng phía / so le trong)
  {
    topic: TOPICS.GOC_SONG_SONG,
    generate: (rng, id) => {
      const a = rng.int(40, 130);
      const b = 180 - a;
      return makeMcq(
        rng,
        id,
        `Cho hai đường thẳng song song $a \\parallel b$. Đường thẳng $c$ cắt $a$ và $b$ tạo thành cặp góc trong cùng phía. Biết một góc có số đo $${a}^\\circ$, góc trong cùng phía còn lại có số đo là:`,
        `$${b}^\\circ$`,
        [`$${a}^\\circ$`, `$${90}^\\circ$`, `$${Math.abs(a - 20)}^\\circ$`],
        `Khi hai đường thẳng song song bị cắt bởi một đường thẳng thứ ba thì hai góc trong cùng phía bù nhau (có tổng bằng $180^\\circ$).\nGóc còn lại bằng $180^\\circ - ${a}^\\circ = ${b}^\\circ$.`,
        TOPICS.GOC_SONG_SONG,
        'thong-hieu',
      );
    },
  },
  // 13. Tổng ba góc trong tam giác
  {
    topic: TOPICS.TAM_GIAC,
    generate: (rng, id) => {
      const A = rng.int(35, 80);
      const B = rng.int(35, 75);
      const C = 180 - A - B;
      return makeMcq(
        rng,
        id,
        `Cho $\\triangle ABC$ có $\\widehat{A} = ${A}^\\circ, \\widehat{B} = ${B}^\\circ$. Số đo góc $\\widehat{C}$ bằng:`,
        `$${C}^\\circ$`,
        [`$${A + B}^\\circ$`, `$${180 - A}^\\circ$`, `$${C + 10}^\\circ$`],
        `Tổng ba góc trong một tam giác bằng $180^\\circ$:\n$$\\widehat{C} = 180^\\circ - (\\widehat{A} + \\widehat{B}) = 180^\\circ - (${A}^\\circ + ${B}^\\circ) = ${C}^\\circ.$$`,
        TOPICS.TAM_GIAC,
        'nhan-biet',
      );
    },
  },
  // 14. Hai tam giác bằng nhau
  {
    topic: TOPICS.TAM_GIAC,
    generate: (rng, id) => {
      const ab = rng.int(4, 10);
      const bc = rng.int(5, 11);
      const ac = rng.int(6, 12);
      return makeMcq(
        rng,
        id,
        `Cho $\\triangle ABC = \\triangle MNP$. Biết $AB = ${ab}\\text{ cm}, BC = ${bc}\\text{ cm}, MP = ${ac}\\text{ cm}$. Chu vi của $\\triangle ABC$ là:`,
        `$${ab + bc + ac}\\text{ cm}$`,
        [`$${ab + bc}\\text{ cm}$`, `$${2 * (ab + bc)}\\text{ cm}$`, `$${ab + bc + ac + 2}\\text{ cm}$`],
        `Vì $\\triangle ABC = \\triangle MNP$ nên các cạnh tương ứng bằng nhau: $AC = MP = ${ac}\\text{ cm}$.\nChu vi $\\triangle ABC$ là: $AB + BC + AC = ${ab} + ${bc} + ${ac} = ${ab + bc + ac}\\text{ (cm)}$.`,
        TOPICS.TAM_GIAC,
        'thong-hieu',
      );
    },
  },
  // 15. Biểu đồ hình quạt tròn
  {
    topic: TOPICS.THONG_KE,
    generate: (rng, id) => {
      const total = rng.pick([40, 80, 100, 120, 200]);
      const pct = rng.pick([15, 20, 25, 30, 35, 40]);
      const count = (total * pct) / 100;
      return makeMcq(
        rng,
        id,
        `Một biểu đồ hình quạt tròn biểu diễn sở thích thể thao của $${total}$ học sinh khối 7. Biết hình quạt biểu diễn môn Bóng đá chiếm $${pct}\\%$. Số học sinh thích môn Bóng đá là:`,
        `$${count}$ học sinh`,
        [`$${count + 5}$ học sinh`, `$${total - count}$ học sinh`, `$${pct}$ học sinh`],
        `Số học sinh thích môn Bóng đá là:\n$$${total} \\cdot ${pct}\\% = \\dfrac{${total} \\cdot ${pct}}{100} = ${count}\\text{ (học sinh)}.$$`,
        TOPICS.THONG_KE,
        'thong-hieu',
      );
    },
  },
];

const tfPool: GradeGeneratorConfig['tfPool'] = [
  (rng, id): TrueFalseQuestion => {
    const a = rng.int(3, 6);
    const b = rng.int(4, 7);
    const h = rng.int(5, 9);
    const Sxq = 2 * (a + b) * h;
    const V = a * b * h;
    return {
      id,
      type: 'true-false',
      prompt: `Cho hình hộp chữ nhật có kích thước đáy là $${a}\\text{ cm} \\times ${b}\\text{ cm}$ và chiều cao $${h}\\text{ cm}$. Xét các khẳng định sau:`,
      statements: [
        { label: 'a', text: `Hình hộp chữ nhật có $6$ mặt, $8$ đỉnh và $12$ cạnh.`, isTrue: true },
        { label: 'b', text: `Diện tích xung quanh của hình hộp là $${Sxq}\\text{ cm}^2$.`, isTrue: true },
        { label: 'c', text: `Thể tích của hình hộp là $${V + 10}\\text{ cm}^3$.`, isTrue: false },
        { label: 'd', text: `Chu vi một mặt đáy là $${2 * (a + b)}\\text{ cm}$.`, isTrue: true },
      ],
      explanation: `• a) Đúng theo đặc điểm của hình hộp chữ nhật.\n• b) Đúng: $S_{\\text{xq}} = 2(${a} + ${b}) \\cdot ${h} = ${Sxq}\\text{ cm}^2$.\n• c) Sai: $V = ${a} \\cdot ${b} \\cdot ${h} = ${V}\\text{ cm}^3 \\ne ${V + 10}\\text{ cm}^3$.\n• d) Đúng: Chu vi đáy $C = 2(${a} + ${b}) = ${2 * (a + b)}\\text{ cm}$.`,
      topic: TOPICS.HINH_KHOI,
      difficulty: 'thong-hieu',
    };
  },
  (rng, id): TrueFalseQuestion => {
    const A = rng.int(40, 70);
    const B = rng.int(40, 70);
    const C = 180 - A - B;
    return {
      id,
      type: 'true-false',
      prompt: `Cho $\\triangle ABC$ có $\\widehat{A} = ${A}^\\circ$ và $\\widehat{B} = ${B}^\\circ$. Xét các khẳng định sau:`,
      statements: [
        { label: 'a', text: `$\\widehat{C} = ${C}^\\circ$.`, isTrue: true },
        { label: 'b', text: `Góc ngoài tại đỉnh $C$ có số đo bằng $${A + B}^\\circ$.`, isTrue: true },
        { label: 'c', text: `$\\triangle ABC$ là tam giác vuông.`, isTrue: C === 90 },
        { label: 'd', text: `Tổng ba góc của $\\triangle ABC$ bằng $180^\\circ$.`, isTrue: true },
      ],
      explanation: `• a) Đúng: $\\widehat{C} = 180^\\circ - (${A}^\\circ + ${B}^\\circ) = ${C}^\\circ$.\n• b) Đúng: Góc ngoài tại đỉnh $C$ bằng tổng hai góc trong không kề với nó: $\\widehat{A} + \\widehat{B} = ${A + B}^\\circ$.\n• c) ${C === 90 ? 'Đúng' : `Sai vì không có góc nào bằng $90^\\circ$ ($\\widehat{C} = ${C}^\\circ$)`}.\n• d) Đúng theo định lí tổng ba góc của một tam giác.`,
      topic: TOPICS.TAM_GIAC,
      difficulty: 'thong-hieu',
    };
  },
  (rng, id): TrueFalseQuestion => {
    const n = rng.pick([5, 6, 7, 8]);
    return {
      id,
      type: 'true-false',
      prompt: `Xét các khẳng định sau về tập hợp số thực $\\mathbb{R}$:`,
      statements: [
        { label: 'a', text: `Mọi số hữu tỉ đều là số thực.`, isTrue: true },
        { label: 'b', text: `$\\sqrt{${n * n}} = ${n}$ là một số hữu tỉ.`, isTrue: true },
        { label: 'c', text: `Giá trị tuyệt đối của $-${n}$ là $-${n}$.`, isTrue: false },
        { label: 'd', text: `$\\sqrt{2}$ là số vô tỉ.`, isTrue: true },
      ],
      explanation: `• a) Đúng vì $\\mathbb{Q} \\subset \\mathbb{R}$.\n• b) Đúng vì $\\sqrt{${n * n}} = ${n} \\in \\mathbb{Q}$.\n• c) Sai vì $|- ${n}| = ${n} > 0$.\n• d) Đúng vì $\\sqrt{2} = 1{,}41421356\\dots$ là số thập phân vô hạn không tuần hoàn.`,
      topic: TOPICS.SO_THUC,
      difficulty: 'nhan-biet',
    };
  },
];

const saGenerators: GradeGeneratorConfig['saGenerators'] = [
  {
    topic: TOPICS.SO_HUU_TI,
    generate: (rng, id): ShortAnswerQuestion => {
      const a = rng.int(2, 5);
      const b = rng.int(1, 7);
      const c = rng.int(8, 20);
      const accepted = fracPlain(c - b, a);
      const disp = fracLatex(c - b, a);
      return {
        id,
        type: 'short-answer',
        prompt: `Tìm số hữu tỉ $x$ biết $${a}x + ${b} = ${c}$ (viết kết quả dưới dạng phân số tối giản hoặc số thập phân).`,
        acceptedAnswers: accepted,
        displayAnswer: `$${disp}$`,
        explanation: `Ta có $${a}x = ${c} - ${b} = ${c - b} \\Rightarrow x = ${disp}$.`,
        topic: TOPICS.SO_HUU_TI,
        difficulty: 'thong-hieu',
      };
    },
  },
  {
    topic: TOPICS.SO_THUC,
    generate: (rng, id): ShortAnswerQuestion => {
      const a = rng.pick([4, 9, 16, 25]);
      const b = rng.pick([36, 49, 64, 81]);
      const ans = Math.sqrt(a) + Math.sqrt(b) - 3;
      return {
        id,
        type: 'short-answer',
        prompt: `Tính giá trị của biểu thức $P = \\sqrt{${a}} + \\sqrt{${b}} - |-3|$.`,
        acceptedAnswers: [`${ans}`],
        displayAnswer: `$${ans}$`,
        explanation: `Ta có $\\sqrt{${a}} = ${Math.sqrt(a)}$, $\\sqrt{${b}} = ${Math.sqrt(b)}$ và $|-3| = 3$.\nDo đó $P = ${Math.sqrt(a)} + ${Math.sqrt(b)} - 3 = ${ans}$.`,
        topic: TOPICS.SO_THUC,
        difficulty: 'thong-hieu',
      };
    },
  },
  {
    topic: TOPICS.HINH_KHOI,
    generate: (rng, id): ShortAnswerQuestion => {
      const edge = rng.int(3, 8);
      const V = edge * edge * edge;
      return {
        id,
        type: 'short-answer',
        prompt: `Một hình lập phương có diện tích một mặt là $${edge * edge}\\text{ cm}^2$. Tính thể tích của hình lập phương đó (đơn vị $\\text{cm}^3$).`,
        acceptedAnswers: [`${V}`],
        displayAnswer: `$${V}$`,
        unit: 'cm³',
        explanation: `Độ dài cạnh hình lập phương là $a = \\sqrt{${edge * edge}} = ${edge}\\text{ cm}$.\nThể tích hình lập phương là $V = a^3 = ${edge}^3 = ${V}\\text{ (cm}^3\\text{)}$.`,
        topic: TOPICS.HINH_KHOI,
        difficulty: 'van-dung',
      };
    },
  },
  {
    topic: TOPICS.TAM_GIAC,
    generate: (rng, id): ShortAnswerQuestion => {
      const B = rng.int(40, 75);
      const A = 180 - 2 * B;
      return {
        id,
        type: 'short-answer',
        prompt: `Cho $\\triangle ABC$ cân tại $A$ có $\\widehat{B} = ${B}^\\circ$. Tính số đo góc ở đỉnh $\\widehat{A}$ (đơn vị độ).`,
        acceptedAnswers: [`${A}`],
        displayAnswer: `$${A}^\\circ$`,
        unit: 'độ',
        explanation: `Vì $\\triangle ABC$ cân tại $A$ nên $\\widehat{C} = \\widehat{B} = ${B}^\\circ$.\nTổng ba góc bằng $180^\\circ$ nên $\\widehat{A} = 180^\\circ - 2 \\cdot ${B}^\\circ = ${A}^\\circ$.`,
        topic: TOPICS.TAM_GIAC,
        difficulty: 'van-dung',
      };
    },
  },
  {
    topic: TOPICS.THONG_KE,
    generate: (rng, id): ShortAnswerQuestion => {
      const a = rng.int(15, 30);
      const b = rng.int(20, 35);
      const c = rng.int(10, 25);
      const d = 100 - a - b - c;
      return {
        id,
        type: 'short-answer',
        prompt: `Biểu đồ hình quạt tròn biểu diễn cơ cấu xếp loại học lực gồm 4 mức: Tốt ($${a}\\%$), Khá ($${b}\\%$), Đạt ($${c}\\%$) và Chưa đạt. Hỏi mức Chưa đạt chiếm bao nhiêu phần trăm?`,
        acceptedAnswers: [`${d}`],
        displayAnswer: `$${d}\\%$`,
        unit: '%',
        explanation: `Tổng tỉ lệ của cả hình tròn là $100\\%$.\nMức Chưa đạt chiếm: $100\\% - (${a}\\% + ${b}\\% + ${c}\\%) = ${d}\\%$.`,
        topic: TOPICS.THONG_KE,
        difficulty: 'thong-hieu',
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
      sourceNote: 'Chuẩn ma trận Cuối HK1 Toán 7 — GDPT 2018',
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
      subtitle: 'Số hữu tỉ, Số thực, Hình khối & Đường thẳng song song',
      category: 'giua-hk1',
      textbook: books[idx % books.length],
      durationMinutes: 60,
      topics: [TOPICS.SO_HUU_TI, TOPICS.SO_THUC, TOPICS.HINH_KHOI, TOPICS.GOC_SONG_SONG],
      sourceNote: 'Bám sát ma trận Giữa HK1 Toán 7 — GDPT 2018',
      mcqCount: 12,
      tfCount: 2,
      saCount: 2,
      topicFilter: [TOPICS.SO_HUU_TI, TOPICS.SO_THUC, TOPICS.HINH_KHOI, TOPICS.GOC_SONG_SONG],
    };
  }),
  {
    index: 15,
    title: 'Kiểm tra 15 phút — Số hữu tỉ & Lũy thừa',
    subtitle: '10 câu trắc nghiệm nhanh kèm lời giải chi tiết',
    category: 'kiem-tra-15p',
    textbook: 'chung',
    durationMinutes: 15,
    topics: [TOPICS.SO_HUU_TI],
    sourceNote: 'Chuyên đề Chương 1 — Toán 7',
    mcqCount: 10,
    tfCount: 0,
    saCount: 0,
    topicFilter: [TOPICS.SO_HUU_TI],
  },
  {
    index: 16,
    title: 'Kiểm tra 15 phút — Số vô tỉ, Căn bậc hai & Số thực',
    subtitle: '10 câu trắc nghiệm nhanh kèm lời giải chi tiết',
    category: 'kiem-tra-15p',
    textbook: 'kntt',
    durationMinutes: 15,
    topics: [TOPICS.SO_THUC],
    sourceNote: 'Chuyên đề Chương 2 — Toán 7',
    mcqCount: 10,
    tfCount: 0,
    saCount: 0,
    topicFilter: [TOPICS.SO_THUC],
  },
  {
    index: 17,
    title: 'Kiểm tra 15 phút — Hình hộp chữ nhật & Hình lăng trụ đứng',
    subtitle: '8 Trắc nghiệm + 2 Trả lời ngắn',
    category: 'kiem-tra-15p',
    textbook: 'ctst',
    durationMinutes: 15,
    topics: [TOPICS.HINH_KHOI],
    sourceNote: 'Chuyên đề Hình khối — Toán 7',
    mcqCount: 8,
    tfCount: 0,
    saCount: 2,
    topicFilter: [TOPICS.HINH_KHOI],
  },
  {
    index: 18,
    title: 'Kiểm tra 15 phút — Góc & Hai đường thẳng song song',
    subtitle: '10 câu trắc nghiệm nhanh kèm lời giải chi tiết',
    category: 'kiem-tra-15p',
    textbook: 'cd',
    durationMinutes: 15,
    topics: [TOPICS.GOC_SONG_SONG],
    sourceNote: 'Chuyên đề Đường thẳng song song — Toán 7',
    mcqCount: 10,
    tfCount: 0,
    saCount: 0,
    topicFilter: [TOPICS.GOC_SONG_SONG],
  },
  {
    index: 19,
    title: 'Kiểm tra 15 phút — Tổng ba góc & Hai tam giác bằng nhau',
    subtitle: '8 Trắc nghiệm + 2 Trả lời ngắn',
    category: 'kiem-tra-15p',
    textbook: 'chung',
    durationMinutes: 15,
    topics: [TOPICS.TAM_GIAC],
    sourceNote: 'Chuyên đề Tam giác — Toán 7',
    mcqCount: 8,
    tfCount: 0,
    saCount: 2,
    topicFilter: [TOPICS.TAM_GIAC],
  },
  {
    index: 20,
    title: 'Kiểm tra 15 phút — Biểu đồ quạt tròn & Thống kê',
    subtitle: '8 Trắc nghiệm + 2 Trả lời ngắn',
    category: 'kiem-tra-15p',
    textbook: 'chung',
    durationMinutes: 15,
    topics: [TOPICS.THONG_KE],
    sourceNote: 'Chuyên đề Thống kê — Toán 7',
    mcqCount: 8,
    tfCount: 0,
    saCount: 2,
    topicFilter: [TOPICS.THONG_KE],
  },
  {
    index: 21,
    title: 'Ôn tập Chương 1 — Tập hợp số hữu tỉ',
    subtitle: '12 Trắc nghiệm + 3 Trả lời ngắn (45 phút)',
    category: 'on-tap-chuong',
    textbook: 'kntt',
    durationMinutes: 45,
    topics: [TOPICS.SO_HUU_TI],
    sourceNote: 'Ôn tập Chương 1 — Toán 7',
    mcqCount: 12,
    tfCount: 0,
    saCount: 3,
    topicFilter: [TOPICS.SO_HUU_TI],
  },
  {
    index: 22,
    title: 'Ôn tập Chương 2 — Số thực',
    subtitle: '12 Trắc nghiệm + 3 Trả lời ngắn (45 phút)',
    category: 'on-tap-chuong',
    textbook: 'ctst',
    durationMinutes: 45,
    topics: [TOPICS.SO_THUC],
    sourceNote: 'Ôn tập Chương 2 — Toán 7',
    mcqCount: 12,
    tfCount: 0,
    saCount: 3,
    topicFilter: [TOPICS.SO_THUC],
  },
  {
    index: 23,
    title: 'Ôn tập Chương 3 — Góc và Đường thẳng song song',
    subtitle: '12 Trắc nghiệm + 3 Trả lời ngắn (45 phút)',
    category: 'on-tap-chuong',
    textbook: 'cd',
    durationMinutes: 45,
    topics: [TOPICS.GOC_SONG_SONG, TOPICS.HINH_KHOI],
    sourceNote: 'Ôn tập Hình học HK1 — Toán 7',
    mcqCount: 12,
    tfCount: 0,
    saCount: 3,
    topicFilter: [TOPICS.GOC_SONG_SONG, TOPICS.HINH_KHOI],
  },
  {
    index: 24,
    title: 'Ôn tập Chương 4 & 5 — Tam giác & Dữ liệu thống kê',
    subtitle: '12 Trắc nghiệm + 3 Trả lời ngắn (45 phút)',
    category: 'on-tap-chuong',
    textbook: 'chung',
    durationMinutes: 45,
    topics: [TOPICS.TAM_GIAC, TOPICS.THONG_KE],
    sourceNote: 'Ôn tập Tam giác & Thống kê — Toán 7',
    mcqCount: 12,
    tfCount: 0,
    saCount: 3,
    topicFilter: [TOPICS.TAM_GIAC, TOPICS.THONG_KE],
  },
];

export const GRADE_7_CONFIG: GradeGeneratorConfig = {
  grade: 7,
  blueprints,
  mcqGenerators,
  tfPool,
  saGenerators,
};

export const GRADE_7_EXAMS: Exam[] = buildGradeExams(GRADE_7_CONFIG);
