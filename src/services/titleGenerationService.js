/**
 * Title Generation Service
 * 
 * Automatically generates meaningful titles for chat sessions based on conversation content.
 * Similar to ChatGPT's automatic title generation feature.
 */

const { logger } = require('../utils/logger');
const OllamaService = require('./ollamaService');
const { pool } = require('../database');

class TitleGenerationService {
  constructor() {
    this.maxTitleLength = 60;
    this.minMessagesForTitle = 2; // Generate title after 2 messages (user + assistant)
    this.ollamaService = null;
    this.initialized = false;

    // Initialize the service
    this.initializeOllamaService();
  }

  /**
   * Initialize the Ollama service
   */
  async initializeOllamaService() {
    try {
      this.ollamaService = new OllamaService();
      await this.ollamaService.initialize();
      this.initialized = true;
      logger.info('Title Generation Service: OllamaService initialized successfully');
    } catch (error) {
      logger.error('Title Generation Service: Failed to initialize OllamaService:', error);
      this.initialized = false;
    }
  }

  /**
   * Get the appropriate model for title generation following the priority system
   * @param {string} userSelectedModelId - Model ID selected by user (from localStorage/UI)
   * @returns {Promise<string>} - Model name to use for title generation
   */
  async getTitleGenerationModel(userSelectedModelId = null) {
    try {
      // Priority 1: User explicitly selected model (if provided)
      if (userSelectedModelId) {
        // If it looks like a UUID (database ID), get the actual model name
        if (userSelectedModelId.includes('-') && userSelectedModelId.length > 20) {
          try {
            const modelQuery = await pool.query(
              'SELECT ollama_model_id FROM ai_models WHERE id = $1 AND is_active = true',
              [userSelectedModelId]
            );

            if (modelQuery.rows.length > 0) {
              logger.info(`Using user-selected model for title generation: ${modelQuery.rows[0].ollama_model_id}`);
              return modelQuery.rows[0].ollama_model_id;
            }
          } catch (dbError) {
            logger.warn(`Error looking up user-selected model: ${dbError.message}`);
          }
        } else {
          // Direct model name provided
          logger.info(`Using user-selected model for title generation: ${userSelectedModelId}`);
          return userSelectedModelId;
        }
      }

      // Priority 2: Default model from database (ollama_settings)
      if (this.ollamaService?.settings?.default_model) {
        logger.info(`Using database default model for title generation: ${this.ollamaService.settings.default_model}`);
        return this.ollamaService.settings.default_model;
      }

      // Priority 3: Environment variable
      if (process.env.DEFAULT_OLLAMA_MODEL) {
        logger.info(`Using environment default model for title generation: ${process.env.DEFAULT_OLLAMA_MODEL}`);
        return process.env.DEFAULT_OLLAMA_MODEL;
      }

      // Priority 4: Fallback model
      logger.info('Using fallback model for title generation: llama3');
      return 'llama3';

    } catch (error) {
      logger.error('Error determining title generation model:', error);
      return 'llama3'; // Final fallback
    }
  }

  /**
   * Generate a title for a chat session based on conversation content
   * @param {Array} messages - Array of messages from the conversation
   * @param {string} userSelectedModelId - Optional user-selected model ID for title generation
   * @returns {Promise<string>} - Generated title
   */
  async generateTitle(messages, userSelectedModelId = null) {
    try {
      if (!messages || messages.length < this.minMessagesForTitle) {
        return 'New Chat';
      }

      // Ensure Ollama service is initialized (wait for it if needed)
      if (!this.initialized) {
        logger.info('Waiting for OllamaService to initialize...');
        await this.initializeOllamaService();

        // If still not initialized, use fallback
        if (!this.initialized) {
          logger.warn('Failed to initialize OllamaService, using fallback title');
          return this.createFallbackTitle(messages);
        }
      }

      // Get the appropriate model using the priority system
      const model = await this.getTitleGenerationModel(userSelectedModelId);

      // Extract the first few meaningful exchanges for title generation
      const relevantMessages = this.extractRelevantMessages(messages);
      
      if (relevantMessages.length === 0) {
        return 'New Chat';
      }

      // Create a prompt for title generation
      const titlePrompt = this.createTitlePrompt(relevantMessages);

      logger.info(`Generating title using model: ${model}`);

      // Generate title using AI
      const result = await this.ollamaService.generateResponse(titlePrompt, model);
      
      if (result.success && result.response) {
        const generatedTitle = this.cleanTitle(result.response);
        logger.info(`Generated title: "${generatedTitle}"`);
        return generatedTitle;
      } else {
        logger.warn('Failed to generate title, using fallback');
        return this.createFallbackTitle(relevantMessages);
      }
    } catch (error) {
      logger.error('Error generating title:', error);
      return this.createFallbackTitle(messages);
    }
  }

