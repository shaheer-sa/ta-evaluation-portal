export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      assessments: {
        Row: {
          created_at: string
          id: string
          max_marks: number
          section_course_id: string
          title: string
          type: "assignment" | "quiz" | "mid" | "final" | "project" | "cp"
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          max_marks: number
          section_course_id: string
          title: string
          type: "assignment" | "quiz" | "mid" | "final" | "project" | "cp"
          updated_at?: string
          weight: number
        }
        Update: {
          created_at?: string
          id?: string
          max_marks?: number
          section_course_id?: string
          title?: string
          type?: "assignment" | "quiz" | "mid" | "final" | "project" | "cp"
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessments_section_course_id_fkey"
            columns: ["section_course_id"]
            isOneToOne: true
            referencedRelation: "section_courses"
            referencedColumns: ["id"]
          }
        ]
      }
      courses: {
        Row: {
          code: string
          created_at: string
          enable_assignments: boolean
          enable_cp: boolean
          enable_quizzes: boolean
          enable_reeval: boolean
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          enable_assignments?: boolean
          enable_cp?: boolean
          enable_quizzes?: boolean
          enable_reeval?: boolean
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          enable_assignments?: boolean
          enable_cp?: boolean
          enable_quizzes?: boolean
          enable_reeval?: boolean
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          created_at: string
          id: string
          section_id: string
          student_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          section_id: string
          student_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          section_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: true
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      marks: {
        Row: {
          assessment_id: string
          created_at: string
          enrollment_id: string
          id: string
          score: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assessment_id: string
          created_at?: string
          enrollment_id: string
          id?: string
          score: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assessment_id?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          score?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marks_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          recipient_id: string
          related_id: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id: string
          related_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id?: string
          related_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          role: "ta" | "student"
          roll_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          role: "ta" | "student"
          roll_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: "ta" | "student"
          roll_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      queries: {
        Row: {
          assessment_id: string | null
          created_at: string
          description: string
          enrollment_id: string
          id: string
          priority: "low" | "medium" | "high"
          status: "pending" | "in_review" | "resolved" | "rejected"
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          description: string
          enrollment_id: string
          id?: string
          priority?: "low" | "medium" | "high"
          status?: "pending" | "in_review" | "resolved" | "rejected"
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          description?: string
          enrollment_id?: string
          id?: string
          priority?: "low" | "medium" | "high"
          status?: "pending" | "in_review" | "resolved" | "rejected"
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "queries_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queries_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      replies: {
        Row: {
          sender_id: string
          message: string
          created_at: string
          id: string
          query_id: string
        }
        Insert: {
          sender_id: string
          message: string
          created_at?: string
          id?: string
          query_id: string
        }
        Update: {
          sender_id?: string
          message?: string
          created_at?: string
          id?: string
          query_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replies_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replies_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: true
            referencedRelation: "queries"
            referencedColumns: ["id"]
          }
        ]
      }
      section_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          section_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          section_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_courses_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: true
            referencedRelation: "sections"
            referencedColumns: ["id"]
          }
        ]
      }
      sections: {
        Row: {
          created_at: string
          id: string
          name: string
          term_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          term_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: true
            referencedRelation: "terms"
            referencedColumns: ["id"]
          }
        ]
      }
      terms: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_class_average: {
        Args: {
          p_assessment_id: string
        }
        Returns: number
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
