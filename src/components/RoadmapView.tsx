import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { geminiService } from '../services/geminiService';
import { userService } from '../services/userService';
import { ArrowLeft, CheckCircle, Circle, Clock, Play, Award, BookOpen, Target, Zap, Brain, Star, TrendingUp, Sparkles, AlertCircle, RefreshCw, Download, Share, Eye, BarChart3, Users, Globe, Code, Palette, Calculator, Database, Smartphone, Camera, Headphones, Monitor, Wifi, Settings, Lock, Layers, Cpu } from 'lucide-react';

interface Chapter {
  id: string;
  title: string;
  description: string;
  duration: string;
  estimatedHours: string;
  difficulty: string;
  position: 'left' | 'right';
  completed: boolean;
  keyTopics: string[];
  skills: string[];
  practicalProjects: string[];
  resources: number;
}

interface Roadmap {
  id: string;
  subject: string;
  difficulty: string;
  description: string;
  totalDuration: string;
  estimatedHours: string;
  prerequisites: string[];
  learningOutcomes: string[];
  chapters: Chapter[];
}

interface RoadmapViewProps {
  subject: string;
  difficulty: string;
  onBack: () => void;
  onChapterSelect: (chapter: Chapter) => void;
  onDetailedCourseGenerated: (courseData: any) => void;
}

