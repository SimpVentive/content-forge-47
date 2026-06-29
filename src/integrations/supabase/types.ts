export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      api_provider_rates: {
        Row: {
          cost_per_unit: number
          created_at: string
          currency: string
          id: string
          last_updated: string
          notes: string | null
          provider_name: string
          unit_description: string | null
          updated_at: string
        }
        Insert: {
          cost_per_unit: number
          created_at?: string
          currency?: string
          id?: string
          last_updated?: string
          notes?: string | null
          provider_name: string
          unit_description?: string | null
          updated_at?: string
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          currency?: string
          id?: string
          last_updated?: string
          notes?: string | null
          provider_name?: string
          unit_description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      api_usage_logs: {
        Row: {
          cost: number
          course_id: string | null
          created_at: string
          id: string
          provider_name: string
          reason: string | null
          units_used: number
          user_id: string
        }
        Insert: {
          cost: number
          course_id?: string | null
          created_at?: string
          id?: string
          provider_name: string
          reason?: string | null
          units_used: number
          user_id: string
        }
        Update: {
          cost?: number
          course_id?: string | null
          created_at?: string
          id?: string
          provider_name?: string
          reason?: string | null
          units_used?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_selection_preferences: {
        Row: {
          content_hash: string | null
          course_id: string
          course_type: string | null
          created_at: string
          id: string
          selected_asset_ids: string[] | null
          topic_keywords: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content_hash?: string | null
          course_id: string
          course_type?: string | null
          created_at?: string
          id?: string
          selected_asset_ids?: string[] | null
          topic_keywords?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content_hash?: string | null
          course_id?: string
          course_type?: string | null
          created_at?: string
          id?: string
          selected_asset_ids?: string[] | null
          topic_keywords?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_selection_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_usage_log: {
        Row: {
          asset_id: string
          course_id: string
          id: string
          slide_number: number
          slide_title: string | null
          used_at: string
          user_id: string
        }
        Insert: {
          asset_id: string
          course_id: string
          id?: string
          slide_number: number
          slide_title?: string | null
          used_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string
          course_id?: string
          id?: string
          slide_number?: number
          slide_title?: string | null
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_usage_log_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "user_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_transactions: {
        Row: {
          amount_inr: number
          created_at: string
          credits_purchased: number
          id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_inr: number
          created_at?: string
          credits_purchased: number
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_inr?: number
          created_at?: string
          credits_purchased?: number
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          created_at: string
          credits_total: number
          credits_used: number
          email: string
          full_name: string | null
          id: string
          organization_name: string | null
          phone: string | null
          plan: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          account_type?: string
          created_at?: string
          credits_total?: number
          credits_used?: number
          email: string
          full_name?: string | null
          id: string
          organization_name?: string | null
          phone?: string | null
          plan?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          created_at?: string
          credits_total?: number
          credits_used?: number
          email?: string
          full_name?: string | null
          id?: string
          organization_name?: string | null
          phone?: string | null
          plan?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_configs: {
        Row: {
          api_key_encrypted: string
          config_json: Json | null
          id: string
          is_active: boolean
          provider_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key_encrypted: string
          config_json?: Json | null
          id?: string
          is_active?: boolean
          provider_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key_encrypted?: string
          config_json?: Json | null
          id?: string
          is_active?: boolean
          provider_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_configs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_purchases: {
        Row: {
          cost_inr: number
          created_at: string
          id: string
          notes: string | null
          provider_name: string
          purchase_date: string
          units_purchased: number
        }
        Insert: {
          cost_inr: number
          created_at?: string
          id?: string
          notes?: string | null
          provider_name: string
          purchase_date: string
          units_purchased: number
        }
        Update: {
          cost_inr?: number
          created_at?: string
          id?: string
          notes?: string | null
          provider_name?: string
          purchase_date?: string
          units_purchased?: number
        }
        Relationships: []
      }
      user_assets: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          file_size_bytes: number
          filename: string
          height: number | null
          id: string
          mime_type: string
          original_filename: string
          storage_path: string
          storage_url: string
          tags: string[] | null
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_size_bytes: number
          filename: string
          height?: number | null
          id?: string
          mime_type: string
          original_filename: string
          storage_path: string
          storage_url: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_size_bytes?: number
          filename?: string
          height?: number | null
          id?: string
          mime_type?: string
          original_filename?: string
          storage_path?: string
          storage_url?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_assets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { uid: string }; Returns: boolean }
      spend_credits: {
        Args: { p_amount: number; p_reason?: string; p_user_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
