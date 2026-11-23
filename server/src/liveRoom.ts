import type { ServerResponse } from 'node:http';
import type {
  AccountPublic,
  BoardPage,
  LiveChatMessage,
  LiveRoomState,
  WhiteboardItem,
  WhiteboardPoint,
} from '../../shared/types.js';
import { generateId } from './auth.js';

interface SseClient {
  id: string;
  user: AccountPublic;
  res: ServerResponse;
}

const clients = new Map<string, SseClient>();

function createPage(num: number): BoardPage {
  return {
    id: generateId('pg'),
    title: `Trang ${num}`,
    backgroundImage: null,
    items: [],
  };
}

const state: LiveRoomState = {
  active: false,
  hostName: '',
  startedAt: null,
  examId: null,
  questionIndex: 0,
  showSolution: false,
  studentCanDraw: false,
  gridPaper: true,
  meetUrl: '',
  pages: [createPage(1)],
  currentPageIndex: 0,
  messages: [],
  participants: [],
};

function currentPage(): BoardPage {
  if (state.pages.length === 0) {
    state.pages = [createPage(1)];
    state.currentPageIndex = 0;
  }
  if (state.currentPageIndex >= state.pages.length) {
    state.currentPageIndex = state.pages.length - 1;
  }
  return state.pages[state.currentPageIndex];
}

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

function broadcast(event: string, data: unknown, excludeUserId?: string) {
  for (const c of clients.values()) {
    if (excludeUserId && c.user.id === excludeUserId) continue;
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
  | { type: 'add-item'; item: WhiteboardItem }
  | { type: 'live-preview'; item: WhiteboardItem | null }
  | { type: 'laser'; point: WhiteboardPoint | null }
  | { type: 'undo-item' }
  | { type: 'clear-page'; includeImage?: boolean }
  | { type: 'set-page-image'; imageDataUrl: string | null }
  | { type: 'add-page'; imageDataUrl?: string | null; title?: string }
  | { type: 'switch-page'; index: number }
  | { type: 'delete-page'; index: number }
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

  if (action.type === 'laser') {
    if (user.role !== 'teacher') return { ok: true };
    broadcast('laser', { point: action.point, name: user.fullName }, user.id);
    return { ok: true };
  }

  if (action.type === 'live-preview') {
    if (user.role !== 'teacher' && !state.studentCanDraw) return { ok: true };
    broadcast('preview', { pageIndex: state.currentPageIndex, item: action.item }, user.id);
    return { ok: true };
  }

  if (action.type === 'add-item') {
    if (user.role !== 'teacher' && !state.studentCanDraw) {
      return { ok: false, error: 'Gia sư đang khóa quyền viết bảng của học sinh.' };
    }
    const page = currentPage();
    let item: WhiteboardItem;
    if (action.item.kind === 'text') {
      const text = (action.item.text ?? '').trim().slice(0, 300);
      if (!text) return { ok: true };
      item = {
        id: action.item.id || generateId('txt'),
        kind: 'text',
        authorName: user.fullName,
        color: action.item.color || '#1c1f21',
        fontSize: Math.max(12, Math.min(48, Number(action.item.fontSize) || 18)),
        x: Math.max(0, Math.min(1, Number(action.item.x) || 0.1)),
        y: Math.max(0, Math.min(1, Number(action.item.y) || 0.1)),
        text,
      };
    } else {
      item = {
        id: action.item.id || generateId('str'),
        kind: 'stroke',
        tool: action.item.tool || 'pen',
        authorName: user.fullName,
        color: action.item.color || '#1c1f21',
        width: Math.max(1, Math.min(36, Number(action.item.width) || 3)),
        points: Array.isArray(action.item.points) ? action.item.points.slice(0, 1000) : [],
      };
      if (item.points.length === 0) return { ok: true };
    }

    page.items.push(item);
    if (page.items.length > 400) page.items = page.items.slice(-400);
    broadcast('item', { pageIndex: state.currentPageIndex, item });
    return { ok: true };
  }

  if (action.type === 'undo-item') {
    if (user.role !== 'teacher' && !state.studentCanDraw) {
      return { ok: false, error: 'Không có quyền hoàn tác.' };
    }
    const page = currentPage();
    if (page.items.length > 0) {
      page.items.pop();
      broadcast('state', getLiveRoomState());
    }
    return { ok: true };
  }

  if (action.type === 'clear-page') {
    if (user.role !== 'teacher') return { ok: false, error: 'Chỉ gia sư mới xóa bảng.' };
    const page = currentPage();
    page.items = [];
    if (action.includeImage) page.backgroundImage = null;
    broadcast('state', getLiveRoomState());
    return { ok: true };
  }

  if (action.type === 'set-page-image') {
    if (user.role !== 'teacher') return { ok: false, error: 'Chỉ gia sư mới tải ảnh đề lên bảng.' };
    if (action.imageDataUrl && !action.imageDataUrl.startsWith('data:image/')) {
      return { ok: false, error: 'Định dạng ảnh không hợp lệ.' };
    }
    if (action.imageDataUrl && action.imageDataUrl.length > 2.2 * 1024 * 1024) {
      return { ok: false, error: 'Ảnh quá lớn, vui lòng chọn ảnh nhỏ hơn.' };
    }
    const page = currentPage();
    page.backgroundImage = action.imageDataUrl;
    broadcast('state', getLiveRoomState());
    return { ok: true };
  }

  if (action.type === 'add-page') {
    if (user.role !== 'teacher') return { ok: false, error: 'Chỉ gia sư mới thêm trang mới.' };
    if (state.pages.length >= 12) return { ok: false, error: 'Tối đa 12 trang trong một buổi học.' };
    const page = createPage(state.pages.length + 1);
    if (action.title?.trim()) page.title = action.title.trim().slice(0, 40);
    if (action.imageDataUrl && action.imageDataUrl.startsWith('data:image/')) {
      page.backgroundImage = action.imageDataUrl;
    }
    state.pages.push(page);
    state.currentPageIndex = state.pages.length - 1;
    broadcast('state', getLiveRoomState());
    return { ok: true };
  }

  if (action.type === 'switch-page') {
    if (user.role !== 'teacher') return { ok: false, error: 'Chỉ gia sư mới chuyển trang.' };
    const idx = Math.max(0, Math.min(state.pages.length - 1, Math.trunc(action.index)));
    state.currentPageIndex = idx;
    broadcast('state', getLiveRoomState());
    return { ok: true };
  }

  if (action.type === 'delete-page') {
    if (user.role !== 'teacher') return { ok: false, error: 'Chỉ gia sư mới xóa trang.' };
    if (state.pages.length <= 1) {
      state.pages[0].items = [];
      state.pages[0].backgroundImage = null;
    } else {
      const idx = Math.max(0, Math.min(state.pages.length - 1, Math.trunc(action.index)));
      state.pages.splice(idx, 1);
      state.currentPageIndex = Math.min(state.currentPageIndex, state.pages.length - 1);
    }
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
