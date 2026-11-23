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

const VALID_CATEGORIES = new Set([
  'food',
  'grocery',
  'bills',
  'invest_expense',
  'transport',
  'kids',
  'health',
  'shopping',
  'entertainment',
  'gifts',
  'business_expense',
  'other_expense',
]);

const VALID_PAYMENTS = new Set(['cash', 'bank', 'card', 'ewallet']);

const SYSTEM_PROMPT = `Bạn là trợ lý OCR tài chính gia đình Việt Nam siêu chính xác.
Hãy đọc ảnh hóa đơn (hóa đơn in nhiệt siêu thị/quán ăn, hóa đơn viết tay, hóa đơn điện nước, hoặc ảnh chụp màn hình chuyển khoản ngân hàng/ví điện tử Việt Nam) và trả về DUY NHẤT một đối tượng JSON hợp lệ (không thêm lời giải thích, không markdown).

Cấu trúc JSON bắt buộc:
{
  "amount": <số nguyên VNĐ của TỔNG TIỀN THANH TOÁN thực tế, ví dụ 385000. Bỏ qua Tiền khách đưa, Tiền thừa, số dư tài khoản, SĐT, mã giao dịch>,
  "candidateAmounts": [<tối đa 4 số nguyên VNĐ quan trọng đọc thấy trên ảnh, đặt số tổng chính ở vị trí đầu tiên>],
  "date": "<YYYY-MM-DD nếu có trên hóa đơn, nếu không có thì để rỗng>",
  "merchant": "<tên cửa hàng / quán / đơn vị nhận tiền ngắn gọn tiếng Việt>",
  "categoryId": "<chọn ĐÚNG 1 trong: food, grocery, bills, invest_expense, transport, kids, health, shopping, entertainment, gifts, business_expense, other_expense>",
  "paymentMethod": "<chọn ĐÚNG 1 trong: bank, cash, ewallet, card>",
  "note": "<ghi chú chi tiêu tiếng Việt ngắn gọn, tự nhiên, tối đa 50 ký tự>",
  "rawText": "<tóm tắt ngắn các dòng món hàng hoặc nội dung chính đọc được>"
}

Quy tắc phân loại categoryId:
- food: ăn uống, quán phở/cơm/bún, nhà hàng, cà phê, trà sữa, bánh ngọt
- grocery: siêu thị (WinMart, Co.opmart, Bách Hóa Xanh, Go!, Aeon), đi chợ thịt cá rau củ trái cây, tạp hóa
- bills: tiền điện EVN, tiền nước, internet, wifi, cước điện thoại, phí quản lý
- invest_expense: mua vàng, gửi tiết kiệm, chứng khoán, đầu tư
- transport: đổ xăng, gửi xe, Grab, Be, Xanh SM, sửa xe, cầu đường
- kids: học phí, sách vở, nhà sách Fahasa, học thêm, đồ dùng học tập
- health: nhà thuốc (Long Châu, Pharmacity), khám bệnh, bệnh viện, nha khoa, vitamin
- shopping: quần áo, giày dép, mỹ phẩm, Shopee, Lazada, đồ dùng cá nhân
- entertainment: xem phim CGV, du lịch, vui chơi, tiệc
- gifts: biếu tặng, mừng cưới, quà sinh nhật
- business_expense: nhập hàng kinh doanh, vận chuyển hàng, quảng cáo, vật tư kinh doanh
- other_expense: các khoản khác`;

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

function parseAiJson(raw: string, fallbackDate: string): ExtractedReceipt | null {
  if (!raw) return null;
  // Strip optional thinking blocks and markdown fences
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
    if (amount >= 1000) candidateSet.add(amount);
    for (const c of rawCands) {
      const n = toInt(c);
      if (n >= 1000 && n <= 500_000_000) candidateSet.add(n);
    }

    const rawDate = typeof parsed.date === 'string' ? parsed.date.trim() : '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : fallbackDate;

    const rawCat = typeof parsed.categoryId === 'string' ? parsed.categoryId.trim() : '';
    const categoryId = VALID_CATEGORIES.has(rawCat) ? rawCat : 'other_expense';

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
  if (!image.startsWith('data:image/') || image.length > 4_500_000) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Ảnh hóa đơn không hợp lệ hoặc vượt quá 4MB.' }),
      { status: 400, headers },
    );
  }

  const fallbackDate =
    typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
      ? body.today
      : new Date().toISOString().slice(0, 10);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
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

  // Try Google Gemma 4 Vision first (thinking disabled for instant JSON OCR),
  // then fail over to Meta Llama 4 Scout Vision if needed.
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
      const parsed = parseAiJson(text, fallbackDate);

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
