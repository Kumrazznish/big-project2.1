const API_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY,
  import.meta.env.VITE_GEMINI_API_KEY_2,
  import.meta.env.VITE_GEMINI_API_KEY_3,
  import.meta.env.VITE_GEMINI_API_KEY_4,
  import.meta.env.VITE_GEMINI_API_KEY_5,
  import.meta.env.VITE_GEMINI_API_KEY_6,
  import.meta.env.VITE_GEMINI_API_KEY_7,
  import.meta.env.VITE_GEMINI_API_KEY_8,
  import.meta.env.VITE_GEMINI_API_KEY_9,
  import.meta.env.VITE_GEMINI_API_KEY_10
].filter(Boolean).filter(key => key !== 'your_gemini_api_key_1' && !key.startsWith('your_gemini_api_key')); // Remove any undefined keys and placeholder values

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// Enhanced rate limiting with multiple API keys and parallel processing
class MultiKeyRateLimiter {
  private keyUsage: Map<string, { requests: number[]; lastRequest: number; consecutiveErrors: number; isActive: boolean }> = new Map();
  private keyPool: string[] = [];
  private readonly maxRequestsPerKey = 20; // Increased for better throughput
  private readonly timeWindow = 60000; // 1 minute
  private readonly minInterval = 1000; // Reduced to 1 second for faster processing
  private readonly maxConsecutiveErrors = 3;

  constructor() {
    // Initialize tracking for each API key
    API_KEYS.forEach((key, index) => {
      if (key) {
        this.keyUsage.set(key, { 
          requests: [], 
          lastRequest: 0, 
          consecutiveErrors: 0,
          isActive: true
        });
        this.keyPool.push(key);
      }
    });
    console.log(`Initialized rate limiter with ${API_KEYS.length} API keys`);
  }

  getAvailableKeys(count: number = 1): string[] {
    const now = Date.now();
    const availableKeys: string[] = [];
    
    // Sort keys by usage (least used first)
    const sortedKeys = [...this.keyPool].sort((a, b) => {
      const usageA = this.keyUsage.get(a);
      const usageB = this.keyUsage.get(b);
      if (!usageA || !usageB) return 0;
      
      // Clean old requests
      usageA.requests = usageA.requests.filter(time => now - time < this.timeWindow);
      usageB.requests = usageB.requests.filter(time => now - time < this.timeWindow);
      
      return usageA.requests.length - usageB.requests.length;
    });

    for (const key of sortedKeys) {
      if (availableKeys.length >= count) break;
      
      const usage = this.keyUsage.get(key);
      if (!usage || !usage.isActive) continue;

      // Clean old requests
      usage.requests = usage.requests.filter(time => now - time < this.timeWindow);
      
      // Check if this key can make a request
      const canUseKey = usage.requests.length < this.maxRequestsPerKey && 
                       (now - usage.lastRequest) >= this.minInterval &&
                       usage.consecutiveErrors < this.maxConsecutiveErrors;
      
      if (canUseKey) {
        availableKeys.push(key);
      }
    }
    
    return availableKeys;
  }

  recordRequest(apiKey: string): void {
    const usage = this.keyUsage.get(apiKey);
    if (usage) {
      const now = Date.now();
      usage.requests.push(now);
      usage.lastRequest = now;
    }
  }

  recordError(apiKey: string): void {
    const usage = this.keyUsage.get(apiKey);
    if (usage) {
      usage.consecutiveErrors++;
      if (usage.consecutiveErrors >= this.maxConsecutiveErrors) {
        usage.isActive = false;
        // Reactivate after 5 minutes
        setTimeout(() => {
          usage.isActive = true;
          usage.consecutiveErrors = 0;
        }, 300000);
      }
    }
  }

  recordSuccess(apiKey: string): void {
    const usage = this.keyUsage.get(apiKey);
    if (usage) {
      usage.consecutiveErrors = 0;
      usage.isActive = true;
    }
  }

