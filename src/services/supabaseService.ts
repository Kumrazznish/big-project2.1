import { supabase } from './supabase';
import { UserProfile, LearningHistory } from '../types';

class SupabaseService {
  async getOrCreateUser(userData: {
    clerkId: string;
    email: string;
    firstName: string;
    lastName: string;
    imageUrl: string;
  }): Promise<UserProfile> {
    try {
      // First, try to find user by clerkId
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('clerk_id', userData.clerkId)
        .single();

      if (existingUser && !fetchError) {
        // User exists, update their info
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({
            email: userData.email,
            first_name: userData.firstName,
            last_name: userData.lastName,
            image_url: userData.imageUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (updateError) throw updateError;

        return {
          _id: updatedUser.id,
          clerkId: updatedUser.clerk_id,
          email: updatedUser.email,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          imageUrl: updatedUser.image_url || '',
          createdAt: updatedUser.created_at,
          updatedAt: updatedUser.updated_at
        };
      } else {
        // User doesn't exist, create new one
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            clerk_id: userData.clerkId,
            email: userData.email,
            first_name: userData.firstName,
            last_name: userData.lastName,
            image_url: userData.imageUrl
          })
          .select()
          .single();

        if (createError) throw createError;

        return {
          _id: newUser.id,
          clerkId: newUser.clerk_id,
          email: newUser.email,
          firstName: newUser.first_name,
          lastName: newUser.last_name,
          imageUrl: newUser.image_url || '',
          createdAt: newUser.created_at,
          updatedAt: newUser.updated_at
        };
      }
    } catch (error) {
      console.error('Error getting or creating user:', error);
      throw error;
    }
  }