  /**
   * Extract relevant messages for title generation
   * @param {Array} messages - All messages from the conversation
   * @returns {Array} - Filtered messages for title generation
   */
  extractRelevantMessages(messages) {
    // Filter out system messages and take first few exchanges
    const userAssistantMessages = messages.filter(msg => 
      msg.role === 'user' || msg.role === 'assistant'
    );

    // Take first 4 messages (2 exchanges) for title generation
    return userAssistantMessages.slice(0, 4);
  }

  /**
   * Create a prompt for AI title generation
   * @param {Array} messages - Messages to base the title on
   * @returns {string} - Title generation prompt
   */
  createTitlePrompt(messages) {
    const conversation = messages.map(msg => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const content = msg.content || msg.message || '';
      return `${role}: ${content.substring(0, 200)}`;
    }).join('\n\n');

    return `Based on the following conversation, generate a concise, descriptive title (3-6 words maximum) that captures the main topic or question being discussed. The title should be clear, specific, and helpful for identifying this conversation later.

Conversation:
${conversation}

Generate only the title, nothing else. Do not use quotes or special formatting. Examples of good titles:
- "Python Data Analysis Help"
- "Recipe for Chocolate Cake"
- "JavaScript Array Methods"
- "Travel Planning Europe"
- "Resume Writing Tips"

Title:`;
  }

  /**
   * Clean and format the generated title
   * @param {string} rawTitle - Raw title from AI
   * @returns {string} - Cleaned title
   */
  cleanTitle(rawTitle) {
    if (!rawTitle) return 'New Chat';

    let title = rawTitle.trim();
    
    // Remove common prefixes/suffixes
    title = title.replace(/^(Title:|Generated Title:|Chat about|Discussion about|Conversation about)/i, '');
    title = title.replace(/\.$/, ''); // Remove trailing period
    title = title.replace(/^["']|["']$/g, ''); // Remove quotes
    title = title.trim();

    // Ensure title is not too long
    if (title.length > this.maxTitleLength) {
      title = title.substring(0, this.maxTitleLength).trim();
      // Try to end at a word boundary
      const lastSpace = title.lastIndexOf(' ');
      if (lastSpace > this.maxTitleLength * 0.7) {
        title = title.substring(0, lastSpace);
      }
    }

    // Ensure title is not empty or too short
    if (!title || title.length < 3) {
      return 'New Chat';
    }

    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);

    return title;
  }

  /**
   * Create a fallback title when AI generation fails
   * @param {Array} messages - Messages to base the fallback on
   * @returns {string} - Fallback title
   */
  createFallbackTitle(messages) {
    if (!messages || messages.length === 0) {
      return 'New Chat';
    }

    // Find the first user message
    const firstUserMessage = messages.find(msg => msg.role === 'user');
    
    if (firstUserMessage) {
      const content = firstUserMessage.content || firstUserMessage.message || '';
      const words = content.trim().split(/\s+/).slice(0, 4);
      
      if (words.length > 0) {
        let title = words.join(' ');
        if (title.length > this.maxTitleLength) {
          title = title.substring(0, this.maxTitleLength).trim();
        }
        return title.charAt(0).toUpperCase() + title.slice(1);
      }
    }

    return 'New Chat';
  }

  /**
   * Check if a session should have its title generated
   * @param {Array} messages - Current messages in the session
   * @param {string} currentTitle - Current session title
   * @returns {boolean} - Whether title should be generated
   */
  shouldGenerateTitle(messages, currentTitle) {
    // Don't regenerate if title was already customized (not "New Chat")
    if (currentTitle && currentTitle !== 'New Chat' && currentTitle !== 'MCP Session' && currentTitle !== 'Predictor Session') {
      return false;
    }

    // Generate title if we have enough messages
    const meaningfulMessages = messages.filter(msg => 
      (msg.role === 'user' || msg.role === 'assistant') && 
      (msg.content || msg.message || '').trim().length > 0
    );

    return meaningfulMessages.length >= this.minMessagesForTitle;
  }
}

module.exports = new TitleGenerationService();