  getStatus(): { 
    canMakeRequest: boolean; 
    waitTime: number; 
    requestsRemaining: number;
    activeKeys: number;
    keyStatuses: Array<{ key: string; requests: number; available: boolean; errors: number }>;
  } {
    const now = Date.now();
    const keyStatuses = API_KEYS.map(key => {
      const usage = this.keyUsage.get(key);
      if (!usage) return { key: key.slice(-8), requests: 0, available: false, errors: 0 };
      
      usage.requests = usage.requests.filter(time => now - time < this.timeWindow);
      const available = usage.requests.length < this.maxRequestsPerKey && 
                       (now - usage.lastRequest) >= this.minInterval &&
                       usage.consecutiveErrors < this.maxConsecutiveErrors &&
                       usage.isActive;
      
      return {
        key: key.slice(-8),
        requests: usage.requests.length,
        available,
        errors: usage.consecutiveErrors
      };
    });

    const activeKeys = keyStatuses.filter(k => k.available).length;
    const totalRemaining = keyStatuses.reduce((sum, k) => sum + Math.max(0, this.maxRequestsPerKey - k.requests), 0);

    return {
      canMakeRequest: activeKeys > 0,
      waitTime: activeKeys > 0 ? 0 : this.minInterval,
      requestsRemaining: totalRemaining,
      activeKeys,
      keyStatuses
    };
  }
}

const rateLimiter = new MultiKeyRateLimiter();

