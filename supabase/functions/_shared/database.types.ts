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
          created_at: string
          deleted_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
          propic: string | null
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type"] | null
        }
        Insert: {
          callsign?: string | null
          created_at?: string
          deleted_at?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          propic?: string | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"] | null
        }
        Update: {
          callsign?: string | null
          created_at?: string
          deleted_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
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
          created_at: string
          description: string
          id: string
          repeater_id: string
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          repeater_id: string
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          repeater_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repeater_reports_repeater_id_fkey"
            columns: ["repeater_id"]
            isOneToOne: false
            referencedRelation: "repeaters"
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
      user_favorite_repeaters: {
        Row: {
          created_at: string
          id: string
          repeater_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          repeater_id: string
          user_id: string
        }
        Update: {
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
      maidenhead_to_point: { Args: { loc: string }; Returns: unknown }
      parse_shift_hz: { Args: { shift_text: string }; Returns: number }
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
      feedback_type: "like" | "down"
      network_kind: "dmr" | "c4fm" | "dstar" | "voip" | "mixed" | "other"
      report_status: "pending" | "reviewed" | "resolved" | "rejected"
      station_kind: "portable" | "mobile" | "fixed"
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
      feedback_type: ["like", "down"],
      network_kind: ["dmr", "c4fm", "dstar", "voip", "mixed", "other"],
      report_status: ["pending", "reviewed", "resolved", "rejected"],
      station_kind: ["portable", "mobile", "fixed"],
      user_type: ["swl", "licensed"],
    },
  },
} as const
