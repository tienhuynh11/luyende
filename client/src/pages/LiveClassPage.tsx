import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  Eye,
  EyeOff,
  Grid,
  Lock,
  Radio,
  Send,
  Trash2,
  Undo2,
  Unlock,
  Users,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GradeLevel, LiveChatMessage, LiveRoomState, WhiteboardPoint, WhiteboardStroke } from '@shared/types';
import { MathText } from '../components/MathText';
import { apiSendLiveAction, fetchLiveState } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { useExams } from '../lib/examStore';

const COLORS = [
  { hex: '#1c1f21', label: 'Đen' },
  { hex: '#1d4ed8', label: 'Xanh dương' },
  { hex: '#dc2626', label: 'Đỏ' },
  { hex: '#15803d', label: 'Xanh lá' },
];

const WIDTHS = [
  { val: 2, label: 'Mảnh' },
  { val: 4, label: 'Vừa' },
  { val: 8, label: 'Dày' },
];

const emptyState: LiveRoomState = {
  active: false,
  hostName: '',
  startedAt: null,
  examId: null,
  questionIndex: 0,
  showSolution: false,
  studentCanDraw: true,
  gridPaper: true,
  meetUrl: '',
  strokes: [],
  messages: [],
  participants: [],
};

export function LiveClassPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { allExams, getExam } = useExams();

  const [room, setRoom] = useState<LiveRoomState>(emptyState);
  const [connected, setConnected] = useState(false);

  // Drawing controls
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<boolean>(false);
  const activePointsRef = useRef<WhiteboardPoint[]>([]);
  const [color, setColor] = useState('#1c1f21');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [eraser, setEraser] = useState(false);

  // Tutor spotlight selector
  const [pickGrade, setPickGrade] = useState<GradeLevel>(6);
  const [meetDraft, setMeetDraft] = useState('');

  // Chat
  const [chatText, setChatText] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const isTeacher = user?.role === 'teacher';
  const canDraw = isTeacher || room.studentCanDraw;

  // Connect to SSE stream
  useEffect(() => {
    if (!user) return;
    void fetchLiveState()
      .then((d) => {
        setRoom(d.state);
        setMeetDraft(d.state.meetUrl);
      })
      .catch(() => {});

    const es = new EventSource('/api/live/stream', { withCredentials: true });
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.addEventListener('state', (ev) => {
      try {
        const next = JSON.parse((ev as MessageEvent).data) as LiveRoomState;
        setRoom(next);
        setMeetDraft(next.meetUrl);
      } catch {
        // ignore
      }
    });

    es.addEventListener('stroke', (ev) => {
      try {
        const stroke = JSON.parse((ev as MessageEvent).data) as WhiteboardStroke;
        setRoom((prev) => {
          if (prev.strokes.some((s) => s.id === stroke.id)) return prev;
          return { ...prev, strokes: [...prev.strokes, stroke] };
        });
      } catch {
        // ignore
      }
    });

    es.addEventListener('chat', (ev) => {
      try {
        const msg = JSON.parse((ev as MessageEvent).data) as LiveChatMessage;
        setRoom((prev) => {
          if (prev.messages.some((m) => m.id === msg.id)) return prev;
          return { ...prev, messages: [...prev.messages, msg] };
        });
      } catch {
        // ignore
      }
    });

    es.addEventListener('participants', (ev) => {
      try {
        const participants = JSON.parse((ev as MessageEvent).data) as LiveRoomState['participants'];
        setRoom((prev) => ({ ...prev, participants }));
      } catch {
        // ignore
      }
    });

    return () => {
      es.close();
      setConnected(false);
    };
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room.messages.length]);

  // Render whiteboard canvas
  const drawStrokeOnCtx = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, s: WhiteboardStroke) => {
      if (s.points.length === 0) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = s.eraser ? '#ffffff' : s.color;
      ctx.lineWidth = s.eraser ? s.width * 3.5 : s.width;
      ctx.beginPath();
      const first = s.points[0];
      ctx.moveTo(first.x * w, first.y * h);
      if (s.points.length === 1) {
        ctx.lineTo(first.x * w + 0.5, first.y * h + 0.5);
      } else {
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x * w, s.points[i].y * h);
        }
      }
      ctx.stroke();
      ctx.restore();
    },
    [],
  );

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.max(1, Math.floor(rect.width * dpr));
    const targetH = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Optional math grid paper
    if (room.gridPaper) {
      ctx.strokeStyle = '#ecebe5';
      ctx.lineWidth = 1;
      const step = 24;
      ctx.beginPath();
      for (let x = step; x < rect.width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rect.height);
      }
      for (let y = step; y < rect.height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
      }
      ctx.stroke();
    }

    for (const s of room.strokes) {
      drawStrokeOnCtx(ctx, rect.width, rect.height, s);
    }
  }, [room.strokes, room.gridPaper, drawStrokeOnCtx]);

  useEffect(() => {
    redrawAll();
    const onResize = () => redrawAll();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [redrawAll]);

  const getNormPoint = (e: PointerEvent<HTMLCanvasElement>): WhiteboardPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getNormPoint(e);
    if (!pt) return;
    drawingRef.current = true;
    activePointsRef.current = [pt];
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !canDraw) return;
    const pt = getNormPoint(e);
    if (!pt) return;
    const pts = activePointsRef.current;
    const prev = pts[pts.length - 1];
    if (prev && Math.hypot(pt.x - prev.x, pt.y - prev.y) < 0.0025) return;
    pts.push(pt);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      const rect = canvas.getBoundingClientRect();
      drawStrokeOnCtx(ctx, rect.width, rect.height, {
        id: 'live',
        authorName: user?.fullName ?? '',
        color,
        width: strokeWidth,
        eraser,
        points: prev ? [prev, pt] : [pt],
      });
    }
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const points = activePointsRef.current;
    activePointsRef.current = [];
    if (points.length === 0) return;

    const stroke: WhiteboardStroke = {
      id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      authorName: user?.fullName ?? '',
      color,
      width: strokeWidth,
      eraser,
      points,
    };
    setRoom((prev) => ({ ...prev, strokes: [...prev.strokes, stroke] }));
    void apiSendLiveAction({ type: 'add-stroke', stroke }).catch(() => {});
  };

  const spotlightExam = room.examId ? getExam(room.examId) : undefined;
  const spotlightQuestion = spotlightExam?.questions[room.questionIndex];
  const gradeExams = useMemo(() => allExams.filter((e) => e.grade === pickGrade), [allExams, pickGrade]);

  const handleSendChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    const text = chatText.trim();
    setChatText('');
    try {
      await apiSendLiveAction({ type: 'chat', text });
    } catch {
      // ignore
    }
  };

  if (authLoading) {
    return <div className="container"><div className="panel">Đang tải...</div></div>;
  }

  if (!user) {
    return (
      <div className="container narrow-container">
        <div className="panel">
          <h1>Phòng học trực tiếp</h1>
          <p className="muted-text">Vui lòng đăng nhập bằng tài khoản Gia sư hoặc Học sinh để vào phòng học.</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/dang-nhap')}>
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container live-page">
      {/* HEADER PHÒNG HỌC */}
      <div className="live-head panel">
        <div className="live-head-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1>Phòng dạy trực tiếp</h1>
            <span className={`live-status ${room.active ? 'on' : 'off'}`}>
              <Radio size={13} /> {room.active ? 'Đang mở' : 'Chưa mở'}
            </span>
            <span className="muted-inline">
              <Users size={14} style={{ verticalAlign: -2 }} /> {room.participants.length} người trong phòng
              {room.participants.length > 0 && ` (${room.participants.map((p) => p.name).join(', ')})`}
            </span>
          </div>
          {!connected && <div className="cell-sub">Đang kết nối lại máy chủ...</div>}
        </div>

        <div className="live-head-actions">
          {room.meetUrl && (
            <a href={room.meetUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
              <Video size={15} /> Mở gọi thoại / Video
            </a>
          )}
          {isTeacher && (
            <button
              type="button"
              className={room.active ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
              onClick={() => void apiSendLiveAction({ type: 'set-active', active: !room.active })}
            >
              {room.active ? 'Đóng phòng học' : 'Mở phòng (báo học sinh)'}
            </button>
          )}
        </div>
      </div>

      {/* THANH CHỌN ĐỀ CHIẾU LÊN BẢNG (CHỈ GIA SƯ) */}
      {isTeacher && (
        <div className="panel live-controls">
          <div className="live-ctrl-row">
            <select
              className="select-input"
              value={pickGrade}
              onChange={(e) => setPickGrade(Number(e.target.value) as GradeLevel)}
            >
              <option value={6}>Toán 6</option>
              <option value={7}>Toán 7</option>
              <option value={8}>Toán 8</option>
              <option value={9}>Toán 9</option>
            </select>

            <select
              className="select-input"
              style={{ flex: 1, minWidth: 200 }}
              value={room.examId ?? ''}
              onChange={(e) =>
                void apiSendLiveAction({
                  type: 'set-spotlight',
                  examId: e.target.value || null,
                  questionIndex: 0,
                  showSolution: false,
                })
              }
            >
              <option value="">-- Chọn đề để chiếu câu hỏi cho học sinh --</option>
              {gradeExams.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.title}</option>
              ))}
            </select>

            <div className="meet-link-wrap">
              <input
                type="url"
                className="select-input"
                placeholder="Dán link Meet / Zoom / Zalo..."
                value={meetDraft}
                onChange={(e) => setMeetDraft(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => void apiSendLiveAction({ type: 'set-options', meetUrl: meetDraft })}
              >
                Lưu link gọi
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                title="Tạo phòng gọi thoại/video miễn phí bằng Jitsi"
                onClick={() => {
                  const url = `https://meet.jit.si/LuyenDeTHCS-${Date.now().toString(36).slice(-5)}`;
                  setMeetDraft(url);
                  void apiSendLiveAction({ type: 'set-options', meetUrl: url });
                }}
              >
                <Video size={14} /> Tạo link gọi nhanh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CÂU HỎI ĐANG CHIẾU ĐỒNG BỘ */}
      {spotlightExam && spotlightQuestion && (
        <section className="panel spotlight-box">
          <div className="spotlight-head">
            <div>
              <strong>{spotlightExam.title}</strong> — Câu {room.questionIndex + 1}/{spotlightExam.questions.length}
            </div>
            {isTeacher && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={room.questionIndex <= 0}
                  onClick={() =>
                    void apiSendLiveAction({
                      type: 'set-spotlight',
                      examId: spotlightExam.id,
                      questionIndex: room.questionIndex - 1,
                      showSolution: false,
                    })
                  }
                >
                  <ChevronLeft size={15} /> Câu trước
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={room.questionIndex >= spotlightExam.questions.length - 1}
                  onClick={() =>
                    void apiSendLiveAction({
                      type: 'set-spotlight',
                      examId: spotlightExam.id,
                      questionIndex: room.questionIndex + 1,
                      showSolution: false,
                    })
                  }
                >
                  Câu sau <ChevronRight size={15} />
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() =>
                    void apiSendLiveAction({
                      type: 'set-spotlight',
                      examId: spotlightExam.id,
                      questionIndex: room.questionIndex,
                      showSolution: !room.showSolution,
                    })
                  }
                >
                  {room.showSolution ? <EyeOff size={15} /> : <Eye size={15} />}
                  {room.showSolution ? 'Ẩn lời giải' : 'Hiện lời giải'}
                </button>
              </div>
            )}
          </div>

          <div className="spotlight-prompt">
            <MathText text={spotlightQuestion.prompt} />
          </div>

          {spotlightQuestion.type === 'mcq' && (
            <div className="spotlight-opts">
              {spotlightQuestion.options.map((o, i) => (
                <div
                  key={i}
                  className={`spotlight-opt ${room.showSolution && i === spotlightQuestion.correctIndex ? 'correct' : ''}`}
                >
                  <strong>{(['A', 'B', 'C', 'D'] as const)[i]}.</strong> <MathText text={o} />
                </div>
              ))}
            </div>
          )}

          {spotlightQuestion.type === 'true-false' && (
            <div className="spotlight-opts">
              {spotlightQuestion.statements.map((st) => (
                <div key={st.label} className="spotlight-opt">
                  <strong>{st.label})</strong> <MathText text={st.text} />
                  {room.showSolution && (
                    <span className="tag" style={{ marginLeft: 8 }}>{st.isTrue ? 'Đúng' : 'Sai'}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {room.showSolution && (
            <div className="solution-box">
              <div className="solution-title">Lời giải chi tiết</div>
              <div className="solution-body">
                <MathText text={spotlightQuestion.explanation} />
              </div>
            </div>
          )}
        </section>
      )}

      {/* BẢNG TRẮNG + CHAT TRỰC TIẾP */}
      <div className="live-grid">
        <section className="panel board-panel">
          <div className="wb-toolbar">
            <div className="wb-group">
              {COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className={`color-dot ${!eraser && color === c.hex ? 'active' : ''}`}
                  style={{ background: c.hex }}
                  title={c.label}
                  onClick={() => {
                    setEraser(false);
                    setColor(c.hex);
                  }}
                />
              ))}
              {WIDTHS.map((w) => (
                <button
                  key={w.val}
                  type="button"
                  className={`pill-btn ${!eraser && strokeWidth === w.val ? 'active' : ''}`}
                  style={{ padding: '3px 8px', fontSize: 12 }}
                  onClick={() => {
                    setEraser(false);
                    setStrokeWidth(w.val);
                  }}
                >
                  {w.label}
                </button>
              ))}
              <button
                type="button"
                className={`pill-btn ${eraser ? 'active' : ''}`}
                style={{ padding: '4px 8px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => setEraser((v) => !v)}
              >
                <Eraser size={14} /> Tẩy
              </button>
            </div>

            <div className="wb-group">
              <button
                type="button"
                className="icon-btn"
                title="Hoàn tác nét vừa vẽ"
                disabled={!canDraw}
                onClick={() => void apiSendLiveAction({ type: 'undo-stroke' })}
              >
                <Undo2 size={16} />
              </button>

              {isTeacher && (
                <>
                  <button
                    type="button"
                    className="icon-btn"
                    title={room.gridPaper ? 'Chuyển nền trắng' : 'Bật ô ly vở toán'}
                    onClick={() => void apiSendLiveAction({ type: 'set-options', gridPaper: !room.gridPaper })}
                  >
                    <Grid size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title={room.studentCanDraw ? 'Khóa học sinh viết bảng' : 'Cho phép học sinh cùng viết bảng'}
                    onClick={() =>
                      void apiSendLiveAction({ type: 'set-options', studentCanDraw: !room.studentCanDraw })
                    }
                  >
                    {room.studentCanDraw ? <Unlock size={16} /> : <Lock size={16} />}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Xóa toàn bộ bảng"
                    onClick={() => {
                      if (window.confirm('Xóa sạch bảng trắng?')) {
                        void apiSendLiveAction({ type: 'clear-board' });
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

          {!canDraw && (
            <div className="cell-sub" style={{ marginBottom: 6 }}>
              Chế độ chỉ xem (gia sư đang khóa quyền viết bảng của học sinh).
            </div>
          )}

          <div className="wb-canvas-wrap">
            <canvas
              ref={canvasRef}
              className={`wb-canvas ${canDraw ? 'drawable' : ''}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
            />
          </div>
        </section>

        {/* KHUNG CHAT & CÔNG THỨC TOÁN */}
        <section className="panel chat-panel">
          <div className="chat-head">
            <strong>Trao đổi & Gõ công thức</strong>
            <small className="muted-inline">Hỗ trợ $x^2$, $\frac{'{a}{b}'}$</small>
          </div>
          <div className="chat-messages">
            {room.messages.length === 0 ? (
              <div className="empty-inline">Chưa có tin nhắn. Gõ công thức hoặc trao đổi trực tiếp tại đây.</div>
            ) : (
              room.messages.map((m) => (
                <div key={m.id} className={`chat-msg ${m.role === 'teacher' ? 'is-teacher' : ''}`}>
                  <div className="chat-msg-head">
                    <strong>{m.authorName}</strong>
                    <small>{new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</small>
                  </div>
                  <div className="chat-msg-body">
                    <MathText text={m.text} />
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendChat} className="chat-form">
            <input
              type="text"
              placeholder="Nhắn tin hoặc gõ $công thức$..."
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
            />
            <button type="submit" className="btn-primary btn-sm" aria-label="Gửi">
              <Send size={15} />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