export class GeminiService {
  private async makeRequestWithKey(prompt: string, apiKey: string, requestId: string): Promise<string> {
    try {
      console.log(`[${requestId}] Making request with key ...${apiKey.slice(-8)}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // Reduced timeout

      const requestBody = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.2, // Lower for more consistent results
          topK: 20,
          topP: 0.8,
          maxOutputTokens: 4096, // Reduced for faster responses
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      const response = await fetch(`${API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify(requestBody)
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        rateLimiter.recordError(apiKey);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response structure');
      }

      const content = data.candidates[0].content.parts[0].text;
      if (!content || content.trim().length === 0) {
        throw new Error('Empty response content');
      }

      rateLimiter.recordSuccess(apiKey);
      console.log(`[${requestId}] Success with key ...${apiKey.slice(-8)}`);
      
      return content;

    } catch (error) {
      console.error(`[${requestId}] Request failed:`, error);
      throw error;
    }
  }

  async makeRequest(prompt: string, requestId: string = Math.random().toString(36).substr(2, 9)): Promise<string> {
    if (API_KEYS.length === 0) {
      throw new Error('No valid Gemini API keys configured. Please add your actual API keys to the .env file.');
    }

    const availableKeys = rateLimiter.getAvailableKeys(1);
    
    if (availableKeys.length === 0) {
      throw new Error('All API keys are currently busy or invalid. Please check your API keys and try again.');
    }

    const apiKey = availableKeys[0];
    rateLimiter.recordRequest(apiKey);
    
    return this.makeRequestWithKey(prompt, apiKey, requestId);
  }

  // Parallel processing for multiple requests
  async makeParallelRequests(prompts: { prompt: string; id: string }[]): Promise<{ id: string; result: string; error?: string }[]> {
    const availableKeys = rateLimiter.getAvailableKeys(prompts.length);
    const results: { id: string; result: string; error?: string }[] = [];
    
    // Process requests in batches based on available keys
    const batchSize = Math.min(availableKeys.length, prompts.length);
    
    for (let i = 0; i < prompts.length; i += batchSize) {
      const batch = prompts.slice(i, i + batchSize);
      const batchPromises = batch.map(async (item, index) => {
        const keyIndex = index % availableKeys.length;
        const apiKey = availableKeys[keyIndex];
        
        try {
          rateLimiter.recordRequest(apiKey);
          const result = await this.makeRequestWithKey(item.prompt, apiKey, item.id);
          return { id: item.id, result };
        } catch (error) {
          return { 
            id: item.id, 
            result: '', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to avoid overwhelming the API
      if (i + batchSize < prompts.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results;
  }

  private cleanJsonResponse(response: string): string {
    let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    cleaned = cleaned.trim();
    
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    
    return cleaned.trim();
  }

  // Optimized roadmap generation with parallel processing
  async generateRoadmap(subject: string, difficulty: string, onProgress?: (progress: number, status: string) => void): Promise<any> {
    console.log('Generating roadmap for:', { subject, difficulty });
    
    if (onProgress) onProgress(10, 'Initializing roadmap generation...');
    
    const preferences = JSON.parse(localStorage.getItem('learningPreferences') || '{}');
    
    // Generate roadmap structure first
    const structurePrompt = `Create a comprehensive learning roadmap structure for "${subject}" at "${difficulty}" level.

IMPORTANT: Return ONLY a valid JSON object with NO additional text.

{
  "subject": "${subject}",
  "difficulty": "${difficulty}",
  "description": "Comprehensive ${subject} learning path for ${difficulty} level",
  "totalDuration": "8-12 weeks",
  "estimatedHours": "40-60 hours",
  "prerequisites": ["Basic computer skills", "Internet access"],
  "learningOutcomes": [
    "Master ${subject} fundamentals",
    "Build practical projects",
    "Understand best practices"
  ],
  "chapters": [
    {
      "id": "chapter-1",
      "title": "Introduction to ${subject}",
      "description": "Learn the fundamentals",
      "duration": "1 week",
      "estimatedHours": "4-6 hours",
      "difficulty": "beginner",
      "position": "left",
      "completed": false,
      "keyTopics": ["Basic concepts", "Setup"],
      "skills": ["Fundamentals"],
      "practicalProjects": ["Hello World"],
      "resources": 5
    },
    {
      "id": "chapter-2",
      "title": "Core Concepts",
      "description": "Deep dive into essentials",
      "duration": "1-2 weeks",
      "estimatedHours": "6-8 hours",
      "difficulty": "beginner",
      "position": "right",
      "completed": false,
      "keyTopics": ["Data types", "Functions"],
      "skills": ["Basic syntax"],
      "practicalProjects": ["Calculator"],
      "resources": 7
    }
  ]
}`;

    if (onProgress) onProgress(30, 'Generating roadmap structure...');
    
    try {
      const response = await this.makeRequest(structurePrompt, 'roadmap-structure');
      const cleanedResponse = this.cleanJsonResponse(response);
      const roadmapData = JSON.parse(cleanedResponse);
      
      if (onProgress) onProgress(100, 'Roadmap generated successfully!');
      
      return roadmapData;
    } catch (error) {
      console.error('Roadmap generation failed:', error);
      throw new Error('Failed to generate roadmap. Please try again.');
    }
  }

  // Optimized detailed course generation with parallel processing
  async generateDetailedCourse(roadmap: any, onProgress?: (progress: number, status: string, currentChapter?: string) => void): Promise<any> {
    console.log('Generating detailed course for roadmap:', roadmap.id);
    
    if (onProgress) onProgress(5, 'Starting detailed course generation...');
    
    const chapters = roadmap.chapters || [];
    const totalChapters = chapters.length;
    
    // Generate content for chapters in parallel batches
    const batchSize = Math.min(3, rateLimiter.getStatus().activeKeys); // Process 3 chapters at a time
    const detailedChapters = [];
    
    for (let i = 0; i < chapters.length; i += batchSize) {
      const batch = chapters.slice(i, i + batchSize);
      const currentBatchStart = i;
      
      // Prepare prompts for parallel processing
      const prompts = batch.map((chapter, batchIndex) => {
        const chapterIndex = currentBatchStart + batchIndex;
        
        if (onProgress) {
          onProgress(
            Math.round(((chapterIndex) / totalChapters) * 80) + 10,
            'Generating chapter content...',
            chapter.title
          );
        }
        
        return {
          id: `chapter-${chapter.id}`,
          prompt: `Create comprehensive course content for "${chapter.title}" in ${roadmap.subject}.

IMPORTANT: Return ONLY valid JSON with NO additional text.

{
  "title": "${chapter.title}",
  "description": "${chapter.description}",
  "learningObjectives": [
    "Understand ${chapter.title} fundamentals",
    "Apply concepts practically"
  ],
  "estimatedTime": "${chapter.estimatedHours}",
  "content": {
    "introduction": "Introduction to ${chapter.title}...",
    "mainContent": "Detailed explanation of ${chapter.title} concepts...",
    "keyPoints": [
      "Key concept 1",
      "Key concept 2"
    ],
    "summary": "Summary of ${chapter.title}..."
  },
  "videoId": "dQw4w9WgXcQ",
  "codeExamples": [
    {
      "title": "Basic Example",
      "code": "// Example code\\nconsole.log('${chapter.title}');",
      "explanation": "This example demonstrates basic concepts."
    }
  ],
  "practicalExercises": [
    {
      "title": "Practice Exercise",
      "description": "Apply what you learned",
      "difficulty": "easy"
    }
  ],
  "additionalResources": [
    {
      "title": "Documentation",
      "url": "https://example.com",
      "type": "documentation",
      "description": "Official documentation"
    }
  ],
  "nextSteps": [
    "Practice the exercises",
    "Review examples"
  ]
}`
        };
      });
      
      // Process batch in parallel
      const batchResults = await this.makeParallelRequests(prompts);
      
      // Process results
      for (let j = 0; j < batch.length; j++) {
        const chapter = batch[j];
        const result = batchResults.find(r => r.id === `chapter-${chapter.id}`);
        
        if (result && !result.error) {
          try {
            const cleanedResponse = this.cleanJsonResponse(result.result);
            const chapterContent = JSON.parse(cleanedResponse);
            
            detailedChapters.push({
              ...chapter,
              content: chapterContent,
              quiz: null // Will be generated separately if needed
            });
          } catch (parseError) {
            console.error(`Failed to parse content for chapter ${chapter.id}:`, parseError);
            detailedChapters.push({
              ...chapter,
              content: null,
              quiz: null
            });
          }
        } else {
          console.error(`Failed to generate content for chapter ${chapter.id}:`, result?.error);
          detailedChapters.push({
            ...chapter,
            content: null,
            quiz: null
          });
        }
      }
      
      // Small delay between batches
      if (i + batchSize < chapters.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (onProgress) onProgress(95, 'Finalizing detailed course...');
    
    const detailedCourse = {
      id: `detailed_${roadmap.id}`,
      roadmapId: roadmap.id,
      title: `Complete ${roadmap.subject} Course`,
      description: `Comprehensive ${roadmap.subject} course with detailed content`,
      chapters: detailedChapters,
      generatedAt: new Date().toISOString()
    };
    
    if (onProgress) onProgress(100, 'Detailed course generated successfully!');
    
    return detailedCourse;
  }

  async generateCourseContent(chapterTitle: string, subject: string, difficulty: string): Promise<any> {
    const requestId = `course-${Math.random().toString(36).substr(2, 9)}`;
    
    const prompt = `Create comprehensive course content for "${chapterTitle}" in ${subject} at ${difficulty} level.

IMPORTANT: Return ONLY a valid JSON object with NO additional text.

{
  "title": "${chapterTitle}",
  "description": "Comprehensive guide to ${chapterTitle}",
  "learningObjectives": [
    "Understand ${chapterTitle} fundamentals",
    "Apply concepts practically"
  ],
  "estimatedTime": "4-6 hours",
  "content": {
    "introduction": "Introduction to ${chapterTitle}...",
    "mainContent": "Detailed explanation...",
    "keyPoints": ["Key point 1", "Key point 2"],
    "summary": "Summary of concepts..."
  },
  "videoId": "dQw4w9WgXcQ",
  "codeExamples": [
    {
      "title": "Basic Example",
      "code": "// Example code",
      "explanation": "Explanation"
    }
  ],
  "practicalExercises": [
    {
      "title": "Exercise",
      "description": "Practice exercise",
      "difficulty": "easy"
    }
  ],
  "additionalResources": [
    {
      "title": "Resource",
      "url": "https://example.com",
      "type": "documentation",
      "description": "Description"
    }
  ],
  "nextSteps": ["Practice", "Review"]
}`;

    const response = await this.makeRequest(prompt, requestId);
    const cleanedResponse = this.cleanJsonResponse(response);
    return JSON.parse(cleanedResponse);
  }

  async generateQuiz(chapterTitle: string, subject: string, difficulty: string): Promise<any> {
    const requestId = `quiz-${Math.random().toString(36).substr(2, 9)}`;
    
    const prompt = `Create a quiz for "${chapterTitle}" in ${subject} at ${difficulty} level.

IMPORTANT: Return ONLY valid JSON with NO additional text.

{
  "chapterId": "chapter-quiz",
  "title": "Quiz: ${chapterTitle}",
  "description": "Test your understanding",
  "timeLimit": 600,
  "passingScore": 70,
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "question": "What is ${chapterTitle}?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 1,
      "explanation": "Explanation here",
      "difficulty": "easy",
      "points": 10
    }
  ],
  "totalQuestions": 5,
  "totalPoints": 50
}`;

    const response = await this.makeRequest(prompt, requestId);
    const cleanedResponse = this.cleanJsonResponse(response);
    return JSON.parse(cleanedResponse);
  }

  getRateLimitStatus() {
    return rateLimiter.getStatus();
  }
}

export const geminiService = new GeminiService();