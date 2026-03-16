import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface TicketWithDetails {
  id: string;
  status: string;
  used_at: string | null;
  created_at: string;
  ticket_product: {
    id: string;
    ticket_type: string;
    event_slot_member: {
      display_name: string;
      event_time_slot: {
        id: string;
        start_time: string;
        event_date: {
          id: string;
          event_date: string;
          event: {
            id: string;
            title: string;
          };
        };
      };
    } | null;
  };
}

interface GroupedTickets {
  eventId: string;
  eventTitle: string;
  dates: {
    dateId: string;
    dateStr: string;
    slots: {
      slotId: string;
      startTime: string;
      tickets: TicketWithDetails[];
    }[];
  }[];
}

type ViewLevel = 'events' | 'slots' | 'tickets';

export default function MyTickets() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<GroupedTickets[]>([]);
  const [viewLevel, setViewLevel] = useState<ViewLevel>('events');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/auth/login';
      return;
    }

    // チケットを階層データとともに取得
    const { data: tickets, error } = await supabase
      .from('user_tickets')
      .select(`
        id, status, used_at, created_at,
        ticket_products!inner (
          id, ticket_type,
          event_slot_members (
            display_name,
            event_time_slots!inner (
              id, start_time,
              event_dates!inner (
                id, event_date,
                events!inner ( id, title )
              )
            )
          )
        )
      `)
      .eq('user_id', session.user.id)
      .in('status', ['valid', 'used'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Tickets fetch error:', error);
      // フォールバック: シンプルなクエリ
      const { data: simpleTickets } = await supabase
        .from('user_tickets')
        .select('*, ticket_products(*)')
        .eq('user_id', session.user.id)
        .in('status', ['valid', 'used']);

      setLoading(false);
      return;
    }

    // グルーピング
    const groupMap = new Map<string, GroupedTickets>();

    (tickets || []).forEach((t: any) => {
      const product = t.ticket_products;
      const slotMember = product?.event_slot_members;
      if (!slotMember) return;

      const slot = slotMember.event_time_slots;
      const date = slot?.event_dates;
      const event = date?.events;
      if (!event) return;

      const ticket: TicketWithDetails = {
        id: t.id,
        status: t.status,
        used_at: t.used_at,
        created_at: t.created_at,
        ticket_product: {
          id: product.id,
          ticket_type: product.ticket_type,
          event_slot_member: {
            display_name: slotMember.display_name,
            event_time_slot: {
              id: slot.id,
              start_time: slot.start_time,
              event_date: {
                id: date.id,
                event_date: date.event_date,
                event: { id: event.id, title: event.title },
              },
            },
          },
        },
      };

      if (!groupMap.has(event.id)) {
        groupMap.set(event.id, {
          eventId: event.id,
          eventTitle: event.title,
          dates: [],
        });
      }

      const group = groupMap.get(event.id)!;
      let dateGroup = group.dates.find((d) => d.dateId === date.id);
      if (!dateGroup) {
        dateGroup = { dateId: date.id, dateStr: date.event_date, slots: [] };
        group.dates.push(dateGroup);
      }

      let slotGroup = dateGroup.slots.find((s) => s.slotId === slot.id);
      if (!slotGroup) {
        slotGroup = { slotId: slot.id, startTime: slot.start_time, tickets: [] };
        dateGroup.slots.push(slotGroup);
      }

      slotGroup.tickets.push(ticket);
    });

    setGroups(Array.from(groupMap.values()));
    setLoading(false);
  }

  // チケット使用（撮影画面への遷移）
  const handleTicketUse = (ticket: TicketWithDetails) => {
    if (ticket.status !== 'valid') return;
    // 撮影画面に遷移（チケットIDをパラメータで渡す）
    window.location.href = `/camera?ticket_id=${ticket.id}`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
  };

  const formatTime = (timeStr: string) => timeStr.slice(0, 5);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>読み込み中...</div>;
  }

  if (groups.length === 0) {
    return (
      <div className="my-tickets">
        <h1>購入済みチケット</h1>
        <div className="empty-msg">
          <p>チケットがありません。</p>
          <p><a href="/events">イベント一覧</a>からチケットを購入できます。</p>
        </div>
      </div>
    );
  }

  // =====================================================
  // レベル3: 特定タイムスロットのチケット一覧
  // =====================================================
  if (viewLevel === 'tickets' && selectedSlot) {
    const group = groups.find((g) => g.eventId === selectedEvent);
    const dateGroup = group?.dates.find((d) => d.dateId === selectedDate);
    const slotGroup = dateGroup?.slots.find((s) => s.slotId === selectedSlot);

    return (
      <div className="my-tickets">
        <button className="back-btn" onClick={() => { setViewLevel('slots'); setSelectedSlot(''); }}>
          ← 日時一覧に戻る
        </button>
        <h1>{group?.eventTitle}</h1>
        <h2>
          {dateGroup && formatDate(dateGroup.dateStr)} {slotGroup && formatTime(slotGroup.startTime)}
        </h2>

        <div className="ticket-grid">
          {slotGroup?.tickets.map((ticket, index) => {
            const member = ticket.ticket_product.event_slot_member;
            const isUsed = ticket.status === 'used';

            return (
              <div
                key={ticket.id}
                className={`ticket-card ${isUsed ? 'ticket-used' : ''}`}
                onClick={() => !isUsed && handleTicketUse(ticket)}
              >
                <div className="ticket-card-info">
                  <span className="ticket-card-member">
                    {member?.display_name} #{index + 1}
                  </span>
                  <span className="ticket-card-type">{ticket.ticket_product.ticket_type}</span>
                </div>
                <span className={`ticket-badge ${isUsed ? 'badge-used' : 'badge-valid'}`}>
                  {isUsed ? '撮影終了' : '未使用'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =====================================================
  // レベル2: 特定イベントの日時一覧
  // =====================================================
  if (viewLevel === 'slots' && selectedEvent) {
    const group = groups.find((g) => g.eventId === selectedEvent);

    return (
      <div className="my-tickets">
        <button className="back-btn" onClick={() => { setViewLevel('events'); setSelectedEvent(''); }}>
          ← イベント一覧に戻る
        </button>
        <h1>{group?.eventTitle}</h1>

        {group?.dates.map((dateGroup) => (
          <div key={dateGroup.dateId}>
            <h2>{formatDate(dateGroup.dateStr)}</h2>
            {dateGroup.slots.map((slot) => {
              const totalTickets = slot.tickets.length;
              const usedTickets = slot.tickets.filter((t) => t.status === 'used').length;
              return (
                <div
                  key={slot.slotId}
                  className="slot-group"
                  style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '0.5rem' }}
                  onClick={() => {
                    setSelectedDate(dateGroup.dateId);
                    setSelectedSlot(slot.slotId);
                    setViewLevel('tickets');
                  }}
                >
                  <div className="slot-label">{formatTime(slot.startTime)}</div>
                  <div className="slot-meta">
                    {totalTickets}枚（使用済み {usedTickets}/{totalTickets}）
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // =====================================================
  // レベル1: イベント一覧
  // =====================================================
  return (
    <div className="my-tickets">
      <h1>購入済みチケット</h1>

      {groups.map((group) => {
        const totalTickets = group.dates.reduce(
          (sum, d) => sum + d.slots.reduce((s, sl) => s + sl.tickets.length, 0), 0
        );
        const usedTickets = group.dates.reduce(
          (sum, d) => sum + d.slots.reduce((s, sl) => s + sl.tickets.filter((t) => t.status === 'used').length, 0), 0
        );

        return (
          <div
            key={group.eventId}
            className="event-group"
            onClick={() => {
              setSelectedEvent(group.eventId);
              setViewLevel('slots');
            }}
          >
            <div className="event-group-header">
              <span>{group.eventTitle}</span>
              <span className="event-group-count">
                {totalTickets}枚（使用済み {usedTickets}）
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
