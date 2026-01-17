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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      asset_price_history: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          price: number
          recorded_at: string
          user_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          price: number
          recorded_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          price?: number
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_price_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "portfolio_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"] | null
          id: string
          month: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"] | null
          id?: string
          month: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"] | null
          id?: string
          month?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      category_mappings: {
        Row: {
          category_id: string | null
          created_at: string
          description: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_mappings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      isin_mappings: {
        Row: {
          asset_type: string
          created_at: string
          id: string
          isin: string
          name: string
          symbol: string
          user_id: string
        }
        Insert: {
          asset_type?: string
          created_at?: string
          id?: string
          isin: string
          name: string
          symbol: string
          user_id: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          id?: string
          isin?: string
          name?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_assets: {
        Row: {
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"] | null
          current_price: number | null
          id: string
          name: string
          notes: string | null
          purchase_date: string
          purchase_price: number
          quantity: number
          sold_at: string | null
          sold_price: number | null
          symbol: string | null
          type: Database["public"]["Enums"]["asset_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"] | null
          current_price?: number | null
          id?: string
          name: string
          notes?: string | null
          purchase_date?: string
          purchase_price: number
          quantity: number
          sold_at?: string | null
          sold_price?: number | null
          symbol?: string | null
          type: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"] | null
          current_price?: number | null
          id?: string
          name?: string
          notes?: string | null
          purchase_date?: string
          purchase_price?: number
          quantity?: number
          sold_at?: string | null
          sold_price?: number | null
          symbol?: string | null
          type?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      price_update_logs: {
        Row: {
          assets_checked: number
          assets_updated: number
          errors: Json | null
          id: string
          updated_at: string
        }
        Insert: {
          assets_checked?: number
          assets_updated?: number
          errors?: Json | null
          id?: string
          updated_at?: string
        }
        Update: {
          assets_checked?: number
          assets_updated?: number
          errors?: Json | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_currency: Database["public"]["Enums"]["currency_code"] | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
          fire: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency_code"] | null
          fire?: boolean | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency_code"] | null
          fire?: boolean | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      poker_manual_expenses: {
        Row: {
          amount: number
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      poker_next_cut: {
        Row: {
          amount: number
          created_at: string
          deal: number
          id: string
          name: string
          profit_loss: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          deal: number
          id?: string
          name: string
          profit_loss: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          deal?: number
          id?: string
          name?: string
          profit_loss?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"] | null
          frequency: string
          id: string
          is_active: boolean | null
          name: string
          next_due_date: string
          updated_at: string
          user_id: string
          week_interval: number | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"] | null
          frequency: string
          id?: string
          is_active?: boolean | null
          name: string
          next_due_date: string
          updated_at?: string
          user_id: string
          week_interval?: number | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"] | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          name?: string
          next_due_date?: string
          updated_at?: string
          user_id?: string
          week_interval?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          color: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"] | null
          current_amount: number | null
          deadline: string | null
          icon: string | null
          id: string
          name: string
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"] | null
          current_amount?: number | null
          deadline?: string | null
          icon?: string | null
          id?: string
          name: string
          target_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"] | null
          current_amount?: number | null
          deadline?: string | null
          icon?: string | null
          id?: string
          name?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"] | null
          date: string
          description: string | null
          id: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"] | null
          date?: string
          description?: string | null
          id?: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"] | null
          date?: string
          description?: string | null
          id?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      asset_type:
        | "stock"
        | "etf"
        | "crypto"
        | "bond"
        | "cash"
        | "real_estate"
        | "other"
      currency_code:
        | "EUR"
        | "USD"
        | "GBP"
        | "CHF"
        | "JPY"
        | "CAD"
        | "AUD"
        | "CNY"
      transaction_type: "income" | "expense"
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
    Enums: {
      asset_type: [
        "stock",
        "etf",
        "crypto",
        "bond",
        "cash",
        "real_estate",
        "other",
      ],
      currency_code: ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "CNY"],
      transaction_type: ["income", "expense"],
    },
  },
} as const
