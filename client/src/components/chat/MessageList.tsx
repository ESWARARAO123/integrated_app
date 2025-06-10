import React, { useRef, useEffect, useState } from 'react';
import { ChatMessage as ChatMessageType, ExtendedChatMessage } from '../../types';
import ChatMessage from './ChatMessage';
import { ChatBubbleLeftRightIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import { messageListStyles, messageBubbleStyles } from './chatStyles';
import { useMCPAgent } from '../../contexts/MCPAgentContext';

// Import RagSource type
import { RagSource } from '../../services/ragChatService';

// Allow for extended message types that include system messages
interface MessageListProps {
  messages: ExtendedChatMessage[];
  isLoading: boolean;
  hasMoreMessages: boolean;
  loadMoreMessages: () => void;
  loadingMessages: boolean;
  isEmpty?: boolean;
  conversationId?: string; // Current conversation ID
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  hasMoreMessages,
  loadMoreMessages,
  loadingMessages,
  isEmpty = false,
  conversationId
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { pendingCommands, commandResults } = useMCPAgent();
  
  // Track if user has manually scrolled
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Detect if user is near bottom of chat
  const checkIfNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    
    const threshold = 100; // pixels from bottom to consider "near bottom"
    const position = container.scrollHeight - container.scrollTop - container.clientHeight;
    return position < threshold;
  };

  // Handle scroll events
  const handleScroll = () => {
    setIsNearBottom(checkIfNearBottom());
    
    // Check for infinite scrolling at the top
    const container = messagesContainerRef.current;
    if (container && container.scrollTop === 0 && hasMoreMessages && !loadingMessages) {
      loadMoreMessages();
    }
  };

  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Set up scroll event listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMoreMessages, loadingMessages, loadMoreMessages]);

  // Auto-scroll to bottom when new messages arrive, if user was already at bottom
  useEffect(() => {
    if (isNearBottom) {
      scrollToBottom();
    }
  }, [messages, isLoading, pendingCommands, commandResults]);

  // Reset scroll position when conversation changes
  useEffect(() => {
    setTimeout(() => {
      scrollToBottom();
      setIsNearBottom(true);
    }, 100);
  }, [conversationId]);

  // Group messages by role
  const groupedMessages = React.useMemo(() => {
    const groups: { role: string; messages: ExtendedChatMessage[] }[] = [];

    messages.forEach(message => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.role === message.role) {
        lastGroup.messages.push(message);
      } else {
        groups.push({ role: message.role, messages: [message] });
      }
    });

    return groups;
  }, [messages]);

  if (isEmpty) {
    return (
      <div style={messageListStyles.emptyState} className="chat-empty-state">
        <div style={messageListStyles.emptyIcon}>
          <ChatBubbleLeftRightIcon className="w-8 h-8" style={{ color: 'var(--color-primary)' }} />
        </div>
        <h3 className="text-xl font-bold mb-2 text-center" style={{ color: 'var(--color-text)' }}>Chat Assistant</h3>
        <p className="mb-8 text-center max-w-md" style={{ color: 'var(--color-text-muted)' }}>
          I'm here to help with your tasks. You can ask me questions, request assistance, or get information about the platform.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full">
      <div
        ref={messagesContainerRef}
        className="scrollbar-thin scrollbar-thumb-primary scrollbar-track-surface-dark message-list-container flex-1 overflow-y-auto"
        style={{
          ...messageListStyles.container,
          padding: '0',
        }}
      >
        {/* Load more messages indicator */}
        {hasMoreMessages && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
            <button
              onClick={loadMoreMessages}
              style={{
                ...messageListStyles.loadMoreButton,
                opacity: loadingMessages ? 0.7 : 1,
                cursor: loadingMessages ? 'not-allowed' : 'pointer',
              }}
              disabled={loadingMessages}
              className="flex items-center"
            >
              {loadingMessages ? (
                <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 rounded-full" style={{ borderColor: 'var(--color-primary)' }}></div>
              ) : (
                <ArrowDownIcon className="w-4 h-4 mr-2 rotate-180" />
              )}
              {loadingMessages ? 'Loading...' : 'Load more messages'}
            </button>
          </div>
        )}

        <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '1rem 1rem 0' }}>
          {/* Grouped messages */}
          {groupedMessages.map((group, groupIndex) => (
            <div
              key={groupIndex}
              style={{
                marginBottom: '1.5rem',
                animation: 'fadeIn 0.3s ease-in-out',
                animationFillMode: 'both',
                animationDelay: `${groupIndex * 0.05}s`
              }}
            >
              {group.messages.map((message, msgIdx) => (
                <div
                  key={message.id || msgIdx}
                  style={{
                    animation: 'slideIn 0.2s ease-out',
                    animationFillMode: 'both',
                    animationDelay: `${msgIdx * 0.05}s`
                  }}
                >
                  <ChatMessage
                    message={message}
                    isAI={group.role === 'assistant'}
                    conversationId={conversationId || message.conversationId}
                  />
                </div>
              ))}
            </div>
          ))}

          {/* Loading indicator - only show if there's no streaming message already */}
          {isLoading && !messages.some(msg => msg.isStreaming) && (
            <div style={{ display: 'flex', marginBottom: '1rem', paddingBottom: '1rem' }}>
              <div style={messageBubbleStyles.ai.avatar}>
                AI
              </div>
              <div style={messageListStyles.typingIndicator}>
                <div style={{ ...messageListStyles.typingDot, animationDelay: '0ms' }}></div>
                <div style={{ ...messageListStyles.typingDot, animationDelay: '150ms' }}></div>
                <div style={{ ...messageListStyles.typingDot, animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}

          {/* Extra space at the bottom to ensure messages aren't hidden behind input */}
          <div style={{ height: '150px' }}></div>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll to bottom button - only show when not at bottom */}
      {!isNearBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 right-5 bg-primary text-white rounded-full p-2 shadow-md hover:bg-primary-dark transition-colors duration-200 z-10 flex items-center justify-center"
          aria-label="Scroll to bottom"
        >
          <ArrowDownIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

export default MessageList;