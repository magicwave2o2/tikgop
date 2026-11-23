interface AiBinding {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
}

interface Env {
  AI?: AiBinding;
}

interface PagesContext {
  request: Request;
  env: Env;
}

interface VoiceRequestBody {
  transcript?: string;
  today?: string;
  activeMemberId?: string;
  members?: Array<{ id?: string; name?: string; role?: string }>;
  categories?: Array<{ id?: string; name?: string; type?: 'expense' | 'income' }>;
}

interface ParsedVoiceItem {
  type: 'expense' | 'income';
  amount: number;
  categoryId: string;
  memberId: string;
  date: string;
  paymentMethod: 'cash' | 'bank' | 'card' | 'ewallet';
  note: string;
}

const VALID_PAYMENTS = new Set(['cash', 'bank', 'card', 'ewallet']);

// Sliding-window rate limit per IP (40 voice parses / 5 min)
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX_REQUESTS = 40;
const ipHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const prev = (ipHits.get(ip) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (prev.length >= RATE_MAX_REQUESTS) {
    ipHits.set(ip, prev);
    return true;
  }
  prev.push(now);
  ipHits.set(ip, prev);
  if (ipHits.size > 500) {
    for (const [k, list] of ipHits.entries()) {
      if (list.every((ts) => now - ts >= RATE_WINDOW_MS)) ipHits.delete(k);
    }
  }
  return false;
}

