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
      codex_entries: {
        Row: {
          body: string
          codex_key: string
          created_at: string
          is_true_ending_required: boolean
          tags: string[]
          title: string
        }
        Insert: {
          body: string
          codex_key: string
          created_at?: string
          is_true_ending_required?: boolean
          tags?: string[]
          title: string
        }
        Update: {
          body?: string
          codex_key?: string
          created_at?: string
          is_true_ending_required?: boolean
          tags?: string[]
          title?: string
        }
        Relationships: []
      }
      codex_unlocks: {
        Row: {
          codex_key: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          codex_key: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          codex_key?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "codex_unlocks_codex_key_fkey"
            columns: ["codex_key"]
            isOneToOne: false
            referencedRelation: "codex_entries"
            referencedColumns: ["codex_key"]
          },
        ]
      }
      deaths: {
        Row: {
          cause: string
          created_at: string
          epitaph: string
          id: string
          run_id: string
          section: number
          user_id: string
        }
        Insert: {
          cause: string
          created_at?: string
          epitaph: string
          id?: string
          run_id: string
          section: number
          user_id: string
        }
        Update: {
          cause?: string
          created_at?: string
          epitaph?: string
          id?: string
          run_id?: string
          section?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deaths_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rumors_catalog: {
        Row: {
          effect_text: string
          mechanical_json: Json
          rumor_key: string
          title: string
        }
        Insert: {
          effect_text: string
          mechanical_json?: Json
          rumor_key: string
          title: string
        }
        Update: {
          effect_text?: string
          mechanical_json?: Json
          rumor_key?: string
          title?: string
        }
        Relationships: []
      }
      run_assets: {
        Row: {
          created_at: string
          id: string
          kind: string
          prompt: string
          run_id: string
          section_number: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          prompt?: string
          run_id: string
          section_number: number
          url?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          prompt?: string
          run_id?: string
          section_number?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_assets_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      run_sections_cache: {
        Row: {
          choice_flavor_json: Json
          created_at: string
          narrator_text: string
          plate_caption: string | null
          plate_prompt: string | null
          plate_url: string | null
          run_id: string
          section_number: number
          title: string
        }
        Insert: {
          choice_flavor_json?: Json
          created_at?: string
          narrator_text?: string
          plate_caption?: string | null
          plate_prompt?: string | null
          plate_url?: string | null
          run_id: string
          section_number: number
          title?: string
        }
        Update: {
          choice_flavor_json?: Json
          created_at?: string
          narrator_text?: string
          plate_caption?: string | null
          plate_prompt?: string | null
          plate_url?: string | null
          run_id?: string
          section_number?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_sections_cache_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      run_state: {
        Row: {
          autosave_at: string
          character_description: string | null
          current_section: number
          inventory_json: Json
          log_json: Json
          range_band: string
          resources_json: Json
          run_id: string
          stance: string
          stats_json: Json
          status_effects_json: Json
          tracks_json: Json
          trait_key: string | null
          user_id: string
          visited_sections: number[]
        }
        Insert: {
          autosave_at?: string
          character_description?: string | null
          current_section?: number
          inventory_json?: Json
          log_json?: Json
          range_band?: string
          resources_json?: Json
          run_id: string
          stance?: string
          stats_json?: Json
          status_effects_json?: Json
          tracks_json?: Json
          trait_key?: string | null
          user_id: string
          visited_sections?: number[]
        }
        Update: {
          autosave_at?: string
          character_description?: string | null
          current_section?: number
          inventory_json?: Json
          log_json?: Json
          range_band?: string
          resources_json?: Json
          run_id?: string
          stance?: string
          stats_json?: Json
          status_effects_json?: Json
          tracks_json?: Json
          trait_key?: string | null
          user_id?: string
          visited_sections?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "run_state_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          created_at: string
          ending_key: string | null
          id: string
          is_complete: boolean
          is_shared_replay: boolean
          is_true_ending: boolean
          outline_json: Json
          seed: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ending_key?: string | null
          id?: string
          is_complete?: boolean
          is_shared_replay?: boolean
          is_true_ending?: boolean
          outline_json?: Json
          seed: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ending_key?: string | null
          id?: string
          is_complete?: boolean
          is_shared_replay?: boolean
          is_true_ending?: boolean
          outline_json?: Json
          seed?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_rumors: {
        Row: {
          level: number
          rumor_key: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          level?: number
          rumor_key: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          level?: number
          rumor_key?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_rumors_rumor_key_fkey"
            columns: ["rumor_key"]
            isOneToOne: false
            referencedRelation: "rumors_catalog"
            referencedColumns: ["rumor_key"]
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
