import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Grid,
  Highlighter,
  ImagePlus,
  Lock,
  Maximize2,
  MessageCircle,
  Minimize2,
  Minus,
  Pen,
  Plus,
  Pointer,
  Radio,
  Send,
  Square,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type PointerEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  BoardPage,
  GradeLevel,
  LiveChatMessage,
  LiveRoomState,
  WhiteboardItem,
  WhiteboardPoint,
  WhiteboardTool,
} from '@shared/types';
import { MathText } from '../components/MathText';
import { apiSendLiveAction, fetchLiveState } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { useExams } from '../lib/examStore';

const PEN_COLORS = [
  { hex: '#1c1f21', label: 'Đen' },
  { hex: '#1d4ed8', label: 'Xanh dương' },
  { hex: '#dc2626', label: 'Đỏ' },
  { hex: '#15803d', label: 'Xanh lá' },
];

const HIGHLIGHT_COLORS = [
  { hex: '#facc15', label: 'Vàng' },
  { hex: '#4ade80', label: 'Xanh lá' },
  { hex: '#f472b6', label: 'Hồng' },
];

const WIDTHS = [
  { val: 2, label: 'Mảnh' },
  { val: 4, label: 'Vừa' },
  { val: 7, label: 'Dày' },
];

const emptyPage: BoardPage = { id: 'p1', title: 'Trang 1', backgroundImage: null, items: [] };

