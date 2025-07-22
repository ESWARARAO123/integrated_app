import React, { useState, useEffect } from 'react';
import { ExtendedChatMessage, ChatSession } from '../../types';
import predictorService from '../../services/predictorService';
import TrainingForm from './TrainingForm';
import { chatbotService } from '../../services/chatbotService';

interface ChatbotPredictionProps {
  activeSessionId: string | null;
  messages: ExtendedChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ExtendedChatMessage[]>>;
  isPredictorEnabled: boolean;
  setIsPredictorEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  createNewSession: (title?: string) => Promise<ChatSession>;
  fetchSessions: () => void;
  setActiveSessionId?: React.Dispatch<React.SetStateAction<string | null>>;
}

// Custom hook that exports the predictor message handler
export const usePredictorHandler = ({
  activeSessionId,
  messages,
  setMessages,
  isPredictorEnabled,
  setIsLoading,
  createNewSession,
  fetchSessions,
  setActiveSessionId,
}: Omit<ChatbotPredictionProps, 'setIsPredictorEnabled'>) => {

  // Helper functions for predictor message persistence
  const savePredictorMessage = (sessionId: string, message: ExtendedChatMessage) => {
    try {
      const key = `predictor_messages_${sessionId}`;
      const existing = localStorage.getItem(key);
      let messages = existing ? JSON.parse(existing) : [];
      
      messages.push({
        ...message,
        timestamp: message.timestamp.toISOString()
      });
      
      if (messages.length > 50) {
        messages = messages.slice(-50);
      }
      
      localStorage.setItem(key, JSON.stringify(messages));
      console.log('Predictor message saved to localStorage:', message.id);
    } catch (error) {
      console.error('Error saving predictor message to localStorage:', error);
    }
  };

  // Session management helper
  const ensurePredictorSession = async (currentSessionId: string | null): Promise<string | null> => {
    if (currentSessionId) return currentSessionId;
    
    try {
      const newSession = await createNewSession('Predictor Session');
      await fetchSessions();
      console.log('Created new session for predictor:', newSession.id);
      
      // Update the active session in the parent component
      if (setActiveSessionId) {
        setActiveSessionId(newSession.id);
      }
      
      return newSession.id;
    } catch (error) {
      console.error('Error creating new session for predictor:', error);
      return null;
    }
  };

  const handlePredictorMessage = async (content: string, meta?: any) => {
    if (!isPredictorEnabled && !meta?.predictor) return false; // Return false to indicate not handled

    console.log('🔮 Predictor mode enabled, processing command:', content);

    // Always create user message for direct user input (when meta is undefined or doesn't indicate server response)
    if (!meta?.isServerResponse) {
      const userMessage: ExtendedChatMessage = {
        id: `predictor-user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
        predictor: true,
        isUserCommand: true,
      };
      
      console.log('🔮 Creating user message:', userMessage);
      setMessages(prev => [...prev, userMessage]);

      // Get or create session for predictor
      let sessionId = await ensurePredictorSession(activeSessionId);
      
      // Save user message to localStorage only (backend will save when processing)
      if (sessionId) {
        savePredictorMessage(sessionId, userMessage);
      }

      // Now process the command and get AI response (this will save to database)
      return await processCommand(content.trim(), sessionId);
    }

    return false; // Not handled if it's a server response
  };

  const processCommand = async (content: string, sessionId: string | null) => {
    if (content.toLowerCase().trim() === 'train') {
      const helpMessage: ExtendedChatMessage = {
        id: `predictor-help-${Date.now()}`,
        role: 'assistant',
        content: `**Training Options**\n\n**Quick Training:**\n \`train <place_table> <cts_table> <route_table>\`\n\n**Examples:**\n \`train reg_place_csv reg_cts_csv reg_route_csv\`\n \`train ariane_place_sorted_csv ariane_cts_sorted_csv ariane_route_sorted_csv\`\n\nWhat tables would you like to use for training?`,
        timestamp: new Date(),
        predictor: true,
        isServerResponse: true,
      };
      
      setMessages(prev => [...prev, helpMessage]);
      
      if (sessionId) {
        savePredictorMessage(sessionId, helpMessage);
      }
      return true; // Handled
    }

    if (content.toLowerCase().trim() === 'predict') {
      const helpMessage: ExtendedChatMessage = {
        id: `predictor-help-${Date.now()}`,
        role: 'assistant',
        content: `**Prediction Options**\n\n**Generate Predictions:**\n \`predict <place_table> <cts_table>\`\n\n**Examples:**\n \`predict reg_place_csv reg_cts_csv\`\n \`predict ariane_place_sorted_csv ariane_cts_sorted_csv\`\n\nWhat tables would you like to use for prediction?`,
        timestamp: new Date(),
        predictor: true,
        isServerResponse: true,
      };
      
      setMessages(prev => [...prev, helpMessage]);
      
      if (sessionId) {
        savePredictorMessage(sessionId, helpMessage);
      }
      return true; // Handled
    }

    // Let the backend handle the command processing and just wait for the response
    try {
      setIsLoading(true);
      
      const result = await chatbotService.sendPredictorMessage(
        content,
        sessionId,
        '',
        {
          predictor: true,
          isUserCommand: true
        }
      );
      
      console.log('🔮 Command sent to chatbot API:', result);

      if ((result as any).predictorData) {
        const predictorData = (result as any).predictorData;
        const aiMessage: ExtendedChatMessage = {
          id: `predictor-ai-${Date.now()}`,
          role: 'assistant',
          content: result.content || 'Command completed',
          timestamp: new Date(),
          predictor: true,
          isServerResponse: true,
          ...(predictorData.predictions && { predictions: predictorData.predictions }),
          ...(predictorData.data && { data: predictorData.data }),
          ...(predictorData.metrics && { metrics: predictorData.metrics }),
          ...(predictorData.total_predictions && { total_predictions: predictorData.total_predictions }),
          ...(predictorData.training_metrics && { training_metrics: predictorData.training_metrics }),
          ...(predictorData.isTrainingComplete && { isTrainingComplete: predictorData.isTrainingComplete }),
          ...(predictorData.error && { error: predictorData.error }),
          ...(predictorData.showDownloadButton && { showDownloadButton: true })
        };
        
        setMessages(prev => [...prev, aiMessage]);
        
        if (sessionId) {
          savePredictorMessage(sessionId, aiMessage);
        }
      }
      
    } catch (error: any) {
      console.error('🔮 Command error:', error);
      
      const errorMessage: ExtendedChatMessage = {
        id: `predictor-error-${Date.now()}`,
        role: 'assistant',
        content: `**Error**\n\n${error.message}`,
        timestamp: new Date(),
        predictor: true,
        isServerResponse: true,
        error: error.message,
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      if (sessionId) {
        savePredictorMessage(sessionId, errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
    
    return true; // Handled
  };

  return { handlePredictorMessage };
};

const ChatbotPrediction: React.FC<ChatbotPredictionProps> = ({
  activeSessionId,
  messages,
  setMessages,
  isPredictorEnabled,
  setIsPredictorEnabled,
  setIsLoading,
  createNewSession,
  fetchSessions,
}) => {
  const [showTrainingForm, setShowTrainingForm] = useState(false);

  // Helper functions for predictor message persistence
  const loadPredictorMessages = (sessionId: string): ExtendedChatMessage[] => {
    try {
      const key = `predictor_messages_${sessionId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const messages = JSON.parse(stored);
        return messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.error('Error loading predictor messages from localStorage:', error);
    }
    return [];
  };

  const savePredictorMessage = (sessionId: string, message: ExtendedChatMessage) => {
    try {
      const key = `predictor_messages_${sessionId}`;
      const existing = localStorage.getItem(key);
      let messages = existing ? JSON.parse(existing) : [];
      
      messages.push({
        ...message,
        timestamp: message.timestamp.toISOString()
      });
      
      if (messages.length > 50) {
        messages = messages.slice(-50);
      }
      
      localStorage.setItem(key, JSON.stringify(messages));
      console.log('Predictor message saved to localStorage:', message.id);
    } catch (error) {
      console.error('Error saving predictor message to localStorage:', error);
    }
  };

  // Listen for predictor messages from TrainingForm
  useEffect(() => {
    const handlePredictorMessage = (event: CustomEvent) => {
      setMessages((prev) => [...prev, event.detail.message]);
    };

    window.addEventListener('addPredictorMessage', handlePredictorMessage as EventListener);
    return () => {
      window.removeEventListener('addPredictorMessage', handlePredictorMessage as EventListener);
    };
  }, [setMessages]);

  // Load predictor messages when session changes
  useEffect(() => {
    if (activeSessionId && isPredictorEnabled) {
      console.log('Loading predictor messages for session:', activeSessionId);
      const predictorMessages = loadPredictorMessages(activeSessionId);
      if (predictorMessages.length > 0) {
        console.log(`Found ${predictorMessages.length} predictor messages in localStorage`);
        setMessages(prev => {
          const existingIds = new Set(prev.map(msg => msg.id));
          const newMessages = predictorMessages.filter(msg => !existingIds.has(msg.id));
          return [...prev, ...newMessages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        });
      }
    }
  }, [activeSessionId, isPredictorEnabled]);

  // Polling for new messages
  useEffect(() => {
    if (!activeSessionId || !isPredictorEnabled) return;

    const messagePollingInterval = setInterval(async () => {
      try {
        const currentMessageCount = messages.length;
        const response = await chatbotService.getSession(activeSessionId);
        
        if (response.messages.length > currentMessageCount) {
          console.log('New messages found, updating messages');
          
          // Convert API messages to ExtendedChatMessage format
          const newMessages = response.messages
            .filter(msg => !messages.some(existing => existing.id === msg.id))
            .map(msg => ({
              ...msg,
              role: msg.role as 'user' | 'assistant' | 'system'
            }));
          
          if (newMessages.length > 0) {
            console.log(`Adding ${newMessages.length} new messages`);
            setMessages(prev => [...prev, ...newMessages].sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            ));
          }
        }
      } catch (error) {
        console.error('Error polling for new messages:', error);
      }
    }, 3000);

    return () => {
      clearInterval(messagePollingInterval);
    };
  }, [activeSessionId, isPredictorEnabled, messages.length]);

  // Handle predictor activation welcome message
  useEffect(() => {
    if (isPredictorEnabled && activeSessionId) {
      const welcomeMessage: ExtendedChatMessage = {
        id: `predictor-activation-${Date.now()}`,
        role: 'assistant',
        content: `🔮 **Predictor Mode Activated**

I'm ready to help you train models and make predictions with any tables in your database!

**Quick Commands:**
 \`train <place_table> <cts_table> <route_table>\` - Train with specific tables
 \`train\` - Get training help
 \`predict <place_table> <cts_table>\` - Generate predictions
 \`predict\` - Get prediction help

**Examples:**
 \`train reg_place_csv reg_cts_csv reg_route_csv\`
 \`train ariane_place_sorted_csv ariane_cts_sorted_csv ariane_route_sorted_csv\`
 \`predict reg_place_csv reg_cts_csv\`
 \`predict ariane_place_sorted_csv ariane_cts_sorted_csv\`

**Features:**
🚀 Fully dynamic - works with any tables in configured database
🔍 Auto-detects available training sets
✅ Real-time validation and suggestions
⚡ Fast training - optimized for speed
📊 Detailed performance metrics

What would you like to do?`,
        timestamp: new Date(),
        predictor: true,
        isServerResponse: true,
      };
      
      setMessages(prev => {
        // Check if we already have a recent welcome message
        const hasRecentWelcome = prev.some(msg => 
          msg.predictor && msg.content.includes('Predictor Mode Activated') &&
          Date.now() - msg.timestamp.getTime() < 5000
        );
        
        if (hasRecentWelcome) {
          return prev;
        }
        
        return [...prev, welcomeMessage];
      });
      
      savePredictorMessage(activeSessionId, welcomeMessage);
      
      try {
        chatbotService.sendPredictorMessage(
          '',
          activeSessionId,
          welcomeMessage.content,
          {
            predictor: welcomeMessage.predictor,
            isServerResponse: welcomeMessage.isServerResponse
          }
        );
      } catch (error) {
        console.error('Error saving welcome message to database:', error);
      }
    }
  }, [isPredictorEnabled, activeSessionId]);

  return (
    <>
      {/* Training form modal */}
      {showTrainingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Train Predictor Model
              </h2>
              <button
                onClick={() => setShowTrainingForm(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <TrainingForm 
              onTrainingComplete={(result) => {
                console.log('Training completed:', result);
                setShowTrainingForm(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotPrediction;