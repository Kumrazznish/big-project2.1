import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          clerk_id: string;
          email: string;
          first_name: string;
          last_name: string;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clerk_id: string;
          email: string;
          first_name: string;
          last_name: string;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clerk_id?: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          image_url?: string | null;
          updated_at?: string;
        };
      };
      learning_history: {
        Row: {
          id: string;
          user_id: string;
          subject: string;
          difficulty: string;
          roadmap_id: string;
          chapter_progress: any;
          learning_preferences: any;
          started_at: string;
          last_accessed_at: string;
          completed_at: string | null;
          time_spent: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject: string;
          difficulty: string;
          roadmap_id: string;
          chapter_progress?: any;
          learning_preferences?: any;
          started_at?: string;
          last_accessed_at?: string;
          completed_at?: string | null;
          time_spent?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject?: string;
          difficulty?: string;
          roadmap_id?: string;
          chapter_progress?: any;
          learning_preferences?: any;
          started_at?: string;
          last_accessed_at?: string;
          completed_at?: string | null;
          time_spent?: string | null;
          updated_at?: string;
        };
      };
      detailed_courses: {
        Row: {
          id: string;
          user_id: string;
          roadmap_id: string;
          title: string;
          description: string;
          chapters: any;
          generated_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          roadmap_id: string;
          title: string;
          description: string;
          chapters?: any;
          generated_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          roadmap_id?: string;
          title?: string;
          description?: string;
          chapters?: any;
          generated_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}