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
      broadcast_notifications: {
        Row: {
          contents: Json
          created_at: string
          data: Json | null
          headings: Json
          id: string
          recipient_count: number
          sent_by: string | null
        }
        Insert: {
          contents: Json
          created_at?: string
          data?: Json | null
          headings: Json
          id?: string
          recipient_count?: number
          sent_by?: string | null
        }
        Update: {
          contents?: Json
          created_at?: string
          data?: Json | null
          headings?: Json
          id?: string
          recipient_count?: number
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_notifications_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      iz8wnh_points_to_sync: {
        Row: {
          area: string
          id: number
          lat: number
          lon: number
          radius_km: number
          station_id: string
        }
        Insert: {
          area: string
          id?: number
          lat: number
          lon: number
          radius_km?: number
          station_id: string
        }
        Update: {
          area?: string
          id?: number
          lat?: number
          lon?: number
          radius_km?: number
          station_id?: string
        }
        Relationships: []
      }
      networks: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["network_kind"]
          name: string
          notes: string | null
          parent_network_id: string | null
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["network_kind"]
          name: string
          notes?: string | null
          parent_network_id?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["network_kind"]
          name?: string
          notes?: string | null
          parent_network_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "networks_parent_network_id_fkey"
            columns: ["parent_network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      params: {
        Row: {
          created_at: string
          id: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          callsign: string | null
          cluster_notifications_enabled: boolean
          created_at: string
          deleted_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
          last_seen_version: string | null
          propic: string | null
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type"] | null
        }
        Insert: {
          callsign?: string | null
          cluster_notifications_enabled?: boolean
          created_at?: string
          deleted_at?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          last_seen_version?: string | null
          propic?: string | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"] | null
        }
        Update: {
          callsign?: string | null
          cluster_notifications_enabled?: boolean
          created_at?: string
          deleted_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_seen_version?: string | null
          propic?: string | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"] | null
        }
        Relationships: []
      }
      repeater_access: {
        Row: {
          color_code: number | null
          created_at: string
          ctcss_rx_hz: number | null
          ctcss_tx_hz: number | null
          dcs_code: number | null
          dg_id: number | null
          external_id: string | null
          id: string
          last_seen_at: string | null
          mode: Database["public"]["Enums"]["access_mode"]
          network_id: string | null
          node_id: number | null
          notes: string | null
          repeater_id: string
          source: string
          talkgroup: number | null
          updated_at: string
        }
        Insert: {
          color_code?: number | null
          created_at?: string
          ctcss_rx_hz?: number | null
          ctcss_tx_hz?: number | null
          dcs_code?: number | null
          dg_id?: number | null
          external_id?: string | null
          id?: string
          last_seen_at?: string | null
          mode: Database["public"]["Enums"]["access_mode"]
          network_id?: string | null
          node_id?: number | null
          notes?: string | null
          repeater_id: string
          source?: string
          talkgroup?: number | null
          updated_at?: string
        }
        Update: {
          color_code?: number | null
          created_at?: string
          ctcss_rx_hz?: number | null
          ctcss_tx_hz?: number | null
          dcs_code?: number | null
          dg_id?: number | null
          external_id?: string | null
          id?: string
          last_seen_at?: string | null
          mode?: Database["public"]["Enums"]["access_mode"]
          network_id?: string | null
          node_id?: number | null
          notes?: string | null
          repeater_id?: string
          source?: string
          talkgroup?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repeater_access_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repeater_access_repeater_id_fkey"
            columns: ["repeater_id"]
            isOneToOne: false
            referencedRelation: "repeaters"
            referencedColumns: ["id"]
          },
        ]
      }
      repeater_feedback: {
        Row: {
          comment: string
          created_at: string
          geom: unknown
          id: string
          lat: number
          lon: number
          repeater_access_id: string
          repeater_id: string
          station: Database["public"]["Enums"]["station_kind"]
          type: Database["public"]["Enums"]["feedback_type"]
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          geom?: unknown
          id?: string
          lat: number
          lon: number
          repeater_access_id: string
          repeater_id: string
          station: Database["public"]["Enums"]["station_kind"]
          type: Database["public"]["Enums"]["feedback_type"]
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          geom?: unknown
          id?: string
          lat?: number
          lon?: number
          repeater_access_id?: string
          repeater_id?: string
          station?: Database["public"]["Enums"]["station_kind"]
          type?: Database["public"]["Enums"]["feedback_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repeater_feedback_repeater_access_id_fkey"
            columns: ["repeater_access_id"]
            isOneToOne: false
            referencedRelation: "repeater_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repeater_feedback_repeater_id_fkey"
            columns: ["repeater_id"]
            isOneToOne: false
            referencedRelation: "repeaters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repeater_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      repeater_reports: {
        Row: {
          closed_by: string | null
          coordinator_response: string | null
          created_at: string
          description: string
          id: string
          repeater_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_by?: string | null
          coordinator_response?: string | null
          created_at?: string
          description: string
          id?: string
          repeater_id: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_by?: string | null
          coordinator_response?: string | null
          created_at?: string
          description?: string
          id?: string
          repeater_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repeater_reports_closed_by_profile_fk"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repeater_reports_profile_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repeater_reports_repeater_id_fkey"
            columns: ["repeater_id"]
            isOneToOne: false
            referencedRelation: "repeaters"
            referencedColumns: ["id"]
          },
        ]
      }
      repeater_spots: {
        Row: {
          access_id: string | null
          callsign_snapshot: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          duration_minutes: number | null
          expires_at: string | null
          id: string
          repeater_id: string
          spotted_callsign: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          access_id?: string | null
          callsign_snapshot: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          duration_minutes?: number | null
          expires_at?: string | null
          id?: string
          repeater_id: string
          spotted_callsign?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          access_id?: string | null
          callsign_snapshot?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          duration_minutes?: number | null
          expires_at?: string | null
          id?: string
          repeater_id?: string
          spotted_callsign?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repeater_spots_access_repeater_fkey"
            columns: ["access_id", "repeater_id"]
            isOneToOne: false
            referencedRelation: "repeater_access"
            referencedColumns: ["id", "repeater_id"]
          },
          {
            foreignKeyName: "repeater_spots_repeater_id_fkey"
            columns: ["repeater_id"]
            isOneToOne: false
            referencedRelation: "repeaters"
            referencedColumns: ["id"]
          },
        ]
      }
      repeater_submissions: {
        Row: {
          accesses: Json
          callsign: string | null
          created_at: string
          frequency_hz: number
          id: string
          lat: number | null
          locality: string | null
          locator: string | null
          lon: number | null
          name: string | null
          notes: string | null
          province_code: string | null
          region: string | null
          shift_hz: number | null
          status: Database["public"]["Enums"]["submission_status"]
          user_id: string
        }
        Insert: {
          accesses?: Json
          callsign?: string | null
          created_at?: string
          frequency_hz: number
          id?: string
          lat?: number | null
          locality?: string | null
          locator?: string | null
          lon?: number | null
          name?: string | null
          notes?: string | null
          province_code?: string | null
          region?: string | null
          shift_hz?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          user_id: string
        }
        Update: {
          accesses?: Json
          callsign?: string | null
          created_at?: string
          frequency_hz?: number
          id?: string
          lat?: number | null
          locality?: string | null
          locator?: string | null
          lon?: number | null
          name?: string | null
          notes?: string | null
          province_code?: string | null
          region?: string | null
          shift_hz?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repeater_submissions_user_id_profile_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      repeaters: {
        Row: {
          callsign: string | null
          created_at: string
          external_id: string | null
          frequency_hz: number
          geom: unknown
          id: string
          is_active: boolean
          last_seen_at: string | null
          lat: number | null
          locality: string | null
          locator: string | null
          lon: number | null
          manager: string | null
          name: string | null
          province_code: string | null
          region: string | null
          shift_hz: number | null
          shift_raw: string | null
          source: string
          updated_at: string
        }
        Insert: {
          callsign?: string | null
          created_at?: string
          external_id?: string | null
          frequency_hz: number
          geom?: unknown
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          lat?: number | null
          locality?: string | null
          locator?: string | null
          lon?: number | null
          manager?: string | null
          name?: string | null
          province_code?: string | null
          region?: string | null
          shift_hz?: number | null
          shift_raw?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          callsign?: string | null
          created_at?: string
          external_id?: string | null
          frequency_hz?: number
          geom?: unknown
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          lat?: number | null
          locality?: string | null
          locator?: string | null
          lon?: number | null
          manager?: string | null
          name?: string | null
          province_code?: string | null
          region?: string | null
          shift_hz?: number | null
          shift_raw?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      sync_pending_changes: {
        Row: {
          change_type: string
          created_at: string
          diff: Json
          external_id: string
          id: string
          local_updated_at: string | null
          remote_data: Json
          remote_updated_at: string | null
          repeater_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_winner: string
        }
        Insert: {
          change_type: string
          created_at?: string
          diff?: Json
          external_id: string
          id?: string
          local_updated_at?: string | null
          remote_data: Json
          remote_updated_at?: string | null
          repeater_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_winner?: string
        }
        Update: {
          change_type?: string
          created_at?: string
          diff?: Json
          external_id?: string
          id?: string
          local_updated_at?: string | null
          remote_data?: Json
          remote_updated_at?: string | null
          repeater_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_winner?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_pending_changes_repeater_id_fkey"
            columns: ["repeater_id"]
            isOneToOne: false
            referencedRelation: "repeaters"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          access_processed: number
          completed_at: string | null
          created_at: string
          dry_run: boolean
          fetch_errors: number
          id: string
          processed_messages: number
          repeaters_processed: number
          started_at: string
          status: string
          sync_errors: number
          total_messages: number
        }
        Insert: {
          access_processed?: number
          completed_at?: string | null
          created_at?: string
          dry_run?: boolean
          fetch_errors?: number
          id?: string
          processed_messages?: number
          repeaters_processed?: number
          started_at?: string
          status?: string
          sync_errors?: number
          total_messages?: number
        }
        Update: {
          access_processed?: number
          completed_at?: string | null
          created_at?: string
          dry_run?: boolean
          fetch_errors?: number
          id?: string
          processed_messages?: number
          repeaters_processed?: number
          started_at?: string
          status?: string
          sync_errors?: number
          total_messages?: number
        }
        Relationships: []
      }
      user_favorite_repeaters: {
        Row: {
          cluster_notifications_enabled: boolean
          created_at: string
          id: string
          repeater_id: string
          user_id: string
        }
        Insert: {
          cluster_notifications_enabled?: boolean
          created_at?: string
          id?: string
          repeater_id: string
          user_id: string
        }
        Update: {
          cluster_notifications_enabled?: boolean
          created_at?: string
          id?: string
          repeater_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorite_repeaters_repeater_id_fkey"
            columns: ["repeater_id"]
            isOneToOne: false
            referencedRelation: "repeaters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          contents: Json
          created_at: string
          data: Json | null
          headings: Json
          id: string
          user_id: string
        }
        Insert: {
          contents: Json
          created_at?: string
          data?: Json | null
          headings: Json
          id?: string
          user_id: string
        }
        Update: {
          contents?: Json
          created_at?: string
          data?: Json | null
          headings?: Json
          id?: string
          user_id?: string
        }
        Relationships: []
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
    }
    Views: {
      v_repeater_feedback_stats: {
        Row: {
          down_total: number | null
          last_down_at: string | null
          last_like_at: string | null
          likes_total: number | null
          repeater_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repeater_feedback_repeater_id_fkey"
            columns: ["repeater_id"]
            isOneToOne: false
            referencedRelation: "repeaters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _create_spot_atomic:
        | {
            Args: {
              p_access_id: string
              p_callsign_snapshot: string
              p_duration_minutes: number
              p_repeater_id: string
              p_user_id: string
            }
            Returns: {
              access_id: string | null
              callsign_snapshot: string
              closed_at: string | null
              closed_by: string | null
              created_at: string
              duration_minutes: number | null
              expires_at: string | null
              id: string
              repeater_id: string
              spotted_callsign: string | null
              started_at: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "repeater_spots"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_access_id: string
              p_callsign_snapshot: string
              p_duration_minutes: number
              p_repeater_id: string
              p_spotted_callsign?: string
              p_user_id: string
            }
            Returns: {
              access_id: string | null
              callsign_snapshot: string
              closed_at: string | null
              closed_by: string | null
              created_at: string
              duration_minutes: number | null
              expires_at: string | null
              id: string
              repeater_id: string
              spotted_callsign: string | null
              started_at: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "repeater_spots"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      authorize: {
        Args: {
          requested_permission: Database["public"]["Enums"]["app_permission"]
        }
        Returns: boolean
      }
      cron_fetch_iz8wnh_updates: { Args: never; Returns: undefined }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      increment_sync_run_stats: {
        Args: {
          p_access_processed?: number
          p_fetch_errors?: number
          p_repeaters_processed?: number
          p_run_id: string
          p_sync_errors?: number
        }
        Returns: undefined
      }
      maidenhead_to_point: { Args: { loc: string }; Returns: unknown }
      parse_shift_hz: { Args: { shift_text: string }; Returns: number }
      queue_delete: {
        Args: { p_msg_id: number; p_queue_name: string }
        Returns: boolean
      }
      queue_read: {
        Args: { p_qty: number; p_queue_name: string; p_vt: number }
        Returns: {
          enqueued_at: string
          message: Json
          msg_id: number
          read_ct: number
          vt: string
        }[]
      }
      queue_send_batch: {
        Args: { p_msgs: Json[]; p_queue_name: string }
        Returns: number[]
      }
      repeaters_in_bounds: {
        Args: {
          p_access_modes?: string[]
          p_lat1: number
          p_lat2: number
          p_lon1: number
          p_lon2: number
        }
        Returns: {
          accesses: Json
          repeater: Database["public"]["Tables"]["repeaters"]["Row"]
        }[]
      }
      repeaters_nearby: {
        Args: {
          p_access_modes?: string[]
          p_lat: number
          p_limit?: number
          p_lon: number
          p_radius_km?: number
        }
        Returns: {
          accesses: Json
          distance_m: number
          repeater: Database["public"]["Tables"]["repeaters"]["Row"]
        }[]
      }
      search_repeaters: {
        Args: {
          p_access_modes?: string[]
          p_freq_max_hz?: number
          p_freq_min_hz?: number
          p_include_inactive?: boolean
          p_lat?: number
          p_limit?: number
          p_lon?: number
          p_query: string
        }
        Returns: {
          accesses: Json
          distance_m: number
          rank: number
          repeater: Database["public"]["Tables"]["repeaters"]["Row"]
        }[]
      }
      try_parse_ctcss: { Args: { t: string }; Returns: number }
    }
    Enums: {
      access_mode:
        | "ANALOG"
        | "DMR"
        | "C4FM"
        | "DSTAR"
        | "ECHOLINK"
        | "SVX"
        | "APRS"
        | "BEACON"
        | "ATV"
        | "NXDN"
        | "ALLSTAR"
        | "WINLINK"
      app_permission:
        | "repeaters.write"
        | "repeaters.delete"
        | "networks.write"
        | "networks.delete"
        | "reports.manage"
        | "users.manage"
        | "sync.trigger"
        | "sync.review"
      app_role: "admin" | "viewer" | "bridge_manager" | "report_manager"
      feedback_type: "like" | "down"
      network_kind: "dmr" | "c4fm" | "dstar" | "voip" | "mixed" | "other"
      report_status: "pending" | "reviewed" | "resolved" | "rejected"
      station_kind: "portable" | "mobile" | "fixed"
      submission_status: "pending" | "approved" | "rejected"
      user_type: "swl" | "licensed"
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
      access_mode: [
        "ANALOG",
        "DMR",
        "C4FM",
        "DSTAR",
        "ECHOLINK",
        "SVX",
        "APRS",
        "BEACON",
        "ATV",
        "NXDN",
        "ALLSTAR",
        "WINLINK",
      ],
      app_permission: [
        "repeaters.write",
        "repeaters.delete",
        "networks.write",
        "networks.delete",
        "reports.manage",
        "users.manage",
        "sync.trigger",
        "sync.review",
      ],
      app_role: ["admin", "viewer", "bridge_manager", "report_manager"],
      feedback_type: ["like", "down"],
      network_kind: ["dmr", "c4fm", "dstar", "voip", "mixed", "other"],
      report_status: ["pending", "reviewed", "resolved", "rejected"],
      station_kind: ["portable", "mobile", "fixed"],
      submission_status: ["pending", "approved", "rejected"],
      user_type: ["swl", "licensed"],
    },
  },
} as const
