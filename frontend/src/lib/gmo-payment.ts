/**
 * GMOペイメントゲートウェイ リンクタイプPlus（ハッシュ型）
 *
 * フロー:
 * 1. 決済パラメータJSON → Base64エンコード（α）
 * 2. α + ShopPass → SHA256ハッシュ（γ）
 * 3. α.γ → 決済URL生成
 */

function getEnv(key: string): string {
  const value = import.meta.env[key] || '';
  return value;
}

/** 一意な注文IDを生成する（GMO制約: 英数字とハイフンのみ） */
export function generateOrderId(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `ENC-${hex}`;
}

/** SHA256ハッシュを計算する */
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Base64エンコード */
function toBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * GMOリンクタイプPlusのハッシュ型決済URLを生成する
 */
export async function buildPaymentUrl(
  orderId: string,
  amount: number,
  overview: string = 'アンコール決済',
): Promise<string> {
  const shopId = getEnv('GMO_SHOP_ID');
  const shopPass = getEnv('GMO_SHOP_PASS');
  const configId = getEnv('GMO_CONFIG_ID');
  const linkUrl = getEnv('GMO_LINK_URL') || 'https://stg.link.mul-pay.jp';

  const params = {
    configid: configId,
    transaction: {
      OrderID: orderId,
      Amount: String(amount),
      Overview: overview,
    },
  };

  const jsonStr = JSON.stringify(params);

  // Step 1: Base64エンコード → α
  const alpha = toBase64(jsonStr);

  // Step 2: α + ShopPass → β, SHA256(β) → γ
  const beta = alpha + shopPass;
  const gamma = await sha256(beta);

  // Step 3: α.γ → ε
  const epsilon = `${alpha}.${gamma}`;

  return `${linkUrl}/v1/plus/${shopId}/checkout/${epsilon}`;
}

/**
 * GMOからの結果通知のハッシュ値を検証する
 */
export async function verifyResultNotification(
  orderId: string,
  amount: string,
  shopId: string,
  hashValue: string,
): Promise<boolean> {
  const hashKey = getEnv('GMO_RESULT_HASH_KEY');

  if (!hashKey) {
    // 開発環境では検証をスキップ
    console.warn('GMO_RESULT_HASH_KEY is not set, skipping hash verification');
    return true;
  }

  const raw = `${shopId}${orderId}${amount}${hashKey}`;
  const expected = await sha256(raw);

  if (expected !== hashValue) {
    console.error(`GMO hash mismatch: order=${orderId}, expected=${expected}, received=${hashValue}`);
    return false;
  }

  return true;
}
