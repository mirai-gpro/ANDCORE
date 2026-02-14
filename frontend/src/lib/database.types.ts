export type UserRole = 'fan' | 'idol' | 'admin';
export type EventStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';
export type TicketStatus = 'valid' | 'used' | 'expired';
export type MediaType = 'photo' | 'video';
export type MediaStatus = 'pending_review' | 'published';

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
      ticket_products: {
        Row: {
          id: string;
          event_id: string;
          idol_id: string;
          title: string | null;
          price_points: number;
          duration_seconds: number;
          stock_limit: number | null;
          created_at: string;
        };
        Insert: {
          event_id: string;
          idol_id: string;
          title?: string | null;
          price_points: number;
          duration_seconds: number;
          stock_limit?: number | null;
        };
        Update: {
          title?: string | null;
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
          status: TicketStatus;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          ticket_product_id: string;
          status?: TicketStatus;
        };
        Update: {
          status?: TicketStatus;
          used_at?: string | null;
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
