export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cash_categories: {
        Row: { active: boolean; id: string; name: string; organization_id: string; type: string }
        Insert: { active?: boolean; id?: string; name: string; organization_id: string; type: string }
        Update: { active?: boolean; id?: string; name?: string; organization_id?: string; type?: string }
        Relationships: [
          { foreignKeyName: "cash_categories_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
        ]
      }
      cash_closures: {
        Row: { closed_at: string; closed_by: string; closing_balance: number; closure_date: string; id: string; opening_balance: number; organization_id: string; reopened: boolean; total_in: number; total_out: number; unit_id: string }
        Insert: { closed_at?: string; closed_by: string; closing_balance: number; closure_date: string; id?: string; opening_balance: number; organization_id: string; reopened?: boolean; total_in: number; total_out: number; unit_id: string }
        Update: { closed_at?: string; closed_by?: string; closing_balance?: number; closure_date?: string; id?: string; opening_balance?: number; organization_id?: string; reopened?: boolean; total_in?: number; total_out?: number; unit_id?: string }
        Relationships: [
          { foreignKeyName: "cash_closures_closed_by_fkey"; columns: ["closed_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "cash_closures_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "cash_closures_unit_id_fkey"; columns: ["unit_id"]; isOneToOne: false; referencedRelation: "units"; referencedColumns: ["id"] },
        ]
      }
      cash_transactions: {
        Row: { amount: number; category_id: string | null; created_at: string; created_by: string; description: string; id: string; organization_id: string; receipt_url: string | null; responsible_id: string; sale_id: string | null; transaction_date: string; type: string; unit_id: string }
        Insert: { amount: number; category_id?: string | null; created_at?: string; created_by: string; description: string; id?: string; organization_id: string; receipt_url?: string | null; responsible_id: string; sale_id?: string | null; transaction_date?: string; type: string; unit_id: string }
        Update: { amount?: number; category_id?: string | null; created_at?: string; created_by?: string; description?: string; id?: string; organization_id?: string; receipt_url?: string | null; responsible_id?: string; sale_id?: string | null; transaction_date?: string; type?: string; unit_id?: string }
        Relationships: [
          { foreignKeyName: "cash_transactions_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "cash_categories"; referencedColumns: ["id"] },
          { foreignKeyName: "cash_transactions_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "cash_transactions_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "cash_transactions_responsible_id_fkey"; columns: ["responsible_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "cash_transactions_sale_id_fkey"; columns: ["sale_id"]; isOneToOne: false; referencedRelation: "sales"; referencedColumns: ["id"] },
          { foreignKeyName: "cash_transactions_unit_id_fkey"; columns: ["unit_id"]; isOneToOne: false; referencedRelation: "units"; referencedColumns: ["id"] },
        ]
      }
      clients: {
        Row: { created_at: string; email: string | null; id: string; name: string; organization_id: string; phone: string | null }
        Insert: { created_at?: string; email?: string | null; id?: string; name: string; organization_id: string; phone?: string | null }
        Update: { created_at?: string; email?: string | null; id?: string; name?: string; organization_id?: string; phone?: string | null }
        Relationships: [
          { foreignKeyName: "clients_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
        ]
      }
      invites: {
        Row: { created_at: string; created_by: string | null; email: string; expires_at: string; id: string; organization_id: string; role_id: string | null; status: string; token: string; unit_id: string | null }
        Insert: { created_at?: string; created_by?: string | null; email: string; expires_at: string; id?: string; organization_id: string; role_id?: string | null; status?: string; token?: string; unit_id?: string | null }
        Update: { created_at?: string; created_by?: string | null; email?: string; expires_at?: string; id?: string; organization_id?: string; role_id?: string | null; status?: string; token?: string; unit_id?: string | null }
        Relationships: [
          { foreignKeyName: "invites_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "invites_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "invites_role_id_fkey"; columns: ["role_id"]; isOneToOne: false; referencedRelation: "roles"; referencedColumns: ["id"] },
          { foreignKeyName: "invites_unit_id_fkey"; columns: ["unit_id"]; isOneToOne: false; referencedRelation: "units"; referencedColumns: ["id"] },
        ]
      }
      organizations: {
        Row: { created_at: string; id: string; name: string }
        Insert: { created_at?: string; id?: string; name: string }
        Update: { created_at?: string; id?: string; name?: string }
        Relationships: []
      }
      packages: {
        Row: { active: boolean; description: string | null; id: string; name: string; organization_id: string; procedure_id: string | null }
        Insert: { active?: boolean; description?: string | null; id?: string; name: string; organization_id: string; procedure_id?: string | null }
        Update: { active?: boolean; description?: string | null; id?: string; name?: string; organization_id?: string; procedure_id?: string | null }
        Relationships: [
          { foreignKeyName: "packages_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "packages_procedure_id_fkey"; columns: ["procedure_id"]; isOneToOne: false; referencedRelation: "procedures"; referencedColumns: ["id"] },
        ]
      }
      procedures: {
        Row: { active: boolean; category: string | null; id: string; name: string; organization_id: string }
        Insert: { active?: boolean; category?: string | null; id?: string; name: string; organization_id: string }
        Update: { active?: boolean; category?: string | null; id?: string; name?: string; organization_id?: string }
        Relationships: [
          { foreignKeyName: "procedures_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
        ]
      }
      profiles: {
        Row: { active: boolean; created_at: string; full_name: string; id: string; organization_id: string; phone: string | null; primary_unit_id: string | null; role_id: string | null }
        Insert: { active?: boolean; created_at?: string; full_name: string; id: string; organization_id: string; phone?: string | null; primary_unit_id?: string | null; role_id?: string | null }
        Update: { active?: boolean; created_at?: string; full_name?: string; id?: string; organization_id?: string; phone?: string | null; primary_unit_id?: string | null; role_id?: string | null }
        Relationships: [
          { foreignKeyName: "profiles_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "profiles_primary_unit_id_fkey"; columns: ["primary_unit_id"]; isOneToOne: false; referencedRelation: "units"; referencedColumns: ["id"] },
          { foreignKeyName: "profiles_role_id_fkey"; columns: ["role_id"]; isOneToOne: false; referencedRelation: "roles"; referencedColumns: ["id"] },
        ]
      }
      role_permissions: {
        Row: { action: string; allowed: boolean; id: string; module: string; role_id: string }
        Insert: { action: string; allowed?: boolean; id?: string; module: string; role_id: string }
        Update: { action?: string; allowed?: boolean; id?: string; module?: string; role_id?: string }
        Relationships: [
          { foreignKeyName: "role_permissions_role_id_fkey"; columns: ["role_id"]; isOneToOne: false; referencedRelation: "roles"; referencedColumns: ["id"] },
        ]
      }
      roles: {
        Row: { created_at: string; id: string; name: string; organization_id: string }
        Insert: { created_at?: string; id?: string; name: string; organization_id: string }
        Update: { created_at?: string; id?: string; name?: string; organization_id?: string }
        Relationships: [
          { foreignKeyName: "roles_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
        ]
      }
      sales: {
        Row: { amount: number; client_id: string; created_at: string; created_by: string; id: string; installments: number; lead_origin: Database["public"]["Enums"]["lead_origin"]; notes: string | null; organization_id: string; package_id: string | null; payment_method: Database["public"]["Enums"]["payment_method"]; procedure_id: string | null; sale_date: string; seller_id: string; status: string; unit_id: string; updated_at: string | null; updated_by: string | null }
        Insert: { amount: number; client_id: string; created_at?: string; created_by: string; id?: string; installments?: number; lead_origin: Database["public"]["Enums"]["lead_origin"]; notes?: string | null; organization_id: string; package_id?: string | null; payment_method: Database["public"]["Enums"]["payment_method"]; procedure_id?: string | null; sale_date?: string; seller_id: string; status?: string; unit_id: string; updated_at?: string | null; updated_by?: string | null }
        Update: { amount?: number; client_id?: string; created_at?: string; created_by?: string; id?: string; installments?: number; lead_origin?: Database["public"]["Enums"]["lead_origin"]; notes?: string | null; organization_id?: string; package_id?: string | null; payment_method?: Database["public"]["Enums"]["payment_method"]; procedure_id?: string | null; sale_date?: string; seller_id?: string; status?: string; unit_id?: string; updated_at?: string | null; updated_by?: string | null }
        Relationships: [
          { foreignKeyName: "sales_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_package_id_fkey"; columns: ["package_id"]; isOneToOne: false; referencedRelation: "packages"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_procedure_id_fkey"; columns: ["procedure_id"]; isOneToOne: false; referencedRelation: "procedures"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_seller_id_fkey"; columns: ["seller_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_unit_id_fkey"; columns: ["unit_id"]; isOneToOne: false; referencedRelation: "units"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_updated_by_fkey"; columns: ["updated_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      sales_history: {
        Row: { changed_at: string; changed_by: string | null; field_name: string; id: string; new_value: string | null; old_value: string | null; sale_id: string }
        Insert: { changed_at?: string; changed_by?: string | null; field_name: string; id?: string; new_value?: string | null; old_value?: string | null; sale_id: string }
        Update: { changed_at?: string; changed_by?: string | null; field_name?: string; id?: string; new_value?: string | null; old_value?: string | null; sale_id?: string }
        Relationships: [
          { foreignKeyName: "sales_history_changed_by_fkey"; columns: ["changed_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_history_sale_id_fkey"; columns: ["sale_id"]; isOneToOne: false; referencedRelation: "sales"; referencedColumns: ["id"] },
        ]
      }
      units: {
        Row: { active: boolean; city: string | null; created_at: string; id: string; name: string; organization_id: string }
        Insert: { active?: boolean; city?: string | null; created_at?: string; id?: string; name: string; organization_id: string }
        Update: { active?: boolean; city?: string | null; created_at?: string; id?: string; name?: string; organization_id?: string }
        Relationships: [
          { foreignKeyName: "units_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
        ]
      }
      user_units: {
        Row: { unit_id: string; user_id: string }
        Insert: { unit_id: string; user_id: string }
        Update: { unit_id?: string; user_id?: string }
        Relationships: [
          { foreignKeyName: "user_units_unit_id_fkey"; columns: ["unit_id"]; isOneToOne: false; referencedRelation: "units"; referencedColumns: ["id"] },
          { foreignKeyName: "user_units_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      current_organization_id: { Args: never; Returns: string }
      current_unit_ids: { Args: never; Returns: string[] }
      get_invite_by_token: { Args: { p_token: string }; Returns: { email: string; role_name: string; unit_name: string }[] }
      is_admin: { Args: never; Returns: boolean }
      is_manager: { Args: never; Returns: boolean }
    }
    Enums: {
      lead_origin: "Instagram" | "Indicacao" | "Google" | "WhatsApp" | "Passante" | "Outros"
      payment_method: "Dinheiro" | "PIX" | "Debito" | "Credito" | "Boleto" | "Transferencia"
    }
    CompositeTypes: { [_ in never]: never }
  }
}
