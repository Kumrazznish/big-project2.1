import { supabaseService } from './supabaseService';
import { UserProfile, LearningHistory } from '../types';

interface RoadmapData {
  roadmapId: string;
  subject: string;
  difficulty: string;
  description: string;
  totalDuration: string;
  estimatedHours: string;
  prerequisites: string[];
  learningOutcomes: string[];
  chapters: any[];
}

class UserService {
  async getOrCreateUser(userData: {
    clerkId: string;
    email: string;
    firstName: string;
    lastName: string;
    imageUrl: string;
  }): Promise<UserProfile> {
    try {
      return await supabaseService.getOrCreateUser(userData);
    } catch (error) {
      console.error('Error in userService.getOrCreateUser:', error);
      // Fallback to localStorage if Supabase fails
      const fallbackUser: UserProfile = {
        _id: userData.clerkId,
        clerkId: userData.clerkId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        imageUrl: userData.imageUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      localStorage.setItem(`user_${userData.clerkId}`, JSON.stringify(fallbackUser));
      return fallbackUser;
    }
  }

  async updateUser(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    try {
      return await supabaseService.updateUser(userId, data);
    } catch (error) {
      console.error('Error in userService.updateUser:', error);
      // Fallback to localStorage
      const existingUser = localStorage.getItem(`user_${userId}`);
      if (existingUser) {
        const user = JSON.parse(existingUser);
        const updatedUser = { ...user, ...data, updatedAt: new Date().toISOString() };
        localStorage.setItem(`user_${userId}`, JSON.stringify(updatedUser));
        return updatedUser;
      }
      throw error;
    }
  }

  async getUserHistory(userId: string): Promise<LearningHistory[]> {
    try {
      return await supabaseService.getUserHistory(userId);
    } catch (error) {
      console.error('Error in userService.getUserHistory:', error);
      // Fallback to localStorage
      const history = localStorage.getItem(`history_${userId}`);
      return history ? JSON.parse(history) : [];
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
      return await supabaseService.addToHistory(userId, historyData);
    } catch (error) {
      console.error('Error in userService.addToHistory:', error);
      // Fallback to localStorage
      const newHistory: LearningHistory = {
        _id: `history_${Date.now()}`,
        userId,
        ...historyData,
        startedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        chapterProgress: historyData.chapterProgress.map(cp => ({
          ...cp,
          completedAt: cp.completedAt?.toISOString()
        }))
      };
      
      const existingHistory = localStorage.getItem(`history_${userId}`);
      const history = existingHistory ? JSON.parse(existingHistory) : [];
      history.push(newHistory);
      localStorage.setItem(`history_${userId}`, JSON.stringify(history));
      
      return newHistory;
    }
  }

  async updateChapterProgress(userId: string, historyId: string, chapterId: string, completed: boolean): Promise<void> {
    try {
      await supabaseService.updateChapterProgress(userId, historyId, chapterId, completed);
    } catch (error) {
      console.error('Error in userService.updateChapterProgress:', error);
      // Fallback to localStorage
      const existingHistory = localStorage.getItem(`history_${userId}`);
      if (existingHistory) {
        const history = JSON.parse(existingHistory);
        const historyItem = history.find((h: any) => h._id === historyId);
        if (historyItem) {
          const chapterIndex = historyItem.chapterProgress.findIndex(
            (cp: any) => cp.chapterId === chapterId
          );
          if (chapterIndex !== -1) {
            historyItem.chapterProgress[chapterIndex].completed = completed;
            historyItem.chapterProgress[chapterIndex].completedAt = completed ? new Date().toISOString() : undefined;
          } else {
            historyItem.chapterProgress.push({
              chapterId,
              completed,
              completedAt: completed ? new Date().toISOString() : undefined
            });
          }
          historyItem.lastAccessedAt = new Date().toISOString();
          localStorage.setItem(`history_${userId}`, JSON.stringify(history));
        }
      }
    }
  }

  async saveRoadmap(userId: string, roadmapData: RoadmapData): Promise<void> {
    try {
      await supabaseService.saveRoadmap(userId, roadmapData);
    } catch (error) {
      console.error('Error in userService.saveRoadmap:', error);
      // Fallback to localStorage
      localStorage.setItem(`roadmap_${roadmapData.roadmapId}`, JSON.stringify(roadmapData));
    }
  }

  async getRoadmap(userId: string, roadmapId: string): Promise<any | null> {
    try {
      return await supabaseService.getRoadmap(userId, roadmapId);
    } catch (error) {
      console.error('Error in userService.getRoadmap:', error);
      // Fallback to localStorage
      const roadmap = localStorage.getItem(`roadmap_${roadmapId}`);
      return roadmap ? JSON.parse(roadmap) : null;
    }
  }

  async getUserRoadmaps(userId: string): Promise<any[]> {
    try {
      return await supabaseService.getUserRoadmaps(userId);
    } catch (error) {
      console.error('Error in userService.getUserRoadmaps:', error);
      // Fallback to localStorage - scan for roadmap keys
      const roadmaps = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('roadmap_')) {
          try {
            const roadmap = JSON.parse(localStorage.getItem(key) || '');
            roadmaps.push(roadmap);
          } catch (parseError) {
            console.error('Error parsing roadmap from localStorage:', parseError);
          }
        }
      }
      return roadmaps;
    }
  }

  async saveDetailedCourse(userId: string, courseData: {
    roadmapId: string;
    title: string;
    description: string;
    chapters: any[];
  }): Promise<void> {
    try {
      await supabaseService.saveDetailedCourse(userId, courseData);
    } catch (error) {
      console.error('Error in userService.saveDetailedCourse:', error);
      // Fallback to localStorage
      localStorage.setItem(`detailed_course_${courseData.roadmapId}`, JSON.stringify(courseData));
    }
  }

  async getDetailedCourse(userId: string, roadmapId: string): Promise<any | null> {
    try {
      console.log('Getting detailed course from database for:', { userId, roadmapId });
      return await supabaseService.getDetailedCourse(userId, roadmapId);
    } catch (error) {
      console.error('Error in userService.getDetailedCourse:', error);
      // Fallback to localStorage
      console.log('Falling back to localStorage for detailed course');
      const course = localStorage.getItem(`detailed_course_${roadmapId}`);
      return course ? JSON.parse(course) : null;
    }
  }

  async saveDetailedCourse(userId: string, courseData: {
    roadmapId: string;
    title: string;
  async getUserDetailedCourses(userId: string): Promise<any[]> {
    try {
      return await supabaseService.getUserDetailedCourses(userId);
    } catch (error) {
      console.error('Error in userService.getUserDetailedCourses:', error);
      // Fallback to localStorage
      const courses = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('detailed_course_')) {
          try {
            const course = JSON.parse(localStorage.getItem(key) || '');
            courses.push(course);
          } catch (parseError) {
            console.error('Error parsing detailed course from localStorage:', parseError);
          }
        }
      }
      return courses;
    }
  }
}

export const userService = new UserService();