const RoadmapView: React.FC<RoadmapViewProps> = ({ 
  subject, 
  difficulty, 
  onBack, 
  onChapterSelect, 
  onDetailedCourseGenerated 
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [generatingDetailedCourse, setGeneratingDetailedCourse] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [currentGeneratingChapter, setCurrentGeneratingChapter] = useState('');

  const maxRetries = 3;

  useEffect(() => {
    generateRoadmap();
  }, [subject, difficulty]);

  const generateRoadmap = async () => {
    setLoading(true);
    setError(null);
    setGenerationProgress(0);
    setGenerationStatus('Initializing...');
    
    try {
      console.log('Generating roadmap for:', { subject, difficulty });
      
      // Check rate limit status before making request
      const rateLimitStatus = geminiService.getRateLimitStatus();
      if (!rateLimitStatus.canMakeRequest) {
        throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(rateLimitStatus.waitTime / 1000)} seconds before trying again.`);
      }
      
      const roadmapData = await geminiService.generateRoadmap(
        subject, 
        difficulty,
        (progress, status) => {
          setGenerationProgress(progress);
          setGenerationStatus(status);
        }
      );
      
      console.log('Generated roadmap:', roadmapData);
      
      // Create unique roadmap ID
      const roadmapId = `roadmap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const roadmapWithId = {
        ...roadmapData,
        id: roadmapId
      };
      
      setRoadmap(roadmapWithId);
      
      // Save roadmap to database if user is logged in
      if (user) {
        try {
          await userService.saveRoadmap(user._id, {
            roadmapId,
            subject: roadmapData.subject,
            difficulty: roadmapData.difficulty,
            description: roadmapData.description,
            totalDuration: roadmapData.totalDuration,
            estimatedHours: roadmapData.estimatedHours,
            prerequisites: roadmapData.prerequisites || [],
            learningOutcomes: roadmapData.learningOutcomes || [],
            chapters: roadmapData.chapters || []
          });
          
          // Also add to learning history
          const preferences = JSON.parse(localStorage.getItem('learningPreferences') || '{}');
          await userService.addToHistory(user._id, {
            subject: roadmapData.subject,
            difficulty: roadmapData.difficulty,
            roadmapId,
            chapterProgress: roadmapData.chapters.map((chapter: Chapter) => ({
              chapterId: chapter.id,
              completed: false
            })),
            learningPreferences: {
              learningStyle: preferences.learningStyle || 'mixed',
              timeCommitment: preferences.timeCommitment || 'regular',
              goals: preferences.goals || []
            }
          });
          
          console.log('Roadmap saved to database successfully');
        } catch (dbError) {
          console.error('Failed to save roadmap to database:', dbError);
          // Continue anyway, roadmap is still generated
        }
      }
      
      setRetryCount(0);
    } catch (error) {
      console.error('Failed to generate roadmap:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate roadmap');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      generateRoadmap();
    }
  };

  const generateDetailedCourse = async () => {
    if (!roadmap || !user) return;
    
    setGeneratingDetailedCourse(true);
    setGenerationProgress(0);
    setGenerationStatus('Starting detailed course generation...');
    setCurrentGeneratingChapter('');
    
    try {
      console.log('Starting detailed course generation for roadmap:', roadmap.id);
      
      const detailedCourse = await geminiService.generateDetailedCourse(
        roadmap,
        (progress, status, currentChapter) => {
          setGenerationProgress(progress);
          setGenerationStatus(status);
          if (currentChapter) {
            setCurrentGeneratingChapter(currentChapter);
          }
        }
      );
      
      // Save detailed course to database
      await userService.saveDetailedCourse(user._id, {
        roadmapId: roadmap.id,
        title: detailedCourse.title,
        description: detailedCourse.description,
        chapters: detailedCourse.chapters
      });
      
      console.log('Detailed course saved to database successfully');
      
      // Store in localStorage as backup
      localStorage.setItem(`detailed_course_${roadmap.id}`, JSON.stringify(detailedCourse));
      
      // Navigate to detailed course view
      onDetailedCourseGenerated(detailedCourse);
      
    } catch (error) {
      console.error('Failed to generate detailed course:', error);
      setError('Failed to generate detailed course. Please try again.');
    } finally {
      setGeneratingDetailedCourse(false);
      setGenerationProgress(0);
      setGenerationStatus('');
      setCurrentGeneratingChapter('');
    }
  };

  const getSubjectIcon = (subject: string) => {
    const subjectLower = subject.toLowerCase();
    if (subjectLower.includes('programming') || subjectLower.includes('code')) return Code;
    if (subjectLower.includes('design') || subjectLower.includes('ui')) return Palette;
    if (subjectLower.includes('data') || subjectLower.includes('ai')) return Brain;
    if (subjectLower.includes('web')) return Globe;
    if (subjectLower.includes('math')) return Calculator;
    if (subjectLower.includes('mobile')) return Smartphone;
    if (subjectLower.includes('database')) return Database;
    if (subjectLower.includes('network')) return Wifi;
    if (subjectLower.includes('security')) return Lock;
    if (subjectLower.includes('system')) return Cpu;
    if (subjectLower.includes('media')) return Camera;
    if (subjectLower.includes('audio')) return Headphones;
    if (subjectLower.includes('business')) return Target;
    return BookOpen;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner': return 'from-green-500 to-emerald-500';
      case 'intermediate': return 'from-yellow-500 to-orange-500';
      case 'advanced': return 'from-red-500 to-pink-500';
      default: return 'from-blue-500 to-cyan-500';
    }
  };

  const getChapterIcon = (index: number) => {
    const icons = [BookOpen, Code, Brain, Target, Zap, Star, Award, TrendingUp, BarChart3, Users, Globe, Database, Monitor, Settings, Lock, Layers];
    return icons[index % icons.length];
  };

  if (loading) {
    return (
      <div className={`min-h-screen transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900' 
          : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
      }`}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-8">
            {/* Enhanced Loading Animation for Roadmap */}
            <div className="relative">
              <div className="w-32 h-32 relative">
                <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full animate-spin">
                  <div className="absolute top-0 left-0 w-8 h-8 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full"></div>
                </div>
                <div className="absolute inset-4 border-4 border-purple-500/20 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }}>
                  <div className="absolute top-0 left-0 w-6 h-6 bg-gradient-to-r from-purple-500 to-cyan-600 rounded-full"></div>
                </div>
              </div>
              <Brain className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 text-cyan-500" />
            </div>
            
            <div>
              <h3 className={`text-3xl font-bold mb-4 transition-colors ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                🎯 Crafting Your Perfect Learning Path
              </h3>
              <p className={`text-lg transition-colors ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {generationStatus || `AI is creating a personalized ${subject} roadmap for ${difficulty} level...`}
              </p>
              
              {generationProgress > 0 && (
                <div className="mt-6 max-w-md mx-auto">
                  <div className={`w-full rounded-full h-3 ${
                    theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'
                  }`}>
                    <div 
                      className="bg-gradient-to-r from-cyan-500 to-purple-600 h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${generationProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-cyan-500 font-bold text-sm mt-2">{generationProgress}%</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900' 
          : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
      }`}>
        <div className="flex items-center justify-center min-h-screen">
          <div className={`max-w-lg mx-4 p-10 rounded-3xl border text-center transition-colors ${
            theme === 'dark' 
              ? 'bg-slate-800/50 border-red-500/30 backdrop-blur-xl' 
              : 'bg-white/80 border-red-200 backdrop-blur-xl'
          }`}>
            <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-8">
              <AlertCircle className="w-10 h-10 text-white" />
            </div>
            <h3 className={`text-2xl font-bold mb-6 transition-colors ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Roadmap Generation Failed
            </h3>
            <p className={`mb-8 text-lg transition-colors ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {error}
            </p>
            <div className="space-y-4">
              {retryCount < maxRetries && (
                <button
                  onClick={handleRetry}
                  className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-8 py-4 rounded-xl hover:from-cyan-600 hover:to-purple-700 transition-all duration-300 font-semibold text-lg flex items-center justify-center space-x-3"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span>Try Again ({retryCount + 1}/{maxRetries})</span>
                </button>
              )}
              <button
                onClick={onBack}
                className={`w-full border px-8 py-4 rounded-xl transition-all duration-300 font-semibold text-lg ${
                  theme === 'dark' 
                    ? 'border-gray-600 text-gray-300 hover:border-gray-400 hover:bg-white/5' 
                    : 'border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!roadmap) return null;

  const SubjectIcon = getSubjectIcon(roadmap.subject);
  const completedChapters = roadmap.chapters.filter(ch => ch.completed).length;
  const totalChapters = roadmap.chapters.length;
  const progress = totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;

  // Detailed Course Generation Loading Screen
  if (generatingDetailedCourse) {
    return (
      <div className={`min-h-screen transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900' 
          : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
      }`}>
        <div className="flex items-center justify-center min-h-screen">
          <div className={`max-w-2xl mx-4 p-12 rounded-3xl border text-center transition-colors ${
            theme === 'dark' 
              ? 'bg-slate-800/50 border-white/10 backdrop-blur-xl' 
              : 'bg-white/80 border-gray-200 backdrop-blur-xl'
          }`}>
            {/* Enhanced Loading Animation */}
            <div className="relative mb-8">
              <div className="w-32 h-32 relative mx-auto">
                <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full animate-spin">
                  <div className="absolute top-0 left-0 w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full"></div>
                </div>
                <div className="absolute inset-4 border-4 border-pink-500/20 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '3s' }}>
                  <div className="absolute top-0 left-0 w-6 h-6 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full"></div>
                </div>
              </div>
              <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 text-purple-500" />
            </div>
            
            <h3 className={`text-3xl font-bold mb-4 transition-colors ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              🚀 AI is Working Its Magic
            </h3>
            
            <p className={`text-lg mb-8 transition-colors ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {generationStatus}
            </p>
            
            {currentGeneratingChapter && (
              <div className={`mb-6 p-4 rounded-xl border-l-4 border-purple-500 transition-colors ${
                theme === 'dark' ? 'bg-purple-500/10' : 'bg-purple-50'
              }`}>
                <p className={`font-medium transition-colors ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  Currently generating: {currentGeneratingChapter}
                </p>
              </div>
            )}
            
            {/* Enhanced Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium transition-colors ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Progress
                </span>
                <span className="text-purple-500 font-bold text-lg">
                  {generationProgress}%
                </span>
              </div>
              <div className={`w-full rounded-full h-4 mb-4 ${
                theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'
              }`}>
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-600 h-4 rounded-full transition-all duration-1000 relative overflow-hidden"
                  style={{ width: `${generationProgress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                </div>
              </div>
            </div>
            
            {/* Status Messages */}
            <div className={`text-sm space-y-2 transition-colors ${
              theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'
            }`}>
              <p>✨ Using multiple AI models for faster generation</p>
              <p>🔄 Processing chapters in parallel for optimal speed</p>
              <p>📚 Creating comprehensive content with examples and exercises</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900' 
        : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
    }`}>
      {/* Header */}
      <div className={`backdrop-blur-xl border-b sticky top-0 z-10 transition-colors ${
        theme === 'dark' ? 'bg-black/20 border-white/10' : 'bg-white/80 border-gray-200'
      }`}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <button
            onClick={onBack}
            className={`flex items-center space-x-3 mb-8 px-6 py-3 rounded-xl transition-all duration-300 ${
              theme === 'dark' 
                ? 'text-gray-300 hover:text-white hover:bg-slate-800/50' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="font-semibold text-lg">Back to Selection</span>
          </button>

          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-8">
              <div className={`w-24 h-24 rounded-3xl bg-gradient-to-r ${getDifficultyColor(roadmap.difficulty)} flex items-center justify-center shadow-2xl`}>
                <SubjectIcon className="w-12 h-12 text-white" />
              </div>
              <div>
                <h1 className={`text-4xl font-bold mb-4 transition-colors ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent' 
                    : 'text-gray-900'
                }`}>
                  {roadmap.subject}
                </h1>
                <p className={`text-xl mb-6 max-w-2xl transition-colors ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {roadmap.description}
                </p>
                <div className="flex items-center space-x-8">
                  <div className={`flex items-center space-x-3 transition-colors ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <Clock className="w-6 h-6" />
                    <span className="text-lg font-medium">{roadmap.totalDuration}</span>
                  </div>
                  <div className={`flex items-center space-x-3 transition-colors ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <Target className="w-6 h-6" />
                    <span className="text-lg font-medium">{roadmap.estimatedHours}</span>
                  </div>
                  <div className={`px-4 py-2 rounded-full font-bold bg-gradient-to-r ${getDifficultyColor(roadmap.difficulty)} text-white`}>
                    {roadmap.difficulty.charAt(0).toUpperCase() + roadmap.difficulty.slice(1)}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-cyan-500 font-bold text-3xl mb-2">{Math.round(progress)}%</div>
              <div className={`text-lg transition-colors ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>Complete</div>
              <div className={`w-32 rounded-full h-3 mt-4 ${
                theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'
              }`}>
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 h-3 rounded-full transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Action Buttons */}
        <div className="flex justify-center mb-12">
          <button
            onClick={generateDetailedCourse}
            disabled={generatingDetailedCourse}
            className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-12 py-4 rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-bold text-lg flex items-center space-x-3 shadow-2xl hover:shadow-purple-500/25 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
          >
            {generatingDetailedCourse && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
            )}
            <Sparkles className="w-6 h-6" />
            <span>{generatingDetailedCourse ? 'Generating...' : 'Generate Complete Course'}</span>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className={`backdrop-blur-xl border rounded-3xl p-6 text-center transition-colors ${
            theme === 'dark' 
              ? 'bg-slate-800/50 border-white/10' 
              : 'bg-white/80 border-gray-200'
          }`}>
            <BookOpen className="w-8 h-8 text-blue-500 mx-auto mb-4" />
            <div className={`text-2xl font-bold transition-colors ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {totalChapters}
            </div>
            <div className={`text-sm transition-colors ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>Chapters</div>
          </div>

          <div className={`backdrop-blur-xl border rounded-3xl p-6 text-center transition-colors ${
            theme === 'dark' 
              ? 'bg-slate-800/50 border-white/10' 
              : 'bg-white/80 border-gray-200'
          }`}>
            <Clock className="w-8 h-8 text-green-500 mx-auto mb-4" />
            <div className={`text-2xl font-bold transition-colors ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {roadmap.estimatedHours}
            </div>
            <div className={`text-sm transition-colors ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>Study Time</div>
          </div>

          <div className={`backdrop-blur-xl border rounded-3xl p-6 text-center transition-colors ${
            theme === 'dark' 
              ? 'bg-slate-800/50 border-white/10' 
              : 'bg-white/80 border-gray-200'
          }`}>
            <Award className="w-8 h-8 text-purple-500 mx-auto mb-4" />
            <div className={`text-2xl font-bold transition-colors ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {completedChapters}
            </div>
            <div className={`text-sm transition-colors ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>Completed</div>
          </div>

          <div className={`backdrop-blur-xl border rounded-3xl p-6 text-center transition-colors ${
            theme === 'dark' 
              ? 'bg-slate-800/50 border-white/10' 
              : 'bg-white/80 border-gray-200'
          }`}>
            <TrendingUp className="w-8 h-8 text-orange-500 mx-auto mb-4" />
            <div className={`text-2xl font-bold transition-colors ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {Math.round(progress)}%
            </div>
            <div className={`text-sm transition-colors ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>Progress</div>
          </div>
        </div>

        {/* Prerequisites */}
        {roadmap.prerequisites && roadmap.prerequisites.length > 0 && (
          <div className={`backdrop-blur-xl border rounded-3xl p-8 mb-12 transition-colors ${
            theme === 'dark' 
              ? 'bg-slate-800/50 border-white/10' 
              : 'bg-white/80 border-gray-200'
          }`}>
            <h2 className={`text-2xl font-bold mb-6 flex items-center transition-colors ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              <CheckCircle className="w-7 h-7 mr-3 text-green-500" />
              Prerequisites
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roadmap.prerequisites.map((prerequisite, index) => (
                <div key={index} className={`flex items-center space-x-3 p-4 rounded-xl transition-colors ${
                  theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-50'
                }`}>
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className={`transition-colors ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {prerequisite}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Learning Outcomes */}
        {roadmap.learningOutcomes && roadmap.learningOutcomes.length > 0 && (
          <div className={`backdrop-blur-xl border rounded-3xl p-8 mb-12 transition-colors ${
            theme === 'dark' 
              ? 'bg-slate-800/50 border-white/10' 
              : 'bg-white/80 border-gray-200'
          }`}>
            <h2 className={`text-2xl font-bold mb-6 flex items-center transition-colors ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              <Target className="w-7 h-7 mr-3 text-purple-500" />
              Learning Outcomes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roadmap.learningOutcomes.map((outcome, index) => (
                <div key={index} className={`flex items-start space-x-3 p-4 rounded-xl transition-colors ${
                  theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-50'
                }`}>
                  <Star className="w-5 h-5 text-purple-500 flex-shrink-0 mt-1" />
                  <span className={`transition-colors ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {outcome}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Roadmap Timeline */}
        <div className={`backdrop-blur-xl border rounded-3xl p-8 transition-colors ${
          theme === 'dark' 
            ? 'bg-slate-800/50 border-white/10' 
            : 'bg-white/80 border-gray-200'
        }`}>
          <h2 className={`text-2xl font-bold mb-8 flex items-center transition-colors ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            <BookOpen className="w-7 h-7 mr-3 text-cyan-500" />
            Learning Path
          </h2>

          <div className="relative">
            {/* Timeline Line */}
            <div className={`absolute left-8 top-0 bottom-0 w-1 ${
              theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'
            }`}></div>

            <div className="space-y-8">
              {roadmap.chapters.map((chapter, index) => {
                const ChapterIcon = getChapterIcon(index);
                return (
                  <div
                    key={chapter.id}
                    className={`relative flex items-start space-x-6 p-6 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-105 ${
                      chapter.completed
                        ? theme === 'dark'
                          ? 'bg-green-500/10 border border-green-500/30'
                          : 'bg-green-50 border border-green-200'
                        : theme === 'dark'
                          ? 'bg-slate-700/30 hover:bg-slate-700/50'
                          : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => onChapterSelect(chapter)}
                  >
                    {/* Timeline Node */}
                    <div className={`absolute -left-2 w-6 h-6 rounded-full border-4 ${
                      chapter.completed
                        ? 'bg-green-500 border-green-500'
                        : theme === 'dark'
                          ? 'bg-slate-800 border-slate-600'
                          : 'bg-white border-gray-300'
                    }`}></div>

                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                      chapter.completed
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                        : `bg-gradient-to-r ${getDifficultyColor(chapter.difficulty)}`
                    }`}>
                      {chapter.completed ? (
                        <CheckCircle className="w-8 h-8 text-white" />
                      ) : (
                        <ChapterIcon className="w-8 h-8 text-white" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className={`text-xl font-bold transition-colors ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                          {chapter.title}
                        </h3>
                        <div className="flex items-center space-x-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            theme === 'dark' ? 'bg-slate-600 text-gray-300' : 'bg-gray-200 text-gray-700'
                          }`}>
                            {chapter.duration}
                          </span>
                          {chapter.completed && (
                            <CheckCircle className="w-6 h-6 text-green-500" />
                          )}
                        </div>
                      </div>
                      
                      <p className={`mb-4 transition-colors ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {chapter.description}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <h4 className={`font-semibold mb-2 transition-colors ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Key Topics
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {chapter.keyTopics.slice(0, 3).map((topic, topicIndex) => (
                              <span
                                key={topicIndex}
                                className={`px-2 py-1 rounded text-xs ${
                                  theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {topic}
                              </span>
                            ))}
                            {chapter.keyTopics.length > 3 && (
                              <span className={`px-2 py-1 rounded text-xs ${
                                theme === 'dark' ? 'bg-slate-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                              }`}>
                                +{chapter.keyTopics.length - 3}
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className={`font-semibold mb-2 transition-colors ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Skills
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {chapter.skills.slice(0, 2).map((skill, skillIndex) => (
                              <span
                                key={skillIndex}
                                className={`px-2 py-1 rounded text-xs ${
                                  theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                                }`}
                              >
                                {skill}
                              </span>
                            ))}
                            {chapter.skills.length > 2 && (
                              <span className={`px-2 py-1 rounded text-xs ${
                                theme === 'dark' ? 'bg-slate-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                              }`}>
                                +{chapter.skills.length - 2}
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className={`font-semibold mb-2 transition-colors ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Projects
                          </h4>
                          <div className="flex items-center space-x-2">
                            <Award className="w-4 h-4 text-orange-500" />
                            <span className={`text-sm transition-colors ${
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {chapter.practicalProjects.length} projects
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-cyan-500" />
                            <span className={`text-sm transition-colors ${
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {chapter.estimatedHours}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <BookOpen className="w-4 h-4 text-purple-500" />
                            <span className={`text-sm transition-colors ${
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {chapter.resources} resources
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 text-cyan-500">
                          <span className="font-medium">Start Learning</span>
                          <Play className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoadmapView;