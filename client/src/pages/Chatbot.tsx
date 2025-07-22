import React, { useRef, useEffect, useState } from 'react';
import { animations } from '../components/chat/chatStyles';
import {
  ArrowPathIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { containsReadContextToolCall } from '../utils/toolParser';
import { useSidebar } from '../contexts/SidebarContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useToolExecution } from '../hooks/useToolExecution';
import ChatInput from '../components/chat/ChatInput';
import ChatSidebar from '../components/chat/ChatSidebar';
import MessageList from '../components/chat/MessageList';
import ModelSelector from '../components/chat/ModelSelector';
import MCPServerSelector from '../components/chat/MCPServerSelector';
import ProcessingToast from '../components/chat/ProcessingToast';
import ContextReadingIndicator from '../components/chat/ContextReadingIndicator';
import MCPNotifications from '../components/mcp/MCPNotifications';
import { useMCP } from '../contexts/MCPContext';
import { useMCPAgent } from '../contexts/MCPAgentContext';
import { useChatSessions } from '../hooks/useChatSessions';
import { useChatMessaging } from '../hooks/useChatMessaging';
import { useContextHandling } from '../hooks/useContextHandling';
import { ExtendedChatMessage } from '../types';
import { chatbotService } from '../services/chatbotService';
import UserIcon from '../components/UserIcon';
import ChatbotPrediction from '../components/prediction/ChatbotPrediction';

const Chatbot: React.FC = () => {
  const { isExpanded: isMainSidebarExpanded } = useSidebar();
  const contextRulesLoadedRef = useRef<{[key: string]: boolean}>({});

  const {
    sessions,
    activeSessionId,
    sessionTitle,
    editingTitle,
    messages,
    loadingMessages,
    loadingSessions,
    hasMoreMessages,
    expandedGroups,
    showSidebar,
    setActiveSessionId,
    setSessionTitle,
    setEditingTitle,
    setMessages,
    fetchSessions,
    fetchSessionMessages,
    loadMoreMessages,
    createNewSession,
    deleteSession,
    updateSessionTitle,
    editSession,
    toggleSidebar,
    toggleGroup,
    resetChat
  } = useChatSessions();

  const {
    isLoading,
    isStreaming,
    isUploading,
    uploadProgress,
    setIsLoading,
    setIsStreaming,
    streamedContentRef,
    abortFunctionRef,
    sendChatMessage,
    stopGeneration
  } = useChatMessaging();

  const {
    isRagAvailable,
    isRagEnabled,
    ragNotificationShown,
    setRagNotificationShown,
    checkForStoredContext,
    checkRagAvailability,
    forceCheckDocumentStatus,
    toggleRagMode,
    showRagAvailableNotification
  } = useContextHandling(activeSessionId);

  const [selectedModelId, setSelectedModelId] = React.useState<string | undefined>(() => {
    return localStorage.getItem('selectedModelId') || undefined;
  });

  const { isConnected: isMCPConnected, defaultServer, connectToServer, mcpConnection } = useMCP();
  const { isAgentEnabled: isMCPEnabled, toggleAgent: toggleMCPEnabled } = useMCPAgent();
  
  const [showServerSelector, setShowServerSelector] = useState(false);
  const [isChat2SqlEnabled, setIsChat2SqlEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('chat2sql_mode_enabled');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [isPredictorEnabled, setIsPredictorEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('predictor_mode_enabled');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const saveChat2SqlMessage = (sessionId: string, message: ExtendedChatMessage) => {
    try {
      const key = `chat2sql_messages_${sessionId}`;
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
      console.log('Chat2SQL message saved to localStorage:', message.id);
    } catch (error) {
      console.error('Error saving Chat2SQL message to localStorage:', error);
    }
  };

  const loadChat2SqlMessages = (sessionId: string): ExtendedChatMessage[] => {
    try {
      const key = `chat2sql_messages_${sessionId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const messages = JSON.parse(stored);
        return messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.error('Error loading Chat2SQL messages from localStorage:', error);
    }
    return [];
  };

  const clearChat2SqlMessages = (sessionId: string) => {
    try {
      const key = `chat2sql_messages_${sessionId}`;
      localStorage.removeItem(key);
      console.log('Chat2SQL messages cleared for session:', sessionId);
    } catch (error) {
      console.error('Error clearing Chat2SQL messages:', error);
    }
  };

  const getSessionTitleForMode = () => {
    if (isPredictorEnabled) return 'Predictor Session';
    if (isChat2SqlEnabled) return 'Chat2SQL Session';
    if (isRagEnabled) return 'RAG Chat';
    if (isMCPEnabled) return 'MCP Chat';
    return 'New Chat';
  };

  const selectServer = async (serverId: string) => {
    console.log('Selected MCP server:', serverId);
    
    try {
      setTimeout(() => {
        if (!isMCPEnabled) {
          toggleMCPEnabled();
        }
        setShowServerSelector(false);
      }, 3000);
    } catch (error) {
      console.error('Error in server selection:', error);
    }
  };

  const createContextToolMessage = () => {
    const contextMessage: ExtendedChatMessage = {
      id: `context-tool-${Date.now()}`,
      role: 'assistant',
      content: '? Reading context from uploaded documents...',
      timestamp: new Date(),
      isContextMessage: true
    };
    return contextMessage;
  };

  const handleMCPChatMessage = async (
    content: string,
    messages: ExtendedChatMessage[],
    activeSessionId: string | null,
    selectedModel: { id?: string },
    streamedContentRef: React.MutableRefObject<{ [key: string]: string }>,
    abortFunctionRef: React.MutableRefObject<(() => void) | null>,
    setMessages: React.Dispatch<React.SetStateAction<ExtendedChatMessage[]>>,
    setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>,
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
    executeTool: any,
    chatbotService: any,
    fetchSessions: () => void
  ) => {
    console.log('MCP Chat message handling:', content);
    console.log('MCP connection state:', { 
      isMCPConnected,
      defaultServer: !!defaultServer, 
      mcpConnectionClientId: mcpConnection?.clientId,
      mcpConnectionState: mcpConnection 
    });
    
    if (!defaultServer) {
      console.error('No default MCP server configured');
      throw new Error('No MCP server configured');
    }
    
    if (!mcpConnection?.clientId) {
      console.error('No MCP client ID available');
      throw new Error('MCP connection not established - no client ID');
    }

    setIsStreaming(true);
    setIsLoading(true);

    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: ExtendedChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };

    setMessages(prev => [...prev, assistantMessage]);
    streamedContentRef.current[assistantMessageId] = '';

    try {
      const { mcpSystemPrompt } = await import('../prompts/mcpSystemPrompt');
      const mcpMessages = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      }));

      const hasSystemPrompt = mcpMessages.some(msg =>
        msg.role === 'system' &&
        (msg.content.includes('runshellcommand') || msg.content.includes('SHELL COMMAND TOOL'))
      );

      if (!hasSystemPrompt) {
        mcpMessages.unshift({
          role: 'system',
          content: mcpSystemPrompt
        });
      }

      mcpMessages.push({
        role: 'user',
        content: content
      });

      const mcpChatServiceModule = await import('../services/mcpChatService');
      const abortFunction = await mcpChatServiceModule.default.streamChatCompletion(
        {
          modelId: selectedModel.id,
          messages: mcpMessages,
          mcpClientId: mcpConnection.clientId,
          mcpServer: {
            host: defaultServer.mcp_host,
            port: defaultServer.mcp_port
          },
          options: {
            stream: true,
            temperature: 0.7,
            max_tokens: 2000
          }
        },
        (chunk) => {
          if (chunk.choices?.[0]?.delta?.content) {
            streamedContentRef.current[assistantMessageId] += chunk.choices[0].delta.content;
            
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: streamedContentRef.current[assistantMessageId] }
                : msg
            ));
          }
        },
        async () => {
          const finalContent = streamedContentRef.current[assistantMessageId];
          
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: finalContent, isStreaming: false }
              : msg
          ));

          if (activeSessionId && finalContent) {
            try {
              console.log('Attempting to save MCP assistant message to database:', {
                sessionId: activeSessionId,
                contentLength: finalContent.length,
                contentPreview: finalContent.substring(0, 50) + '...'
              });

              await chatbotService.sendMessage(
                '',
                activeSessionId,
                finalContent,
                false
              );
              console.log('MCP assistant message saved to database successfully');
            } catch (error: any) {
              console.error('Error saving MCP assistant message to database:', {
                error: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
              });

              if (error.response?.status === 401) {
                console.warn('Authentication error when saving MCP assistant message - user may need to log in again');
              } else if (error.response?.status === 400) {
                console.warn('Bad request when saving MCP assistant message - check request format');
              }
            }
          }

          setIsStreaming(false);
          setIsLoading(false);
          abortFunctionRef.current = null;
          delete streamedContentRef.current[assistantMessageId];
        },
        (error) => {
          console.error('MCP chat streaming error:', error);
          
          const errorContent = `Error: ${error.message}`;
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: errorContent, isStreaming: false }
              : msg
          ));

          setIsStreaming(false);
          setIsLoading(false);
          abortFunctionRef.current = null;
          delete streamedContentRef.current[assistantMessageId];
        }
      );

      abortFunctionRef.current = abortFunction;

    } catch (error: any) {
      console.error('Error initializing MCP chat:', error);
      
      const errorContent = `Error: ${error.message}`;
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: errorContent, isStreaming: false }
          : msg
      ));

      setIsStreaming(false);
      setIsLoading(false);
      abortFunctionRef.current = null;
      delete streamedContentRef.current[assistantMessageId];
      
      throw error;
    }
  };

  const { isExecutingTool, currentTool, executeTool } = useToolExecution();

  const handleToggleChat2Sql = () => {
    setIsChat2SqlEnabled((prev: boolean) => {
      const newValue = !prev;
      try {
        localStorage.setItem('chat2sql_mode_enabled', JSON.stringify(newValue));
      } catch (error) {
        console.error('Error saving Chat2SQL mode to localStorage:', error);
      }
      return newValue;
    });
  };

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSessions();
    checkRagAvailability();
    forceCheckDocumentStatus(messages, setMessages, setIsLoading, setIsStreaming);
    
    if (activeSessionId) {
      if (contextRulesLoadedRef.current[activeSessionId]) {
        console.log('Context rules already loaded for session:', activeSessionId);
        return;
      }
      
      const contextRulesKey = `context_rules_${activeSessionId}`;
      try {
        let storedContextRules = sessionStorage.getItem(contextRulesKey) || localStorage.getItem(contextRulesKey);
        
        if (storedContextRules) {
          const parsedRules = JSON.parse(storedContextRules);
          
          if (parsedRules.hasContext && parsedRules.rules) {
            console.log('Found stored context rules for conversation:', activeSessionId);
            
            const systemContextMessage: ExtendedChatMessage = {
              id: `system-context-${Date.now()}`,
              role: 'system',
              content: `User context loaded: ${parsedRules.rules}`,
              timestamp: new Date(),
              isContextMessage: true
            };
            
            setMessages(prev => {
              const hasSimilarMessage = prev.some(msg => 
                msg.role === 'system' && 
                msg.content.includes('User context loaded:')
              );
              
              if (hasSimilarMessage) {
                console.log('Similar system message already exists, not adding another one');
                return prev;
              }

              return [...prev, systemContextMessage];
            });
            
            contextRulesLoadedRef.current[activeSessionId] = true;
          }
        }
      } catch (error) {
        console.error('Error checking for stored context rules:', error);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeSessionId) {
      fetchSessionMessages(activeSessionId);
      const storedContext = checkForStoredContext(activeSessionId);
      if (storedContext) {
        console.log('Using stored context from localStorage:', storedContext);
      }
      
      const contextRulesKey = `context_rules_${activeSessionId}`;
      try {
        if (contextRulesLoadedRef.current[activeSessionId]) {
          console.log('Context rules already loaded for session:', activeSessionId);
          return;
        }
        
        let storedContextRules = sessionStorage.getItem(contextRulesKey) || localStorage.getItem(contextRulesKey);
        
        if (storedContextRules) {
          const parsedRules = JSON.parse(storedContextRules);
          
          if (parsedRules.hasContext && parsedRules.rules) {
            console.log('Found stored context rules for conversation:', activeSessionId);
            
            const systemContextMessage: ExtendedChatMessage = {
              id: `system-context-${Date.now()}`,
              role: 'system',
              content: `User context loaded: ${parsedRules.rules}`,
              timestamp: new Date(),
              isContextMessage: true
            };
            
            setTimeout(() => {
              setMessages(prev => {
                const hasSimilarMessage = prev.some(msg => 
                  msg.role === 'system' && 
                  msg.content.includes('User context loaded:')
                );
                
                if (hasSimilarMessage) {
                  console.log('Similar system message already exists, not adding another one');
                  return prev;
                }
                
                return [...prev, systemContextMessage];
              });
              
              contextRulesLoadedRef.current[activeSessionId] = true;
            }, 500);
          }
        }
      } catch (error) {
        console.error('Error checking for stored context rules:', error);
      }
    } else {
      setMessages([]);
    }
  }, [activeSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleRefreshMessages = (event: CustomEvent<{ conversationId: string; source?: string }>) => {
      const { conversationId, source } = event.detail;

      if (source === 'context_tool') {
        console.log('Skipping refresh from context tool to prevent UI issues');
        return;
      }

      if (conversationId && conversationId === activeSessionId) {
        console.log('Refreshing messages for conversation:', conversationId);
        fetchSessionMessages(conversationId);
      }
    };

    window.addEventListener('refreshMessages', handleRefreshMessages as EventListener);

    const handleAddSystemMessage = (event: CustomEvent<{ message: ExtendedChatMessage }>) => {
      const { message } = event.detail;
      console.log('Adding system message to conversation:', message);
      
      setMessages(prev => {
        const hasSimilarMessage = prev.some(msg => 
          msg.role === 'system' && 
          msg.content.includes('User context loaded:')
        );
        
        if (hasSimilarMessage) {
          console.log('Similar system message already exists, replacing it');
          const updatedMessages = prev.map(msg => 
            (msg.role === 'system' && msg.content.includes('User context loaded:'))
              ? message
              : msg
          );
          
          const hasChanges = updatedMessages.some((msg, idx) => msg !== prev[idx]);
          if (!hasChanges) {
            console.log('No changes needed to system messages');
            return prev;
          }

          return updatedMessages;
        }
        
        return [...prev, message];
      });
    };
    
    window.addEventListener('addSystemMessage', handleAddSystemMessage as EventListener);

    return () => {
      window.removeEventListener('refreshMessages', handleRefreshMessages as EventListener);
      window.removeEventListener('addSystemMessage', handleAddSystemMessage as EventListener);
    };
  }, [activeSessionId, fetchSessionMessages]);

  const { connected: wsConnected, reconnect: wsReconnect } = useWebSocket();
  useEffect(() => {
    const periodicCheckInterval = setInterval(() => {
      if (!ragNotificationShown) {
        console.log('Performing periodic document status check');
        forceCheckDocumentStatus(messages, setMessages, setIsLoading, setIsStreaming);
        checkRagAvailability();
      }

      if (!wsConnected) {
        console.log('WebSocket not connected during periodic check, attempting to reconnect...');
        wsReconnect();
      }
    }, 30000);

    return () => {
      clearInterval(periodicCheckInterval);
    };
  }, [wsConnected, wsReconnect, ragNotificationShown]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
    }
  }, [editingTitle]);

  const handleSendMessage = async (content: string, file?: File, meta?: any) => {
    if ((content.trim() === '' && !file) || isLoading || isUploading) return;

    if (meta?.chat2sql) {
      console.log('Handling Chat2SQL response in Chatbot.tsx...', meta);
      
      if (meta.isServerResponse) {
        const aiMessage: ExtendedChatMessage = {
          id: meta.id,
          role: 'assistant',
          content: meta.error ? `Error: ${meta.error}` : meta.content,
          timestamp: new Date(meta.timestamp),
          isSqlResult: true,
          chat2sql: true
        };
        
        console.log('SQL result message:', aiMessage);
        setMessages(prev => [...prev, aiMessage]);
        
        if (activeSessionId) {
          saveChat2SqlMessage(activeSessionId, aiMessage);
        }
        
        let sessionId = activeSessionId;
        if (!sessionId) {
          try {
            const newSession = await createNewSession('Chat2SQL Session');
            sessionId = newSession.id;
            setActiveSessionId(sessionId);
            await fetchSessions();
            console.log('Created new session for Chat2SQL:', sessionId);
          } catch (error) {
            console.error('Error creating new session for Chat2SQL:', error);
          }
        }
        
        if (sessionId) {
          try {
            await chatbotService.sendPredictorMessage(
              '',
              sessionId,
              meta.error ? `Error: ${meta.error}` : meta.content,
              {
                chat2sql: true,
                isSqlResult: true,
                isServerResponse: true,
                error: meta.error
              }
            );
            console.log('Chat2SQL AI message saved to database');
          } catch (error) {
            console.error('Error saving Chat2SQL AI message to database:', error);
          }
        }
        return;
      }
      
      if (meta.isUserMessage) {
        const userMessage: ExtendedChatMessage = {
          id: meta.id || `user-${Date.now()}`,
          role: 'user',
          content: content.trim(),
          timestamp: new Date(),
          isSqlQuery: true,
          chat2sql: true
        };

        console.log('User SQL query message:', userMessage);
        setMessages(prev => [...prev, userMessage]);

        if (activeSessionId) {
          saveChat2SqlMessage(activeSessionId, userMessage);
        }

        let sessionId = activeSessionId;
        if (!sessionId) {
          try {
            const newSession = await createNewSession('Chat2SQL Session');
            sessionId = newSession.id;
            setActiveSessionId(sessionId);
            await fetchSessions();
            console.log('Created new session for Chat2SQL:', sessionId);
          } catch (error) {
            console.error('Error creating new session for Chat2SQL:', error);
          }
        }
        
        if (sessionId) {
          try {
            await chatbotService.sendPredictorMessage(
              content.trim(),
              sessionId,
              '',
              {
                chat2sql: true,
                isSqlQuery: true,
                isUserMessage: true
              }
            );
            console.log('Chat2SQL user message saved to database');
          } catch (error) {
            console.error('Error saving Chat2SQL user message to database:', error);
          }
        }

        return;
      }

      return;
    }

    if (content.trim().toLowerCase() === 'read_context') {
      console.log('Detected exact read_context command, triggering context tool directly');
      
      const userMessage: ExtendedChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      
      const aiMessage = createContextToolMessage();
      setMessages(prev => [...prev, aiMessage]);
      
      let sessionId = activeSessionId;
      if (!sessionId) {
        try {
          const newSession = await createNewSession('Context Session');
          sessionId = newSession.id;
          setActiveSessionId(sessionId);
          await fetchSessions();
          console.log('Created new session for context:', sessionId);
        } catch (error) {
          console.error('Error creating new session for context:', error);
        }
      }
      
      if (sessionId) {
        try {
          await chatbotService.sendMessage(
            content.trim(),
            sessionId,
            aiMessage.content,
            false
          );
          console.log('Context command and response saved to database');
        } catch (error) {
          console.error('Error saving context messages to database:', error);
        }
      }
      
      return;
    }
    
    if (isMCPEnabled && !file && content.trim() !== '') {
      try {
        const userMessage: ExtendedChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: content.trim(),
          timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);

        let sessionId = activeSessionId;
        if (!sessionId) {
          try {
            const newSession = await createNewSession('MCP Session');
            sessionId = newSession.id;
            setActiveSessionId(sessionId);
            await fetchSessions();
            console.log('Created new session for MCP:', sessionId);
          } catch (error) {
            console.error('Error creating new session for MCP:', error);
          }
        }
        
        if (sessionId) {
          try {
            console.log('Attempting to save MCP user message to database:', {
              content: content.trim().substring(0, 50) + '...',
              sessionId,
              contentLength: content.trim().length
            });

            await chatbotService.sendMessage(
              content.trim(),
              sessionId,
              '',
              false
            );
            console.log('MCP user message saved to database successfully');
          } catch (error: any) {
            console.error('Error saving MCP user message to database:', {
              error: error.message,
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data
            });

            if (error.response?.status === 401) {
              console.warn('Authentication error when saving MCP message - user may need to log in again');
            } else if (error.response?.status === 400) {
              console.warn('Bad request when saving MCP message - check request format');
            }
          }
        }

        await handleMCPChatMessage(
          content,
          messages,
          activeSessionId,
          { id: selectedModelId },
          streamedContentRef,
          abortFunctionRef,
          setMessages,
          setIsStreaming,
          setIsLoading,
          executeTool,
          chatbotService,
          fetchSessions
        );
        return;
      } catch (error: any) {
        console.error('Error using MCP chat mode:', error);
        const errorMessage: ExtendedChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `MCP Error: ${error.message}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        
        if (activeSessionId) {
          try {
            console.log('Attempting to save MCP error message to database:', {
              sessionId: activeSessionId,
              errorContent: errorMessage.content
            });

            await chatbotService.sendMessage(
              '',
              activeSessionId,
              errorMessage.content,
              false
            );
            console.log('MCP error message saved to database successfully');
          } catch (dbError: any) {
            console.error('Error saving MCP error message to database:', {
              error: dbError.message,
              status: dbError.response?.status,
              statusText: dbError.response?.statusText,
              data: dbError.response?.data
            });

            if (dbError.response?.status === 401) {
              console.warn('Authentication error when saving MCP error message - user may need to log in again');
            } else if (dbError.response?.status === 400) {
              console.warn('Bad request when saving MCP error message - check request format');
            }
          }
        }
        
        return;
      }
    }

    const result = await sendChatMessage(
      content, 
      file, 
      messages, 
      activeSessionId, 
      selectedModelId, 
      isRagAvailable, 
      isRagEnabled, 
      setMessages, 
      fetchSessions
    );
    
    if (result?.newSessionId && (!activeSessionId || activeSessionId !== result.newSessionId)) {
      setActiveSessionId(result.newSessionId);
    }
  };

  const handleToggleMCP = () => {
    if (!isMCPEnabled && !isMCPConnected) {
      setShowServerSelector(true);
    } else {
      toggleMCPEnabled();
    }
  };

  const isEmpty = messages.length === 0;

  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      ${animations.bounce}
      ${animations.fadeIn}
      ${animations.slideIn}

      .input-area-blur {
        background-color: transparent !important;
        border: none !important;
        box-shadow: none !important;
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        backgroundColor: 'var(--color-bg)',
        left: isMainSidebarExpanded ? '64px' : '63px',
        width: isMainSidebarExpanded ? 'calc(100% - 64px)' : 'calc(100% - 50px)'
      }}
    >
      <ProcessingToast />
      <MCPServerSelector
        isOpen={showServerSelector}
        onClose={() => setShowServerSelector(false)}
        onServerSelect={selectServer}
      />
      <div
        className="px-4 py-3 flex items-center justify-between z-10 relative"
        style={{
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          borderRadius: '0 0 12px 12px'
        }}
      >
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <UserIcon size={36} variant="default" />
            <h2
              className="text-base md:text-lg font-semibold truncate max-w-[200px] md:max-w-none"
              style={{ color: 'var(--color-text)' }}
            >
              {activeSessionId ? sessionTitle : 'New Chat'}
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {isMCPEnabled && (
            <MCPNotifications />
          )}
          
          <ModelSelector
            onSelectModel={setSelectedModelId}
            selectedModelId={selectedModelId}
          />
          {!isEmpty && (
            <button
              onClick={() => resetChat()}
              className="p-2 rounded-full hover:bg-opacity-20 hover:bg-gray-500 transition-all hover:scale-105"
              style={{
                color: 'var(--color-text-muted)',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)'
              }}
              title="Clear current chat"
            >
              <ArrowPathIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {showSidebar && (
          <div
            className="absolute md:relative h-full transition-all duration-300 ease-in-out z-20 md:z-0"
            style={{
              left: '0',
              width: window.innerWidth < 768 ? '100%' : '320px'
            }}
          >
            <ChatSidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              expandedGroups={expandedGroups}
              loadingSessions={loadingSessions}
              isCollapsed={false}
              onCreateSession={createNewSession}
              onSelectSession={setActiveSessionId}
              onDeleteSession={deleteSession}
              onEditSession={editSession}
              onToggleGroup={toggleGroup}
              onToggleCollapse={toggleSidebar}
            />
          </div>
        )}

        {!showSidebar && (
          <ChatSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            expandedGroups={expandedGroups}
            loadingSessions={loadingSessions}
            isCollapsed={true}
            onCreateSession={createNewSession}
            onSelectSession={setActiveSessionId}
            onDeleteSession={deleteSession}
            onEditSession={editSession}
            onToggleGroup={toggleGroup}
            onToggleCollapse={toggleSidebar}
          />
        )}

        <div
          className={`absolute inset-0 transition-all duration-300 ease-in-out flex flex-col`}
          style={{
            backgroundColor: 'var(--color-bg)',
            marginLeft: showSidebar ? (window.innerWidth < 768 ? '0' : '320px') : '0'
          }}
        >
          {isExecutingTool && currentTool === 'read_context' && !messages.some(msg =>
            msg.role === 'assistant' && containsReadContextToolCall(msg.content)
          ) && (
            <div className="px-4 pt-2">
              <ContextReadingIndicator isReading={true} />
            </div>
          )}

          <MessageList
            messages={messages.filter(msg => msg.role !== 'system')}
            isLoading={isLoading}
            hasMoreMessages={hasMoreMessages}
            loadMoreMessages={loadMoreMessages}
            loadingMessages={loadingMessages}
            isEmpty={isEmpty}
            conversationId={activeSessionId || undefined}
          />

          <div
            className={`${isEmpty ? "absolute left-1/2 bottom-[10%] transform -translate-x-1/2" : "absolute bottom-0 left-0 right-0"}
            ${!isEmpty && ""} py-4 px-4 md:px-8 lg:px-16 xl:px-24`}
            style={{
              maxWidth: '100%',
              margin: '0 auto',
              zIndex: 10,
              backgroundColor: 'transparent'
            }}
          >
            <ChatbotPrediction
              activeSessionId={activeSessionId}
              messages={messages}
              setMessages={setMessages}
              isPredictorEnabled={isPredictorEnabled}
              setIsPredictorEnabled={setIsPredictorEnabled}
              setIsLoading={setIsLoading}
              createNewSession={createNewSession}
              fetchSessions={fetchSessions}
            />

            <ChatInput
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              isEmpty={isEmpty}
              isStreaming={isStreaming}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              onStopGeneration={stopGeneration}
              isRagAvailable={isRagAvailable}
              isRagEnabled={isRagEnabled}
              onToggleRag={toggleRagMode}
              isMCPAvailable={isMCPConnected}
              isMCPEnabled={isMCPEnabled}
              onToggleMCP={handleToggleMCP}
              isChat2SqlEnabled={isChat2SqlEnabled}
              onToggleChat2Sql={handleToggleChat2Sql}
            />

            {isEmpty && (
              <div className="flex justify-center mt-12">
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => createNewSession()}
                    className="px-4 py-2 rounded-md text-sm flex items-center hover:bg-opacity-10 hover:bg-gray-500"
                    style={{
                      backgroundColor: 'var(--color-surface-dark)',
                      color: 'var(--color-text)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <PlusIcon className="h-4 w-4 mr-1.5" />
                    <span>New Chat</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
