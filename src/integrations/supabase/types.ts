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
      action_items: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          description: string
          due_date: string | null
          id: string
          minutes_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          description: string
          due_date?: string | null
          id?: string
          minutes_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string
          due_date?: string | null
          id?: string
          minutes_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_items_minutes_id_fkey"
            columns: ["minutes_id"]
            isOneToOne: false
            referencedRelation: "meeting_minutes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          super_admin_id: string
          target_member_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          super_admin_id: string
          target_member_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          super_admin_id?: string
          target_member_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_target_member_id_fkey"
            columns: ["target_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      b2c_transactions: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          initiated_at: string
          mpesa_charge: number
          mpesa_transaction_id: string
          phone_number: string
          recipient_name: string | null
          status: string
          transaction_completed_at: string | null
          updated_at: string
          utility_account_balance: number | null
          wallet_type: string
          withdrawal_id: string
          working_account_balance: number | null
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          initiated_at?: string
          mpesa_charge?: number
          mpesa_transaction_id: string
          phone_number: string
          recipient_name?: string | null
          status?: string
          transaction_completed_at?: string | null
          updated_at?: string
          utility_account_balance?: number | null
          wallet_type?: string
          withdrawal_id: string
          working_account_balance?: number | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          initiated_at?: string
          mpesa_charge?: number
          mpesa_transaction_id?: string
          phone_number?: string
          recipient_name?: string | null
          status?: string
          transaction_completed_at?: string | null
          updated_at?: string
          utility_account_balance?: number | null
          wallet_type?: string
          withdrawal_id?: string
          working_account_balance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "b2c_transactions_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "penalty_withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          member_id: string | null
          month: number
          mpesa_code: string | null
          name: string | null
          phone: string
          raw_details: string | null
          transaction_date: string
          transaction_reference: string
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          member_id?: string | null
          month: number
          mpesa_code?: string | null
          name?: string | null
          phone: string
          raw_details?: string | null
          transaction_date: string
          transaction_reference: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          member_id?: string | null
          month?: number
          mpesa_code?: string | null
          name?: string | null
          phone?: string
          raw_details?: string | null
          transaction_date?: string
          transaction_reference?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiaries: {
        Row: {
          created_at: string
          id: string
          id_number: string | null
          member_id: string
          name: string
          phone: string | null
          relationship: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          id_number?: string | null
          member_id: string
          name: string
          phone?: string | null
          relationship?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          id_number?: string | null
          member_id?: string
          name?: string
          phone?: string | null
          relationship?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficiaries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiary_requests: {
        Row: {
          admin_notes: string | null
          beneficiary_id: string | null
          beneficiary_id_number: string | null
          beneficiary_name: string | null
          beneficiary_phone: string | null
          beneficiary_relationship: string | null
          created_at: string | null
          id: string
          member_id: string
          reason: string
          request_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          beneficiary_id?: string | null
          beneficiary_id_number?: string | null
          beneficiary_name?: string | null
          beneficiary_phone?: string | null
          beneficiary_relationship?: string | null
          created_at?: string | null
          id?: string
          member_id: string
          reason: string
          request_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          beneficiary_id?: string | null
          beneficiary_id_number?: string | null
          beneficiary_name?: string | null
          beneficiary_phone?: string | null
          beneficiary_relationship?: string | null
          created_at?: string | null
          id?: string
          member_id?: string
          reason?: string
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beneficiary_requests_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiary_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      contributions: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          member_id: string
          month: number
          paid_date: string | null
          payment_id: string | null
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          member_id: string
          month: number
          paid_date?: string | null
          payment_id?: string | null
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          member_id?: string
          month?: number
          paid_date?: string | null
          payment_id?: string | null
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "contributions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_security: {
        Row: {
          created_at: string
          id: string
          pin_hash: string | null
          updated_at: string
          user_id: string
          webauthn_credential_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          pin_hash?: string | null
          updated_at?: string
          user_id: string
          webauthn_credential_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          pin_hash?: string | null
          updated_at?: string
          user_id?: string
          webauthn_credential_id?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          member_id: string
          notes: string | null
          status: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          member_id: string
          notes?: string | null
          status?: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          member_id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_campaigns: {
        Row: {
          active: boolean
          allow_partial: boolean
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          goal_type: string
          id: string
          target_total: number | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          allow_partial?: boolean
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          goal_type?: string
          id?: string
          target_total?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          allow_partial?: boolean
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          goal_type?: string
          id?: string
          target_total?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      donation_payment_records: {
        Row: {
          amount: number
          campaign_id: string | null
          created_at: string
          id: string
          member_id: string | null
          mpesa_transaction_id: string | null
          payment_ref: string | null
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          campaign_id?: string | null
          created_at?: string
          id?: string
          member_id?: string | null
          mpesa_transaction_id?: string | null
          payment_ref?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          campaign_id?: string | null
          created_at?: string
          id?: string
          member_id?: string | null
          mpesa_transaction_id?: string | null
          payment_ref?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donation_payment_records_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "donation_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_payment_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_wallet: {
        Row: {
          id: string
          total_balance: number
          total_received: number
          total_withdrawn: number
          updated_at: string
        }
        Insert: {
          id?: string
          total_balance?: number
          total_received?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Update: {
          id?: string
          total_balance?: number
          total_received?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Relationships: []
      }
      donation_withdrawal_signatories: {
        Row: {
          approved_at: string | null
          created_at: string
          id: string
          rejected_at: string | null
          rejection_reason: string | null
          signatory_role: string
          signatory_user_id: string | null
          signature_url: string | null
          status: string
          updated_at: string
          withdrawal_id: string | null
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          id?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          signatory_role: string
          signatory_user_id?: string | null
          signature_url?: string | null
          status?: string
          updated_at?: string
          withdrawal_id?: string | null
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          id?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          signatory_role?: string
          signatory_user_id?: string | null
          signature_url?: string | null
          status?: string
          updated_at?: string
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donation_withdrawal_signatories_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "donation_withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_withdrawals: {
        Row: {
          amount: number
          created_at: string
          id: string
          phone_number: string | null
          reason: string
          requested_by: string | null
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          phone_number?: string | null
          reason: string
          requested_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          phone_number?: string | null
          reason?: string
          requested_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          contribution_amount: number
          created_at: string
          created_by: string
          departed_name: string | null
          description: string | null
          event_type: string
          id: string
          related_member_id: string | null
          relationship: string | null
          reschedule_reason: string | null
          rescheduled_date: string | null
          scheduled_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          contribution_amount?: number
          created_at?: string
          created_by: string
          departed_name?: string | null
          description?: string | null
          event_type?: string
          id?: string
          related_member_id?: string | null
          relationship?: string | null
          reschedule_reason?: string | null
          rescheduled_date?: string | null
          scheduled_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          contribution_amount?: number
          created_at?: string
          created_by?: string
          departed_name?: string | null
          description?: string | null
          event_type?: string
          id?: string
          related_member_id?: string | null
          relationship?: string | null
          reschedule_reason?: string | null
          rescheduled_date?: string | null
          scheduled_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_related_member_id_fkey"
            columns: ["related_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category: string
          created_at: string | null
          created_by: string
          description: string | null
          expense_type: string
          id: string
          mpesa_charge: number
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          phone_number: string | null
          recipient_member_id: string | null
          recipient_name: string | null
          reference_number: string | null
          status: string | null
          updated_at: string | null
          wallet_type: string
          withdrawal_id: string | null
          withdrawal_table: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category: string
          created_at?: string | null
          created_by: string
          description?: string | null
          expense_type: string
          id?: string
          mpesa_charge?: number
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          phone_number?: string | null
          recipient_member_id?: string | null
          recipient_name?: string | null
          reference_number?: string | null
          status?: string | null
          updated_at?: string | null
          wallet_type?: string
          withdrawal_id?: string | null
          withdrawal_table?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          expense_type?: string
          id?: string
          mpesa_charge?: number
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          phone_number?: string | null
          recipient_member_id?: string | null
          recipient_name?: string | null
          reference_number?: string | null
          status?: string | null
          updated_at?: string | null
          wallet_type?: string
          withdrawal_id?: string | null
          withdrawal_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_recipient_member_id_fkey"
            columns: ["recipient_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_reports: {
        Row: {
          generated_at: string | null
          generated_by: string
          id: string
          net_balance: number | null
          report_data: Json | null
          report_period_end: string
          report_period_start: string
          report_type: string
          total_contributions: number | null
          total_expenses: number | null
          total_payouts: number | null
        }
        Insert: {
          generated_at?: string | null
          generated_by: string
          id?: string
          net_balance?: number | null
          report_data?: Json | null
          report_period_end: string
          report_period_start: string
          report_type: string
          total_contributions?: number | null
          total_expenses?: number | null
          total_payouts?: number | null
        }
        Update: {
          generated_at?: string | null
          generated_by?: string
          id?: string
          net_balance?: number | null
          report_data?: Json | null
          report_period_end?: string
          report_period_start?: string
          report_type?: string
          total_contributions?: number | null
          total_expenses?: number | null
          total_payouts?: number | null
        }
        Relationships: []
      }
      meeting_attendance: {
        Row: {
          created_at: string | null
          id: string
          meeting_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          meeting_id: string
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          meeting_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meeting_minutes"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_minutes: {
        Row: {
          absent_with_apology: string[] | null
          absent_without_apology: string[] | null
          action_items: string | null
          agenda: string | null
          attendees: string[] | null
          chairperson_name: string | null
          chairperson_signature_url: string | null
          created_at: string | null
          created_by: string
          decisions: string | null
          discussions: string | null
          id: string
          meeting_date: string
          meeting_type: string
          next_meeting_date: string | null
          rejection_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          secretary_name: string | null
          secretary_notes: string | null
          secretary_reviewed_at: string | null
          secretary_reviewed_by: string | null
          secretary_signature_url: string | null
          status: string | null
          submitted_at: string | null
          submitted_by: string | null
          title: string
          updated_at: string | null
          visible_to_members: string[] | null
        }
        Insert: {
          absent_with_apology?: string[] | null
          absent_without_apology?: string[] | null
          action_items?: string | null
          agenda?: string | null
          attendees?: string[] | null
          chairperson_name?: string | null
          chairperson_signature_url?: string | null
          created_at?: string | null
          created_by: string
          decisions?: string | null
          discussions?: string | null
          id?: string
          meeting_date: string
          meeting_type?: string
          next_meeting_date?: string | null
          rejection_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          secretary_name?: string | null
          secretary_notes?: string | null
          secretary_reviewed_at?: string | null
          secretary_reviewed_by?: string | null
          secretary_signature_url?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          title: string
          updated_at?: string | null
          visible_to_members?: string[] | null
        }
        Update: {
          absent_with_apology?: string[] | null
          absent_without_apology?: string[] | null
          action_items?: string | null
          agenda?: string | null
          attendees?: string[] | null
          chairperson_name?: string | null
          chairperson_signature_url?: string | null
          created_at?: string | null
          created_by?: string
          decisions?: string | null
          discussions?: string | null
          id?: string
          meeting_date?: string
          meeting_type?: string
          next_meeting_date?: string | null
          rejection_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          secretary_name?: string | null
          secretary_notes?: string | null
          secretary_reviewed_at?: string | null
          secretary_reviewed_by?: string | null
          secretary_signature_url?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          title?: string
          updated_at?: string | null
          visible_to_members?: string[] | null
        }
        Relationships: []
      }
      member_access_logs: {
        Row: {
          access_type: string
          created_at: string | null
          id: string
          member_id: string
          reason: string | null
          super_admin_id: string
        }
        Insert: {
          access_type: string
          created_at?: string | null
          id?: string
          member_id: string
          reason?: string | null
          super_admin_id: string
        }
        Update: {
          access_type?: string
          created_at?: string | null
          id?: string
          member_id?: string
          reason?: string | null
          super_admin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_access_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_registrations: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          date_of_birth: string | null
          department: string | null
          full_name: string
          id: string
          payment_status: string
          phone_number: string
          rejection_reason: string | null
          status: string
          updated_at: string
          verified_at: string | null
          working_location: string | null
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          full_name: string
          id?: string
          payment_status?: string
          phone_number: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          working_location?: string | null
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          full_name?: string
          id?: string
          payment_status?: string
          phone_number?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          working_location?: string | null
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          member_id: string | null
          name: string
          phone: string
          profile_picture_url: string | null
          status_message: string | null
          total_contributions: number
          total_penalties: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          member_id?: string | null
          name: string
          phone: string
          profile_picture_url?: string | null
          status_message?: string | null
          total_contributions?: number
          total_penalties?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          member_id?: string | null
          name?: string
          phone?: string
          profile_picture_url?: string | null
          status_message?: string | null
          total_contributions?: number
          total_penalties?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      memo_recipients: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          downloaded_at: string | null
          id: string
          member_id: string
          memo_id: string
          seen_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          downloaded_at?: string | null
          id?: string
          member_id: string
          memo_id: string
          seen_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          downloaded_at?: string | null
          id?: string
          member_id?: string
          memo_id?: string
          seen_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memo_recipients_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memo_recipients_memo_id_fkey"
            columns: ["memo_id"]
            isOneToOne: false
            referencedRelation: "memos"
            referencedColumns: ["id"]
          },
        ]
      }
      memo_templates: {
        Row: {
          category: string
          created_at: string | null
          created_by: string
          id: string
          name: string
          template_content: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by: string
          id?: string
          name: string
          template_content: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string
          id?: string
          name?: string
          template_content?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      memos: {
        Row: {
          attachments: string[] | null
          category: string
          content: string
          created_at: string | null
          created_by: string
          id: string
          recipient_type: string
          reference_number: string | null
          sent_at: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          attachments?: string[] | null
          category: string
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          recipient_type: string
          reference_number?: string | null
          sent_at?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          attachments?: string[] | null
          category?: string
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          recipient_type?: string
          reference_number?: string | null
          sent_at?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          conversation_id: string | null
          created_at: string
          edited_at: string | null
          id: string
          member_id: string | null
          reply_to_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          conversation_id?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          member_id?: string | null
          reply_to_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          conversation_id?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          member_id?: string | null
          reply_to_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          reschedule_reason: string | null
          rescheduled_date: string | null
          scheduled_date: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          reschedule_reason?: string | null
          rescheduled_date?: string | null
          scheduled_date?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          reschedule_reason?: string | null
          rescheduled_date?: string | null
          scheduled_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      news_read: {
        Row: {
          id: string
          news_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          news_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          news_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_read_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      office_bearer_signatures: {
        Row: {
          id: string
          role: string
          signature_url: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          role: string
          signature_url?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          role?: string
          signature_url?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      operational_payment_records: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          member_id: string | null
          mpesa_transaction_id: string | null
          notes: string | null
          payment_ref: string | null
          source: string
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string | null
          mpesa_transaction_id?: string | null
          notes?: string | null
          payment_ref?: string | null
          source?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string | null
          mpesa_transaction_id?: string | null
          notes?: string | null
          payment_ref?: string | null
          source?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      operational_wallet: {
        Row: {
          id: string
          total_balance: number
          total_received: number
          total_withdrawn: number
          updated_at: string
        }
        Insert: {
          id?: string
          total_balance?: number
          total_received?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Update: {
          id?: string
          total_balance?: number
          total_received?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Relationships: []
      }
      operational_withdrawal_signatories: {
        Row: {
          approved_at: string | null
          created_at: string
          id: string
          rejected_at: string | null
          rejection_reason: string | null
          signatory_role: string
          signatory_user_id: string | null
          signature_url: string | null
          status: string
          updated_at: string
          withdrawal_id: string | null
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          id?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          signatory_role: string
          signatory_user_id?: string | null
          signature_url?: string | null
          status?: string
          updated_at?: string
          withdrawal_id?: string | null
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          id?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          signatory_role?: string
          signatory_user_id?: string | null
          signature_url?: string | null
          status?: string
          updated_at?: string
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_withdrawal_signatories_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "operational_withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_withdrawals: {
        Row: {
          amount: number
          category: string
          created_at: string
          expense_type: string | null
          id: string
          phone_number: string | null
          reason: string
          recipient_name: string | null
          requested_by: string | null
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          expense_type?: string | null
          id?: string
          phone_number?: string | null
          reason: string
          recipient_name?: string | null
          requested_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          expense_type?: string | null
          id?: string
          phone_number?: string | null
          reason?: string
          recipient_name?: string | null
          requested_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_settings: {
        Row: {
          id: string
          letterhead_template: string | null
          logo_url: string | null
          organization_address: string | null
          organization_email: string | null
          organization_name: string
          organization_phone: string | null
          payout_rules: Json | null
          signature_url: string | null
          stamp_url: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          letterhead_template?: string | null
          logo_url?: string | null
          organization_address?: string | null
          organization_email?: string | null
          organization_name?: string
          organization_phone?: string | null
          payout_rules?: Json | null
          signature_url?: string | null
          stamp_url?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          letterhead_template?: string | null
          logo_url?: string | null
          organization_address?: string | null
          organization_email?: string | null
          organization_name?: string
          organization_phone?: string | null
          payout_rules?: Json | null
          signature_url?: string | null
          stamp_url?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      password_resets: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          new_password_hash: string | null
          reset_at: string | null
          reset_by: string | null
          reset_token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          new_password_hash?: string | null
          reset_at?: string | null
          reset_by?: string | null
          reset_token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          new_password_hash?: string | null
          reset_at?: string | null
          reset_by?: string | null
          reset_token?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          matched: boolean
          member_id: string | null
          raw_message: string | null
          received_at: string
          source: string
          transaction_ref: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          matched?: boolean
          member_id?: string | null
          raw_message?: string | null
          received_at?: string
          source?: string
          transaction_ref?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          matched?: boolean
          member_id?: string | null
          raw_message?: string | null
          received_at?: string
          source?: string
          transaction_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string
          eligible_amount: number
          id: string
          member_id: string
          paid_at: string | null
          paid_by: string | null
          payment_reference: string | null
          payout_type: string
          reason: string | null
          rejection_reason: string | null
          status: string | null
          supporting_documents: string[] | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by: string
          eligible_amount: number
          id?: string
          member_id: string
          paid_at?: string | null
          paid_by?: string | null
          payment_reference?: string | null
          payout_type: string
          reason?: string | null
          rejection_reason?: string | null
          status?: string | null
          supporting_documents?: string[] | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string
          eligible_amount?: number
          id?: string
          member_id?: string
          paid_at?: string | null
          paid_by?: string | null
          payment_reference?: string | null
          payout_type?: string
          reason?: string | null
          rejection_reason?: string | null
          status?: string | null
          supporting_documents?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      penalties: {
        Row: {
          amount: number
          contribution_id: string | null
          created_at: string
          id: string
          is_paid: boolean
          member_id: string
          reason: string
        }
        Insert: {
          amount: number
          contribution_id?: string | null
          created_at?: string
          id?: string
          is_paid?: boolean
          member_id: string
          reason?: string
        }
        Update: {
          amount?: number
          contribution_id?: string | null
          created_at?: string
          id?: string
          is_paid?: boolean
          member_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "penalties_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalties_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      penalty_payment_records: {
        Row: {
          amount: number
          created_at: string
          id: string
          member_id: string
          mpesa_transaction_id: string | null
          payment_ref: string | null
          penalty_id: string | null
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          member_id: string
          mpesa_transaction_id?: string | null
          payment_ref?: string | null
          penalty_id?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          member_id?: string
          mpesa_transaction_id?: string | null
          payment_ref?: string | null
          penalty_id?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "penalty_payment_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalty_payment_records_penalty_id_fkey"
            columns: ["penalty_id"]
            isOneToOne: false
            referencedRelation: "penalties"
            referencedColumns: ["id"]
          },
        ]
      }
      penalty_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          member_id: string
          notes: string | null
          payment_date: string
          payment_message: string | null
          reference_number: string
          rejection_reason: string | null
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          member_id: string
          notes?: string | null
          payment_date: string
          payment_message?: string | null
          reference_number: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          member_id?: string
          notes?: string | null
          payment_date?: string
          payment_message?: string | null
          reference_number?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "penalty_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      penalty_wallet: {
        Row: {
          created_at: string
          id: string
          last_updated: string
          total_balance: number
          total_received: number
          total_withdrawn: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_updated?: string
          total_balance?: number
          total_received?: number
          total_withdrawn?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_updated?: string
          total_balance?: number
          total_received?: number
          total_withdrawn?: number
        }
        Relationships: []
      }
      penalty_withdrawals: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          id: string
          phone_number: string | null
          reason: string
          receipt_url: string | null
          requested_by: string
          status: Database["public"]["Enums"]["withdrawal_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          id?: string
          phone_number?: string | null
          reason: string
          receipt_url?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          phone_number?: string | null
          reason?: string
          receipt_url?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      registration_access_links: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          registration_id: string
          temporary_password: string | null
          used: boolean
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string
          id?: string
          registration_id: string
          temporary_password?: string | null
          used?: boolean
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          registration_id?: string
          temporary_password?: string | null
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "registration_access_links_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "member_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_config: {
        Row: {
          active: boolean
          auto_approve: boolean
          created_at: string
          id: string
          registration_fee: number
          retiring_date: string | null
          show_on_login: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          auto_approve?: boolean
          created_at?: string
          id?: string
          registration_fee?: number
          retiring_date?: string | null
          show_on_login?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          auto_approve?: boolean
          created_at?: string
          id?: string
          registration_fee?: number
          retiring_date?: string | null
          show_on_login?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      registration_fees: {
        Row: {
          amount: number
          created_at: string
          error_message: string | null
          id: string
          last_retry_at: string | null
          mpesa_checkout_request_id: string | null
          mpesa_transaction_id: string | null
          phone_number: string | null
          registration_id: string
          retry_count: number
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          mpesa_checkout_request_id?: string | null
          mpesa_transaction_id?: string | null
          phone_number?: string | null
          registration_id: string
          retry_count?: number
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          mpesa_checkout_request_id?: string | null
          mpesa_transaction_id?: string | null
          phone_number?: string | null
          registration_id?: string
          retry_count?: number
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_fees_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "member_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      signatory_signatures: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          signatory_role: string
          signature_url: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          signatory_role: string
          signature_url?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          signatory_role?: string
          signature_url?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          created_at: string
          id: string
          message: string
          provider_ref: string | null
          recipient_phone: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          provider_ref?: string | null
          recipient_phone: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          provider_ref?: string | null
          recipient_phone?: string
          status?: string
        }
        Relationships: []
      }
      system_health: {
        Row: {
          checked_at: string | null
          details: Json | null
          id: string
          metric_name: string
          metric_value: number | null
          status: string | null
        }
        Insert: {
          checked_at?: string | null
          details?: Json | null
          id?: string
          metric_name: string
          metric_value?: number | null
          status?: string | null
        }
        Update: {
          checked_at?: string | null
          details?: Json | null
          id?: string
          metric_name?: string
          metric_value?: number | null
          status?: string | null
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          component: string | null
          created_at: string | null
          error_details: Json | null
          id: string
          log_level: string
          message: string
          request_path: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          status_code: number | null
          user_id: string | null
        }
        Insert: {
          component?: string | null
          created_at?: string | null
          error_details?: Json | null
          id?: string
          log_level: string
          message: string
          request_path?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          status_code?: number | null
          user_id?: string | null
        }
        Update: {
          component?: string | null
          created_at?: string | null
          error_details?: Json | null
          id?: string
          log_level?: string
          message?: string
          request_path?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          status_code?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      unmatched_payments: {
        Row: {
          created_at: string
          extracted_amount: number | null
          extracted_phone: string | null
          id: string
          payment_id: string
          raw_message: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          created_at?: string
          extracted_amount?: number | null
          extracted_phone?: string | null
          id?: string
          payment_id: string
          raw_message?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          created_at?: string
          extracted_amount?: number | null
          extracted_phone?: string | null
          id?: string
          payment_id?: string
          raw_message?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unmatched_payments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          id: string
          is_online: boolean
          last_seen: string
          user_id: string
        }
        Insert: {
          id?: string
          is_online?: boolean
          last_seen?: string
          user_id: string
        }
        Update: {
          id?: string
          is_online?: boolean
          last_seen?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          is_active: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          direction: string
          gross_amount: number
          id: string
          mpesa_charge: number
          mpesa_receipt: string | null
          net_amount: number
          notes: string | null
          occurred_at: string
          party_name: string | null
          party_phone: string | null
          reference_id: string | null
          reference_table: string | null
          running_balance: number
          source: string
          status: string
          system_fee: number
          wallet_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          direction: string
          gross_amount?: number
          id?: string
          mpesa_charge?: number
          mpesa_receipt?: string | null
          net_amount?: number
          notes?: string | null
          occurred_at?: string
          party_name?: string | null
          party_phone?: string | null
          reference_id?: string | null
          reference_table?: string | null
          running_balance?: number
          source: string
          status?: string
          system_fee?: number
          wallet_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          direction?: string
          gross_amount?: number
          id?: string
          mpesa_charge?: number
          mpesa_receipt?: string | null
          net_amount?: number
          notes?: string | null
          occurred_at?: string
          party_name?: string | null
          party_phone?: string | null
          reference_id?: string | null
          reference_table?: string | null
          running_balance?: number
          source?: string
          status?: string
          system_fee?: number
          wallet_type?: string
        }
        Relationships: []
      }
      welfare_settings: {
        Row: {
          contribution_due_day: number
          created_at: string
          id: string
          monthly_contribution_amount: number
          name: string
          penalty_amount: number
          penalty_grace_days: number
          updated_at: string
        }
        Insert: {
          contribution_due_day?: number
          created_at?: string
          id?: string
          monthly_contribution_amount?: number
          name?: string
          penalty_amount?: number
          penalty_grace_days?: number
          updated_at?: string
        }
        Update: {
          contribution_due_day?: number
          created_at?: string
          id?: string
          monthly_contribution_amount?: number
          name?: string
          penalty_amount?: number
          penalty_grace_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      withdrawal_receipts: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          receipt_pdf_url: string
          withdrawal_id: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          receipt_pdf_url: string
          withdrawal_id: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          receipt_pdf_url?: string
          withdrawal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_receipts_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "penalty_withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_signatories: {
        Row: {
          approved_at: string | null
          created_at: string
          id: string
          rejected_at: string | null
          rejection_reason: string | null
          signatory_role: string
          signatory_user_id: string | null
          signature_url: string | null
          status: Database["public"]["Enums"]["signatory_status"]
          updated_at: string
          withdrawal_id: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          id?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          signatory_role: string
          signatory_user_id?: string | null
          signature_url?: string | null
          status?: Database["public"]["Enums"]["signatory_status"]
          updated_at?: string
          withdrawal_id: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          id?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          signatory_role?: string
          signatory_user_id?: string | null
          signature_url?: string | null
          status?: Database["public"]["Enums"]["signatory_status"]
          updated_at?: string
          withdrawal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_signatories_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "penalty_withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_member_with_universal_password: {
        Args: {
          member_id_param?: string
          member_name: string
          member_phone: string
        }
        Returns: string
      }
      assign_user_role: {
        Args: {
          role_param: Database["public"]["Enums"]["app_role"]
          user_id_param: string
        }
        Returns: undefined
      }
      generate_memo_reference: { Args: never; Returns: string }
      get_members_with_roles: {
        Args: never
        Returns: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string
          user_id: string
        }[]
      }
      get_user_conversation_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment: {
        Args: {
          amount: number
          field_name: string
          row_id: string
          table_name: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "member"
        | "user"
        | "chairperson"
        | "vice_chairperson"
        | "secretary"
        | "vice_secretary"
        | "patron"
        | "treasurer"
      signatory_status: "pending" | "approved" | "rejected"
      withdrawal_status:
        | "pending"
        | "submitted"
        | "approved"
        | "rejected"
        | "completed"
        | "cancelled"
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
      app_role: [
        "super_admin",
        "admin",
        "member",
        "user",
        "chairperson",
        "vice_chairperson",
        "secretary",
        "vice_secretary",
        "patron",
        "treasurer",
      ],
      signatory_status: ["pending", "approved", "rejected"],
      withdrawal_status: [
        "pending",
        "submitted",
        "approved",
        "rejected",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
