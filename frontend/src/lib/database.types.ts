export type UserRole = 'fan' | 'idol' | 'admin';
export type EventStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';
export type TicketStatus = 'valid' | 'used' | 'expired' | 'refunded';
export type MediaType = 'photo' | 'video';
export type MediaStatus = 'pending_review' | 'published';
export type PaymentOrderType = 'point_charge' | 'ticket_purchase';
export type PaymentOrderStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
export type HoldStatus = 'held' | 'purchased' | 'released' | 'expired';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          nickname: string | null;
          avatar_url: string | null;
          points_balance: number;
          rank_score: number;
          created_at: string;
        };
        Insert: {
          id: string;
          role: UserRole;
          nickname?: string | null;
          avatar_url?: string | null;
          points_balance?: number;
          rank_score?: number;
        };
        Update: {
          role?: UserRole;
          nickname?: string | null;
          avatar_url?: string | null;
          points_balance?: number;
          rank_score?: number;
        };
      };
      events: {
        Row: {
          id: string;
          organizer_id: string;
          title: string;
          subtitle: string | null;
          performers: string | null;
          venue_name: string | null;
          venue_map_url: string | null;
          description: string | null;
          event_date: string | null;
          location: string | null;
          ticket_price: number | null;
          image_url: string | null;
          youtube_url: string | null;
          x_url: string | null;
          instagram_url: string | null;
          tiktok_url: string | null;
          status: EventStatus;
          created_at: string;
        };
        Insert: {
          organizer_id: string;
          title: string;
          subtitle?: string | null;
          performers?: string | null;
          venue_name?: string | null;
          venue_map_url?: string | null;
          description?: string | null;
          event_date?: string | null;
          location?: string | null;
          ticket_price?: number | null;
          image_url?: string | null;
          youtube_url?: string | null;
          x_url?: string | null;
          instagram_url?: string | null;
          tiktok_url?: string | null;
          status?: EventStatus;
        };
        Update: {
          title?: string;
          subtitle?: string | null;
          performers?: string | null;
          venue_name?: string | null;
          venue_map_url?: string | null;
          description?: string | null;
          event_date?: string | null;
          location?: string | null;
          ticket_price?: number | null;
          image_url?: string | null;
          youtube_url?: string | null;
          x_url?: string | null;
          instagram_url?: string | null;
          tiktok_url?: string | null;
          status?: EventStatus;
        };
      };
      event_dates: {
        Row: {
          id: string;
          event_id: string;
          event_date: string;
          created_at: string;
        };
        Insert: {
          event_id: string;
          event_date: string;
        };
        Update: {
          event_date?: string;
        };
      };
      event_time_slots: {
        Row: {
          id: string;
          event_date_id: string;
          start_time: string;
          door_time: string;
          created_at: string;
        };
        Insert: {
          event_date_id: string;
          start_time: string;
          door_time: string;
        };
        Update: {
          start_time?: string;
          door_time?: string;
        };
      };
      event_performers: {
        Row: {
          id: string;
          event_id: string;
          idol_group_id: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          event_id: string;
          idol_group_id: string;
          sort_order?: number;
        };
        Update: {
          sort_order?: number;
        };
      };
      event_slot_members: {
        Row: {
          id: string;
          event_time_slot_id: string;
          idol_id: string | null;
          display_name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          event_time_slot_id: string;
          idol_id?: string | null;
          display_name: string;
          sort_order?: number;
        };
        Update: {
          display_name?: string;
          sort_order?: number;
        };
      };
      ticket_products: {
        Row: {
          id: string;
          event_id: string;
          idol_id: string;
          event_slot_member_id: string | null;
          ticket_type: string;
          title: string | null;
          description: string | null;
          price: number;
          price_points: number;
          duration_seconds: number;
          stock_limit: number | null;
          sold_count: number;
          created_at: string;
        };
        Insert: {
          event_id: string;
          idol_id: string;
          event_slot_member_id?: string | null;
          ticket_type?: string;
          title?: string | null;
          description?: string | null;
          price?: number;
          price_points?: number;
          duration_seconds?: number;
          stock_limit?: number | null;
        };
        Update: {
          ticket_type?: string;
          title?: string | null;
          description?: string | null;
          price?: number;
          price_points?: number;
          duration_seconds?: number;
          stock_limit?: number | null;
        };
      };
      user_tickets: {
        Row: {
          id: string;
          user_id: string;
          ticket_product_id: string;
          ticket_hold_id: string | null;
          payment_order_id: string | null;
          status: TicketStatus;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          ticket_product_id: string;
          ticket_hold_id?: string | null;
          payment_order_id?: string | null;
          status?: TicketStatus;
        };
        Update: {
          status?: TicketStatus;
          used_at?: string | null;
        };
      };
      ticket_holds: {
        Row: {
          id: string;
          user_id: string;
          payment_order_id: string | null;
          status: HoldStatus;
          total_amount: number;
          held_at: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          payment_order_id?: string | null;
          total_amount?: number;
          expires_at?: string;
        };
        Update: {
          status?: HoldStatus;
          payment_order_id?: string | null;
        };
      };
      ticket_hold_items: {
        Row: {
          id: string;
          ticket_hold_id: string;
          ticket_product_id: string;
          quantity: number;
          unit_price: number;
          created_at: string;
        };
        Insert: {
          ticket_hold_id: string;
          ticket_product_id: string;
          quantity: number;
          unit_price: number;
        };
        Update: {
          quantity?: number;
        };
      };
      payment_orders: {
        Row: {
          id: string;
          user_id: string;
          order_type: PaymentOrderType;
          status: PaymentOrderStatus;
          amount: number;
          tax: number;
          points_amount: number | null;
          ticket_product_id: string | null;
          ticket_quantity: number | null;
          gmo_order_id: string;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          user_id: string;
          order_type: PaymentOrderType;
          amount: number;
          gmo_order_id: string;
          points_amount?: number | null;
          ticket_product_id?: string | null;
          ticket_quantity?: number | null;
        };
        Update: {
          status?: PaymentOrderStatus;
          completed_at?: string | null;
        };
      };
      media_assets: {
        Row: {
          id: string;
          user_id: string;
          idol_id: string;
          event_id: string;
          original_url: string | null;
          decorated_url: string | null;
          voice_message_url: string | null;
          media_type: MediaType;
          status: MediaStatus;
          created_at: string;
        };
        Insert: {
          user_id: string;
          idol_id: string;
          event_id: string;
          original_url?: string | null;
          media_type: MediaType;
        };
        Update: {
          original_url?: string | null;
          decorated_url?: string | null;
          voice_message_url?: string | null;
          status?: MediaStatus;
        };
      };
    };
  };
}
