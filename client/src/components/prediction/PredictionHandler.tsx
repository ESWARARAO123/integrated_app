import React, { useEffect, useState } from 'react';
import { ExtendedChatMessage } from '../../types';
import { chatbotService } from '../../services/chatbotService';
import TrainingForm from '../TrainingForm';
import predictorService from '../../services/predictorService';

interface PredictionHandlerProps {
  isPredictorEnabled: boolean;
  activeSessionId: string | null;
  messages: ExtendedChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ExtendedChatMessage[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  createNewSession: (title?: string) => Promise<any>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  fetchSessions: () => void;
  showTrainingForm: boolean;
  setShowTrainingForm: React.Dispatch<React.SetStateAction<boolean>>;
}

export const usePredictionHandler = ({
  isPredictorEnabled,
  activeSessionId,
  messages,
  setMessages,
  setIsLoading,
  createNewSession,
  setActiveSessionId,
  fetchSessions,
  showTrainingForm,
  setShowTrainingForm
}: PredictionHandlerProps) => {

  // Helper functions for predictor message persistence
  const savePredictorMessage = (sessionId: string, message: ExtendedChatMessage) => {
    try {
      const key = `predictor_messages_${sessionId}`;
      const existing = localStorage.getItem(key);
      let messages = existing ? JSON.parse(existing) : [];
      
      // Add the new message
      messages.push({
        ...message,
        timestamp: message.timestamp.toISOString() // Convert Date to string for storage
      });
      
      // Keep only the last 50 messages per session to prevent localStorage bloat
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
          timestamp: new Date(msg.timestamp) // Convert string back to Date
        }));
      }
    } catch (error) {
      console.error('Error loading predictor messages from localStorage:', error);
    }
    return [];
  };

  const clearPredictorMessages = (sessionId: string) => {
    try {
      const key = `predictor_messages_${sessionId}`;
      localStorage.removeItem(key);
      console.log('Predictor messages cleared for session:', sessionId);
    } catch (error) {
      console.error('Error clearing predictor messages:', error);
    }
  };

  // Load predictor messages when session changes
  useEffect(() => {
    if (activeSessionId && isPredictorEnabled) {
      console.log('Loading predictor messages for session:', activeSessionId);
      const predictorMessages = loadPredictorMessages(activeSessionId);
      if (predictorMessages.length > 0) {
        console.log(`Found ${predictorMessages.length} predictor messages in localStorage`);
        // Merge predictor messages with existing messages, avoiding duplicates
        setMessages(prev => {
          const existingIds = new Set(prev.map(msg => msg.id));
          const newMessages = predictorMessages.filter(msg => !existingIds.has(msg.id));
          return [...prev, ...newMessages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        });
      }
    }
  }, [activeSessionId, isPredictorEnabled, setMessages]);

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

  // Add predictor message event listener
  useEffect(() => {
    const handleAddPredictorMessage = (event: CustomEvent) => {
      console.log('🤖 Predictor message event received:', event.detail);
      const { message } = event.detail;
      
      if (message) {
        const predictorMessage: ExtendedChatMessage = {
          ...message,
          timestamp: new Date(message.timestamp),
          predictor: true,
          isServerResponse: true,
        };
        
        setMessages(prev => [...prev, predictorMessage]);
        
        // Save to localStorage for persistence
        if (activeSessionId) {
          savePredictorMessage(activeSessionId, predictorMessage);
        }
      }
    };

    window.addEventListener('addPredictorMessage', handleAddPredictorMessage as EventListener);

    return () => {
      window.removeEventListener('addPredictorMessage', handleAddPredictorMessage as EventListener);
    };
  }, [activeSessionId, setMessages]);

  // Polling for new messages (for predictor followup messages)
  useEffect(() => {
    if (!activeSessionId || !isPredictorEnabled) return;

    const messagePollingInterval = setInterval(async () => {
      try {
        // Fetch latest messages to check for new ones
        const currentMessageCount = messages.length;
        const response = await chatbotService.getSession(activeSessionId, 50, 0); // Fetch latest 50 messages
        
        if (response.messages.length > currentMessageCount) {
          console.log('New messages found, updating messages');
          // Refresh the session messages to get the latest data
          // Note: This would need to be passed from parent component
          // await fetchSessionMessages(activeSessionId);
        }
      } catch (error) {
        console.error('Error polling for new messages:', error);
      }
    }, 3000); // Check every 3 seconds when predictor is active

    return () => {
      clearInterval(messagePollingInterval);
    };
  }, [activeSessionId, isPredictorEnabled, messages.length]);

  const handlePredictorMessage = async (content: string, meta?: any) => {
    // Handle Predictor activation and messages
    if (meta?.predictor && meta?.isActivation) {
      // This is a predictor activation, send to backend for welcome message
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
      return true; // Handled
    }

    // Handle predictor commands
    if (isPredictorEnabled) {
      console.log('🤖 Predictor mode enabled, processing command:', content);
      
      // Handle training form toggle
      if (content.toLowerCase().trim() === 'train') {
        setShowTrainingForm(true);
        return true; // Handled
      }
      
      // Parse predictor commands using the service
      const parsedTables = predictorService.parseTableNamesFromCommand(content);
      console.log('🤖 Parsed tables from command:', parsedTables);
      
      if (parsedTables) {
        // Add user message first
        const userMessage: ExtendedChatMessage = {
          id: `predictor-user-${Date.now()}`,
          role: 'user',
          content: content,
          timestamp: new Date(),
          predictor: true,
          isUserCommand: true,
        };
        
        setMessages(prev => [...prev, userMessage]);
        
        // Save user message to localStorage
        if (activeSessionId) {
          savePredictorMessage(activeSessionId, userMessage);
        }
        
        await handlePredictorCommand(content, parsedTables, userMessage);
        return true; // Handled
      } else {
        // Invalid predictor command - show help
        await handleInvalidPredictorCommand(content);
        return true; // Handled
      }
    }

    return false; // Not handled
  };

  const handlePredictorCommand = async (content: string, parsedTables: any, userMessage: ExtendedChatMessage) => {
    // Handle train command
    if (content.toLowerCase().startsWith('train ')) {
      if (parsedTables.place && parsedTables.cts && parsedTables.route) {
        console.log('🤖 Executing training with tables:', parsedTables);
        
        try {
          setIsLoading(true);
          
          // Use the chatbot predictor-message API instead of direct predictor API
          const result = await chatbotService.sendPredictorMessage(
            content, // The full command like "train table1 table2 table3"
            activeSessionId,
            '', // No response yet, this will be generated by the backend
            {
              predictor: true,
              isUserCommand: true
            }
          );
          
          console.log('🤖 Training command sent to chatbot API:', result);
          
          // The response will contain the actual training result from Python API
          if (result.predictorData) {
            const aiMessage: ExtendedChatMessage = {
              id: `predictor-ai-${Date.now()}`,
              role: 'assistant',
              content: result.content || 'Training completed',
              timestamp: new Date(),
              predictor: true,
              isServerResponse: true,
              model_id: result.predictorData.model_id,
              training_metrics: result.predictorData.training_metrics,
              isTrainingComplete: result.predictorData.isTrainingComplete
            };
            
            setMessages(prev => [...prev, aiMessage]);
            
            // Save AI response to localStorage
            if (activeSessionId) {
              savePredictorMessage(activeSessionId, aiMessage);
            }

            // Handle followup message for training completion
            if (result.predictorData.followupMessage) {
              setTimeout(() => {
                const followupMessage: ExtendedChatMessage = {
                  id: `predictor-followup-${Date.now()}`,
                  role: 'assistant',
                  content: result.predictorData.followupMessage.message,
                  timestamp: new Date(),
                  predictor: true,
                  isServerResponse: true,
                  isTrainingComplete: result.predictorData.followupMessage.isTrainingComplete
                };
                
                setMessages(prev => [...prev, followupMessage]);
                
                if (activeSessionId) {
                  savePredictorMessage(activeSessionId, followupMessage);
                }
              }, 2000); // Show completion message after 2 seconds
            }
          }
          
        } catch (error: any) {
          console.error('🤖 Training error:', error);
          
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
        // Invalid train command format
        const errorMessage: ExtendedChatMessage = {
          id: `predictor-error-${Date.now()}`,
          role: 'assistant',
          content: `**Invalid Training Command**\n\n**Correct format:** \`train <place_table> <cts_table> <route_table>\`\n\n**Examples:**\n \`train ariane_place_sorted_csv ariane_cts_sorted_csv ariane_route_sorted_csv\`\n \`train reg_place_csv reg_cts_csv reg_route_csv\``,
          timestamp: new Date(),
          predictor: true,
          isServerResponse: true,
        };
        
        setMessages(prev => [...prev, errorMessage]);
        
        if (activeSessionId) {
          savePredictorMessage(activeSessionId, errorMessage);
        }
      }
    }
    // Handle predict command
    else if (content.toLowerCase().startsWith('predict ')) {
      console.log('🤖 Executing prediction with tables:', parsedTables);

      try {
        setIsLoading(true);

        // Use the chatbot predictor-message API instead of direct predictor API
        const result = await chatbotService.sendPredictorMessage(
          content, // The full command like "predict table1 table2"
          activeSessionId,
          '', // No response yet, this will be generated by the backend
          {
            predictor: true,
            isUserCommand: true
          }
        );

        console.log('🤖 Prediction command sent to chatbot API:', result);

        // The response will contain the actual prediction result from Python API
        if (result.predictorData) {
          const aiMessage: ExtendedChatMessage = {
            id: `predictor-ai-${Date.now()}`,
            role: 'assistant',
            content: result.content || 'Prediction completed',
            timestamp: new Date(),
            predictor: true,
            isServerResponse: true,
            predictions: result.predictorData.predictions,
            data: result.predictorData.data,
            metrics: result.predictorData.metrics,
            total_predictions: result.predictorData.total_predictions,
            showDownloadButton: true
          };

          setMessages(prev => [...prev, aiMessage]);

          // Save AI response to localStorage
          if (activeSessionId) {
            savePredictorMessage(activeSessionId, aiMessage);
          }
        }

      } catch (error: any) {
        console.error('🤖 Prediction error:', error);

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
    }
    // Handle basic "train" command (shows training form)
    else if (content.toLowerCase().trim() === 'train') {
      try {
        setIsLoading(true);

        // Use the chatbot predictor-message API for basic train command
        const result = await chatbotService.sendPredictorMessage(
          content, // "train"
          activeSessionId,
          '', // No response yet, this will be generated by the backend
          {
            predictor: true,
            isUserCommand: true
          }
        );

        console.log('🤖 Basic train command sent to chatbot API:', result);

        // The response will contain the training form message
        if (result.predictorData) {
          const aiMessage: ExtendedChatMessage = {
            id: `predictor-ai-${Date.now()}`,
            role: 'assistant',
            content: result.content || 'Training form displayed',
            timestamp: new Date(),
            predictor: true,
            isServerResponse: true,
            showTrainingForm: result.predictorData.showTrainingForm || false
          };

          setMessages(prev => [...prev, aiMessage]);

          // Save AI response to localStorage
          if (activeSessionId) {
            savePredictorMessage(activeSessionId, aiMessage);
          }
        }

      } catch (error: any) {
        console.error('🤖 Basic train command error:', error);

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
    }
    // Handle basic "predict" command (shows prediction help)
    else if (content.toLowerCase().trim() === 'predict') {
      try {
        setIsLoading(true);

        // Use the chatbot predictor-message API for basic predict command
        const result = await chatbotService.sendPredictorMessage(
          content, // "predict"
          activeSessionId,
          '', // No response yet, this will be generated by the backend
          {
            predictor: true,
            isUserCommand: true
          }
        );

        console.log('🤖 Basic predict command sent to chatbot API:', result);

        // The response will contain the prediction help message
        if (result.predictorData) {
          const aiMessage: ExtendedChatMessage = {
            id: `predictor-ai-${Date.now()}`,
            role: 'assistant',
            content: result.content || 'Prediction help displayed',
            timestamp: new Date(),
            predictor: true,
            isServerResponse: true
          };

          setMessages(prev => [...prev, aiMessage]);

          // Save AI response to localStorage
          if (activeSessionId) {
            savePredictorMessage(activeSessionId, aiMessage);
          }
        }

      } catch (error: any) {
        console.error('🤖 Basic predict command error:', error);

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
    }
  };

  const handleInvalidPredictorCommand = async (content: string) => {
    // Invalid predictor command
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
      content: `**Predictor Commands**\n\n**Training:**\n \`train <place_table> <cts_table> <route_table>\`\n \`train\` - Open training form\n\n**Prediction:**\n \`predict <place_table> <cts_table>\`\n\n**Examples:**\n \`train ariane_place_sorted_csv ariane_cts_sorted_csv ariane_route_sorted_csv\`\n \`predict reg_place_csv reg_cts_csv\`\n\nWhat would you like to do?`,
      timestamp: new Date(),
      predictor: true,
      isServerResponse: true,
    };
    
    setMessages(prev => [...prev, helpMessage]);
    
    if (activeSessionId) {
      savePredictorMessage(activeSessionId, userMessage);
      savePredictorMessage(activeSessionId, helpMessage);
    }
  };

  const handleMetaPredictorMessage = async (content: string, meta: any) => {
    // Handle Predictor messages
    if (meta?.predictor) {
      console.log('Handling Predictor response in PredictionHandler...', meta);

      if (meta.isServerResponse) {
        const aiMessage: ExtendedChatMessage = {
          id: meta.id,
          role: 'assistant',
          content: meta.error ? `Error: ${meta.error}` : meta.content,
          timestamp: new Date(meta.timestamp),
          predictor: true,
          predictions: meta.predictions || meta.data, // Use predictions or data field
          data: meta.data,
          error: meta.error,
          showDownloadButton: meta.showDownloadButton,
          csvData: meta.csvData, // Add CSV data to the message
          downloadUrl: meta.downloadUrl,
          downloadFilename: meta.downloadFilename
        };

        console.log('Predictor result message:', aiMessage);
        setMessages(prev => [...prev, aiMessage]);

        // Save predictor AI response to database and localStorage
        let sessionId = activeSessionId;
        if (!sessionId) {
          // Create a new session if none exists
          try {
            const newSession = await createNewSession('Predictor Session');
            sessionId = newSession.id;
            setActiveSessionId(sessionId);
            await fetchSessions(); // Refresh the sessions list
            console.log('Created new session for predictor:', sessionId);
          } catch (error) {
            console.error('Error creating new session for predictor:', error);
          }
        }

        if (sessionId) {
          try {
            await chatbotService.sendPredictorMessage(
              '', // Empty user message since this is AI response
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
        return true; // Handled
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

        // Save predictor user command to database and localStorage
        let sessionId = activeSessionId;
        if (!sessionId) {
          // Create a new session if none exists
          try {
            const newSession = await createNewSession('Predictor Session');
            sessionId = newSession.id;
            setActiveSessionId(sessionId);
            await fetchSessions(); // Refresh the sessions list
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
              '', // Empty response since this is user message
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
        return true; // Handled
      }

      return true; // Handled
    }

    return false; // Not handled
  };

  return {
    handlePredictorMessage,
    handleMetaPredictorMessage,
    savePredictorMessage,
    loadPredictorMessages,
    clearPredictorMessages
  };
};

// Training Form Component wrapper
interface PredictionTrainingFormProps {
  showTrainingForm: boolean;
  setShowTrainingForm: React.Dispatch<React.SetStateAction<boolean>>;
}

export const PredictionTrainingForm: React.FC<PredictionTrainingFormProps> = ({
  showTrainingForm,
  setShowTrainingForm
}) => {
  if (!showTrainingForm) return null;

  return (
    <div className="px-4 py-2">
      <TrainingForm
        onTrainingComplete={() => setShowTrainingForm(false)}
      />
    </div>
  );
};
