export type UserRole = 'fan' | 'idol' | 'organizer' | 'admin';
export type EventStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';
export type TicketStatus = 'valid' | 'used' | 'expired' | 'refunded';
export type MediaType = 'photo' | 'video';
export type MediaStatus = 'pending_review' | 'published';
export type PaymentOrderType = 'point_charge' | 'ticket_purchase';
export type PaymentOrderStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
export type HoldStatus = 'held' | 'purchased' | 'released' | 'expired';
export type PointTransactionType = 'charge' | 'purchase' | 'refund' | 'bonus' | 'generate' | 'grant';

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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      ticket_products: {
        Row: {
          id: string;
          event_id: string;
          idol_id: string | null;
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
          idol_id?: string | null;
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
          sold_count?: number;
        };
        Relationships: [];
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
        Relationships: [];
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
          status?: HoldStatus;
          total_amount?: number;
          expires_at?: string;
        };
        Update: {
          status?: HoldStatus;
          payment_order_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ticket_hold_items_ticket_hold_id_fkey';
            columns: ['id'];
            isOneToOne: false;
            referencedRelation: 'ticket_hold_items';
            referencedColumns: ['ticket_hold_id'];
          }
        ];
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
        Relationships: [];
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
          gmo_access_id: string | null;
          gmo_access_pass: string | null;
          gmo_order_id: string;
          gmo_job_cd: string;
          gmo_method: string | null;
          gmo_forward: string | null;
          gmo_approve: string | null;
          gmo_tran_id: string | null;
          gmo_tran_date: string | null;
          error_code: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          user_id: string;
          order_type: PaymentOrderType;
          amount: number;
          gmo_order_id: string;
          gmo_job_cd?: string;
          points_amount?: number | null;
          ticket_product_id?: string | null;
          ticket_quantity?: number | null;
        };
        Update: {
          status?: PaymentOrderStatus;
          gmo_access_id?: string | null;
          gmo_access_pass?: string | null;
          gmo_method?: string | null;
          gmo_forward?: string | null;
          gmo_approve?: string | null;
          gmo_tran_id?: string | null;
          gmo_tran_date?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
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
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role: string;
        };
        Update: {
          role?: string;
        };
        Relationships: [];
      };
      point_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          balance_after: number;
          type: PointTransactionType;
          reference_id: string | null;
          description: string | null;
          granted_by: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          amount: number;
          balance_after: number;
          type: PointTransactionType;
          reference_id?: string | null;
          description?: string | null;
          granted_by?: string | null;
        };
        Update: {
          amount?: number;
          balance_after?: number;
          type?: PointTransactionType;
          description?: string | null;
        };
        Relationships: [];
      };
      idol_groups: {
        Row: {
          id: string;
          organizer_id: string;
          name: string;
          catchphrase: string | null;
          photo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organizer_id: string;
          name: string;
          catchphrase?: string | null;
          photo_url?: string | null;
        };
        Update: {
          name?: string;
          catchphrase?: string | null;
          photo_url?: string | null;
        };
        Relationships: [];
      };
      idol_group_admins: {
        Row: {
          group_id: string;
          admin_email: string;
          created_at: string;
        };
        Insert: {
          group_id: string;
          admin_email: string;
        };
        Update: {
          admin_email?: string;
        };
        Relationships: [];
      };
      idol_members: {
        Row: {
          id: string;
          group_id: string;
          name: string;
          google_email: string | null;
          photo_url: string | null;
          profile_id: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          group_id: string;
          name: string;
          google_email?: string | null;
          photo_url?: string | null;
          profile_id?: string | null;
          sort_order?: number;
        };
        Update: {
          name?: string;
          google_email?: string | null;
          photo_url?: string | null;
          profile_id?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      switch_role: {
        Args: { new_role: string };
        Returns: undefined;
      };
      grant_role: {
        Args: { target_user_id: string; target_role: string };
        Returns: undefined;
      };
      revoke_role: {
        Args: { target_user_id: string; target_role: string };
        Returns: undefined;
      };
      ensure_profile: {
        Args: { target_role: string; target_nickname?: string; target_avatar_url?: string };
        Returns: undefined;
      };
      user_has_role: {
        Args: { allowed_roles: string[] };
        Returns: boolean;
      };
      generate_points: {
        Args: { amount: number };
        Returns: Record<string, unknown>;
      };
      grant_points: {
        Args: { target_user_id: string; amount: number; note?: string };
        Returns: Record<string, unknown>;
      };
      find_user_by_email: {
        Args: { search_email: string };
        Returns: { id: string; nickname: string; points_balance: number }[];
      };
      list_organizers: {
        Args: Record<string, never>;
        Returns: { user_id: string; email: string; nickname: string }[];
      };
      list_admins: {
        Args: Record<string, never>;
        Returns: { user_id: string; email: string; nickname: string; role: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