function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const reqUrl = new URL(request.url);
    const originUrl = new URL(origin);
    if (originUrl.host === reqUrl.host) return true;
    const h = originUrl.hostname;
    return (
      h === 'tikgop.pages.dev' ||
      h.endsWith('.tikgop.pages.dev') ||
      h === 'localhost' ||
      h === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

function buildVoiceSystemPrompt(
  today: string,
  activeMemberId: string,
  members: Array<{ id: string; name: string; role: string }>,
  categories: Array<{ id: string; name: string; type: 'expense' | 'income' }>,
): string {
  const memberList = members.map((m) => `- ${m.id}: ${m.name} (${m.role})`).join('\n');
  const expCats = categories
    .filter((c) => c.type === 'expense')
    .map((c) => `- ${c.id}: ${c.name}`)
    .join('\n');
  const incCats = categories
    .filter((c) => c.type === 'income')
    .map((c) => `- ${c.id}: ${c.name}`)
    .join('\n');

  return `Bạn là trợ lý phân tích chi tiêu gia đình Việt Nam từ giọng nói tự nhiên.
Hôm nay là: ${today}. Thành viên mặc định đang nói: ${activeMemberId}.

Thành viên gia đình:
${memberList}

Danh mục CHI TIÊU (type="expense"):
${expCats}

Danh mục THU NHẬP (type="income"):
${incCats}

Quy tắc bắt buộc:
1. Hiểu mọi cách nói tiền Việt Nam: "4 chục"=40000, "5 chục rưỡi"=55000, "1 lít"=100000, "1 lít 2"=120000, "nửa lít"=50000, "3 xị"=300000, "1 củ rưỡi"=1500000, "2 triệu 3"=2300000, "85k"=85000, "hai trăm rưỡi"=250000.
2. Nếu câu nói chứa NHIỀU khoản chi/thu riêng biệt (ví dụ "ăn sáng 60k, đổ xăng 100k, mua sách cho Mai Anh 85k"), hãy TÁCH thành nhiều phần tử trong mảng "items".
3. Tự động suy luận categoryId chính xác theo ngữ cảnh đời sống Việt Nam (vd: "mua hoa tặng cô giáo" -> gifts; "cắt tóc/quần áo" -> shopping; "đóng quỹ lớp/học bơi/học đàn" -> kids; "sửa xe/thay nhớt/gửi xe/Grab" -> transport; "trả tiền ship/nhập hàng/quảng cáo" -> business_expense; "mua vàng/gửi tiết kiệm/chứng khoán" -> invest_expense; "bán hàng thu tiền" -> income + business).
4. Suy luận đúng memberId nếu câu có nhắc tên (Cha/Bố/Bình -> cha_binh, Mẹ/Trang -> me_trang, Phát -> minh_phat, Mai Anh -> mai_anh). Nếu không nhắc, dùng "${activeMemberId}".
5. Xử lý ngày tương đối theo ngày hôm nay (${today}): "hôm nay", "hôm qua", "hôm kia", hoặc "ngày DD/MM".
6. Viết "note" ngắn gọn, tự nhiên, đúng chính tả tiếng Việt có dấu (bỏ số tiền và tên người nếu thừa).
7. Trả về DUY NHẤT JSON hợp lệ (không giải thích, không markdown):
{"items":[{"type":"expense","amount":120000,"categoryId":"food","memberId":"${activeMemberId}","date":"${today}","paymentMethod":"cash","note":"Phở bò ăn sáng"}]}`;
}

function extractTextFromAiResponse(res: unknown): string {
  if (!res) return '';
  if (typeof res === 'string') return res;
  if (typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (typeof obj.response === 'string') return obj.response;
    if (obj.response && typeof obj.response === 'object') return JSON.stringify(obj.response);
    if (Array.isArray(obj.choices) && obj.choices.length > 0) {
      const first = obj.choices[0] as Record<string, unknown>;
      const msg = first?.message as Record<string, unknown> | undefined;
      if (typeof msg?.content === 'string') return msg.content;
      if (Array.isArray(msg?.content)) {
        return msg.content
          .map((p) =>
            typeof p === 'object' && p && 'text' in p ? String((p as { text?: unknown }).text || '') : '',
          )
          .join('\n');
      }
    }
    if (typeof obj.result === 'string') return obj.result;
  }
  return '';
}

function parseVoiceJson(
  raw: string,
  fallbackDate: string,
  fallbackMemberId: string,
  validExpenseCats: Set<string>,
  validIncomeCats: Set<string>,
  validMemberIds: Set<string>,
): ParsedVoiceItem[] | null {
  if (!raw) return null;
  const stripped = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as { items?: unknown };
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    if (rawItems.length === 0) return null;

    const cleanItems: ParsedVoiceItem[] = [];
    for (const entry of rawItems.slice(0, 12)) {
      if (!entry || typeof entry !== 'object') continue;
      const obj = entry as Record<string, unknown>;
      const type: 'expense' | 'income' = obj.type === 'income' ? 'income' : 'expense';
      let amount = 0;
      if (typeof obj.amount === 'number' && Number.isFinite(obj.amount)) {
        amount = Math.round(obj.amount);
      } else if (typeof obj.amount === 'string') {
        const digits = obj.amount.replace(/[^\d]/g, '');
        amount = digits ? Number(digits) : 0;
      }
      if (amount < 0 || amount > 1_000_000_000) amount = 0;

      const rawCat = typeof obj.categoryId === 'string' ? obj.categoryId.trim() : '';
      const validSet = type === 'income' ? validIncomeCats : validExpenseCats;
      const categoryId = validSet.has(rawCat)
        ? rawCat
        : type === 'income'
          ? 'other_income'
          : 'other_expense';

      const rawMem = typeof obj.memberId === 'string' ? obj.memberId.trim() : '';
      const memberId = validMemberIds.has(rawMem) ? rawMem : fallbackMemberId;

      const rawDate = typeof obj.date === 'string' ? obj.date.trim() : '';
      const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : fallbackDate;

      const rawPay = typeof obj.paymentMethod === 'string' ? obj.paymentMethod.trim() : '';
      const paymentMethod = (
        VALID_PAYMENTS.has(rawPay) ? rawPay : 'cash'
      ) as ParsedVoiceItem['paymentMethod'];

      const note =
        typeof obj.note === 'string' && obj.note.trim() ? obj.note.trim().slice(0, 80) : '';

      cleanItems.push({
        type,
        amount,
        categoryId,
        memberId,
        date,
        paymentMethod,
        note,
      });
    }

    return cleanItems.length > 0 ? cleanItems : null;
  } catch {
    return null;
  }
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };

  if (!isAllowedOrigin(context.request)) {
    return new Response(JSON.stringify({ ok: false, error: 'Origin không được phép.' }), {
      status: 403,
      headers,
    });
  }

  const clientIp =
    context.request.headers.get('cf-connecting-ip') ||
    context.request.headers.get('x-forwarded-for') ||
    'unknown';
  if (isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ ok: false, error: 'Quá nhiều yêu cầu.' }), {
      status: 429,
      headers,
    });
  }

  if (!context.env.AI) {
    return new Response(JSON.stringify({ ok: false, error: 'Workers AI chưa sẵn sàng.' }), {
      status: 503,
      headers,
    });
  }

  let body: VoiceRequestBody;
  try {
    body = (await context.request.json()) as VoiceRequestBody;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Payload không hợp lệ.' }), {
      status: 400,
      headers,
    });
  }

  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
  if (transcript.length < 2 || transcript.length > 600) {
    return new Response(JSON.stringify({ ok: false, error: 'Nội dung giọng nói không hợp lệ.' }), {
      status: 400,
      headers,
    });
  }

  const today =
    typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
      ? body.today
      : new Date().toISOString().slice(0, 10);

  const members: Array<{ id: string; name: string; role: string }> =
    Array.isArray(body.members) && body.members.length > 0
      ? body.members.slice(0, 12).map((m) => ({
          id: String(m.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32),
          name: String(m.name || '').trim().slice(0, 32),
          role: String(m.role || '').trim().slice(0, 32),
        })).filter((m) => m.id && m.name)
      : [
          { id: 'cha_binh', name: 'Cha Bình', role: 'Cha' },
          { id: 'me_trang', name: 'Mẹ Trang', role: 'Mẹ' },
          { id: 'minh_phat', name: 'Minh Phát', role: 'Con trai' },
          { id: 'mai_anh', name: 'Mai Anh', role: 'Con gái' },
        ];

  const validMemberIds = new Set(members.map((m) => m.id));
  const activeMemberId =
    typeof body.activeMemberId === 'string' && validMemberIds.has(body.activeMemberId)
      ? body.activeMemberId
      : members[0].id;

  const categories: Array<{ id: string; name: string; type: 'expense' | 'income' }> =
    Array.isArray(body.categories) && body.categories.length > 0
      ? body.categories.slice(0, 32).map((c) => ({
          id: String(c.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32),
          name: String(c.name || '').trim().slice(0, 40),
          type: (c.type === 'income' ? 'income' : 'expense') as 'expense' | 'income',
        })).filter((c) => c.id && c.name)
      : [
          { id: 'food', name: 'Ăn uống', type: 'expense' },
          { id: 'grocery', name: 'Đi chợ & Siêu thị', type: 'expense' },
          { id: 'bills', name: 'Điện nước & Hóa đơn', type: 'expense' },
          { id: 'invest_expense', name: 'Đầu tư & Tích lũy', type: 'expense' },
          { id: 'transport', name: 'Đi lại & Xăng xe', type: 'expense' },
          { id: 'kids', name: 'Học tập & Con cái', type: 'expense' },
          { id: 'health', name: 'Sức khỏe', type: 'expense' },
          { id: 'shopping', name: 'Mua sắm', type: 'expense' },
          { id: 'entertainment', name: 'Giải trí & Du lịch', type: 'expense' },
          { id: 'gifts', name: 'Biếu tặng & Hiếu hỉ', type: 'expense' },
          { id: 'business_expense', name: 'Kinh doanh', type: 'expense' },
          { id: 'other_expense', name: 'Chi khác', type: 'expense' },
          { id: 'salary', name: 'Lương hàng tháng', type: 'income' },
          { id: 'bonus', name: 'Thưởng & Phụ cấp', type: 'income' },
          { id: 'business', name: 'Kinh doanh thêm', type: 'income' },
          { id: 'invest', name: 'Đầu tư & Tiết kiệm', type: 'income' },
          { id: 'other_income', name: 'Thu nhập khác', type: 'income' },
        ];

  const validExpenseCats = new Set(categories.filter((c) => c.type === 'expense').map((c) => c.id));
  const validIncomeCats = new Set(categories.filter((c) => c.type === 'income').map((c) => c.id));

  const messages = [
    { role: 'system', content: buildVoiceSystemPrompt(today, activeMemberId, members, categories) },
    { role: 'user', content: transcript },
  ];

  const attempts: Array<{ model: string; extra: Record<string, unknown> }> = [
    {
      model: '@cf/google/gemma-4-26b-a4b-it',
      extra: {
        max_tokens: 640,
        temperature: 0.1,
        chat_template_kwargs: { enable_thinking: false },
      },
    },
    {
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      extra: {
        max_tokens: 640,
        temperature: 0.1,
      },
    },
  ];

  let lastError = 'AI không phân tích được câu nói.';

  for (const { model, extra } of attempts) {
    try {
      const response = await context.env.AI.run(model, {
        messages,
        ...extra,
      });
      const text = extractTextFromAiResponse(response);
      const items = parseVoiceJson(
        text,
        today,
        activeMemberId,
        validExpenseCats,
        validIncomeCats,
        validMemberIds,
      );
      if (items) {
        return new Response(
          JSON.stringify({
            ok: true,
            engine: 'cloudflare-ai',
            model,
            items,
          }),
          { status: 200, headers },
        );
      }
      lastError = 'JSON đầu ra không hợp lệ.';
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return new Response(JSON.stringify({ ok: false, error: lastError }), {
    status: 502,
    headers,
  });
}
