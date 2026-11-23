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

interface ScanRequestBody {
  image?: string;
  today?: string;
  categories?: Array<{ id?: string; name?: string }>;
}

interface ExtractedReceipt {
  amount: number;
  candidateAmounts: number[];
  date: string;
  merchant: string;
  categoryId: string;
  paymentMethod: 'cash' | 'bank' | 'card' | 'ewallet';
  note: string;
  rawText: string;
}

const DEFAULT_CATEGORIES: Array<{ id: string; name: string }> = [
  { id: 'food', name: 'Ăn uống (quán ăn, phở, cơm, cà phê, trà sữa)' },
  { id: 'grocery', name: 'Đi chợ & Siêu thị (WinMart, Co.opmart, Bách Hóa Xanh, thịt cá rau củ)' },
  { id: 'bills', name: 'Điện nước & Hóa đơn (EVN, nước, internet, wifi, phí quản lý)' },
  { id: 'invest_expense', name: 'Đầu tư & Tích lũy (vàng, tiết kiệm, chứng khoán)' },
  { id: 'transport', name: 'Đi lại & Xăng xe (xăng, gửi xe, Grab, Be, sửa xe)' },
  { id: 'kids', name: 'Học tập & Con cái (học phí, sách vở, Fahasa, học thêm)' },
  { id: 'health', name: 'Sức khỏe (nhà thuốc Long Châu, Pharmacity, khám bệnh, vitamin)' },
  { id: 'shopping', name: 'Mua sắm (quần áo, giày dép, mỹ phẩm, Shopee, Lazada)' },
  { id: 'entertainment', name: 'Giải trí & Du lịch (CGV, xem phim, vui chơi, du lịch)' },
  { id: 'gifts', name: 'Biếu tặng & Hiếu hỉ (biếu ông bà, mừng cưới, quà)' },
  { id: 'business_expense', name: 'Kinh doanh (nhập hàng, vận chuyển, quảng cáo, vật tư)' },
  { id: 'other_expense', name: 'Chi khác' },
];

const VALID_PAYMENTS = new Set(['cash', 'bank', 'card', 'ewallet']);

// Lightweight per-isolate sliding-window rate limiter (25 scans / 5 min per IP)
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX_REQUESTS = 25;
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
  if (!origin) return true; // Same-origin fetch or direct non-browser test
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

function buildSystemPrompt(categories: Array<{ id: string; name: string }>): string {
  const catIds = categories.map((c) => c.id).join(', ');
  const catGuide = categories.map((c) => `- ${c.id}: ${c.name}`).join('\n');

  return `Bạn là trợ lý OCR tài chính gia đình Việt Nam siêu chính xác.
Hãy đọc ảnh hóa đơn (hóa đơn in nhiệt siêu thị/quán ăn, hóa đơn viết tay, hóa đơn điện nước, hoặc ảnh chụp màn hình chuyển khoản ngân hàng/ví điện tử Việt Nam) và trả về DUY NHẤT một đối tượng JSON hợp lệ (không thêm lời giải thích, không markdown).

Cấu trúc JSON bắt buộc:
{
  "amount": <số nguyên VNĐ của TỔNG TIỀN THANH TOÁN thực tế, ví dụ 385000. Bỏ qua Tiền khách đưa, Tiền thừa, số dư tài khoản, SĐT, mã giao dịch>,
  "candidateAmounts": [<tối đa 4 số nguyên VNĐ quan trọng đọc thấy trên ảnh, đặt số tổng chính ở vị trí đầu tiên>],
  "date": "<YYYY-MM-DD nếu có trên hóa đơn, nếu không có thì để rỗng>",
  "merchant": "<tên cửa hàng / quán / đơn vị nhận tiền ngắn gọn tiếng Việt>",
  "categoryId": "<chọn ĐÚNG 1 trong: ${catIds}>",
  "paymentMethod": "<chọn ĐÚNG 1 trong: bank, cash, ewallet, card>",
  "note": "<ghi chú chi tiêu tiếng Việt ngắn gọn, tự nhiên, tối đa 50 ký tự>",
  "rawText": "<tóm tắt ngắn các dòng món hàng hoặc nội dung chính đọc được>"
}

Quy tắc phân loại categoryId:
${catGuide}`;
}

function extractTextFromAiResponse(res: unknown): string {
  if (!res) return '';
  if (typeof res === 'string') return res;
  if (typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (typeof obj.response === 'string') return obj.response;
    if (obj.response && typeof obj.response === 'object') {
      return JSON.stringify(obj.response);
    }
    if (Array.isArray(obj.choices) && obj.choices.length > 0) {
      const first = obj.choices[0] as Record<string, unknown>;
      const msg = first?.message as Record<string, unknown> | undefined;
      if (typeof msg?.content === 'string') return msg.content;
      if (Array.isArray(msg?.content)) {
        return msg.content
          .map((part) =>
            typeof part === 'object' && part && 'text' in part
              ? String((part as { text?: unknown }).text || '')
              : '',
          )
          .join('\n');
      }
    }
    if (typeof obj.result === 'string') return obj.result;
  }
  return '';
}