  async updateUser(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (data.email) updateData.email = data.email;
      if (data.firstName) updateData.first_name = data.firstName;
      if (data.lastName) updateData.last_name = data.lastName;
      if (data.imageUrl) updateData.image_url = data.imageUrl;

      const { data: updatedUser, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      return {
        _id: updatedUser.id,
        clerkId: updatedUser.clerk_id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        imageUrl: updatedUser.image_url || '',
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at
      };
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async getUserHistory(userId: string): Promise<LearningHistory[]> {
    try {
      const { data: history, error } = await supabase
        .from('learning_history')
        .select('*')
        .eq('user_id', userId)
        .order('last_accessed_at', { ascending: false });

      if (error) throw error;

      return history.map(item => ({
        _id: item.id,
        userId: item.user_id,
        subject: item.subject,
        difficulty: item.difficulty,
        roadmapId: item.roadmap_id,
        chapterProgress: item.chapter_progress || [],
        learningPreferences: item.learning_preferences || {},
        startedAt: item.started_at,
        lastAccessedAt: item.last_accessed_at,
        completedAt: item.completed_at,
        timeSpent: item.time_spent
      }));
    } catch (error) {
      console.error('Error getting user history:', error);
      throw error;
    }
  }

  async addToHistory(userId: string, historyData: {
    subject: string;
    difficulty: string;
    roadmapId: string;
    chapterProgress: { chapterId: string; completed: boolean; completedAt?: Date }[];
    learningPreferences: {
      learningStyle: string;
      timeCommitment: string;
      goals: string[];
    };
  }): Promise<LearningHistory> {
    try {
      const { data: newHistory, error } = await supabase
        .from('learning_history')
        .insert({
          user_id: userId,
          subject: historyData.subject,
          difficulty: historyData.difficulty,
          roadmap_id: historyData.roadmapId,
          chapter_progress: historyData.chapterProgress.map(cp => ({
            chapterId: cp.chapterId,
            completed: cp.completed,
            completedAt: cp.completedAt?.toISOString()
          })),
          learning_preferences: historyData.learningPreferences,
          started_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return {
        _id: newHistory.id,
        userId: newHistory.user_id,
        subject: newHistory.subject,
        difficulty: newHistory.difficulty,
        roadmapId: newHistory.roadmap_id,
        chapterProgress: newHistory.chapter_progress || [],
        learningPreferences: newHistory.learning_preferences || {},
        startedAt: newHistory.started_at,
        lastAccessedAt: newHistory.last_accessed_at,
        completedAt: newHistory.completed_at,
        timeSpent: newHistory.time_spent
      };
    } catch (error) {
      console.error('Error adding to history:', error);
      throw error;
    }
  }

  async updateChapterProgress(userId: string, historyId: string, chapterId: string, completed: boolean): Promise<void> {
    try {
      // Get current history
      const { data: history, error: fetchError } = await supabase
        .from('learning_history')
        .select('chapter_progress')
        .eq('id', historyId)
        .eq('user_id', userId)
        .single();

      if (fetchError) throw fetchError;

      const chapterProgress = history.chapter_progress || [];
      
      // Find and update the chapter progress
      const chapterIndex = chapterProgress.findIndex(
        (chapter: any) => chapter.chapterId === chapterId
      );
      
      if (chapterIndex !== -1) {
        chapterProgress[chapterIndex].completed = completed;
        chapterProgress[chapterIndex].completedAt = completed ? new Date().toISOString() : null;
      } else {
        // Add new chapter progress if it doesn't exist
        chapterProgress.push({
          chapterId,
          completed,
          completedAt: completed ? new Date().toISOString() : null
        });
      }
      
      // Check if all chapters are completed
      const allCompleted = chapterProgress.every((chapter: any) => chapter.completed);
      
      const updateData: any = {
        chapter_progress: chapterProgress,
        last_accessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      if (allCompleted) {
        updateData.completed_at = new Date().toISOString();
      }
      
      const { error: updateError } = await supabase
        .from('learning_history')
        .update(updateData)
        .eq('id', historyId)
        .eq('user_id', userId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error updating chapter progress:', error);
      throw error;
    }
  }

  async saveDetailedCourse(userId: string, courseData: {
    roadmapId: string;
    title: string;
    description: string;
    chapters: any[];
  }): Promise<void> {
    try {
      console.log('Checking for existing detailed course in database...');
      // Check if course already exists
      const { data: existingCourse, error: fetchError } = await supabase
        .from('detailed_courses')
        .select('id')
        .eq('user_id', userId)
        .eq('roadmap_id', courseData.roadmapId)
        .single();

      if (existingCourse) {
        console.log('Updating existing detailed course in database');
        // Update existing course
        const { error: updateError } = await supabase
          .from('detailed_courses')
          .update({
            title: courseData.title,
            description: courseData.description,
            chapters: courseData.chapters,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCourse.id);

        if (updateError) throw updateError;
        console.log('Successfully updated existing detailed course');
      } else {
        console.log('Creating new detailed course in database');
        // Create new course
        const { error: insertError } = await supabase
          .from('detailed_courses')
          .insert({
            user_id: userId,
            roadmap_id: courseData.roadmapId,
            title: courseData.title,
            description: courseData.description,
            chapters: courseData.chapters,
            generated_at: new Date().toISOString()
          });

        if (insertError) throw insertError;
        console.log('Successfully created new detailed course');
      }
    } catch (error) {
      console.error('Error saving detailed course:', error);
      throw error;
    }
  }

  async getDetailedCourse(userId: string, roadmapId: string): Promise<any | null> {
    try {
      console.log('Fetching detailed course from database:', { userId, roadmapId });
      const { data: course, error } = await supabase
        .from('detailed_courses')
        .select('*')
        .eq('user_id', userId)
        .eq('roadmap_id', roadmapId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"

      if (!course) {
        console.log('No detailed course found in database');
        return null;
      }

      console.log('Found detailed course in database');
      return {
        id: course.id,
        roadmapId: course.roadmap_id,
        title: course.title,
        description: course.description,
        chapters: course.chapters || [],
        generatedAt: course.generated_at
      };
    } catch (error) {
      console.error('Error getting detailed course:', error);
      return null;
    }
  }
}

export const supabaseService = new SupabaseService();