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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          reason: string | null
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          admin_notes: string | null
          claimant_user_id: string
          created_at: string
          developer_profile_id: string | null
          evidence: string | null
          id: string
          message: string | null
          plugin_id: string
          proof_url: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["claim_status"]
        }
        Insert: {
          admin_notes?: string | null
          claimant_user_id: string
          created_at?: string
          developer_profile_id?: string | null
          evidence?: string | null
          id?: string
          message?: string | null
          plugin_id: string
          proof_url?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
        }
        Update: {
          admin_notes?: string | null
          claimant_user_id?: string
          created_at?: string
          developer_profile_id?: string | null
          evidence?: string | null
          id?: string
          message?: string | null
          plugin_id?: string
          proof_url?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
        }
        Relationships: [
          {
            foreignKeyName: "claims_developer_profile_id_fkey"
            columns: ["developer_profile_id"]
            isOneToOne: false
            referencedRelation: "developer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_plugins: {
        Row: {
          collection_id: string
          created_at: string
          plugin_id: string
          sort_order: number
        }
        Insert: {
          collection_id: string
          created_at?: string
          plugin_id: string
          sort_order?: number
        }
        Update: {
          collection_id?: string
          created_at?: string
          plugin_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_plugins_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_plugins_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      developer_balances: {
        Row: {
          available_balance: number
          currency: string
          developer_id: string
          gross_revenue: number
          paid_out: number
          pending_balance: number
          platform_fees: number
          refunds: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          currency?: string
          developer_id: string
          gross_revenue?: number
          paid_out?: number
          pending_balance?: number
          platform_fees?: number
          refunds?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          currency?: string
          developer_id?: string
          gross_revenue?: number
          paid_out?: number
          pending_balance?: number
          platform_fees?: number
          refunds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_balances_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: true
            referencedRelation: "developer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_members: {
        Row: {
          created_at: string
          developer_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          developer_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          developer_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_members_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["developer_account_type"]
          avatar_url: string | null
          created_at: string
          description: string | null
          github_url: string | null
          id: string
          is_public: boolean
          name: string
          owner_id: string
          slug: string
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_payouts_enabled: boolean
          twitter_url: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["developer_account_type"]
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          github_url?: string | null
          id?: string
          is_public?: boolean
          name: string
          owner_id: string
          slug: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["developer_account_type"]
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          github_url?: string | null
          id?: string
          is_public?: boolean
          name?: string
          owner_id?: string
          slug?: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          plugin_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          plugin_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          plugin_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          developer_id: string
          id: string
          notes: string | null
          processed_at: string | null
          requested_at: string
          status: Database["public"]["Enums"]["payout_status"]
          stripe_payout_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          developer_id: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          stripe_payout_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          developer_id?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          stripe_payout_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platforms: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      plugin_analytics_events: {
        Row: {
          created_at: string
          developer_id: string | null
          event_type: Database["public"]["Enums"]["analytics_event_type"]
          id: string
          plugin_id: string
          referrer: string | null
          session_hash: string | null
        }
        Insert: {
          created_at?: string
          developer_id?: string | null
          event_type: Database["public"]["Enums"]["analytics_event_type"]
          id?: string
          plugin_id: string
          referrer?: string | null
          session_hash?: string | null
        }
        Update: {
          created_at?: string
          developer_id?: string | null
          event_type?: Database["public"]["Enums"]["analytics_event_type"]
          id?: string
          plugin_id?: string
          referrer?: string | null
          session_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plugin_analytics_events_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plugin_analytics_events_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      plugin_assets: {
        Row: {
          alt_text: string | null
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at: string
          id: string
          plugin_id: string
          public_url: string | null
          sort_order: number
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          id?: string
          plugin_id: string
          public_url?: string | null
          sort_order?: number
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          id?: string
          plugin_id?: string
          public_url?: string | null
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "plugin_assets_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      plugin_categories: {
        Row: {
          category_id: string
          plugin_id: string
        }
        Insert: {
          category_id: string
          plugin_id: string
        }
        Update: {
          category_id?: string
          plugin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plugin_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plugin_categories_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      plugin_change_requests: {
        Row: {
          admin_notes: string | null
          changed_fields: Json
          created_at: string
          id: string
          plugin_id: string
          requested_by: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["change_request_status"]
        }
        Insert: {
          admin_notes?: string | null
          changed_fields?: Json
          created_at?: string
          id?: string
          plugin_id: string
          requested_by?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
        }
        Update: {
          admin_notes?: string | null
          changed_fields?: Json
          created_at?: string
          id?: string
          plugin_id?: string
          requested_by?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "plugin_change_requests_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      plugin_tags: {
        Row: {
          plugin_id: string
          tag_id: string
        }
        Insert: {
          plugin_id: string
          tag_id: string
        }
        Update: {
          plugin_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plugin_tags_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plugin_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      plugin_versions: {
        Row: {
          changelog: string | null
          compatibility: string | null
          created_at: string
          file_path: string | null
          file_size: number | null
          id: string
          is_current: boolean
          plugin_id: string
          release_notes: string | null
          released_at: string | null
          status: Database["public"]["Enums"]["version_status"]
          updated_at: string
          version_number: string
        }
        Insert: {
          changelog?: string | null
          compatibility?: string | null
          created_at?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_current?: boolean
          plugin_id: string
          release_notes?: string | null
          released_at?: string | null
          status?: Database["public"]["Enums"]["version_status"]
          updated_at?: string
          version_number: string
        }
        Update: {
          changelog?: string | null
          compatibility?: string | null
          created_at?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_current?: boolean
          plugin_id?: string
          release_notes?: string | null
          released_at?: string | null
          status?: Database["public"]["Enums"]["version_status"]
          updated_at?: string
          version_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "plugin_versions_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      plugins: {
        Row: {
          compatibility: string | null
          created_at: string
          currency: string
          current_version: string | null
          developer_id: string | null
          downloads_count: number
          external_purchase_url: string | null
          favorites_count: number
          full_description: string | null
          github_url: string | null
          id: string
          is_claimable: boolean
          is_open_source: boolean
          license: string | null
          listing_type: Database["public"]["Enums"]["listing_type"]
          logo_url: string | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          name: string
          platform_id: string
          price: number
          pricing_model: Database["public"]["Enums"]["pricing_model"]
          published_at: string | null
          purchases_count: number
          rating_average: number
          rejection_reason: string | null
          reviews_count: number
          search_vector: unknown
          short_description: string
          slug: string
          updated_at: string
          video_url: string | null
          views_count: number
          website_url: string | null
          wishlist_count: number
        }
        Insert: {
          compatibility?: string | null
          created_at?: string
          currency?: string
          current_version?: string | null
          developer_id?: string | null
          downloads_count?: number
          external_purchase_url?: string | null
          favorites_count?: number
          full_description?: string | null
          github_url?: string | null
          id?: string
          is_claimable?: boolean
          is_open_source?: boolean
          license?: string | null
          listing_type?: Database["public"]["Enums"]["listing_type"]
          logo_url?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          name: string
          platform_id: string
          price?: number
          pricing_model?: Database["public"]["Enums"]["pricing_model"]
          published_at?: string | null
          purchases_count?: number
          rating_average?: number
          rejection_reason?: string | null
          reviews_count?: number
          search_vector?: unknown
          short_description: string
          slug: string
          updated_at?: string
          video_url?: string | null
          views_count?: number
          website_url?: string | null
          wishlist_count?: number
        }
        Update: {
          compatibility?: string | null
          created_at?: string
          currency?: string
          current_version?: string | null
          developer_id?: string | null
          downloads_count?: number
          external_purchase_url?: string | null
          favorites_count?: number
          full_description?: string | null
          github_url?: string | null
          id?: string
          is_claimable?: boolean
          is_open_source?: boolean
          license?: string | null
          listing_type?: Database["public"]["Enums"]["listing_type"]
          logo_url?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          name?: string
          platform_id?: string
          price?: number
          pricing_model?: Database["public"]["Enums"]["pricing_model"]
          published_at?: string | null
          purchases_count?: number
          rating_average?: number
          rejection_reason?: string | null
          reviews_count?: number
          search_vector?: unknown
          short_description?: string
          slug?: string
          updated_at?: string
          video_url?: string | null
          views_count?: number
          website_url?: string | null
          wishlist_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "plugins_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plugins_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          created_at: string
          currency: string
          developer_id: string | null
          id: string
          plugin_id: string
          purchased_at: string | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          developer_id?: string | null
          id?: string
          plugin_id: string
          purchased_at?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          developer_id?: string | null
          id?: string
          plugin_id?: string
          purchased_at?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          details: string | null
          id: string
          plugin_id: string | null
          reason: string
          reporter_user_id: string | null
          review_id: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          plugin_id?: string | null
          reason: string
          reporter_user_id?: string | null
          review_id?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          plugin_id?: string | null
          reason?: string
          reporter_user_id?: string | null
          review_id?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_type?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          plugin_id: string
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          title: string | null
          updated_at: string
          user_id: string
          verified_purchase: boolean
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          plugin_id: string
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          user_id: string
          verified_purchase?: boolean
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          plugin_id?: string
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
          verified_purchase?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          developer_id: string | null
          id: string
          purchase_id: string | null
          stripe_reference: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          developer_id?: string | null
          id?: string
          purchase_id?: string | null
          stripe_reference?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          developer_id?: string | null
          id?: string
          purchase_id?: string | null
          stripe_reference?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          plugin_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          plugin_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          plugin_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_dashboard_metrics: { Args: { _actor_id: string }; Returns: Json }
      admin_delete_catalog_item: {
        Args: { _actor_id: string; _id: string; _kind: string }
        Returns: string
      }
      admin_moderate_plugin: {
        Args: {
          _actor_id: string
          _plugin_id: string
          _reason?: string
          _status: Database["public"]["Enums"]["moderation_status"]
        }
        Returns: Json
      }
      admin_save_catalog_item: {
        Args: {
          _active?: boolean
          _actor_id: string
          _description?: string
          _id: string
          _kind: string
          _name: string
          _slug: string
          _sort_order?: number
        }
        Returns: Json
      }
      admin_update_workflow: {
        Args: {
          _actor_id: string
          _item_id: string
          _kind: string
          _notes?: string
          _status: string
        }
        Returns: Json
      }
    }
    Enums: {
      analytics_event_type:
        | "page_view"
        | "outbound_click"
        | "download"
        | "purchase"
        | "favorite"
        | "wishlist_add"
      app_role: "user" | "developer" | "admin"
      asset_type: "logo" | "screenshot" | "banner"
      change_request_status: "pending" | "approved" | "rejected"
      claim_status: "pending" | "approved" | "rejected"
      developer_account_type: "individual" | "company" | "organization"
      listing_type: "direct_sale" | "external_listing"
      moderation_status:
        | "draft"
        | "pending_review"
        | "approved"
        | "rejected"
        | "suspended"
      payout_status:
        | "requested"
        | "processing"
        | "paid"
        | "failed"
        | "cancelled"
      pricing_model: "free" | "paid" | "freemium"
      purchase_status:
        | "pending"
        | "paid"
        | "refunded"
        | "partially_refunded"
        | "failed"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      report_target: "plugin" | "review"
      review_status: "active" | "hidden" | "removed"
      transaction_type:
        | "sale"
        | "platform_fee"
        | "refund"
        | "payout"
        | "adjustment"
      version_status: "draft" | "pending_review" | "published" | "archived"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      analytics_event_type: [
        "page_view",
        "outbound_click",
        "download",
        "purchase",
        "favorite",
        "wishlist_add",
      ],
      app_role: ["user", "developer", "admin"],
      asset_type: ["logo", "screenshot", "banner"],
      change_request_status: ["pending", "approved", "rejected"],
      claim_status: ["pending", "approved", "rejected"],
      developer_account_type: ["individual", "company", "organization"],
      listing_type: ["direct_sale", "external_listing"],
      moderation_status: [
        "draft",
        "pending_review",
        "approved",
        "rejected",
        "suspended",
      ],
      payout_status: ["requested", "processing", "paid", "failed", "cancelled"],
      pricing_model: ["free", "paid", "freemium"],
      purchase_status: [
        "pending",
        "paid",
        "refunded",
        "partially_refunded",
        "failed",
      ],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      report_target: ["plugin", "review"],
      review_status: ["active", "hidden", "removed"],
      transaction_type: [
        "sale",
        "platform_fee",
        "refund",
        "payout",
        "adjustment",
      ],
      version_status: ["draft", "pending_review", "published", "archived"],
    },
  },
} as const
