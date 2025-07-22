import React, { useState, useEffect } from 'react';
import { ExtendedChatMessage } from '../../types';
import predictorService from '../../services/predictorService';
import TrainingForm from './TrainingForm';
import { chatbotService } from '../../services/chatbotService';
import ChatInput from '../chat/ChatInput';

interface ChatbotPredictionProps {
  activeSessionId: string | null;
  messages: ExtendedChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ExtendedChatMessage[]>>;
  isPredictorEnabled: boolean;
  setIsPredictorEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  createNewSession: (title: string) => Promise<{ id: string }>;
  fetchSessions: () => void;
}

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
  const [isLoading] = useState(false);

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
        const response = await chatbotService.getSession(activeSessionId, 50, 0);
        
        if (response.messages.length > currentMessageCount) {
          console.log('New messages found, updating messages');
          fetchSessions();
        }
      } catch (error) {
        console.error('Error polling for new messages:', error);
      }
    }, 3000);

    return () => {
      clearInterval(messagePollingInterval);
    };
  }, [activeSessionId, isPredictorEnabled, messages.length, fetchSessions]);

  const handlePredictorMessage = async (content: string, meta?: any) => {
    if (meta?.predictor && meta?.isActivation) {
      try {
        const response = await fetch('/api/chatbot/predictor-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'predictor',
            sessionId: activeSessionId
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.message) {
            const welcomeMessage: ExtendedChatMessage = {
              id: `predictor-welcome-${Date.now()}`,
              role: 'assistant',
              content: result.message,
              timestamp: new Date(),
              predictor: true,
              isServerResponse: true,
            };
            setMessages(prev => [...prev, welcomeMessage]);
          }
        }
      } catch (error) {
        console.error('Error getting predictor welcome message:', error);
      }
      return;
    }

    if (isPredictorEnabled) {
      console.log('?? Predictor mode enabled, processing command:', content);
      
      if (content.toLowerCase().trim() === 'train') {
        setShowTrainingForm(true);
        return;
      }
      
      const parsedTables = predictorService.parseTableNamesFromCommand(content);
      console.log('?? Parsed tables from command:', parsedTables);
      
      if (parsedTables) {
        const userMessage: ExtendedChatMessage = {
          id: `predictor-user-${Date.now()}`,
          role: 'user',
          content: content,
          timestamp: new Date(),
          predictor: true,
          isUserCommand: true,
        };
        
        setMessages(prev => [...prev, userMessage]);
        
        if (activeSessionId) {
          savePredictorMessage(activeSessionId, userMessage);
        }
        
        if (content.toLowerCase().startsWith('train ')) {
          if (parsedTables.place && parsedTables.cts && parsedTables.route) {
            console.log('?? Executing training with tables:', parsedTables);
            
            try {
              setIsLoading(true);
              
              const result = await chatbotService.sendPredictorMessage(
                content,
                activeSessionId,
                '',
                {
                  predictor: true,
                  isUserCommand: true
                }
              );
              
              console.log('?? Training command sent to chatbot API:', result);

              if ((result as any).predictorData) {
                const predictorData = (result as any).predictorData;
                const aiMessage: ExtendedChatMessage = {
                  id: `predictor-ai-${Date.now()}`,
                  role: 'assistant',
                  content: result.content || 'Training completed',
                  timestamp: new Date(),
                  predictor: true,
                  isServerResponse: true,
                  ...(predictorData.model_id && { model_id: predictorData.model_id }),
                  ...(predictorData.training_metrics && { training_metrics: predictorData.training_metrics }),
                  ...(predictorData.isTrainingComplete && { isTrainingComplete: predictorData.isTrainingComplete })
                };
                
                setMessages(prev => [...prev, aiMessage]);
                
                if (activeSessionId) {
                  savePredictorMessage(activeSessionId, aiMessage);
                }

                if (predictorData.followupMessage) {
                  setTimeout(() => {
                    const followupMessage: ExtendedChatMessage = {
                      id: `predictor-followup-${Date.now()}`,
                      role: 'assistant',
                      content: predictorData.followupMessage.message,
                      timestamp: new Date(),
                      predictor: true,
                      isServerResponse: true,
                    };
                    
                    setMessages(prev => [...prev, followupMessage]);
                    
                    if (activeSessionId) {
                      savePredictorMessage(activeSessionId, followupMessage);
                    }
                  }, 2000);
                }
              }
              
            } catch (error: any) {
              console.error('?? Training error:', error);
              
              const errorMessage: ExtendedChatMessage = {
                id: `predictor-error-${Date.now()}`,
                role: 'assistant',
                content: `**Training Error**\n\n${error.message}`,
                timestamp: new Date(),
                predictor: true,
                isServerResponse: true,
                error: error.message,
              };
              
              setMessages(prev => [...prev, errorMessage]);
              
              if (activeSessionId) {
                savePredictorMessage(activeSessionId, errorMessage);
              }
            } finally {
              setIsLoading(false);
            }
          } else {
            const errorMessage: ExtendedChatMessage = {
              id: `predictor-error-${Date.now()}`,
              role: 'assistant',
              content: `**Invalid Training Command**\n\n**Correct format:** \`train <place_table> <cts_table> <route_table>\`\n\n**Examples:**\n \`train ariane_place_sorted_csv ariane_cts_sorted_csv ariane_route_sorted_csv\`\n \`train reg_place_csv reg_cts_csv reg_route_csv\``,
              timestamp: new Date(),
              predictor: true,
              isServerResponse: true,
            };
            
            setMessages(prev => [...prev, errorMessage]);
            
            if (activeSessionId) {
              savePredictorMessage(activeSessionId, errorMessage);
            }
          }
        } else if (content.toLowerCase().startsWith('predict ')) {
          console.log('?? Executing prediction with tables:', parsedTables);
          
          try {
            setIsLoading(true);
            
            const result = await chatbotService.sendPredictorMessage(
              content,
              activeSessionId,
              '',
              {
                predictor: true,
                isUserCommand: true
              }
            );
            
            console.log('?? Prediction command sent to chatbot API:', result);

            if ((result as any).predictorData) {
              const predictorData = (result as any).predictorData;
              const aiMessage: ExtendedChatMessage = {
                id: `predictor-ai-${Date.now()}`,
                role: 'assistant',
                content: result.content || 'Prediction completed',
                timestamp: new Date(),
                predictor: true,
                isServerResponse: true,
                predictions: predictorData.predictions,
                ...(predictorData.data && { data: predictorData.data }),
                ...(predictorData.metrics && { metrics: predictorData.metrics }),
                ...(predictorData.total_predictions && { total_predictions: predictorData.total_predictions }),
                showDownloadButton: true
              };
              
              setMessages(prev => [...prev, aiMessage]);
              
              if (activeSessionId) {
              savePredictorMessage(activeSessionId, aiMessage);
              }
            }
            
          } catch (error: any) {
            console.error('?? Prediction error:', error);
            
            const errorMessage: ExtendedChatMessage = {
              id: `predictor-error-${Date.now()}`,
              role: 'assistant',
              content: `**Prediction Error**\n\n${error.message}`,
              timestamp: new Date(),
              predictor: true,
              isServerResponse: true,
              error: error.message,
            };
            
            setMessages(prev => [...prev, errorMessage]);
            
            if (activeSessionId) {
              savePredictorMessage(activeSessionId, errorMessage);
            }
          } finally {
            setIsLoading(false);
          }
        } else if (content.toLowerCase().trim() === 'train') {
          try {
            setIsLoading(true);
            
            const result = await chatbotService.sendPredictorMessage(
              content,
              activeSessionId,
              '',
              {
                predictor: true,
                isUserCommand: true
              }
            );
            
            console.log('?? Basic train command sent to chatbot API:', result);

            if ((result as any).predictorData) {
              const predictorData = (result as any).predictorData;
              const aiMessage: ExtendedChatMessage = {
                id: `predictor-ai-${Date.now()}`,
                role: 'assistant',
                content: result.content || 'Training form displayed',
                timestamp: new Date(),
                predictor: true,
                isServerResponse: true,
                ...(predictorData.showTrainingForm && { showTrainingForm: predictorData.showTrainingForm })
              };
              
              setMessages(prev => [...prev, aiMessage]);
              
              if (activeSessionId) {
                savePredictorMessage(activeSessionId, aiMessage);
              }
            }
            
          } catch (error: any) {
            console.error('?? Basic train command error:', error);
            
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
            
            if (activeSessionId) {
              savePredictorMessage(activeSessionId, errorMessage);
            }
          } finally {
            setIsLoading(false);
          }
        } else if (content.toLowerCase().trim() === 'predict') {
          try {
            setIsLoading(true);
            
            const result = await chatbotService.sendPredictorMessage(
              content,
              activeSessionId,
              '',
              {
                predictor: true,
                isUserCommand: true
              }
            );
            
            console.log('?? Basic predict command sent to chatbot API:', result);

            if ((result as any).predictorData) {
              const aiMessage: ExtendedChatMessage = {
                id: `predictor-ai-${Date.now()}`,
                role: 'assistant',
                content: result.content || 'Prediction help displayed',
                timestamp: new Date(),
                predictor: true,
                isServerResponse: true
              };
              
              setMessages(prev => [...prev, aiMessage]);
              
              if (activeSessionId) {
                savePredictorMessage(activeSessionId, aiMessage);
              }
            }
            
          } catch (error: any) {
            console.error('?? Basic predict command error:', error);
            
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
            
            if (activeSessionId) {
              savePredictorMessage(activeSessionId, errorMessage);
            }
          } finally {
            setIsLoading(false);
          }
        } else {
          const userMessage: ExtendedChatMessage = {
            id: `predictor-user-${Date.now()}`,
            role: 'user',
            content: content,
            timestamp: new Date(),
            predictor: true,
            isUserCommand: true,
          };
          
          setMessages(prev => [...prev, userMessage]);
          
          const helpMessage: ExtendedChatMessage = {
            id: `predictor-help-${Date.now()}`,
            role: 'assistant',
            content: `**Predictor Commands**\n\n**Training:**\n \`train <place_table> <cts_table> <route_table>\`\n \`train\` - Open training form with available tables\n\n**Prediction:**\n \`predict <place_table> <cts_table>\`\n\n**Examples:**\n \`train ariane_place_sorted_csv ariane_cts_sorted_csv ariane_route_sorted_csv\`\n \`predict reg_place_csv reg_cts_csv\`\n\nWhat would you like to do?`,
            timestamp: new Date(),
            predictor: true,
            isServerResponse: true,
          };
          
          setMessages(prev => [...prev, helpMessage]);
          
          if (activeSessionId) {
            savePredictorMessage(activeSessionId, userMessage);
            savePredictorMessage(activeSessionId, helpMessage);
          }
        }
        return;
      }

      if (meta?.predictor) {
        console.log('Handling Predictor response in ChatbotPrediction.tsx...', meta);
        
        if (meta.isServerResponse) {
          const aiMessage: ExtendedChatMessage = {
            id: meta.id,
            role: 'assistant',
            content: meta.error ? `Error: ${meta.error}` : meta.content,
            timestamp: new Date(meta.timestamp),
            predictor: true,
            predictions: meta.predictions || meta.data,
            error: meta.error,
            showDownloadButton: meta.showDownloadButton,
            ...(meta.csvData && { csvData: meta.csvData }),
            ...(meta.downloadUrl && { downloadUrl: meta.downloadUrl }),
            ...(meta.downloadFilename && { downloadFilename: meta.downloadFilename })
          };
          
          console.log('Predictor result message:', aiMessage);
          setMessages(prev => [...prev, aiMessage]);
          
          let sessionId = activeSessionId;
          if (!sessionId) {
            try {
              const newSession = await createNewSession('Predictor Session');
              sessionId = newSession.id;
              fetchSessions();
              console.log('Created new session for predictor:', sessionId);
            } catch (error) {
              console.error('Error creating new session for predictor:', error);
            }
          }
          
          if (sessionId) {
            try {
              await chatbotService.sendPredictorMessage(
                '',
                sessionId,
                meta.error ? `Error: ${meta.error}` : meta.content,
                {
                  predictor: aiMessage.predictor,
                  predictions: aiMessage.predictions,
                  error: aiMessage.error,
                  showDownloadButton: aiMessage.showDownloadButton,
                  isServerResponse: aiMessage.isServerResponse
                }
              );
              console.log('Predictor AI message saved to database');
            } catch (error) {
              console.error('Error saving predictor AI message to database:', error);
            }
            savePredictorMessage(sessionId, aiMessage);
          }
          return;
        }
        
        if (meta.isUserCommand) {
          const userMessage: ExtendedChatMessage = {
            id: meta.id,
            role: 'user',
            content: content.trim(),
            timestamp: new Date(meta.timestamp),
            predictor: true,
            isUserCommand: true
          };

          console.log('User predictor command message:', userMessage);
          setMessages(prev => [...prev, userMessage]);
          
          let sessionId = activeSessionId;
          if (!sessionId) {
            try {
              const newSession = await createNewSession('Predictor Session');
              sessionId = newSession.id;
              fetchSessions();
              console.log('Created new session for predictor:', sessionId);
            } catch (error) {
              console.error('Error creating new session for predictor:', error);
            }
          }
          
          if (sessionId) {
            try {
              await chatbotService.sendPredictorMessage(
                content.trim(),
                sessionId,
                '',
                {
                  isUserCommand: userMessage.isUserCommand
                }
              );
              console.log('Predictor user command saved to database');
            } catch (error) {
              console.error('Error saving predictor user command to database:', error);
            }
            savePredictorMessage(sessionId, userMessage);
          }
          return;
        }
      }
    }
  };

  return (
    <>
      <ChatInput
          onSendMessage={handlePredictorMessage}
          isLoading={isLoading}
          isEmpty={messages.length === 0}
          isStreaming={false}
          isUploading={false}
          uploadProgress={0}
          onStopGeneration={() => {}}
          isRagAvailable={false}
          isRagEnabled={false}
          onToggleRag={() => {}}
          isMCPAvailable={false}
          isMCPEnabled={false}
          onToggleMCP={() => {}}
          isChat2SqlEnabled={false}
          onToggleChat2Sql={() => {}}
          isPredictorEnabled={isPredictorEnabled}
          onTogglePredictor={() => {
            setIsPredictorEnabled((prev) => {
              const newValue = !prev;
              try {
                localStorage.setItem('predictor_mode_enabled', JSON.stringify(newValue));
              } catch (error) {
                console.error('Error saving predictor mode to localStorage:', error);
              }
              
              if (newValue) {
                const welcomeMessage: ExtendedChatMessage = {
                  id: `predictor-activation-${Date.now()}`,
                  role: 'assistant',
                  content: `?? **Predictor Mode Activated**

I'm ready to help you train models and make predictions with any tables in your database!

**Quick Commands:**
 \`train <place_table> <cts_table> <route_table>\` - Train with specific tables
 \`train\` - Open training form with available tables
 \`predict <place_table> <cts_table>\` - Generate predictions

**Examples:**
 \`train reg_place_csv reg_cts_csv reg_route_csv\`
 \`train ariane_place_sorted_csv ariane_cts_sorted_csv ariane_route_sorted_csv\`
 \`predict reg_place_csv reg_cts_csv\`
 \`predict ariane_place_sorted_csv ariane_cts_sorted_csv\`

**Features:**
? Fully dynamic - works with any tables in configured database
? Auto-detects available training sets
? Real-time validation and suggestions
? Fast training - optimized for speed
? Detailed performance metrics

What would you like to do?`,
                  timestamp: new Date(),
                  predictor: true,
                  isServerResponse: true,
                };
                
                setMessages(prev => [...prev, welcomeMessage]);
                
                if (activeSessionId) {
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
              }
              setShowTrainingForm(false);
              return newValue;
            });
          }}
        />
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