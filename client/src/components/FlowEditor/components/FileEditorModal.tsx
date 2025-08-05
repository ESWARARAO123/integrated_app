import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Textarea,
  VStack,
  HStack,
  Text,
  Alert,
  AlertIcon,
  Badge,
  Box,
  Icon,
  Spinner
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import {
  DocumentTextIcon,
  EyeIcon,
  PencilIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ArrowsPointingOutIcon
} from '@heroicons/react/24/outline';
import { getCachedMCPServerUrl } from '../services/mcpService';
import { readConfigFile } from '../services/fileOperations';
import { calculateFileDiff, getSaveStrategy, generateSedReplacements, formatChangeSummary, FileDiff } from '../services/fileDiffService';

interface FileEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  blockLabel: string;
  mode: 'view' | 'edit';
}

interface FileContent {
  content: string;
  timestamp: string;
}

export const FileEditorModal: React.FC<FileEditorModalProps> = ({
  isOpen,
  onClose,
  filePath,
  blockLabel,
  mode
}) => {
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveMethod, setSaveMethod] = useState<string>('');
  const [serverUrl, setServerUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  // Load MCP server URL when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadMCPServerUrl = async () => {
        try {
          const url = await getCachedMCPServerUrl();
          setServerUrl(url);
        } catch (error) {
          console.error('Error loading MCP server URL:', error);
          // Don't set a hardcoded fallback - let the error be handled properly
          setError('Failed to load MCP server configuration. Please check your MCP settings.');
        }
      };

      loadMCPServerUrl();
    }
  }, [isOpen]);

  // Load file content when modal opens and server URL is available
  useEffect(() => {
    if (isOpen && filePath && serverUrl) {
      loadFileContent();
    }
  }, [isOpen, filePath, serverUrl]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFileContent(null);
      setEditedContent('');
      setError(null);
      setSaveSuccess(false);
      setSaveMethod('');
      setUndoStack([]);
      setRedoStack([]);
      setIsFullscreen(false);

      // Clear auto-save timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    }
  }, [isOpen]);

  // Auto-save functionality - DISABLED to prevent conflicts
  // useEffect(() => {
  //   if (fileContent && editedContent !== fileContent.content && mode === 'edit') {
  //     // Clear existing timeout
  //     if (autoSaveTimeoutRef.current) {
  //       clearTimeout(autoSaveTimeoutRef.current);
  //     }

  //     // Set new auto-save timeout
  //     autoSaveTimeoutRef.current = setTimeout(() => {
  //       saveFileContent(true); // Auto-save
  //     }, 3000); // Auto-save after 3 seconds of inactivity
  //   }
  // }, [editedContent, fileContent, mode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            if (mode === 'edit') saveFileContent();
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
            break;
          case 'y':
            e.preventDefault();
            handleRedo();
            break;
        }
      }

      if (e.key === 'Escape') {
        handleClose();
      }

      if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen(!isFullscreen);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, isFullscreen, undoStack, redoStack]);

  const loadFileContent = async () => {
    if (!filePath || !serverUrl) {
      setError('File path and server URL are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`📖 Loading file content for: ${filePath}`);
      const result = await readConfigFile(filePath, serverUrl);

      if (result.success) {
        // Handle different response formats from MCP
        let rawContent = result.content || '';

        console.log('🔍 Raw content type:', typeof rawContent);
        console.log('🔍 Raw content preview:', rawContent.substring(0, 200));

        // If content contains MCP response with console output, extract just the JSON part
        if (typeof rawContent === 'string' && rawContent.includes('"text":')) {
          try {
            // First try to parse as direct JSON
            const parsed = JSON.parse(rawContent);
            console.log('🔍 Parsed JSON directly:', parsed);

            if (parsed.text) {
              rawContent = parsed.text;
              console.log('✅ Extracted text field from direct JSON');
            }
          } catch (e) {
            // If direct parsing fails, extract JSON from mixed console output
            console.log('🔍 Direct JSON parsing failed, extracting from console output');

            // Look for the JSON pattern: {\n  "text": "..."
            // This is more specific than just looking for any { }
            const jsonPattern = /\{\s*"text":\s*"([\s\S]*?)"\s*\}$/;
            const match = rawContent.match(jsonPattern);

            if (match && match[1]) {
              // Extract the text content and unescape JSON string
              rawContent = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              console.log('✅ Extracted text field using regex pattern');
              console.log('🔍 Extracted content preview:', rawContent.substring(0, 100) + '...');
            } else {
              // Fallback: try to find JSON object boundaries more carefully
              const lines = rawContent.split('\n');
              let jsonStartLine = -1;
              let jsonEndLine = -1;

              // Find the line that starts with just "{"
              for (let i = lines.length - 1; i >= 0; i--) {
                if (lines[i].trim() === '{') {
                  jsonStartLine = i;
                  break;
                }
              }

              // Find the line that ends with just "}"
              for (let i = lines.length - 1; i >= 0; i--) {
                if (lines[i].trim() === '}') {
                  jsonEndLine = i;
                  break;
                }
              }

              if (jsonStartLine !== -1 && jsonEndLine !== -1 && jsonEndLine > jsonStartLine) {
                const jsonLines = lines.slice(jsonStartLine, jsonEndLine + 1);
                const jsonPart = jsonLines.join('\n');
                console.log('🔍 Extracted JSON by line boundaries:', jsonPart);

                try {
                  const parsed = JSON.parse(jsonPart);
                  if (parsed.text) {
                    rawContent = parsed.text;
                    console.log('✅ Extracted text field from line-bounded JSON');
                  }
                } catch (e2) {
                  console.warn('Failed to parse line-bounded JSON, using raw content');
                }
              } else {
                console.warn('Could not find JSON boundaries, using raw content');
              }
            }
          }
        }

        // Convert escaped newlines to actual newlines
        const formattedContent = rawContent.replace(/\\n/g, '\n');

        const content = {
          content: formattedContent,
          timestamp: result.timestamp || new Date().toISOString()
        };
        setFileContent(content);
        setEditedContent(formattedContent);
        // Initialize undo stack with loaded content
        setUndoStack([formattedContent]);
        setRedoStack([]);
        console.log(`✅ File loaded successfully: ${filePath}`);
      } else {
        // Show specific error message from MCP
        const errorMessage = result.error || 'Failed to load file';
        console.error(`❌ File load failed: ${errorMessage}`);

        if (errorMessage.includes('not found') || errorMessage.includes('404')) {
          throw new Error(`Config file not found: ${filePath}\n\nThe file may not have been created yet. Please run FlowDir execution first to generate the config files.`);
        } else {
          throw new Error(errorMessage);
        }
      }
    } catch (err) {
      console.error('Error loading file:', err);
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setLoading(false);
    }
  };

  const saveFileContent = async (isAutoSave = false, retryCount = 0) => {
    if (mode !== 'edit') return;

    // Only set loading state on first attempt to avoid UI flicker
    if (retryCount === 0) {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);
      setSaveMethod('');
    }

    try {
      console.log(`💾 Attempting to save file (attempt ${retryCount + 1}):`, filePath);
      console.log(`📊 Content size: ${editedContent.length} characters`);

      // Calculate diff between original and edited content
      const originalContent = fileContent?.content || '';
      const diff = calculateFileDiff(originalContent, editedContent);
      const saveStrategy = getSaveStrategy(diff);
      
      console.log(`🔍 Diff analysis:`, {
        hasChanges: diff.hasChanges,
        changeCount: diff.changeCount,
        totalLines: diff.totalLines,
        isMinorEdit: diff.isMinorEdit,
        strategy: saveStrategy
      });

      if (!diff.hasChanges) {
        console.log(`✅ No changes detected, skipping save`);
        setSaveSuccess(true);
        setSaveMethod('no_changes');
        setTimeout(() => {
          setSaveSuccess(false);
          setSaveMethod('');
        }, 2000);
        return;
      }

      console.log(`🔧 Using ${saveStrategy} approach for ${diff.changeCount} changed lines`);

      let response: Response;

      if (saveStrategy === 'line-edit') {
        // Use PATCH request for line-by-line editing (more efficient)
        const replacements = generateSedReplacements(diff.changedLines);
        console.log(`🔧 Using PATCH with ${replacements.length} line replacements`);
        
        response = await fetch('/api/dir-create/api/config-file', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Connection': 'close',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify({
            filePath,
            replacements,
            serverUrl,
            timestamp: new Date().toISOString(),
            requestId: `patch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          })
        });
      } else {
        // Use PUT request for full file replacement
        console.log(`🔧 Using PUT for full file replacement`);
        
        response = await fetch('/api/dir-create/api/config-file', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Connection': 'close',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify({
            filePath,
            content: editedContent,
            serverUrl,
            timestamp: new Date().toISOString(),
            requestId: `save-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          })
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}` };
        }
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`✅ File saved successfully using ${data.method || 'shell command'}:`, filePath);
        console.log(`📊 Save method: ${data.method || 'unknown'}`);
        setSaveSuccess(true);
        setSaveMethod(data.method || 'shell_command');
        
        // Update the original content to reflect saved state
        setFileContent(prev => prev ? { ...prev, content: editedContent } : null);

        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setSaveSuccess(false);
          setSaveMethod('');
        }, 3000);
      } else {
        throw new Error(data.error || 'Failed to save file');
      }
    } catch (err) {
      console.error(`❌ Error saving file (attempt ${retryCount + 1}):`, err);

      // Check if it's a connection/network error that might benefit from retry
      const isRetryableError = err instanceof Error && (
        err.message.includes('Failed to fetch') ||
        err.message.includes('NetworkError') ||
        err.message.includes('ERR_EMPTY_RESPONSE') ||
        err.message.includes('request aborted') ||
        err.name === 'AbortError'
      );

      // Retry up to 3 times for retryable errors
      if (isRetryableError && retryCount < 2) {
        console.log(`🔄 Retrying save operation in 2 seconds... (attempt ${retryCount + 2}/3)`);
        setTimeout(() => {
          saveFileContent(isAutoSave, retryCount + 1);
        }, 2000);
        return;
      }

      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    // Add current content to undo stack before changing
    if (editedContent !== newContent && editedContent !== '') {
      setUndoStack(prev => [...prev.slice(-19), editedContent]); // Keep last 20 states
      setRedoStack([]); // Clear redo stack when new change is made
    }
    setEditedContent(newContent);
  };

  const handleUndo = () => {
    if (undoStack.length > 0) {
      const previousContent = undoStack[undoStack.length - 1];
      setRedoStack(prev => [editedContent, ...prev.slice(0, 19)]); // Keep last 20 states
      setUndoStack(prev => prev.slice(0, -1));
      setEditedContent(previousContent);
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const nextContent = redoStack[0];
      setUndoStack(prev => [...prev, editedContent]);
      setRedoStack(prev => prev.slice(1));
      setEditedContent(nextContent);
    }
  };

  const hasUnsavedChanges = mode === 'edit' && fileContent && editedContent !== fileContent.content;

  const handleClose = () => {
    if (hasUnsavedChanges) {
      const confirmClose = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmClose) return;
    }
    onClose();
  };

  // All styles now handled by Chakra UI components

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent
        as={motion.div}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        bg="var(--color-surface)"
        border="1px solid var(--color-border)"
        borderRadius="lg"
        boxShadow="xl"
        maxW="95vw"
        maxH="90vh"
      >
        <ModalHeader color="var(--color-text)">
          <HStack spacing={3} justify="space-between" w="100%">
            <HStack spacing={3}>
              <Icon
                as={mode === 'edit' ? PencilIcon : EyeIcon}
                boxSize={6}
                color="var(--color-primary)"
              />
              <Text>{mode === 'edit' ? 'Edit' : 'View'} {blockLabel} Config</Text>
              {hasUnsavedChanges && (
                <Badge colorScheme="orange" variant="subtle">
                  Unsaved Changes
                </Badge>
              )}
            </HStack>
            <HStack spacing={2}>
              {/* Status indicators */}
              {saveSuccess && (
                <Badge colorScheme="green" variant="subtle">
                  {saveMethod === 'no_changes' ? 'No Changes' : 
                   saveMethod === 'sed_replace' ? 'Saved via Sed' : 
                   saveMethod === 'shell_command' ? 'Saved via Shell' : 
                   'Saved'}
                </Badge>
              )}

              {error && (
                <Badge colorScheme="red" variant="subtle">
                  Error
                </Badge>
              )}

              {/* Edit mode controls */}
              {mode === 'edit' && (
                <>
                  {/* Undo/Redo buttons */}
                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={undoStack.length === 0}
                    onClick={handleUndo}
                    title="Undo (Ctrl+Z)"
                  >
                    <Icon as={ArrowUturnLeftIcon} boxSize={4} />
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={redoStack.length === 0}
                    onClick={handleRedo}
                    title="Redo (Ctrl+Y)"
                  >
                    <Icon as={ArrowUturnRightIcon} boxSize={4} />
                  </Button>

                  {/* Fullscreen toggle */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    title={isFullscreen ? 'Exit Fullscreen (F11)' : 'Fullscreen (F11)'}
                  >
                    <Icon as={ArrowsPointingOutIcon} boxSize={4} />
                  </Button>
                </>
              )}
            </HStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color="var(--color-text)" />

        <ModalBody p={0}>
          {loading ? (
            <VStack spacing={4} py={20}>
              <Spinner size="xl" color="var(--color-primary)" />
              <Text color="var(--color-text-secondary)">Loading file content...</Text>
            </VStack>
          ) : error ? (
            <VStack spacing={4} py={20}>
              <Alert status="error" bg="var(--color-surface-dark)" border="1px solid var(--color-border)">
                <AlertIcon />
                <Text color="var(--color-text)">Error loading file: {error}</Text>
              </Alert>
              <Button onClick={loadFileContent} colorScheme="blue">
                Retry
              </Button>
            </VStack>
          ) : (
            <Box h="60vh">
              <Textarea
                ref={textareaRef}
                value={editedContent}
                onChange={(e) => mode === 'edit' && handleContentChange(e.target.value)}
                isReadOnly={mode === 'view'}
                placeholder={mode === 'edit' ? 'Enter TCL configuration...' : 'File content will appear here...'}
                spellCheck={false}
                resize="none"
                h="100%"
                fontFamily="Monaco, Menlo, 'Ubuntu Mono', monospace"
                fontSize="14px"
                lineHeight="1.5"
                bg="var(--color-bg)"
                border="none"
                borderRadius="0"
                _focus={{ boxShadow: 'none' }}
                color="var(--color-text)"
              />
            </Box>
          )}
        </ModalBody>

        <ModalFooter bg="var(--color-surface-dark)" borderTop="1px solid var(--color-border)">
          <HStack spacing={4} justify="space-between" w="100%">
            <HStack spacing={4} fontSize="sm" color="var(--color-text-secondary)">
              <Text>📁 {filePath}</Text>
              {fileContent && (
                <Text>📅 {new Date(fileContent.timestamp).toLocaleString()}</Text>
              )}
              <Text>{mode === 'edit' ? 'Editable' : 'Read-only'}</Text>
              <Text>{editedContent.split('\n').length} lines</Text>
            </HStack>

            {mode === 'edit' && (
              <Button
                colorScheme="blue"
                isLoading={saving}
                loadingText="Saving..."
                isDisabled={!hasUnsavedChanges}
                onClick={() => saveFileContent()}
              >
                Save Changes
              </Button>
            )}
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
