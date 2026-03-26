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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      admin_configurations: {
        Row: {
          config_name: string
          config_type: string
          config_value: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          updated_at: string
        }
        Insert: {
          config_name: string
          config_type: string
          config_value: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Update: {
          config_name?: string
          config_type?: string
          config_value?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_configurations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assistant_interactions: {
        Row: {
          ai_response: string
          confidence_score: number | null
          context_data: Json | null
          created_at: string
          doctor_id: string
          id: string
          interaction_type: string
          patient_id: string | null
          session_id: string
          user_message: string
        }
        Insert: {
          ai_response: string
          confidence_score?: number | null
          context_data?: Json | null
          created_at?: string
          doctor_id: string
          id?: string
          interaction_type: string
          patient_id?: string | null
          session_id: string
          user_message: string
        }
        Update: {
          ai_response?: string
          confidence_score?: number | null
          context_data?: Json | null
          created_at?: string
          doctor_id?: string
          id?: string
          interaction_type?: string
          patient_id?: string | null
          session_id?: string
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_interactions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistant_interactions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          consultation_fee: number
          created_at: string
          doctor_id: string | null
          duration_minutes: number | null
          id: string
          notes: string | null
          patient_id: string | null
          payment_status: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
          stripe_session_id: string | null
          updated_at: string
          video_room_url: string | null
        }
        Insert: {
          appointment_date: string
          consultation_fee: number
          created_at?: string
          doctor_id?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          payment_status?: string | null
          status?: Database["public"]["Enums"]["appointment_status"] | null
          stripe_session_id?: string | null
          updated_at?: string
          video_room_url?: string | null
        }
        Update: {
          appointment_date?: string
          consultation_fee?: number
          created_at?: string
          doctor_id?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          payment_status?: string | null
          status?: Database["public"]["Enums"]["appointment_status"] | null
          stripe_session_id?: string | null
          updated_at?: string
          video_room_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bio: string | null
          consultation_fee: number
          created_at: string
          email: string
          experience_years: number
          id: string
          is_available: boolean | null
          name: string
          phone: string | null
          profile_image_url: string | null
          qualification: string
          rating: number | null
          specialization: Database["public"]["Enums"]["specialization"]
          status: string | null
          total_reviews: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bio?: string | null
          consultation_fee: number
          created_at?: string
          email: string
          experience_years?: number
          id?: string
          is_available?: boolean | null
          name: string
          phone?: string | null
          profile_image_url?: string | null
          qualification: string
          rating?: number | null
          specialization: Database["public"]["Enums"]["specialization"]
          status?: string | null
          total_reviews?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bio?: string | null
          consultation_fee?: number
          created_at?: string
          email?: string
          experience_years?: number
          id?: string
          is_available?: boolean | null
          name?: string
          phone?: string | null
          profile_image_url?: string | null
          qualification?: string
          rating?: number | null
          specialization?: Database["public"]["Enums"]["specialization"]
          status?: string | null
          total_reviews?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctors_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_reports: {
        Row: {
          appointment_id: string | null
          created_at: string
          description: string
          diagnosis: string | null
          doctor_id: string
          follow_up_date: string | null
          id: string
          imaging_results: Json | null
          lab_results: Json | null
          patient_id: string
          recommendations: string | null
          report_file_url: string | null
          report_type: string
          symptoms: string[] | null
          title: string
          updated_at: string
          vital_signs: Json | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          description: string
          diagnosis?: string | null
          doctor_id: string
          follow_up_date?: string | null
          id?: string
          imaging_results?: Json | null
          lab_results?: Json | null
          patient_id: string
          recommendations?: string | null
          report_file_url?: string | null
          report_type: string
          symptoms?: string[] | null
          title: string
          updated_at?: string
          vital_signs?: Json | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          description?: string
          diagnosis?: string | null
          doctor_id?: string
          follow_up_date?: string | null
          id?: string
          imaging_results?: Json | null
          lab_results?: Json | null
          patient_id?: string
          recommendations?: string | null
          report_file_url?: string | null
          report_type?: string
          symptoms?: string[] | null
          title?: string
          updated_at?: string
          vital_signs?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_reports_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_reports_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          brand_name: string | null
          contraindications: string[] | null
          created_at: string
          description: string | null
          dosage_form: string
          generic_name: string | null
          id: string
          is_active: boolean | null
          is_prescription_required: boolean | null
          manufacturer: string | null
          name: string
          price_per_unit: number | null
          side_effects: string[] | null
          storage_instructions: string | null
          strength: string
          updated_at: string
        }
        Insert: {
          brand_name?: string | null
          contraindications?: string[] | null
          created_at?: string
          description?: string | null
          dosage_form: string
          generic_name?: string | null
          id?: string
          is_active?: boolean | null
          is_prescription_required?: boolean | null
          manufacturer?: string | null
          name: string
          price_per_unit?: number | null
          side_effects?: string[] | null
          storage_instructions?: string | null
          strength: string
          updated_at?: string
        }
        Update: {
          brand_name?: string | null
          contraindications?: string[] | null
          created_at?: string
          description?: string | null
          dosage_form?: string
          generic_name?: string | null
          id?: string
          is_active?: boolean | null
          is_prescription_required?: boolean | null
          manufacturer?: string | null
          name?: string
          price_per_unit?: number | null
          side_effects?: string[] | null
          storage_instructions?: string | null
          strength?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          message: string
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          message: string
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      prescription_items: {
        Row: {
          created_at: string
          dosage: string
          duration: string
          frequency: string
          id: string
          instructions: string | null
          medicine_id: string
          prescription_id: string
          quantity: number
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          dosage: string
          duration: string
          frequency: string
          id?: string
          instructions?: string | null
          medicine_id: string
          prescription_id: string
          quantity: number
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          dosage?: string
          duration?: string
          frequency?: string
          id?: string
          instructions?: string | null
          medicine_id?: string
          prescription_id?: string
          quantity?: number
          total_price?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          appointment_id: string | null
          created_at: string
          diagnosis: string
          doctor_id: string
          id: string
          notes: string | null
          patient_id: string
          prescription_date: string
          status: string | null
          total_amount: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          diagnosis: string
          doctor_id: string
          id?: string
          notes?: string | null
          patient_id: string
          prescription_date?: string
          status?: string | null
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          diagnosis?: string
          doctor_id?: string
          id?: string
          notes?: string | null
          patient_id?: string
          prescription_date?: string
          status?: string | null
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          allergies: string[] | null
          approved_at: string | null
          approved_by: string | null
          blood_type: string | null
          chronic_conditions: string[] | null
          created_at: string
          current_medications: string[] | null
          date_of_birth: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          gender: string | null
          id: string
          module_access: Json | null
          phone: string | null
          profile_image_url: string | null
          role: string | null
          status: string | null
          subscription_plan: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          allergies?: string[] | null
          approved_at?: string | null
          approved_by?: string | null
          blood_type?: string | null
          chronic_conditions?: string[] | null
          created_at?: string
          current_medications?: string[] | null
          date_of_birth?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          gender?: string | null
          id?: string
          module_access?: Json | null
          phone?: string | null
          profile_image_url?: string | null
          role?: string | null
          status?: string | null
          subscription_plan?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          allergies?: string[] | null
          approved_at?: string | null
          approved_by?: string | null
          blood_type?: string | null
          chronic_conditions?: string[] | null
          created_at?: string
          current_medications?: string[] | null
          date_of_birth?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          module_access?: Json | null
          phone?: string | null
          profile_image_url?: string | null
          role?: string | null
          status?: string | null
          subscription_plan?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string | null
          comment: string | null
          created_at: string
          doctor_id: string | null
          id: string
          patient_id: string | null
          rating: number
        }
        Insert: {
          appointment_id?: string | null
          comment?: string | null
          created_at?: string
          doctor_id?: string | null
          id?: string
          patient_id?: string | null
          rating: number
        }
        Update: {
          appointment_id?: string | null
          comment?: string | null
          created_at?: string
          doctor_id?: string | null
          id?: string
          patient_id?: string | null
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_configs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          is_live_mode: boolean | null
          role: string
          stripe_publishable_key: string | null
          stripe_secret_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_live_mode?: boolean | null
          role: string
          stripe_publishable_key?: string | null
          stripe_secret_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_live_mode?: boolean | null
          role?: string
          stripe_publishable_key?: string | null
          stripe_secret_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean | null
          max_appointments: number | null
          module_access: Json
          name: string
          price_monthly: number | null
          price_yearly: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean | null
          max_appointments?: number | null
          module_access?: Json
          name: string
          price_monthly?: number | null
          price_yearly?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean | null
          max_appointments?: number | null
          module_access?: Json
          name?: string
          price_monthly?: number | null
          price_yearly?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_analytics: {
        Row: {
          actions_performed: Json | null
          created_at: string
          id: string
          page_visited: string
          session_id: string
          time_spent: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actions_performed?: Json | null
          created_at?: string
          id?: string
          page_visited: string
          session_id: string
          time_spent?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actions_performed?: Json | null
          created_at?: string
          id?: string
          page_visited?: string
          session_id?: string
          time_spent?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      website_content: {
        Row: {
          author: string | null
          content: string
          content_type: string
          created_at: string
          id: string
          is_published: boolean
          meta_description: string | null
          order_index: number
          slug: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          content: string
          content_type: string
          created_at?: string
          id?: string
          is_published?: boolean
          meta_description?: string | null
          order_index?: number
          slug?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          content?: string
          content_type?: string
          created_at?: string
          id?: string
          is_published?: boolean
          meta_description?: string | null
          order_index?: number
          slug?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_notification: {
        Args: {
          p_user_id: string
          p_title: string
          p_message: string
          p_type?: string
          p_action_url?: string
        }
        Returns: undefined
      }
      log_system_action: {
        Args: {
          p_action: string
          p_resource_type: string
          p_resource_id?: string
          p_details?: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      appointment_status: "pending" | "confirmed" | "completed" | "cancelled"
      specialization:
        | "cardiology"
        | "dermatology"
        | "endocrinology"
        | "gastroenterology"
        | "neurology"
        | "oncology"
        | "orthopedics"
        | "pediatrics"
        | "psychiatry"
        | "general_medicine"
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
      appointment_status: ["pending", "confirmed", "completed", "cancelled"],
      specialization: [
        "cardiology",
        "dermatology",
        "endocrinology",
        "gastroenterology",
        "neurology",
        "oncology",
        "orthopedics",
        "pediatrics",
        "psychiatry",
        "general_medicine",
      ],
    },
  },
} as const
