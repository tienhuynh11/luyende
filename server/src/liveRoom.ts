import type { ServerResponse } from 'node:http';
import type { AccountPublic, LiveChatMessage, LiveRoomState, WhiteboardStroke } from '../../shared/types.js';
import { generateId } from './auth.js';

interface SseClient {
  id: string;
  user: AccountPublic;
  res: ServerResponse;
}

const clients = new Map<string, SseClient>();

const state: LiveRoomState = {
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

function syncParticipants() {
  const map = new Map<string, { id: string; name: string; role: AccountPublic['role'] }>();
  for (const c of clients.values()) {
    map.set(c.user.id, { id: c.user.id, name: c.user.fullName, role: c.user.role });
  }
  state.participants = Array.from(map.values());
}

function sendEvent(res: ServerResponse, event: string, data: unknown) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // ignore broken pipe
  }
}

function broadcast(event: string, data: unknown) {
  for (const c of clients.values()) {
    sendEvent(c.res, event, data);
  }
}

export function isLiveRoomActive(): { active: boolean; hostName: string; startedAt: string | null } {
  return { active: state.active, hostName: state.hostName, startedAt: state.startedAt };
}

export function getLiveRoomState(): LiveRoomState {
  syncParticipants();
  return state;
}

export function registerLiveClient(user: AccountPublic, res: ServerResponse) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });

  const cid = generateId('sse');
  clients.set(cid, { id: cid, user, res });
  syncParticipants();

  // Send full snapshot immediately
  sendEvent(res, 'state', state);
  broadcast('participants', state.participants);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  res.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(cid);
    syncParticipants();
    broadcast('participants', state.participants);
  });
}

export type LiveActionPayload =
  | { type: 'set-active'; active: boolean }
  | { type: 'set-spotlight'; examId: string | null; questionIndex?: number; showSolution?: boolean }
  | { type: 'set-options'; studentCanDraw?: boolean; gridPaper?: boolean; meetUrl?: string }
  | { type: 'add-stroke'; stroke: WhiteboardStroke }
  | { type: 'undo-stroke' }
  | { type: 'clear-board' }
  | { type: 'chat'; text: string };

export function applyLiveAction(user: AccountPublic, action: LiveActionPayload): { ok: boolean; error?: string } {
  if (action.type === 'set-active') {
    if (user.role !== 'teacher') return { ok: false, error: 'Chỉ gia sư mới mở/đóng phòng học.' };
    state.active = Boolean(action.active);
    if (state.active) {
      state.hostName = user.fullName;
      state.startedAt = new Date().toISOString();
    } else {
      state.startedAt = null;
    }
    broadcast('state', getLiveRoomState());
    return { ok: true };
  }

  if (action.type === 'set-spotlight') {
    if (user.role !== 'teacher') return { ok: false, error: 'Chỉ gia sư mới điều khiển câu hỏi đang chiếu.' };
    state.examId = action.examId;
    if (typeof action.questionIndex === 'number') state.questionIndex = Math.max(0, action.questionIndex);
    if (typeof action.showSolution === 'boolean') state.showSolution = action.showSolution;
    broadcast('state', getLiveRoomState());
    return { ok: true };
  }

  if (action.type === 'set-options') {
    if (user.role !== 'teacher') return { ok: false, error: 'Chỉ gia sư mới thay đổi cài đặt phòng.' };
    if (typeof action.studentCanDraw === 'boolean') state.studentCanDraw = action.studentCanDraw;
    if (typeof action.gridPaper === 'boolean') state.gridPaper = action.gridPaper;
    if (typeof action.meetUrl === 'string') {
      const clean = action.meetUrl.trim();
      if (!clean || /^https?:\/\//i.test(clean)) {
        state.meetUrl = clean.slice(0, 300);
      }
    }
    broadcast('state', getLiveRoomState());
    return { ok: true };
  }

  if (action.type === 'add-stroke') {
    if (user.role !== 'teacher' && !state.studentCanDraw) {
      return { ok: false, error: 'Gia sư đang khóa quyền viết bảng của học sinh.' };
    }
    const stroke: WhiteboardStroke = {
      id: action.stroke.id || generateId('str'),
      authorName: user.fullName,
      color: action.stroke.color || '#1c1f21',
      width: Math.max(1, Math.min(28, Number(action.stroke.width) || 3)),
      eraser: Boolean(action.stroke.eraser),
      points: Array.isArray(action.stroke.points) ? action.stroke.points.slice(0, 800) : [],
    };
    if (stroke.points.length > 0) {
      state.strokes.push(stroke);
      if (state.strokes.length > 350) state.strokes = state.strokes.slice(-350);
      broadcast('stroke', stroke);
    }
    return { ok: true };
  }

  if (action.type === 'undo-stroke') {
    if (user.role !== 'teacher' && !state.studentCanDraw) {
      return { ok: false, error: 'Không có quyền hoàn tác.' };
    }
    if (state.strokes.length > 0) {
      state.strokes.pop();
      broadcast('state', getLiveRoomState());
    }
    return { ok: true };
  }

  if (action.type === 'clear-board') {
    if (user.role !== 'teacher') return { ok: false, error: 'Chỉ gia sư mới xóa toàn bộ bảng.' };
    state.strokes = [];
    broadcast('state', getLiveRoomState());
    return { ok: true };
  }

  if (action.type === 'chat') {
    const text = (action.text ?? '').trim().slice(0, 1000);
    if (!text) return { ok: false, error: 'Nội dung trống.' };
    const msg: LiveChatMessage = {
      id: generateId('msg'),
      authorId: user.id,
      authorName: user.fullName,
      role: user.role,
      text,
      createdAt: new Date().toISOString(),
    };
    state.messages.push(msg);
    if (state.messages.length > 100) state.messages = state.messages.slice(-100);
    broadcast('chat', msg);
    return { ok: true };
  }

  return { ok: false, error: 'Thao tác không hợp lệ.' };
}