function parseAiJson(
  raw: string,
  fallbackDate: string,
  validCategoryIds: Set<string>,
): ExtractedReceipt | null {
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
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
    const toInt = (v: unknown): number => {
      if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
      if (typeof v === 'string') {
        const digits = v.replace(/[^\d]/g, '');
        return digits ? Number(digits) : 0;
      }
      return 0;
    };

    const amount = toInt(parsed.amount);
    const rawCands = Array.isArray(parsed.candidateAmounts) ? parsed.candidateAmounts : [];
    const candidateSet = new Set<number>();
    if (amount >= 1000 && amount <= 500_000_000) candidateSet.add(amount);
    for (const c of rawCands) {
      const n = toInt(c);
      if (n >= 1000 && n <= 500_000_000) candidateSet.add(n);
    }

    const rawDate = typeof parsed.date === 'string' ? parsed.date.trim() : '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : fallbackDate;

    const rawCat = typeof parsed.categoryId === 'string' ? parsed.categoryId.trim() : '';
    const categoryId = validCategoryIds.has(rawCat) ? rawCat : 'other_expense';

    const rawPay = typeof parsed.paymentMethod === 'string' ? parsed.paymentMethod.trim() : '';
    const paymentMethod = (
      VALID_PAYMENTS.has(rawPay) ? rawPay : 'bank'
    ) as ExtractedReceipt['paymentMethod'];

    const merchant =
      typeof parsed.merchant === 'string' ? parsed.merchant.trim().slice(0, 48) : '';
    const note =
      typeof parsed.note === 'string' && parsed.note.trim()
        ? parsed.note.trim().slice(0, 70)
        : merchant
          ? `Hóa đơn ${merchant}`
          : 'Chi tiêu từ hóa đơn';
    const rawText =
      typeof parsed.rawText === 'string' ? parsed.rawText.trim().slice(0, 500) : '';

    return {
      amount,
      candidateAmounts: Array.from(candidateSet).slice(0, 4),
      date,
      merchant,
      categoryId,
      paymentMethod,
      note,
      rawText,
    };
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
    return new Response(
      JSON.stringify({ ok: false, error: 'Bạn quét hóa đơn hơi nhanh, hãy đợi vài phút rồi thử lại.' }),
      { status: 429, headers },
    );
  }

  if (!context.env.AI) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Workers AI binding chưa được bật trên môi trường này.' }),
      { status: 503, headers },
    );
  }

  let body: ScanRequestBody;
  try {
    body = (await context.request.json()) as ScanRequestBody;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Payload không hợp lệ.' }), {
      status: 400,
      headers,
    });
  }

  const image = typeof body.image === 'string' ? body.image : '';
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image) || image.length > 4_500_000) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Ảnh hóa đơn phải là JPEG/PNG/WebP và nhỏ hơn 4MB.',
      }),
      { status: 400, headers },
    );
  }

  const fallbackDate =
    typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
      ? body.today
      : new Date().toISOString().slice(0, 10);

  // Merge custom user categories safely (capped at 24 items, sanitized length)
  const mergedCategories = [...DEFAULT_CATEGORIES];
  const validCategoryIds = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
  if (Array.isArray(body.categories)) {
    for (const c of body.categories.slice(0, 24)) {
      const id = typeof c?.id === 'string' ? c.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) : '';
      const name = typeof c?.name === 'string' ? c.name.trim().slice(0, 40) : '';
      if (id && name && !validCategoryIds.has(id)) {
        validCategoryIds.add(id);
        mergedCategories.push({ id, name });
      }
    }
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(mergedCategories) },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Đọc kỹ ảnh hóa đơn/chuyển khoản này và trả về JSON. Ngày hôm nay là ${fallbackDate}.`,
        },
        {
          type: 'image_url',
          image_url: { url: image },
        },
      ],
    },
  ];

  const attempts: Array<{ model: string; extra: Record<string, unknown> }> = [
    {
      model: '@cf/google/gemma-4-26b-a4b-it',
      extra: {
        max_tokens: 768,
        temperature: 0.1,
        chat_template_kwargs: { enable_thinking: false },
      },
    },
    {
      model: '@cf/meta/llama-4-scout-17b-16e-instruct',
      extra: {
        max_tokens: 768,
        temperature: 0.1,
      },
    },
  ];

  let lastError = 'AI Vision không thể đọc hóa đơn.';

  for (const { model, extra } of attempts) {
    try {
      const response = await context.env.AI.run(model, {
        messages,
        ...extra,
      });

      const text = extractTextFromAiResponse(response);
      const parsed = parseAiJson(text, fallbackDate, validCategoryIds);

      if (parsed) {
        return new Response(
          JSON.stringify({
            ok: true,
            engine: 'cloudflare-ai',
            model,
            data: parsed,
          }),
          { status: 200, headers },
        );
      }
      lastError = 'AI không tách được định dạng JSON hợp lệ.';
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return new Response(JSON.stringify({ ok: false, error: lastError }), {
    status: 502,
    headers,
  });
}
