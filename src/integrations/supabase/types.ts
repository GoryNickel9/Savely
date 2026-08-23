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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
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
      backup_codes: {
        Row: {
          code_hash: string
          created_at: string | null
          id: string
          is_used: boolean
          updated_at: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string | null
          id?: string
          is_used?: boolean
          updated_at?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string | null
          id?: string
          is_used?: boolean
          updated_at?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          deleted_at: string | null
          icon: string | null
          id: string
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
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
      cbd: {
        Row: {
          costo: number
          costo_mensile: number | null
          created_at: string | null
          data_acquisto: string
          data_finito: string | null
          descrizione: string | null
          euro_al_giorno: number | null
          giorni_durata: number | null
          grammi: number | null
          grammi_al_giorno: number | null
          id: string
          marca: string | null
          thc_content: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          costo?: number
          costo_mensile?: number | null
          created_at?: string | null
          data_acquisto: string
          data_finito?: string | null
          descrizione?: string | null
          euro_al_giorno?: number | null
          giorni_durata?: number | null
          grammi?: number | null
          grammi_al_giorno?: number | null
          id?: string
          marca?: string | null
          thc_content?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          costo?: number
          costo_mensile?: number | null
          created_at?: string | null
          data_acquisto?: string
          data_finito?: string | null
          descrizione?: string | null
          euro_al_giorno?: number | null
          giorni_durata?: number | null
          grammi?: number | null
          grammi_al_giorno?: number | null
          id?: string
          marca?: string | null
          thc_content?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      couple_audit_log: {
        Row: {
          action: string
          actor_id: string
          connection_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          connection_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          connection_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couple_audit_log_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "couple_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_budgets: {
        Row: {
          amount: number
          connection_id: string
          couple_category_name: string
          created_at: string
          created_by: string
          currency: Database["public"]["Enums"]["currency_code"] | null
          id: string
          month: number
          updated_at: string
          year: number
        }
        Insert: {
          amount: number
          connection_id: string
          couple_category_name: string
          created_at?: string
          created_by: string
          currency?: Database["public"]["Enums"]["currency_code"] | null
          id?: string
          month?: number
          updated_at?: string
          year?: number
        }
        Update: {
          amount?: number
          connection_id?: string
          couple_category_name?: string
          created_at?: string
          created_by?: string
          currency?: Database["public"]["Enums"]["currency_code"] | null
          id?: string
          month?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "couple_budgets_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "couple_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_connection_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      couple_connections: {
        Row: {
          created_at: string
          id: string
          revoked_at: string | null
          updated_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          revoked_at?: string | null
          updated_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          revoked_at?: string | null
          updated_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      cron_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
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
      library_items: {
        Row: {
          api_id: string | null
          author: string | null
          category: string
          cover_image: string | null
          created_at: string
          id: string
          notes: string | null
          publisher: string | null
          purchase_price: number | null
          quantity: number
          reselling_value: number | null
          title: string
          updated_at: string
          user_id: string
          year: number | null
        }
        Insert: {
          api_id?: string | null
          author?: string | null
          category: string
          cover_image?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          publisher?: string | null
          purchase_price?: number | null
          quantity?: number
          reselling_value?: number | null
          title: string
          updated_at?: string
          user_id: string
          year?: number | null
        }
        Update: {
          api_id?: string | null
          author?: string | null
          category?: string
          cover_image?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          publisher?: string | null
          purchase_price?: number | null
          quantity?: number
          reselling_value?: number | null
          title?: string
          updated_at?: string
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      liquido_sigaretta: {
        Row: {
          costo: number
          costo_mensile: number | null
          created_at: string | null
          data_arrivo: string
          data_finito: string | null
          euro_al_giorno: number | null
          giorni_durata: number | null
          id: string
          millilitri: number
          millilitri_al_giorno: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          costo?: number
          costo_mensile?: number | null
          created_at?: string | null
          data_arrivo: string
          data_finito?: string | null
          euro_al_giorno?: number | null
          giorni_durata?: number | null
          id?: string
          millilitri?: number
          millilitri_al_giorno?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          costo?: number
          costo_mensile?: number | null
          created_at?: string | null
          data_arrivo?: string
          data_finito?: string | null
          euro_al_giorno?: number | null
          giorni_durata?: number | null
          id?: string
          millilitri?: number
          millilitri_al_giorno?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      login_activity: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip: unknown
          session_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip?: unknown
          session_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip?: unknown
          session_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      manual_price_updates: {
        Row: {
          assets_checked: number
          assets_updated: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assets_checked?: number
          assets_updated?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assets_checked?: number
          assets_updated?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      net_worth_snapshots: {
        Row: {
          components: Json | null
          created_at: string
          date: string
          id: string
          net_worth: number
          user_id: string
        }
        Insert: {
          components?: Json | null
          created_at?: string
          date: string
          id?: string
          net_worth: number
          user_id: string
        }
        Update: {
          components?: Json | null
          created_at?: string
          date?: string
          id?: string
          net_worth?: number
          user_id?: string
        }
        Relationships: []
      }
      poker_hourly_earnings: {
        Row: {
          created_at: string | null
          date: string
          hourly_rate: number
          hourly_rate_ev: number | null
          hours_played: number
          id: string
          net_won_ev: number | null
          profit_loss: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          hourly_rate?: number
          hourly_rate_ev?: number | null
          hours_played: number
          id?: string
          net_won_ev?: number | null
          profit_loss?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          hourly_rate?: number
          hourly_rate_ev?: number | null
          hours_played?: number
          id?: string
          net_won_ev?: number | null
          profit_loss?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      poker_manual_expenses: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      poker_monthly_expenses: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          is_mandatory: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          is_mandatory?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          is_mandatory?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      poker_next_cut: {
        Row: {
          amount: number
          created_at: string | null
          deal: number
          id: string
          name: string
          profit_loss: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          deal?: number
          id?: string
          name: string
          profit_loss?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          deal?: number
          id?: string
          name?: string
          profit_loss?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      poker_rakeback: {
        Row: {
          created_at: string | null
          date: string
          id: string
          rake_generated: number
          rakeback_percentage: number
          rakeback_received: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          rake_generated?: number
          rakeback_percentage?: number
          rakeback_received?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          rake_generated?: number
          rakeback_percentage?: number
          rakeback_received?: number
          updated_at?: string | null
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
          user_id: string | null
        }
        Insert: {
          assets_checked?: number
          assets_updated?: number
          errors?: Json | null
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assets_checked?: number
          assets_updated?: number
          errors?: Json | null
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          couple_code: string
          created_at: string
          default_currency: Database["public"]["Enums"]["currency_code"] | null
          fire: boolean | null
          full_name: string | null
          fumo: boolean | null
          id: string
          language: string
          permissions: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          couple_code: string
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency_code"] | null
          fire?: boolean | null
          full_name?: string | null
          fumo?: boolean | null
          id?: string
          language?: string
          permissions?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          couple_code?: string
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency_code"] | null
          fire?: boolean | null
          full_name?: string | null
          fumo?: boolean | null
          id?: string
          language?: string
          permissions?: Json | null
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
          deleted_at: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
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
          deleted_at?: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
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
          deleted_at?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
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
      shared_expenses: {
        Row: {
          connection_id: string
          couple_category_name: string | null
          created_at: string
          created_by: string
          id: string
          original_tx_id: string
          partner_amount: number | null
          split_mode: string
          split_percentage: number | null
          updated_at: string
        }
        Insert: {
          connection_id: string
          couple_category_name?: string | null
          created_at?: string
          created_by: string
          id?: string
          original_tx_id: string
          partner_amount?: number | null
          split_mode?: string
          split_percentage?: number | null
          updated_at?: string
        }
        Update: {
          connection_id?: string
          couple_category_name?: string | null
          created_at?: string
          created_by?: string
          id?: string
          original_tx_id?: string
          partner_amount?: number | null
          split_mode?: string
          split_percentage?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_expenses_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "couple_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_expenses_original_tx_id_fkey"
            columns: ["original_tx_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      tgc_cards: {
        Row: {
          card_id: string | null
          category: string
          collector_number: string | null
          condition: string | null
          created_at: string | null
          currency: string | null
          current_price: number | null
          id: string
          image_url: string | null
          language: string
          name: string
          notes: string | null
          purchase_date: string
          purchase_price: number
          quantity: number
          set_code: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_id?: string | null
          category: string
          collector_number?: string | null
          condition?: string | null
          created_at?: string | null
          currency?: string | null
          current_price?: number | null
          id?: string
          image_url?: string | null
          language?: string
          name: string
          notes?: string | null
          purchase_date: string
          purchase_price: number
          quantity?: number
          set_code?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_id?: string | null
          category?: string
          collector_number?: string | null
          condition?: string | null
          created_at?: string | null
          currency?: string | null
          current_price?: number | null
          id?: string
          image_url?: string | null
          language?: string
          name?: string
          notes?: string | null
          purchase_date?: string
          purchase_price?: number
          quantity?: number
          set_code?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      thc: {
        Row: {
          costo: number
          costo_mensile: number | null
          created_at: string | null
          data_acquisto: string
          data_finito: string | null
          descrizione: string | null
          euro_al_giorno: number | null
          giorni_durata: number | null
          grammi: number | null
          grammi_al_giorno: number | null
          id: string
          marca: string | null
          thc_content: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          costo?: number
          costo_mensile?: number | null
          created_at?: string | null
          data_acquisto: string
          data_finito?: string | null
          descrizione?: string | null
          euro_al_giorno?: number | null
          giorni_durata?: number | null
          grammi?: number | null
          grammi_al_giorno?: number | null
          id?: string
          marca?: string | null
          thc_content?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          costo?: number
          costo_mensile?: number | null
          created_at?: string | null
          data_acquisto?: string
          data_finito?: string | null
          descrizione?: string | null
          euro_al_giorno?: number | null
          giorni_durata?: number | null
          grammi?: number | null
          grammi_al_giorno?: number | null
          id?: string
          marca?: string | null
          thc_content?: number | null
          updated_at?: string | null
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
          deleted_at: string | null
          description: string | null
          exchange_rate_eur: number
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
          deleted_at?: string | null
          description?: string | null
          exchange_rate_eur?: number
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
          deleted_at?: string | null
          description?: string | null
          exchange_rate_eur?: number
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
      user_mfa_factors: {
        Row: {
          created_at: string | null
          factor_type: string
          friendly_name: string | null
          id: string
          phone: string | null
          secret: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          factor_type: string
          friendly_name?: string | null
          id?: string
          phone?: string | null
          secret?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          factor_type?: string
          friendly_name?: string | null
          id?: string
          phone?: string | null
          secret?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      shared_expenses_view: {
        Row: {
          connection_id: string | null
          couple_category_name: string | null
          created_at: string | null
          created_by: string | null
          creator_share_amount: number | null
          currency: string | null
          date: string | null
          description: string | null
          exchange_rate_eur: number | null
          id: string | null
          my_share_amount: number | null
          original_tx_id: string | null
          partner_amount: number | null
          partner_share_amount: number | null
          split_mode: string | null
          split_percentage: number | null
          total_amount: number | null
          tx_deleted_at: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_expenses_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "couple_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_expenses_original_tx_id_fkey"
            columns: ["original_tx_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_couple_request: { Args: { p_request_id: string }; Returns: string }
      backfill_net_worth_for_user: {
        Args: { p_from?: string; p_user_id: string }
        Returns: undefined
      }
      compute_net_worth_at: {
        Args: { p_date: string; p_user_id: string }
        Returns: {
          cashflow: number
          net_worth: number
          portfolio_pl: number
          real_estate_discounted: number
        }[]
      }
      count_remaining_backup_codes: {
        Args: { user_id_param: string }
        Returns: number
      }
      delete_session: { Args: { p_session_id: string }; Returns: undefined }
      delete_shared_expense_by_partner: {
        Args: { p_id: string }
        Returns: undefined
      }
      disable_2fa: { Args: { user_id_param: string }; Returns: undefined }
      enable_2fa: {
        Args: {
          factor_type: string
          friendly_name: string
          secret: string
          user_id_param: string
        }
        Returns: string
      }
      find_user_by_couple_code: { Args: { p_code: string }; Returns: string }
      generate_backup_codes: {
        Args: { count?: number; user_id_param: string }
        Returns: {
          code: string
        }[]
      }
      generate_couple_code: { Args: never; Returns: string }
      get_active_sessions: {
        Args: never
        Returns: {
          created_at: string
          id: string
          ip: unknown
          session_id: string
          user_agent: string
        }[]
      }
      get_backup_code: {
        Args: { code: string; user_id_param: string }
        Returns: {
          code_hash: string
          created_at: string
          id: string
          is_used: boolean
          used_at: string
          user_id: string
        }[]
      }
      get_backup_codes: {
        Args: { user_id_param: string }
        Returns: {
          code_hash: string
          created_at: string
          id: string
          is_used: boolean
          used_at: string
          user_id: string
        }[]
      }
      get_registrations_enabled: { Args: never; Returns: boolean }
      get_user_mfa_factors: {
        Args: { user_id_param: string }
        Returns: {
          created_at: string
          factor_type: string
          friendly_name: string
          id: string
          secret: string
          status: string
          updated_at: string
          user_id: string
        }[]
      }
      insert_backup_codes: {
        Args: { codes: string[]; user_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_couple_expenses_enabled: { Args: never; Returns: boolean }
      is_in_connection: { Args: { p_connection_id: string }; Returns: boolean }
      is_in_connection_any: {
        Args: { p_connection_id: string }
        Returns: boolean
      }
      set_registrations_enabled: {
        Args: { p_enabled: boolean }
        Returns: undefined
      }
      snapshot_net_worth_all: { Args: never; Returns: undefined }
      snapshot_net_worth_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      update_shared_expense_by_partner: {
        Args: { p_couple_category_name?: string; p_id: string }
        Returns: undefined
      }
      use_backup_code: { Args: { backup_code_id: string }; Returns: undefined }
      user_has_2fa_enabled: { Args: { user_id: string }; Returns: boolean }
      verify_and_use_backup_code: {
        Args: { code_param: string; user_id_param: string }
        Returns: boolean
      }
      verify_totp_code: {
        Args: { code: string; user_id_param: string }
        Returns: boolean
      }
      write_couple_audit_log: {
        Args: {
          p_action: string
          p_connection_id: string
          p_metadata?: Json
          p_target_id?: string
        }
        Returns: undefined
      }
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
        | "IDR"
      recurring_frequency: "weekly" | "monthly" | "quarterly" | "yearly"
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
  graphql_public: {
    Enums: {},
  },
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
      currency_code: [
        "EUR",
        "USD",
        "GBP",
        "CHF",
        "JPY",
        "CAD",
        "AUD",
        "CNY",
        "IDR",
      ],
      recurring_frequency: ["weekly", "monthly", "quarterly", "yearly"],
      transaction_type: ["income", "expense"],
    },
  },
} as const
