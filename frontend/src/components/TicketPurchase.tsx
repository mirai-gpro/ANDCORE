import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  eventId: string;
}

interface EventDate {
  id: string;
  event_date: string;
}

interface TimeSlot {
  id: string;
  start_time: string;
  door_time: string;
  event_date_id: string;
}

interface SlotMember {
  id: string;
  display_name: string;
  idol_id: string | null;
  event_time_slot_id: string;
}

interface TicketProduct {
  id: string;
  event_slot_member_id: string | null;
  ticket_type: string;
  price: number;
  stock_limit: number | null;
  sold_count: number;
}

interface CartItem {
  productId: string;
  memberName: string;
  ticketType: string;
  price: number;
  quantity: number;
}

type ViewMode = 'select' | 'by_date' | 'by_member' | 'cart' | 'purchasing';
type PaymentMethod = 'gmo' | 'points';

export default function TicketPurchase({ eventId }: Props) {
  const [userId, setUserId] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('select');
  const [searchMode, setSearchMode] = useState<'date' | 'member'>('date');

  // Data
  const [eventDates, setEventDates] = useState<EventDate[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [slotMembers, setSlotMembers] = useState<SlotMember[]>([]);
  const [ticketProducts, setTicketProducts] = useState<TicketProduct[]>([]);
  const [allMembers, setAllMembers] = useState<{ name: string; ids: string[] }[]>([]);

  // Selection state
  const [selectedDateId, setSelectedDateId] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [selectedMemberName, setSelectedMemberName] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Cart
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [holdId, setHoldId] = useState('');
  const [holdExpires, setHoldExpires] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('points');
  const [pointsBalance, setPointsBalance] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 初期データ読み込み
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/auth/login';
        return;
      }
      setUserId(session.user.id);

      // ポイント残高
      const { data: profile } = await supabase
        .from('profiles')
        .select('points_balance')
        .eq('id', session.user.id)
        .single();
      if (profile) setPointsBalance(profile.points_balance || 0);

      // イベント情報
      const { data: event } = await supabase
        .from('events')
        .select('title')
        .eq('id', eventId)
        .single();
      if (event) setEventTitle(event.title);

      // 開催日
      const { data: dates } = await supabase
        .from('event_dates')
        .select('*')
        .eq('event_id', eventId)
        .order('event_date');
      setEventDates(dates || []);

      // タイムスロット
      if (dates && dates.length > 0) {
        const dateIds = dates.map((d) => d.id);
        const { data: slots } = await supabase
          .from('event_time_slots')
          .select('*')
          .in('event_date_id', dateIds)
          .order('start_time');
        setTimeSlots(slots || []);

        // スロットメンバー
        if (slots && slots.length > 0) {
          const slotIds = slots.map((s) => s.id);
          const { data: members } = await supabase
            .from('event_slot_members')
            .select('*')
            .in('event_time_slot_id', slotIds)
            .order('sort_order');
          setSlotMembers(members || []);

          // チケット商品
          if (members && members.length > 0) {
            const memberIds = members.map((m) => m.id);
            const { data: products } = await supabase
              .from('ticket_products')
              .select('*')
              .in('event_slot_member_id', memberIds);
            setTicketProducts(products || []);
          }

          // ユニークなメンバー名を集約
          if (members) {
            const nameMap = new Map<string, string[]>();
            members.forEach((m) => {
              const existing = nameMap.get(m.display_name) || [];
              existing.push(m.id);
              nameMap.set(m.display_name, existing);
            });
            setAllMembers(
              Array.from(nameMap.entries()).map(([name, ids]) => ({ name, ids }))
            );
          }
        }
      }

      setLoading(false);
      setViewMode('select');
    })();
  }, [eventId]);

  // =====================================================
  // 開催日経路のヘルパー
  // =====================================================
  const slotsForDate = useCallback(
    (dateId: string) => timeSlots.filter((s) => s.event_date_id === dateId),
    [timeSlots]
  );

  const membersForSlot = useCallback(
    (slotId: string) => slotMembers.filter((m) => m.event_time_slot_id === slotId),
    [slotMembers]
  );

  const productsForMember = useCallback(
    (memberId: string) => ticketProducts.filter((p) => p.event_slot_member_id === memberId),
    [ticketProducts]
  );

  // =====================================================
  // メンバー経路のヘルパー
  // =====================================================
  const slotsForMember = useCallback(
    (memberName: string) => {
      const memberIds = slotMembers
        .filter((m) => m.display_name === memberName)
        .map((m) => m.event_time_slot_id);
      return timeSlots.filter((s) => memberIds.includes(s.id));
    },
    [slotMembers, timeSlots]
  );

  // 枚数変更
  const handleQuantityChange = (productId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, Math.min(10, current + delta));
      return { ...prev, [productId]: next };
    });
  };

  // カートに追加
  const addToCart = () => {
    const newItems: CartItem[] = [];
    Object.entries(quantities).forEach(([productId, qty]) => {
      if (qty <= 0) return;
      const product = ticketProducts.find((p) => p.id === productId);
      if (!product) return;
      const member = slotMembers.find((m) => m.id === product.event_slot_member_id);
      newItems.push({
        productId,
        memberName: member?.display_name || '',
        ticketType: product.ticket_type,
        price: product.price,
        quantity: qty,
      });
    });

    if (newItems.length === 0) {
      setError('枚数を入力してください');
      return;
    }

    setCartItems((prev) => {
      const merged = [...prev];
      newItems.forEach((newItem) => {
        const existing = merged.find((m) => m.productId === newItem.productId);
        if (existing) {
          existing.quantity += newItem.quantity;
        } else {
          merged.push(newItem);
        }
      });
      return merged;
    });

    setQuantities({});
    setError('');
  };

  // 合計金額を計算
  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // 仮押さえ → 決済
  const handleHoldAndPurchase = async () => {
    setViewMode('purchasing');
    setError('');

    try {
      // 1. 仮押さえ
      const holdRes = await fetch('/api/tickets/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          items: cartItems.map((item) => ({
            ticket_product_id: item.productId,
            quantity: item.quantity,
          })),
        }),
      });

      if (!holdRes.ok) {
        const err = await holdRes.json();
        throw new Error(err.detail || '仮押さえに失敗しました');
      }

      const holdData = await holdRes.json();
      setHoldId(holdData.hold_id);
      setHoldExpires(holdData.expires_at);
      setTotalAmount(holdData.total_amount);

      if (paymentMethod === 'points') {
        // ポイント決済
        const pointRes = await fetch('/api/tickets/purchase-with-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            hold_id: holdData.hold_id,
          }),
        });

        if (!pointRes.ok) {
          const err = await pointRes.json();
          throw new Error(err.detail || 'ポイント決済に失敗しました');
        }

        const pointData = await pointRes.json();
        setPointsBalance(pointData.points_balance);
        window.location.href = `/payment/complete?method=points&points_used=${pointData.points_used}`;
      } else {
        // GMO決済
        const purchaseRes = await fetch('/api/tickets/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            hold_id: holdData.hold_id,
          }),
        });

        if (!purchaseRes.ok) {
          const err = await purchaseRes.json();
          throw new Error(err.detail || '決済URLの取得に失敗しました');
        }

        const purchaseData = await purchaseRes.json();
        window.location.href = purchaseData.payment_url;
      }
    } catch (e: any) {
      setError(e.message);
      setViewMode('cart');
    }
  };

  // =====================================================
  // Render helpers
  // =====================================================
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
  };

  const formatTime = (timeStr: string) => {
    return timeStr.slice(0, 5);
  };

  const getRemaining = (product: TicketProduct) => {
    if (product.stock_limit === null) return null;
    return product.stock_limit - product.sold_count;
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>読み込み中...</div>;
  }

  // =====================================================
  // カート表示 → 購入ボタン
  // =====================================================
  if (viewMode === 'cart' || viewMode === 'purchasing') {
    return (
      <div className="ticket-page">
        <h1>{eventTitle}</h1>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>購入内容の確認</h2>

        {error && <div className="error-msg">{error}</div>}

        <div className="cart-list">
          {cartItems.map((item, i) => (
            <div key={i} className="cart-item">
              <div className="cart-item-info">
                <strong>{item.memberName}</strong>
                <span className="cart-item-type">{item.ticketType}</span>
              </div>
              <div className="cart-item-calc">
                <span>{item.price.toLocaleString()}円 x {item.quantity}枚</span>
                <strong>{(item.price * item.quantity).toLocaleString()}円</strong>
              </div>
            </div>
          ))}
        </div>

        <div className="cart-total">
          <span>合計金額</span>
          <strong>{cartTotal.toLocaleString()}円（税込）</strong>
        </div>

        <div className="payment-method-section">
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>決済方法</h3>
          <label className={`payment-option ${paymentMethod === 'points' ? 'active' : ''}`}>
            <input
              type="radio"
              name="payment"
              checked={paymentMethod === 'points'}
              onChange={() => setPaymentMethod('points')}
            />
            <div className="payment-option-content">
              <span className="payment-option-title">ポイントで購入</span>
              <span className="payment-option-desc">
                残高: {pointsBalance.toLocaleString()}pt
                {pointsBalance < cartTotal && <span style={{ color: '#dc2626', marginLeft: '0.5rem' }}>（残高不足）</span>}
              </span>
            </div>
          </label>
          <label className={`payment-option ${paymentMethod === 'gmo' ? 'active' : ''}`}>
            <input
              type="radio"
              name="payment"
              checked={paymentMethod === 'gmo'}
              onChange={() => setPaymentMethod('gmo')}
            />
            <div className="payment-option-content">
              <span className="payment-option-title">クレジットカード決済</span>
              <span className="payment-option-desc">決済画面に遷移します</span>
            </div>
          </label>
        </div>

        <div className="cart-actions">
          <button
            className="btn btn-primary"
            onClick={handleHoldAndPurchase}
            disabled={viewMode === 'purchasing' || (paymentMethod === 'points' && pointsBalance < cartTotal)}
          >
            {viewMode === 'purchasing' ? '処理中...' : paymentMethod === 'points' ? `ポイントで購入する（${cartTotal.toLocaleString()}pt）` : '購入する（決済へ）'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setViewMode('select');
              setError('');
            }}
            disabled={viewMode === 'purchasing'}
          >
            {searchMode === 'date' ? '開催日選択に戻る' : 'メンバー選択に戻る'}
          </button>
        </div>
      </div>
    );
  }

  // =====================================================
  // 選択モード（開催日 or メンバー）
  // =====================================================
  if (viewMode === 'select') {
    return (
      <div className="ticket-page">
        <h1>{eventTitle}</h1>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>チケット購入</p>

        <div className="mode-selector">
          <label className={`mode-option ${searchMode === 'date' ? 'active' : ''}`}>
            <input
              type="radio"
              name="mode"
              checked={searchMode === 'date'}
              onChange={() => setSearchMode('date')}
            />
            開催日から選ぶ
          </label>
          <label className={`mode-option ${searchMode === 'member' ? 'active' : ''}`}>
            <input
              type="radio"
              name="mode"
              checked={searchMode === 'member'}
              onChange={() => setSearchMode('member')}
            />
            メンバーから選ぶ
          </label>
        </div>

        {searchMode === 'date' ? (
          <div className="date-list">
            <h2>開催日を選択</h2>
            {eventDates.map((d) => (
              <button
                key={d.id}
                className="list-card"
                onClick={() => {
                  setSelectedDateId(d.id);
                  setSelectedSlotId('');
                  setViewMode('by_date');
                }}
              >
                <span className="list-card-title">{formatDate(d.event_date)}</span>
                <span className="list-card-meta">{slotsForDate(d.id).length}回</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="member-list">
            <h2>メンバーを選択</h2>
            {allMembers.map((m) => (
              <button
                key={m.name}
                className="list-card"
                onClick={() => {
                  setSelectedMemberName(m.name);
                  setViewMode('by_member');
                }}
              >
                <span className="list-card-title">{m.name}</span>
              </button>
            ))}
          </div>
        )}

        {cartItems.length > 0 && (
          <div className="cart-badge" onClick={() => setViewMode('cart')}>
            カート ({cartItems.reduce((s, i) => s + i.quantity, 0)}枚) - {cartTotal.toLocaleString()}円
          </div>
        )}
      </div>
    );
  }

  // =====================================================
  // 開催日経路: 日時 → メンバー × 券種
  // =====================================================
  if (viewMode === 'by_date') {
    const selectedDate = eventDates.find((d) => d.id === selectedDateId);
    const slots = slotsForDate(selectedDateId);

    // 時間未選択: タイムスロット一覧
    if (!selectedSlotId) {
      return (
        <div className="ticket-page">
          <button className="back-btn" onClick={() => { setViewMode('select'); setSelectedDateId(''); }}>
            ← 開催日選択に戻る
          </button>
          <h1>{eventTitle}</h1>
          <h2>{selectedDate && formatDate(selectedDate.event_date)} - 時間を選択</h2>
          <div className="slot-list">
            {slots.map((s) => (
              <button
                key={s.id}
                className="list-card"
                onClick={() => setSelectedSlotId(s.id)}
              >
                <span className="list-card-title">{formatTime(s.start_time)}</span>
                <span className="list-card-meta">
                  {membersForSlot(s.id).length}名出演
                </span>
              </button>
            ))}
          </div>
          {cartItems.length > 0 && (
            <div className="cart-badge" onClick={() => setViewMode('cart')}>
              カート ({cartItems.reduce((s, i) => s + i.quantity, 0)}枚) - {cartTotal.toLocaleString()}円
            </div>
          )}
        </div>
      );
    }

    // 時間選択済み: メンバー×券種一覧
    const members = membersForSlot(selectedSlotId);
    const selectedSlot = timeSlots.find((s) => s.id === selectedSlotId);

    const currentSelectionTotal = Object.entries(quantities).reduce((sum, [pid, qty]) => {
      const product = ticketProducts.find((p) => p.id === pid);
      return sum + (product?.price || 0) * qty;
    }, 0);

    return (
      <div className="ticket-page">
        <button className="back-btn" onClick={() => setSelectedSlotId('')}>
          ← 時間選択に戻る
        </button>
        <h1>{eventTitle}</h1>
        <h2>
          {selectedDate && formatDate(selectedDate.event_date)} {selectedSlot && formatTime(selectedSlot.start_time)}
        </h2>

        {error && <div className="error-msg">{error}</div>}

        <div className="member-products">
          {members.map((member) => {
            const products = productsForMember(member.id);
            return (
              <div key={member.id} className="member-section">
                <h3 className="member-name">{member.display_name}</h3>
                {products.map((product) => {
                  const remaining = getRemaining(product);
                  const qty = quantities[product.id] || 0;
                  return (
                    <div key={product.id} className="product-row">
                      <div className="product-info">
                        <span className="product-type">{product.ticket_type}</span>
                        <span className="product-price">{product.price.toLocaleString()}円</span>
                        {remaining !== null && (
                          <span className="product-stock">残{remaining}枚</span>
                        )}
                      </div>
                      <div className="qty-control">
                        <button className="qty-btn" onClick={() => handleQuantityChange(product.id, -1)}>-</button>
                        <span className="qty-value">{qty}</span>
                        <button className="qty-btn" onClick={() => handleQuantityChange(product.id, 1)}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {currentSelectionTotal > 0 && (
          <div className="selection-total">
            小計: {currentSelectionTotal.toLocaleString()}円
          </div>
        )}

        <div className="action-bar">
          <button className="btn btn-primary" onClick={() => { addToCart(); }}>
            決定（カートに追加）
          </button>
        </div>

        {cartItems.length > 0 && (
          <div className="cart-badge" onClick={() => setViewMode('cart')}>
            カート ({cartItems.reduce((s, i) => s + i.quantity, 0)}枚) - {cartTotal.toLocaleString()}円
          </div>
        )}
      </div>
    );
  }

  // =====================================================
  // メンバー経路: メンバー → 日時×券種
  // =====================================================
  if (viewMode === 'by_member') {
    const memberSlotMembers = slotMembers.filter((m) => m.display_name === selectedMemberName);

    const currentSelectionTotal = Object.entries(quantities).reduce((sum, [pid, qty]) => {
      const product = ticketProducts.find((p) => p.id === pid);
      return sum + (product?.price || 0) * qty;
    }, 0);

    return (
      <div className="ticket-page">
        <button className="back-btn" onClick={() => { setViewMode('select'); setSelectedMemberName(''); setQuantities({}); }}>
          ← メンバー選択に戻る
        </button>
        <h1>{eventTitle}</h1>
        <h2>{selectedMemberName} のチケット</h2>

        {error && <div className="error-msg">{error}</div>}

        <div className="member-products">
          {memberSlotMembers.map((sm) => {
            const slot = timeSlots.find((s) => s.id === sm.event_time_slot_id);
            const date = slot ? eventDates.find((d) => d.id === slot.event_date_id) : null;
            const products = productsForMember(sm.id);

            return (
              <div key={sm.id} className="member-section">
                <h3 className="member-name">
                  {date && formatDate(date.event_date)} {slot && formatTime(slot.start_time)}
                </h3>
                {products.map((product) => {
                  const remaining = getRemaining(product);
                  const qty = quantities[product.id] || 0;
                  return (
                    <div key={product.id} className="product-row">
                      <div className="product-info">
                        <span className="product-type">{product.ticket_type}</span>
                        <span className="product-price">{product.price.toLocaleString()}円</span>
                        {remaining !== null && (
                          <span className="product-stock">残{remaining}枚</span>
                        )}
                      </div>
                      <div className="qty-control">
                        <button className="qty-btn" onClick={() => handleQuantityChange(product.id, -1)}>-</button>
                        <span className="qty-value">{qty}</span>
                        <button className="qty-btn" onClick={() => handleQuantityChange(product.id, 1)}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {currentSelectionTotal > 0 && (
          <div className="selection-total">
            小計: {currentSelectionTotal.toLocaleString()}円
          </div>
        )}

        <div className="action-bar">
          <button className="btn btn-primary" onClick={() => { addToCart(); }}>
            決定（カートに追加）
          </button>
        </div>

        {cartItems.length > 0 && (
          <div className="cart-badge" onClick={() => setViewMode('cart')}>
            カート ({cartItems.reduce((s, i) => s + i.quantity, 0)}枚) - {cartTotal.toLocaleString()}円
          </div>
        )}
      </div>
    );
  }

  return null;
}
