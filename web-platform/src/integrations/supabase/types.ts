export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      inventory_items: {
        Row: {
          created_at: string | null
          current_stock: number | null
          id: string
          min_threshold: number | null
          name: string
          restaurant_id: string | null
          sku: string | null
          supplier_info: Json | null
          unit_cost: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_stock?: number | null
          id?: string
          min_threshold?: number | null
          name: string
          restaurant_id?: string | null
          sku?: string | null
          supplier_info?: Json | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_stock?: number | null
          id?: string
          min_threshold?: number | null
          name?: string
          restaurant_id?: string | null
          sku?: string | null
          supplier_info?: Json | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_ab_assignments: {
        Row: {
          assigned_at: string
          customer_id: string
          id: string
          test_id: string
          variant: string
        }
        Insert: {
          assigned_at?: string
          customer_id: string
          id?: string
          test_id: string
          variant?: string
        }
        Update: {
          assigned_at?: string
          customer_id?: string
          id?: string
          test_id?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_ab_assignments_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "loyalty_ab_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_ab_tests: {
        Row: {
          control_settings: Json
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          primary_metric: string
          program_id: string
          secondary_metrics: string[] | null
          start_date: string | null
          status: string
          test_type: string
          traffic_split: number
          updated_at: string
          variant_settings: Json
        }
        Insert: {
          control_settings?: Json
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          primary_metric?: string
          program_id: string
          secondary_metrics?: string[] | null
          start_date?: string | null
          status?: string
          test_type?: string
          traffic_split?: number
          updated_at?: string
          variant_settings?: Json
        }
        Update: {
          control_settings?: Json
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          primary_metric?: string
          program_id?: string
          secondary_metrics?: string[] | null
          start_date?: string | null
          status?: string
          test_type?: string
          traffic_split?: number
          updated_at?: string
          variant_settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_ab_tests_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_analytics: {
        Row: {
          active_members: number | null
          avg_transaction_value: number | null
          churned_members: number | null
          created_at: string
          date: string
          id: string
          new_members: number | null
          points_earned: number | null
          points_redeemed: number | null
          program_id: string
          referrals_generated: number | null
          repeat_purchase_rate: number | null
          restaurant_id: string
          rewards_claimed: number | null
          total_members: number | null
          total_revenue: number | null
          total_transactions: number | null
          updated_at: string
        }
        Insert: {
          active_members?: number | null
          avg_transaction_value?: number | null
          churned_members?: number | null
          created_at?: string
          date?: string
          id?: string
          new_members?: number | null
          points_earned?: number | null
          points_redeemed?: number | null
          program_id: string
          referrals_generated?: number | null
          repeat_purchase_rate?: number | null
          restaurant_id: string
          rewards_claimed?: number | null
          total_members?: number | null
          total_revenue?: number | null
          total_transactions?: number | null
          updated_at?: string
        }
        Update: {
          active_members?: number | null
          avg_transaction_value?: number | null
          churned_members?: number | null
          created_at?: string
          date?: string
          id?: string
          new_members?: number | null
          points_earned?: number | null
          points_redeemed?: number | null
          program_id?: string
          referrals_generated?: number | null
          repeat_purchase_rate?: number | null
          restaurant_id?: string
          rewards_claimed?: number | null
          total_members?: number | null
          total_revenue?: number | null
          total_transactions?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_analytics_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_analytics_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_customer_data: {
        Row: {
          ab_test_variants: Json | null
          created_at: string
          current_points: number | null
          customer_email: string | null
          customer_hash: string | null
          customer_phone: string | null
          id: string
          last_activity: string | null
          last_purchase: string | null
          lifetime_points: number | null
          program_id: string
          referrals_made: number | null
          restaurant_id: string
          reviews_left: number | null
          tier_level: string | null
          total_spent: number | null
          updated_at: string
          visit_count: number | null
        }
        Insert: {
          ab_test_variants?: Json | null
          created_at?: string
          current_points?: number | null
          customer_email?: string | null
          customer_hash?: string | null
          customer_phone?: string | null
          id?: string
          last_activity?: string | null
          last_purchase?: string | null
          lifetime_points?: number | null
          program_id: string
          referrals_made?: number | null
          restaurant_id: string
          reviews_left?: number | null
          tier_level?: string | null
          total_spent?: number | null
          updated_at?: string
          visit_count?: number | null
        }
        Update: {
          ab_test_variants?: Json | null
          created_at?: string
          current_points?: number | null
          customer_email?: string | null
          customer_hash?: string | null
          customer_phone?: string | null
          id?: string
          last_activity?: string | null
          last_purchase?: string | null
          lifetime_points?: number | null
          program_id?: string
          referrals_made?: number | null
          restaurant_id?: string
          reviews_left?: number | null
          tier_level?: string | null
          total_spent?: number | null
          updated_at?: string
          visit_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_customer_data_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_customer_data_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_integrations: {
        Row: {
          api_key: string | null
          created_at: string
          error_log: string | null
          id: string
          integration_type: string
          is_active: boolean | null
          last_sync: string | null
          program_id: string
          provider: string
          restaurant_id: string
          settings: Json | null
          sync_status: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          error_log?: string | null
          id?: string
          integration_type: string
          is_active?: boolean | null
          last_sync?: string | null
          program_id: string
          provider: string
          restaurant_id: string
          settings?: Json | null
          sync_status?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          created_at?: string
          error_log?: string | null
          id?: string
          integration_type?: string
          is_active?: boolean | null
          last_sync?: string | null
          program_id?: string
          provider?: string
          restaurant_id?: string
          settings?: Json | null
          sync_status?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_integrations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_integrations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_programs: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          program_type: string
          restaurant_id: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          program_type: string
          restaurant_id: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          program_type?: string
          restaurant_id?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          ab_test_id: string | null
          created_at: string
          customer_data_id: string
          id: string
          order_amount: number | null
          order_id: string | null
          points_balance: number
          points_change: number
          program_id: string
          reason: string | null
          rule_id: string | null
          transaction_type: string
          variant: string | null
        }
        Insert: {
          ab_test_id?: string | null
          created_at?: string
          customer_data_id: string
          id?: string
          order_amount?: number | null
          order_id?: string | null
          points_balance: number
          points_change: number
          program_id: string
          reason?: string | null
          rule_id?: string | null
          transaction_type: string
          variant?: string | null
        }
        Update: {
          ab_test_id?: string | null
          created_at?: string
          customer_data_id?: string
          id?: string
          order_amount?: number | null
          order_id?: string | null
          points_balance?: number
          points_change?: number
          program_id?: string
          reason?: string | null
          rule_id?: string | null
          transaction_type?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_ab_test_id_fkey"
            columns: ["ab_test_id"]
            isOneToOne: false
            referencedRelation: "loyalty_ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_customer_data_id_fkey"
            columns: ["customer_data_id"]
            isOneToOne: false
            referencedRelation: "loyalty_customer_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          restaurant_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          restaurant_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          restaurant_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_modifiers: {
        Row: {
          menu_item_id: string
          modifier_id: string
        }
        Insert: {
          menu_item_id: string
          modifier_id: string
        }
        Update: {
          menu_item_id?: string
          modifier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_modifiers_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_modifiers_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "menu_modifiers"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string[] | null
          category_id: string | null
          cost: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          is_featured: boolean | null
          name: string
          price: number
          restaurant_id: string
          sort_order: number | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          allergens?: string[] | null
          category_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_featured?: boolean | null
          name: string
          price: number
          restaurant_id: string
          sort_order?: number | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          allergens?: string[] | null
          category_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_featured?: boolean | null
          name?: string
          price?: number
          restaurant_id?: string
          sort_order?: number | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_modifiers: {
        Row: {
          created_at: string
          id: string
          is_required: boolean | null
          max_selections: number | null
          name: string
          restaurant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean | null
          max_selections?: number | null
          name: string
          restaurant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean | null
          max_selections?: number | null
          name?: string
          restaurant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_modifiers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_options: {
        Row: {
          created_at: string
          id: string
          is_available: boolean | null
          modifier_id: string
          name: string
          price_adjustment: number | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean | null
          modifier_id: string
          name: string
          price_adjustment?: number | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean | null
          modifier_id?: string
          name?: string
          price_adjustment?: number | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "modifier_options_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "menu_modifiers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
          modifiers: Json | null
          order_id: string
          quantity: number
          special_instructions: string | null
          status: string
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
          modifiers?: Json | null
          order_id: string
          quantity?: number
          special_instructions?: string | null
          status?: string
          total_price: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
          modifiers?: Json | null
          order_id?: string
          quantity?: number
          special_instructions?: string | null
          status?: string
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          completed_at: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          estimated_ready_time: string | null
          id: string
          notes: string | null
          order_number: string
          order_type: string
          restaurant_id: string
          service_charge: number
          special_instructions: string | null
          status: string
          subtotal: number
          table_id: string | null
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          estimated_ready_time?: string | null
          id?: string
          notes?: string | null
          order_number: string
          order_type?: string
          restaurant_id: string
          service_charge?: number
          special_instructions?: string | null
          status?: string
          subtotal?: number
          table_id?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          estimated_ready_time?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          order_type?: string
          restaurant_id?: string
          service_charge?: number
          special_instructions?: string | null
          status?: string
          subtotal?: number
          table_id?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          metadata: Json | null
          order_id: string
          payment_method: string
          payment_status: string
          processed_at: string | null
          provider_reference: string | null
          restaurant_id: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          metadata?: Json | null
          order_id: string
          payment_method: string
          payment_status?: string
          processed_at?: string | null
          provider_reference?: string | null
          restaurant_id: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          order_id?: string
          payment_method?: string
          payment_status?: string
          processed_at?: string | null
          provider_reference?: string | null
          restaurant_id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      qr_campaign_usage: {
        Row: {
          campaign_id: string
          claimed_at: string
          customer_data_id: string
          id: string
          metadata: Json | null
          points_awarded: number | null
          reward_claimed: Json | null
        }
        Insert: {
          campaign_id: string
          claimed_at?: string
          customer_data_id: string
          id?: string
          metadata?: Json | null
          points_awarded?: number | null
          reward_claimed?: Json | null
        }
        Update: {
          campaign_id?: string
          claimed_at?: string
          customer_data_id?: string
          id?: string
          metadata?: Json | null
          points_awarded?: number | null
          reward_claimed?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_campaign_usage_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "qr_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_campaign_usage_customer_data_id_fkey"
            columns: ["customer_data_id"]
            isOneToOne: false
            referencedRelation: "loyalty_customer_data"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_campaigns: {
        Row: {
          campaign_type: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          name: string
          program_id: string
          qr_data: Json
          restaurant_id: string
          reward_settings: Json
          starts_at: string | null
          updated_at: string
          usage_limits: Json | null
        }
        Insert: {
          campaign_type?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          program_id: string
          qr_data?: Json
          restaurant_id: string
          reward_settings?: Json
          starts_at?: string | null
          updated_at?: string
          usage_limits?: Json | null
        }
        Update: {
          campaign_type?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          program_id?: string
          qr_data?: Json
          restaurant_id?: string
          reward_settings?: Json
          starts_at?: string | null
          updated_at?: string
          usage_limits?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_campaigns_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_campaigns_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_analytics: {
        Row: {
          avg_order_value: number | null
          created_at: string | null
          date: string
          id: string
          order_count: number | null
          peak_hours: Json | null
          popular_items: Json | null
          restaurant_id: string | null
          total_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          avg_order_value?: number | null
          created_at?: string | null
          date: string
          id?: string
          order_count?: number | null
          peak_hours?: Json | null
          popular_items?: Json | null
          restaurant_id?: string | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_order_value?: number | null
          created_at?: string | null
          date?: string
          id?: string
          order_count?: number | null
          peak_hours?: Json | null
          popular_items?: Json | null
          restaurant_id?: string | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_analytics_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_bank_details: {
        Row: {
          account_holder_name: string | null
          account_number: string | null
          bank_name: string | null
          created_at: string
          iban: string | null
          id: string
          restaurant_id: string
          sort_code: string | null
          swift_code: string | null
          updated_at: string
        }
        Insert: {
          account_holder_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          restaurant_id: string
          sort_code?: string | null
          swift_code?: string | null
          updated_at?: string
        }
        Update: {
          account_holder_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          restaurant_id?: string
          sort_code?: string | null
          swift_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_bank_details_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_customers: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          loyalty_points: number | null
          name: string | null
          order_history: Json | null
          phone: string | null
          preferences: Json | null
          restaurant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          loyalty_points?: number | null
          name?: string | null
          order_history?: Json | null
          phone?: string | null
          preferences?: Json | null
          restaurant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          loyalty_points?: number | null
          name?: string | null
          order_history?: Json | null
          phone?: string | null
          preferences?: Json | null
          restaurant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings: {
        Row: {
          auto_accept_orders: boolean | null
          business_days: Json | null
          created_at: string
          id: string
          opening_hours: Json | null
          payment_methods: Json | null
          restaurant_id: string
          service_charge: number | null
          tax_rate: number | null
          updated_at: string
        }
        Insert: {
          auto_accept_orders?: boolean | null
          business_days?: Json | null
          created_at?: string
          id?: string
          opening_hours?: Json | null
          payment_methods?: Json | null
          restaurant_id: string
          service_charge?: number | null
          tax_rate?: number | null
          updated_at?: string
        }
        Update: {
          auto_accept_orders?: boolean | null
          business_days?: Json | null
          created_at?: string
          id?: string
          opening_hours?: Json | null
          payment_methods?: Json | null
          restaurant_id?: string
          service_charge?: number | null
          tax_rate?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          capacity: number
          created_at: string
          id: string
          is_active: boolean | null
          position_x: number | null
          position_y: number | null
          qr_code_url: string | null
          restaurant_id: string
          section: string | null
          table_number: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean | null
          position_x?: number | null
          position_y?: number | null
          qr_code_url?: string | null
          restaurant_id: string
          section?: string | null
          table_number: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean | null
          position_x?: number | null
          position_y?: number | null
          qr_code_url?: string | null
          restaurant_id?: string
          section?: string | null
          table_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          created_at: string
          currency: string | null
          description: string | null
          email: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          slug: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          slug: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          slug?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invitation_token: string | null
          invited_by: string
          restaurant_id: string
          role: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invitation_token?: string | null
          invited_by: string
          restaurant_id: string
          role?: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invitation_token?: string | null
          invited_by?: string
          restaurant_id?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          can_manage_loyalty: boolean | null
          can_manage_menu: boolean | null
          can_manage_orders: boolean | null
          can_manage_staff: boolean | null
          can_view_analytics: boolean | null
          created_at: string
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          permissions: Json | null
          restaurant_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_manage_loyalty?: boolean | null
          can_manage_menu?: boolean | null
          can_manage_orders?: boolean | null
          can_manage_staff?: boolean | null
          can_view_analytics?: boolean | null
          created_at?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          permissions?: Json | null
          restaurant_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_manage_loyalty?: boolean | null
          can_manage_menu?: boolean | null
          can_manage_orders?: boolean | null
          can_manage_staff?: boolean | null
          can_view_analytics?: boolean | null
          created_at?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          permissions?: Json | null
          restaurant_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedules: {
        Row: {
          created_at: string | null
          end_time: string
          id: string
          notes: string | null
          restaurant_id: string
          role_assigned: string | null
          shift_date: string
          staff_member_id: string
          start_time: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_time: string
          id?: string
          notes?: string | null
          restaurant_id: string
          role_assigned?: string | null
          shift_date: string
          staff_member_id: string
          start_time: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          restaurant_id?: string
          role_assigned?: string | null
          shift_date?: string
          staff_member_id?: string
          start_time?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_schedules_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_restaurants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          restaurant_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          restaurant_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          restaurant_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          enabled_features: string[] | null
          id: string
          is_platform_owner: boolean | null
          subscription_plan: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          enabled_features?: string[] | null
          id?: string
          is_platform_owner?: boolean | null
          subscription_plan?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          enabled_features?: string[] | null
          id?: string
          is_platform_owner?: boolean | null
          subscription_plan?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_restaurant_id: {
        Args: { _user_id: string }
        Returns: string
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      user_has_feature: {
        Args: { _user_id: string; _feature_key: string }
        Returns: boolean
      }
      user_has_restaurant_access: {
        Args: { _user_id: string; _restaurant_id: string }
        Returns: boolean
      }
      user_has_subscription_level: {
        Args: { _user_id: string; _required_level: string }
        Returns: boolean
      }
      user_owns_restaurant: {
        Args: { _user_id: string; _restaurant_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "customer"
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
      app_role: ["admin", "customer"],
    },
  },
} as const