const emptyState: LiveRoomState = {
  active: false,
  hostName: '',
  startedAt: null,
  examId: null,
  questionIndex: 0,
  showSolution: false,
  studentCanDraw: false,
  gridPaper: true,
  meetUrl: '',
  pages: [emptyPage],
  currentPageIndex: 0,
  messages: [],
  participants: [],
};

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được file ảnh.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File ảnh không hợp lệ.'));
      img.onload = () => {
        const maxDim = 1400;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const ctx = off.getContext('2d');
        if (!ctx) return reject(new Error('Trình duyệt không hỗ trợ xử lý ảnh.'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(off.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function drawItemOnCtx(ctx: CanvasRenderingContext2D, w: number, h: number, item: WhiteboardItem) {
  ctx.save();
  if (item.kind === 'text') {
    ctx.fillStyle = item.color;
    ctx.font = `600 ${item.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = 'top';
    const lines = item.text.split('\n');
    lines.forEach((line, idx) => {
      ctx.fillText(line, item.x * w, item.y * h + idx * (item.fontSize * 1.3));
    });
    ctx.restore();
    return;
  }

  const pts = item.points;
  if (pts.length === 0) {
    ctx.restore();
    return;
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (item.tool === 'highlighter') {
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = item.color;
    ctx.lineWidth = Math.max(14, item.width * 4.5);
  } else if (item.tool === 'eraser') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(14, item.width * 4);
  } else {
    ctx.strokeStyle = item.color;
    ctx.lineWidth = item.width;
  }

  if (item.tool === 'line' && pts.length >= 2) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    ctx.beginPath();
    ctx.moveTo(a.x * w, a.y * h);
    ctx.lineTo(b.x * w, b.y * h);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (item.tool === 'rect' && pts.length >= 2) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    ctx.strokeRect(a.x * w, a.y * h, (b.x - a.x) * w, (b.y - a.y) * h);
    ctx.restore();
    return;
  }

  if (item.tool === 'circle' && pts.length >= 2) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    const cx = ((a.x + b.x) / 2) * w;
    const cy = ((a.y + b.y) / 2) * h;
    const rx = Math.abs((b.x - a.x) * w) / 2;
    const ry = Math.abs((b.y - a.y) * h) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Smooth quadratic Bezier curve for pen / highlighter / eraser
  ctx.beginPath();
  ctx.moveTo(pts[0].x * w, pts[0].y * h);
  if (pts.length === 1) {
    ctx.lineTo(pts[0].x * w + 0.5, pts[0].y * h + 0.5);
  } else if (pts.length === 2) {
    ctx.lineTo(pts[1].x * w, pts[1].y * h);
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = ((pts[i].x + pts[i + 1].x) / 2) * w;
      const my = ((pts[i].y + pts[i + 1].y) / 2) * h;
      ctx.quadraticCurveTo(pts[i].x * w, pts[i].y * h, mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x * w, last.y * h);
  }
  ctx.stroke();
  ctx.restore();
}

export function LiveClassPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { allExams, getExam } = useExams();

  const [room, setRoom] = useState<LiveRoomState>(emptyState);
  const [connected, setConnected] = useState(false);

  // Board tools
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bgImgCacheRef = useRef<{ src: string; img: HTMLImageElement } | null>(null);
  const drawingRef = useRef<boolean>(false);
  const activePointsRef = useRef<WhiteboardPoint[]>([]);
  const lastBroadcastRef = useRef<number>(0);

  const [tool, setTool] = useState<WhiteboardTool>('pen');
  const [color, setColor] = useState('#1c1f21');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [localPreview, setLocalPreview] = useState<WhiteboardItem | null>(null);
  const [remotePreview, setRemotePreview] = useState<WhiteboardItem | null>(null);
  const [laserPoint, setLaserPoint] = useState<WhiteboardPoint | null>(null);
  const laserTimerRef = useRef<number | null>(null);

  // Inline text stamp tool
  const [textInputPos, setTextInputPos] = useState<WhiteboardPoint | null>(null);
  const [textDraft, setTextDraft] = useState('');

  // UI toggles
  const [showExamBar, setShowExamBar] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pickGrade, setPickGrade] = useState<GradeLevel>(6);
  const [meetDraft, setMeetDraft] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);

  // Floating Chat Bubble
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatText, setChatText] = useState('');
  const chatOpenRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  const isTeacher = user?.role === 'teacher';
  const canDraw = isTeacher || room.studentCanDraw;
  const currentPage = room.pages[room.currentPageIndex] ?? emptyPage;

  // Connect SSE
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
        setRemotePreview(null);
      } catch {
        // ignore
      }
    });

    es.addEventListener('item', (ev) => {
      try {
        const { pageIndex, item } = JSON.parse((ev as MessageEvent).data) as {
          pageIndex: number;
          item: WhiteboardItem;
        };
        setRemotePreview(null);
        setRoom((prev) => {
          const pages = [...prev.pages];
          const pg = pages[pageIndex];
          if (!pg || pg.items.some((x) => x.id === item.id)) return prev;
          pages[pageIndex] = { ...pg, items: [...pg.items, item] };
          return { ...prev, pages };
        });
      } catch {
        // ignore
      }
    });

    es.addEventListener('preview', (ev) => {
      try {
        const { item } = JSON.parse((ev as MessageEvent).data) as { item: WhiteboardItem | null };
        setRemotePreview(item);
      } catch {
        // ignore
      }
    });

    es.addEventListener('laser', (ev) => {
      try {
        const { point } = JSON.parse((ev as MessageEvent).data) as { point: WhiteboardPoint | null };
        setLaserPoint(point);
        if (laserTimerRef.current) window.clearTimeout(laserTimerRef.current);
        if (point) {
          laserTimerRef.current = window.setTimeout(() => setLaserPoint(null), 1500);
        }
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
        if (!chatOpenRef.current && msg.authorId !== user.id) {
          setUnreadCount((c) => c + 1);
        }
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
    if (chatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [room.messages.length, chatOpen]);

  // Support Ctrl+V paste image directly onto whiteboard for teachers!
  useEffect(() => {
    if (!isTeacher) return;
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            setUploadingImg(true);
            try {
              const dataUrl = await compressImageFile(file);
              await apiSendLiveAction({ type: 'set-page-image', imageDataUrl: dataUrl });
            } catch (err) {
              alert((err as Error).message);
            } finally {
              setUploadingImg(false);
            }
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [isTeacher]);

  // Redraw canvas whenever page, items, previews, laser, or image loads
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

    // 1. Background fill
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // 2. Grid paper (when no image or underneath image margins)
    if (room.gridPaper && !currentPage.backgroundImage) {
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

    // 3. Uploaded worksheet / theory image (aspect-fit centered)
    if (currentPage.backgroundImage) {
      const src = currentPage.backgroundImage;
      const cached = bgImgCacheRef.current;
      if (cached && cached.src === src && cached.img.complete && cached.img.naturalWidth > 0) {
        const img = cached.img;
        const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        const dx = (rect.width - dw) / 2;
        const dy = (rect.height - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
      } else if (!cached || cached.src !== src) {
        const img = new Image();
        bgImgCacheRef.current = { src, img };
        img.onload = () => redrawAll();
        img.src = src;
      }
    }

    // 4. Saved items
    for (const it of currentPage.items) {
      drawItemOnCtx(ctx, rect.width, rect.height, it);
    }

    // 5. Live previews (remote & local)
    if (remotePreview) drawItemOnCtx(ctx, rect.width, rect.height, remotePreview);
    if (localPreview) drawItemOnCtx(ctx, rect.width, rect.height, localPreview);

    // 6. Laser pointer
    if (laserPoint) {
      const lx = laserPoint.x * rect.width;
      const ly = laserPoint.y * rect.height;
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx, ly, 11, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220, 38, 38, 0.25)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lx, ly, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#dc2626';
      ctx.fill();
      ctx.restore();
    }
  }, [currentPage, room.gridPaper, localPreview, remotePreview, laserPoint]);

  useEffect(() => {
    redrawAll();
    const onResize = () => redrawAll();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [redrawAll, isFullscreen]);

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
    const pt = getNormPoint(e);
    if (!pt) return;

    if (tool === 'laser' && isTeacher) {
      e.currentTarget.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      setLaserPoint(pt);
      void apiSendLiveAction({ type: 'laser', point: pt });
      return;
    }

    if (!canDraw) return;

    if (tool === 'text') {
      setTextInputPos(pt);
      setTextDraft('');
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    activePointsRef.current = [pt];
    setLocalPreview({
      id: 'preview',
      kind: 'stroke',
      tool: tool === 'highlighter' || tool === 'line' || tool === 'rect' || tool === 'circle' || tool === 'eraser' ? tool : 'pen',
      authorName: user?.fullName ?? '',
      color,
      width: strokeWidth,
      points: [pt],
    });
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const pt = getNormPoint(e);
    if (!pt) return;

    const now = Date.now();
    if (tool === 'laser' && isTeacher) {
      setLaserPoint(pt);
      if (now - lastBroadcastRef.current > 60) {
        lastBroadcastRef.current = now;
        void apiSendLiveAction({ type: 'laser', point: pt });
      }
      return;
    }

    if (!canDraw) return;
    const pts = activePointsRef.current;
    const prev = pts[pts.length - 1];
    if (prev && Math.hypot(pt.x - prev.x, pt.y - prev.y) < 0.002) return;

    if (tool === 'line' || tool === 'rect' || tool === 'circle') {
      activePointsRef.current = [pts[0], pt];
    } else {
      pts.push(pt);
    }

    const previewItem: WhiteboardItem = {
      id: 'preview',
      kind: 'stroke',
      tool: tool === 'highlighter' || tool === 'line' || tool === 'rect' || tool === 'circle' || tool === 'eraser' ? tool : 'pen',
      authorName: user?.fullName ?? '',
      color,
      width: strokeWidth,
      points: [...activePointsRef.current],
    };
    setLocalPreview(previewItem);

    if (now - lastBroadcastRef.current > 80) {
      lastBroadcastRef.current = now;
      void apiSendLiveAction({ type: 'live-preview', item: previewItem });
    }
  };

  const finishPointer = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;

    if (tool === 'laser' && isTeacher) {
      setLaserPoint(null);
      void apiSendLiveAction({ type: 'laser', point: null });
      return;
    }

    const points = activePointsRef.current;
    activePointsRef.current = [];
    setLocalPreview(null);
    if (points.length === 0) return;

    const item: WhiteboardItem = {
      id: `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'stroke',
      tool: tool === 'highlighter' || tool === 'line' || tool === 'rect' || tool === 'circle' || tool === 'eraser' ? tool : 'pen',
      authorName: user?.fullName ?? '',
      color,
      width: strokeWidth,
      points,
    };

    setRoom((prev) => {
      const pages = [...prev.pages];
      const pg = pages[prev.currentPageIndex];
      if (!pg) return prev;
      pages[prev.currentPageIndex] = { ...pg, items: [...pg.items, item] };
      return { ...prev, pages };
    });
    void apiSendLiveAction({ type: 'add-item', item }).catch(() => {});
  };

  const handleCommitText = (e?: FormEvent) => {
    e?.preventDefault();
    if (!textInputPos || !textDraft.trim()) {
      setTextInputPos(null);
      setTextDraft('');
      return;
    }
    const item: WhiteboardItem = {
      id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'text',
      authorName: user?.fullName ?? '',
      color: tool === 'highlighter' ? '#1c1f21' : color,
      fontSize: strokeWidth >= 7 ? 24 : strokeWidth >= 4 ? 19 : 16,
      x: textInputPos.x,
      y: textInputPos.y,
      text: textDraft.trim(),
    };
    setTextInputPos(null);
    setTextDraft('');
    setRoom((prev) => {
      const pages = [...prev.pages];
      const pg = pages[prev.currentPageIndex];
      if (!pg) return prev;
      pages[prev.currentPageIndex] = { ...pg, items: [...pg.items, item] };
      return { ...prev, pages };
    });
    void apiSendLiveAction({ type: 'add-item', item }).catch(() => {});
  };

  const handleUploadImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingImg(true);
    try {
      const dataUrl = await compressImageFile(file);
      await apiSendLiveAction({ type: 'set-page-image', imageDataUrl: dataUrl });
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploadingImg(false);
    }
  };

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `bang-giang-${currentPage.title.toLowerCase().replace(/\s+/g, '-')}.png`;
    a.click();
  };

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

  const spotlightExam = room.examId ? getExam(room.examId) : undefined;
  const spotlightQuestion = spotlightExam?.questions[room.questionIndex];
  const gradeExams = useMemo(() => allExams.filter((e) => e.grade === pickGrade), [allExams, pickGrade]);

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

  const activePalette = tool === 'highlighter' ? HIGHLIGHT_COLORS : PEN_COLORS;

  return (
    <div className={isFullscreen ? 'live-fullscreen' : 'container live-page'}>
      {/* THANH TRẠNG THÁI GỌN NHẸ */}
      <div className="live-head panel">
        <div className="live-head-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1>Phòng dạy trực tiếp</h1>
            <span className={`live-status ${room.active ? 'on' : 'off'}`}>
              <Radio size={13} /> {room.active ? 'Đang mở' : 'Chưa mở'}
            </span>
            <span className="muted-inline">
              <Users size={14} style={{ verticalAlign: -2 }} /> {room.participants.length}
              {room.participants.length > 0 && ` (${room.participants.map((p) => p.name).join(', ')})`}
            </span>
          </div>
          {!connected && <div className="cell-sub">Đang kết nối lại...</div>}
        </div>

        <div className="live-head-actions">
          {room.meetUrl && (
            <a href={room.meetUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
              <Video size={15} /> Gọi thoại / Video
            </a>
          )}
          {isTeacher && (
            <>
              <button
                type="button"
                className={`btn-secondary btn-sm ${showExamBar ? 'active-btn' : ''}`}
                onClick={() => setShowExamBar((v) => !v)}
              >
                <BookOpen size={15} /> Chiếu đề & Link gọi
              </button>
              <button
                type="button"
                className={room.active ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
                onClick={() => void apiSendLiveAction({ type: 'set-active', active: !room.active })}
              >
                {room.active ? 'Đóng phòng' : 'Mở phòng (báo HS)'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* THANH CHIẾU ĐỀ & LINK GỌI (THU GỌN ĐƯỢC) */}
      {isTeacher && showExamBar && (
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
              style={{ flex: 1, minWidth: 190 }}
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
              <option value="">-- Không chiếu câu hỏi kho đề --</option>
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
                Lưu link
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
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

      {/* CÂU HỎI ĐANG CHIẾU (NẾU CÓ) */}
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
                  <ChevronLeft size={15} /> Trước
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
                  Sau <ChevronRight size={15} />
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
                  {room.showSolution ? 'Ẩn giải' : 'Hiện giải'}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Tắt khung câu hỏi"
                  onClick={() => void apiSendLiveAction({ type: 'set-spotlight', examId: null })}
                >
                  <X size={15} />
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

      {/* BẢNG GIẢNG BÀI TOÀN CHIỀU RỘNG */}
      <section className="panel board-panel full-board">
        {/* Thanh chuyển trang (Trang 1, Trang 2...) + Up ảnh đề bài */}
        <div className="page-tabs-bar">
          <div className="page-tabs-scroll">
            {room.pages.map((pg, idx) => (
              <button
                key={pg.id}
                type="button"
                disabled={!isTeacher}
                className={`page-tab ${idx === room.currentPageIndex ? 'active' : ''}`}
                onClick={() => isTeacher && void apiSendLiveAction({ type: 'switch-page', index: idx })}
              >
                {pg.title}
                {pg.backgroundImage ? ' · Ảnh' : ''}
              </button>
            ))}
            {isTeacher && (
              <button
                type="button"
                className="page-tab add"
                title="Thêm trang bảng mới"
                onClick={() => void apiSendLiveAction({ type: 'add-page' })}
              >
                <Plus size={14} /> Thêm trang
              </button>
            )}
          </div>

          <div className="wb-group">
            {isTeacher && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleUploadImage}
                />
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={uploadingImg}
                  onClick={() => fileInputRef.current?.click()}
                  title="Tải ảnh đề bài, chụp trang sách hoặc dán ảnh (Ctrl+V) để sửa trực tiếp lên trên"
                >
                  <ImagePlus size={15} /> {uploadingImg ? 'Đang tải...' : 'Up ảnh đề / bài tập'}
                </button>
                {currentPage.backgroundImage && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => void apiSendLiveAction({ type: 'set-page-image', imageDataUrl: null })}
                  >
                    Bỏ ảnh
                  </button>
                )}
              </>
            )}
            <button type="button" className="icon-btn" title="Lưu ảnh bảng (PNG)" onClick={handleDownloadPng}>
              <Download size={16} />
            </button>
            <button
              type="button"
              className="icon-btn"
              title={isFullscreen ? 'Thu nhỏ' : 'Mở rộng toàn màn hình'}
              onClick={() => setIsFullscreen((v) => !v)}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        {/* Thanh công cụ vẽ & giảng bài */}
        {canDraw ? (
          <div className="wb-toolbar">
            <div className="wb-group">
              <button
                type="button"
                className={`tool-btn ${tool === 'pen' ? 'active' : ''}`}
                title="Bút viết"
                onClick={() => {
                  setTool('pen');
                  if (!PEN_COLORS.some((c) => c.hex === color)) setColor('#1c1f21');
                }}
              >
                <Pen size={16} />
                <span className="hide-xs">Bút</span>
              </button>
              <button
                type="button"
                className={`tool-btn ${tool === 'highlighter' ? 'active' : ''}`}
                title="Bút dạ quang (đánh dấu lý thuyết / đề bài)"
                onClick={() => {
                  setTool('highlighter');
                  setColor('#facc15');
                }}
              >
                <Highlighter size={16} />
                <span className="hide-xs">Dạ quang</span>
              </button>
              <button
                type="button"
                className={`tool-btn ${tool === 'line' ? 'active' : ''}`}
                title="Vẽ đường thẳng (Hình học)"
                onClick={() => setTool('line')}
              >
                <Minus size={16} />
              </button>
              <button
                type="button"
                className={`tool-btn ${tool === 'rect' ? 'active' : ''}`}
                title="Vẽ khung chữ nhật"
                onClick={() => setTool('rect')}
              >
                <Square size={15} />
              </button>
              <button
                type="button"
                className={`tool-btn ${tool === 'circle' ? 'active' : ''}`}
                title="Vẽ hình tròn / khoanh đáp án"
                onClick={() => setTool('circle')}
              >
                <Circle size={15} />
              </button>
              <button
                type="button"
                className={`tool-btn ${tool === 'text' ? 'active' : ''}`}
                title="Chèn chữ / ghi chú lên bảng"
                onClick={() => setTool('text')}
              >
                <Type size={16} />
              </button>
              {isTeacher && (
                <button
                  type="button"
                  className={`tool-btn ${tool === 'laser' ? 'active' : ''}`}
                  title="Tia laser chỉ bài (không để lại nét)"
                  onClick={() => setTool('laser')}
                >
                  <Pointer size={16} />
                </button>
              )}
              <button
                type="button"
                className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
                title="Tẩy"
                onClick={() => setTool('eraser')}
              >
                <Eraser size={16} />
              </button>
            </div>

            <div className="wb-group">
              {tool !== 'eraser' && tool !== 'laser' && (
                <>
                  {activePalette.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      className={`color-dot ${color === c.hex ? 'active' : ''}`}
                      style={{ background: c.hex }}
                      title={c.label}
                      onClick={() => setColor(c.hex)}
                    />
                  ))}
                  {WIDTHS.map((w) => (
                    <button
                      key={w.val}
                      type="button"
                      className={`pill-btn ${strokeWidth === w.val ? 'active' : ''}`}
                      style={{ padding: '3px 7px', fontSize: 12 }}
                      onClick={() => setStrokeWidth(w.val)}
                    >
                      {w.label}
                    </button>
                  ))}
                </>
              )}

              <button
                type="button"
                className="icon-btn"
                title="Hoàn tác"
                onClick={() => void apiSendLiveAction({ type: 'undo-item' })}
              >
                <Undo2 size={16} />
              </button>

              {isTeacher && (
                <>
                  <button
                    type="button"
                    className="icon-btn"
                    title={room.gridPaper ? 'Tắt ô ly' : 'Bật ô ly vở toán'}
                    onClick={() => void apiSendLiveAction({ type: 'set-options', gridPaper: !room.gridPaper })}
                  >
                    <Grid size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title={room.studentCanDraw ? 'Đang cho HS cùng viết — bấm để khóa' : 'Đang khóa HS viết — bấm để mở'}
                    onClick={() =>
                      void apiSendLiveAction({ type: 'set-options', studentCanDraw: !room.studentCanDraw })
                    }
                  >
                    {room.studentCanDraw ? <Unlock size={16} /> : <Lock size={16} />}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Xóa toàn bộ nét vẽ trên trang này"
                    onClick={() => {
                      if (window.confirm('Xóa toàn bộ nét vẽ trên trang này? (Ảnh nền vẫn giữ nguyên)')) {
                        void apiSendLiveAction({ type: 'clear-page', includeImage: false });
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="wb-readonly-bar">
            <span>Đang xem bảng giảng bài trực tiếp ({currentPage.title})</span>
            <span className="muted-inline">Gia sư đang giữ quyền viết bảng</span>
          </div>
        )}

        {isTeacher && !currentPage.backgroundImage && (
          <div className="cell-sub" style={{ marginBottom: 6 }}>
            Mẹo: Bấm <strong>Up ảnh đề / bài tập</strong> (hoặc dán ảnh chụp màn hình bằng <strong>Ctrl+V</strong>) để chữa bài tập lý thuyết trực tiếp lên ảnh.
          </div>
        )}

        {/* KHUNG CANVAS */}
        <div className={`wb-canvas-wrap ${isFullscreen ? 'is-full' : ''}`}>
          <canvas
            ref={canvasRef}
            className={`wb-canvas ${canDraw || (tool === 'laser' && isTeacher) ? 'drawable' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointer}
            onPointerCancel={finishPointer}
          />

          {/* Ô nhập chữ trực tiếp trên bảng */}
          {textInputPos && (
            <form
              className="wb-text-overlay"
              style={{
                left: `${Math.min(72, Math.max(2, textInputPos.x * 100))}%`,
                top: `${Math.min(82, Math.max(2, textInputPos.y * 100))}%`,
              }}
              onSubmit={handleCommitText}
            >
              <input
                type="text"
                autoFocus
                placeholder="Nhập chữ rồi nhấn Enter..."
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                onBlur={() => handleCommitText()}
              />
            </form>
          )}
        </div>
      </section>

      {/* BONG BÓNG CHAT NỔI (CHO CẢ MOBILE & PC) */}
      <div className="chat-fab-wrap">
        {chatOpen && (
          <div className="chat-popup">
            <div className="chat-popup-head">
              <div>
                <strong>Trao đổi trực tiếp</strong>
                <div className="cell-sub">Hỗ trợ gõ công thức $x^2$, $\frac{'{a}{b}'}$</div>
              </div>
              <button type="button" className="icon-btn" onClick={() => setChatOpen(false)} aria-label="Đóng chat">
                <X size={16} />
              </button>
            </div>

            <div className="chat-messages">
              {room.messages.length === 0 ? (
                <div className="empty-inline">Chưa có tin nhắn nào.</div>
              ) : (
                room.messages.map((m) => {
                  const isMine = m.authorId === user.id;
                  return (
                    <div key={m.id} className={`chat-bubble ${isMine ? 'mine' : 'other'}`}>
                      {!isMine && <div className="chat-author">{m.authorName}</div>}
                      <div className="chat-msg-body">
                        <MathText text={m.text} />
                      </div>
                      <div className="chat-time">
                        {new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })
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
          </div>
        )}

        <button
          type="button"
          className="chat-fab"
          onClick={() => setChatOpen((v) => !v)}
          aria-label="Mở khung chat"
          title="Trao đổi trực tiếp"
        >
          {chatOpen ? <X size={22} /> : <MessageCircle size={22} />}
          {!chatOpen && unreadCount > 0 && <span className="chat-fab-badge">{unreadCount}</span>}
        </button>
      </div>
    </div>
  );
}
