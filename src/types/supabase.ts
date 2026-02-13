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
    PostgrestVersion: "13.0.4"
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
      ai_chat_logs: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          question: string
          response_text: string
          result_json: Json | null
          sql_executed: string | null
          tool_called: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          question: string
          response_text: string
          result_json?: Json | null
          sql_executed?: string | null
          tool_called: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          question?: string
          response_text?: string
          result_json?: Json | null
          sql_executed?: string | null
          tool_called?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_messages: {
        Row: {
          clinic_id: string
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      archetype_answers: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          question_id: number
          respondent_id: string | null
          scored_profile: string
          selected_word: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          question_id: number
          respondent_id?: string | null
          scored_profile: string
          selected_word: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          question_id?: number
          respondent_id?: string | null
          scored_profile?: string
          selected_word?: string
        }
        Relationships: [
          {
            foreignKeyName: "archetype_answers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archetype_answers_respondent_id_fkey"
            columns: ["respondent_id"]
            isOneToOne: false
            referencedRelation: "archetype_respondents"
            referencedColumns: ["id"]
          },
        ]
      }
      archetype_public_links: {
        Row: {
          audience_type: string
          clinic_id: string
          collaborator_id: string | null
          created_at: string
          created_by_user_id: string | null
          id: string
          is_active: boolean
          token: string
        }
        Insert: {
          audience_type?: string
          clinic_id: string
          collaborator_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          is_active?: boolean
          token: string
        }
        Update: {
          audience_type?: string
          clinic_id?: string
          collaborator_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          is_active?: boolean
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "archetype_public_links_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archetype_public_links_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "clinic_users"
            referencedColumns: ["id"]
          },
        ]
      }
      archetype_respondents: {
        Row: {
          audience_type: string
          city: string | null
          clinic_id: string
          consent_lgpd: boolean
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          profession: string | null
          public_token: string
          scores: Json
          submitted_by_user_id: string | null
          top_profile: string
          top_profiles: string[] | null
        }
        Insert: {
          audience_type?: string
          city?: string | null
          clinic_id: string
          consent_lgpd?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          profession?: string | null
          public_token: string
          scores: Json
          submitted_by_user_id?: string | null
          top_profile: string
          top_profiles?: string[] | null
        }
        Update: {
          audience_type?: string
          city?: string | null
          clinic_id?: string
          consent_lgpd?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          profession?: string | null
          public_token?: string
          scores?: Json
          submitted_by_user_id?: string | null
          top_profile?: string
          top_profiles?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "archetype_respondents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          ativo: boolean | null
          banco: string
          clinic_id: string | null
          created_at: string | null
          current_balance: number | null
          id: string
          initial_balance: number | null
          nome_conta: string
        }
        Insert: {
          ativo?: boolean | null
          banco: string
          clinic_id?: string | null
          created_at?: string | null
          current_balance?: number | null
          id?: string
          initial_balance?: number | null
          nome_conta: string
        }
        Update: {
          ativo?: boolean | null
          banco?: string
          clinic_id?: string | null
          created_at?: string | null
          current_balance?: number | null
          id?: string
          initial_balance?: number | null
          nome_conta?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          bank_account_id: string | null
          arquivado: boolean | null
          conciliado: boolean | null
          created_at: string | null
          data: string | null
          descricao: string | null
          expense_id_opcional: string | null
          hash_transacao: string | null
          id: string
          revenue_id_opcional: string | null
          tipo: string | null
          valor: number | null
        }
        Insert: {
          bank_account_id?: string | null
          arquivado?: boolean | null
          conciliado?: boolean | null
          created_at?: string | null
          data?: string | null
          descricao?: string | null
          expense_id_opcional?: string | null
          hash_transacao?: string | null
          id?: string
          revenue_id_opcional?: string | null
          tipo?: string | null
          valor?: number | null
        }
        Update: {
          bank_account_id?: string | null
          arquivado?: boolean | null
          conciliado?: boolean | null
          created_at?: string | null
          data?: string | null
          descricao?: string | null
          expense_id_opcional?: string | null
          hash_transacao?: string | null
          id?: string
          revenue_id_opcional?: string | null
          tipo?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_expense_id_opcional_fkey"
            columns: ["expense_id_opcional"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_revenue_id_opcional_fkey"
            columns: ["revenue_id_opcional"]
            isOneToOne: false
            referencedRelation: "revenues"
            referencedColumns: ["id"]
          },
        ]
      }
      card_fees: {
        Row: {
          bandeira: string
          clinic_id: string | null
          created_at: string | null
          id: string
          max_installments: number
          metodo: string
          min_installments: number
          taxa_percent: number
        }
        Insert: {
          bandeira: string
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          max_installments?: number
          metodo?: string
          min_installments?: number
          taxa_percent?: number
        }
        Update: {
          bandeira?: string
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          max_installments?: number
          metodo?: string
          min_installments?: number
          taxa_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "card_fees_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          clinic_id: string | null
          cor_opcional: string | null
          created_at: string | null
          id: string
          name: string
          tipo: string
        }
        Insert: {
          clinic_id?: string | null
          cor_opcional?: string | null
          created_at?: string | null
          id?: string
          name: string
          tipo: string
        }
        Update: {
          clinic_id?: string | null
          cor_opcional?: string | null
          created_at?: string | null
          id?: string
          name?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_users: {
        Row: {
          ativo: boolean | null
          avatar_url: string | null
          clinic_id: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          paginas_liberadas: string[] | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          avatar_url?: string | null
          clinic_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          paginas_liberadas?: string[] | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          avatar_url?: string | null
          clinic_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          paginas_liberadas?: string[] | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_users_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          documento: string | null
          email_contato: string | null
          id: string
          logo_url: string | null
          name: string
          paginas_liberadas: string[] | null
          plano: string | null
          responsavel_nome: string | null
          telefone_contato: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          documento?: string | null
          email_contato?: string | null
          id?: string
          logo_url?: string | null
          name: string
          paginas_liberadas?: string[] | null
          plano?: string | null
          responsavel_nome?: string | null
          telefone_contato?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          documento?: string | null
          email_contato?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          paginas_liberadas?: string[] | null
          plano?: string | null
          responsavel_nome?: string | null
          telefone_contato?: string | null
        }
        Relationships: []
      }
      content_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          banner_url: string | null
          published: boolean | null
          thumbnail_url: string | null
          title: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          banner_url?: string | null
          published?: boolean | null
          thumbnail_url?: string | null
          title?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          banner_url?: string | null
          published?: boolean | null
          thumbnail_url?: string | null
          title?: string | null
          type?: string
        }
        Relationships: []
      }
      content_comments: {
        Row: {
          content: string | null
          content_id: string | null
          created_at: string | null
          id: string
          lesson_id: string | null
          module_id: string | null
          status: string | null
          student_user_id: string | null
        }
        Insert: {
          content?: string | null
          content_id?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          module_id?: string | null
          status?: string | null
          student_user_id?: string | null
        }
        Update: {
          content?: string | null
          content_id?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          module_id?: string | null
          status?: string | null
          student_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_comments_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_comments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "content_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_comments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "content_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      content_lesson_files: {
        Row: {
          created_at: string | null
          file_name: string | null
          file_url: string | null
          id: string
          lesson_id: string | null
        }
        Insert: {
          created_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          lesson_id?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          lesson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_lesson_files_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "content_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      content_lessons: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          module_id: string | null
          order_index: number | null
          panda_video_id: string | null
          panda_video_url: string | null
          published: boolean | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          module_id?: string | null
          order_index?: number | null
          panda_video_id?: string | null
          panda_video_url?: string | null
          published?: boolean | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          module_id?: string | null
          order_index?: number | null
          panda_video_id?: string | null
          panda_video_url?: string | null
          published?: boolean | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "content_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      content_modules: {
        Row: {
          content_id: string | null
          created_at: string | null
          id: string
          order_index: number | null
          title: string | null
          thumbnail_url: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          order_index?: number | null
          title?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          order_index?: number | null
          title?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_modules_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          cep: string | null
          clinic_id: string | null
          cpf: string | null
          created_at: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
        }
        Insert: {
          cep?: string | null
          clinic_id?: string | null
          cpf?: string | null
          created_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
        }
        Update: {
          cep?: string | null
          clinic_id?: string | null
          cpf?: string | null
          created_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          bank_account_id: string | null
          category_id: string | null
          clinic_id: string | null
          created_at: string | null
          data_competencia: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          description: string | null
          forma_pagamento: string | null
          fornecedor: string | null
          id: string
          observacoes: string | null
          parcelas: number | null
          pessoa_tipo: string | null
          status: string
          supplier_id: string | null
          tipo_despesa: string | null
          valor: number | null
        }
        Insert: {
          bank_account_id?: string | null
          category_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          data_competencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          description?: string | null
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          parcelas?: number | null
          pessoa_tipo?: string | null
          status?: string
          supplier_id?: string | null
          tipo_despesa?: string | null
          valor?: number | null
        }
        Update: {
          bank_account_id?: string | null
          category_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          data_competencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          description?: string | null
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          parcelas?: number | null
          pessoa_tipo?: string | null
          status?: string
          supplier_id?: string | null
          tipo_despesa?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      procedures: {
        Row: {
          categoria: string | null
          clinic_id: string | null
          created_at: string | null
          custo_insumo: number | null
          id: string
          procedimento: string
          tempo_minutos: number | null
          valor_cobrado: number | null
        }
        Insert: {
          categoria?: string | null
          clinic_id?: string | null
          created_at?: string | null
          custo_insumo?: number | null
          id?: string
          procedimento: string
          tempo_minutos?: number | null
          valor_cobrado?: number | null
        }
        Update: {
          categoria?: string | null
          clinic_id?: string | null
          created_at?: string | null
          custo_insumo?: number | null
          id?: string
          procedimento?: string
          tempo_minutos?: number | null
          valor_cobrado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "procedures_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_expenses: {
        Row: {
          categoria: string
          clinic_id: string | null
          created_at: string | null
          id: string
          nome: string
          valor_base: number
          valor_calculado: number
        }
        Insert: {
          categoria: string
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
          valor_base: number
          valor_calculado: number
        }
        Update: {
          categoria?: string
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          valor_base?: number
          valor_calculado?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_expenses_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_meeting_participants: {
        Row: {
          clinic_user_id: string
          created_at: string | null
          id: string
          meeting_id: string
        }
        Insert: {
          clinic_user_id: string
          created_at?: string | null
          id?: string
          meeting_id: string
        }
        Update: {
          clinic_user_id?: string
          created_at?: string | null
          id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_meeting_participants_clinic_user_id_fkey"
            columns: ["clinic_user_id"]
            isOneToOne: false
            referencedRelation: "clinic_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "hr_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_meetings: {
        Row: {
          agenda: string | null
          clinic_id: string
          conductor_id: string | null
          created_at: string | null
          created_by: string | null
          department: string | null
          id: string
          meeting_date: string
          meeting_link: string | null
          meeting_time: string | null
          meeting_type: string | null
          next_steps: string | null
          status: string | null
          title: string
        }
        Insert: {
          agenda?: string | null
          clinic_id: string
          conductor_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          id?: string
          meeting_date: string
          meeting_link?: string | null
          meeting_time?: string | null
          meeting_type?: string | null
          next_steps?: string | null
          status?: string | null
          title: string
        }
        Update: {
          agenda?: string | null
          clinic_id?: string
          conductor_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          id?: string
          meeting_date?: string
          meeting_link?: string | null
          meeting_time?: string | null
          meeting_type?: string | null
          next_steps?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_meetings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_meetings_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "clinic_users"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_department_affiliations: {
        Row: {
          affiliated_department_id: string
          created_at: string | null
          department_id: string
          id: string
        }
        Insert: {
          affiliated_department_id: string
          created_at?: string | null
          department_id: string
          id?: string
        }
        Update: {
          affiliated_department_id?: string
          created_at?: string | null
          department_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_department_affiliations_affiliated_department_id_fkey"
            columns: ["affiliated_department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_department_affiliations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_collaborators: {
        Row: {
          admission_date: string | null
          archetype: string | null
          birth_date: string | null
          clinic_id: string
          clinic_user_id: string
          contract_type: string | null
          created_at: string | null
          description: string | null
          function_title: string | null
          id: string
          job_title: string | null
          salary: number | null
        }
        Insert: {
          admission_date?: string | null
          archetype?: string | null
          birth_date?: string | null
          clinic_id: string
          clinic_user_id: string
          contract_type?: string | null
          created_at?: string | null
          description?: string | null
          function_title?: string | null
          id?: string
          job_title?: string | null
          salary?: number | null
        }
        Update: {
          admission_date?: string | null
          archetype?: string | null
          birth_date?: string | null
          clinic_id?: string
          clinic_user_id?: string
          contract_type?: string | null
          created_at?: string | null
          description?: string | null
          function_title?: string | null
          id?: string
          job_title?: string | null
          salary?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_collaborators_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_collaborators_clinic_user_id_fkey"
            columns: ["clinic_user_id"]
            isOneToOne: false
            referencedRelation: "clinic_users"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_departments: {
        Row: {
          clinic_id: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_departments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_feedback_participants: {
        Row: {
          clinic_user_id: string
          created_at: string | null
          feedback_id: string
          id: string
        }
        Insert: {
          clinic_user_id: string
          created_at?: string | null
          feedback_id: string
          id?: string
        }
        Update: {
          clinic_user_id?: string
          created_at?: string | null
          feedback_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_feedback_participants_clinic_user_id_fkey"
            columns: ["clinic_user_id"]
            isOneToOne: false
            referencedRelation: "clinic_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_feedback_participants_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "hr_feedbacks"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_feedbacks: {
        Row: {
          clinic_id: string
          created_at: string | null
          created_by: string | null
          department_id: string | null
          description: string | null
          feedback_date: string | null
          feedback_type: string | null
          id: string
          leader_id: string | null
          result: string | null
          score_management: number | null
          score_personal: number | null
          subject_user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          feedback_date?: string | null
          feedback_type?: string | null
          id?: string
          leader_id?: string | null
          result?: string | null
          score_management?: number | null
          score_personal?: number | null
          subject_user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          feedback_date?: string | null
          feedback_type?: string | null
          id?: string
          leader_id?: string | null
          result?: string | null
          score_management?: number | null
          score_personal?: number | null
          subject_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_feedbacks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_feedbacks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_feedbacks_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "clinic_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_feedbacks_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: false
            referencedRelation: "clinic_users"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
          tipo: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "professionals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_pages: string[] | null
          avatar_url: string | null
          clinic_id: string | null
          created_at: string | null
          full_name: string | null
          id: string
          role: string | null
        }
        Insert: {
          admin_pages?: string[] | null
          avatar_url?: string | null
          clinic_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          role?: string | null
        }
        Update: {
          admin_pages?: string[] | null
          avatar_url?: string | null
          clinic_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_procedures: {
        Row: {
          categoria: string | null
          clinic_id: string | null
          created_at: string | null
          id: string
          is_sold: boolean | null
          procedimento: string | null
          procedure_id: string | null
          quantidade: number | null
          revenue_id: string | null
          valor_cobrado: number | null
        }
        Insert: {
          categoria?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          is_sold?: boolean | null
          procedimento?: string | null
          procedure_id?: string | null
          quantidade?: number | null
          revenue_id?: string | null
          valor_cobrado?: number | null
        }
        Update: {
          categoria?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          is_sold?: boolean | null
          procedimento?: string | null
          procedure_id?: string | null
          quantidade?: number | null
          revenue_id?: string | null
          valor_cobrado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_revenue_procedures_clinic_id"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_procedures_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_procedures_revenue_id_fkey"
            columns: ["revenue_id"]
            isOneToOne: false
            referencedRelation: "revenues"
            referencedColumns: ["id"]
          },
        ]
      }
      revenues: {
        Row: {
          bandeira: string | null
          bank_account_id: string | null
          boleto_due_date: string | null
          category_id: string | null
          cheque_bank: string | null
          cheque_due_date: string | null
          cheque_number: string | null
          cheque_pages: number | null
          cheque_value: number | null
          clinic_id: string | null
          created_at: string | null
          data_competencia: string | null
          data_recebimento: string | null
          description: string | null
          exec_professional_id: string | null
          forma_pagamento: string | null
          forma_pagamento_taxa: number | null
          id: string
          observacoes: string | null
          paciente: string | null
          parcelas: number | null
          recebimento_parcelas: Json | null
          sale_number: string
          sale_professional_id: string | null
          status: string
          valor: number | null
          valor_bruto: number | null
          valor_liquido: number | null
        }
        Insert: {
          bandeira?: string | null
          bank_account_id?: string | null
          boleto_due_date?: string | null
          category_id?: string | null
          cheque_bank?: string | null
          cheque_due_date?: string | null
          cheque_number?: string | null
          cheque_pages?: number | null
          cheque_value?: number | null
          clinic_id?: string | null
          created_at?: string | null
          data_competencia?: string | null
          data_recebimento?: string | null
          description?: string | null
          exec_professional_id?: string | null
          forma_pagamento?: string | null
          forma_pagamento_taxa?: number | null
          id?: string
          observacoes?: string | null
          paciente?: string | null
          parcelas?: number | null
          recebimento_parcelas?: Json | null
          sale_number?: string
          sale_professional_id?: string | null
          status?: string
          valor?: number | null
          valor_bruto?: number | null
          valor_liquido?: number | null
        }
        Update: {
          bandeira?: string | null
          bank_account_id?: string | null
          boleto_due_date?: string | null
          category_id?: string | null
          cheque_bank?: string | null
          cheque_due_date?: string | null
          cheque_number?: string | null
          cheque_pages?: number | null
          cheque_value?: number | null
          clinic_id?: string | null
          created_at?: string | null
          data_competencia?: string | null
          data_recebimento?: string | null
          description?: string | null
          exec_professional_id?: string | null
          forma_pagamento?: string | null
          forma_pagamento_taxa?: number | null
          id?: string
          observacoes?: string | null
          paciente?: string | null
          parcelas?: number | null
          recebimento_parcelas?: Json | null
          sale_number?: string
          sale_professional_id?: string | null
          status?: string
          valor?: number | null
          valor_bruto?: number | null
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "revenues_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenues_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenues_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenues_exec_professional_id_fkey"
            columns: ["exec_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenues_sale_professional_id_fkey"
            columns: ["sale_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          clinic_id: string | null
          cnpj: string | null
          created_at: string | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          clinic_id?: string | null
          cnpj?: string | null
          created_at?: string | null
          id?: string
          nome: string
          telefone?: string | null
        }
        Update: {
          clinic_id?: string | null
          cnpj?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notes: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      app_current_user: {
        Row: {
          clinic_id: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          clinic_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          clinic_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_clinic_id: { Args: never; Returns: string }
      get_cashflow_projection: {
        Args: { p_clinic_id: string; p_days: number }
        Returns: {
          saldo: number
          total_pagar: number
          total_receber: number
        }[]
      }
      get_payables_summary: {
        Args: { p_clinic_id: string; p_days: number }
        Returns: {
          category: string
          items: number
          total: number
        }[]
      }
      get_receivables_summary: {
        Args: { p_clinic_id: string; p_days: number }
        Returns: {
          category: string
          items: number
          total: number
        }[]
      }
      get_top_procedures_profitability: {
        Args: { p_clinic_id: string; p_days: number }
        Returns: {
          itens: number
          lucro: number
          procedimento: string
        }[]
      }
      is_clinic_admin: { Args: { p_clinic_id: string }; Returns: boolean }
      is_clinic_member: { Args: { p_clinic_id: string }; Returns: boolean }
      submit_archetype_response: {
        Args: {
          p_public_token: string
          p_clinic_id: string
          p_audience_type: string
          p_name: string
          p_email: string | null
          p_phone: string | null
          p_profession: string | null
          p_city: string | null
          p_consent_lgpd: boolean
          p_scores: Json
          p_top_profile: string
          p_top_profiles: string[] | null
          p_answers: Json
        }
        Returns: string
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
