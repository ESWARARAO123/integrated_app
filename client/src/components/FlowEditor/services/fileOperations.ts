/**
 * File Operations Service
 * 
 * This service handles remote file operations via MCP through the dir-create-api server.
 * It provides functions to read and write config files for the visual flow editor.
 */

export interface FileReadResponse {
  success: boolean;
  content?: string;
  filePath?: string;
  timestamp?: string;
  error?: string;
}

export interface FileWriteResponse {
  success: boolean;
  message?: string;
  filePath?: string;
  timestamp?: string;
  error?: string;
}



/**
 * Read file content via MCP
 */
export const readConfigFile = async (
  filePath: string,
  serverUrl: string
): Promise<FileReadResponse> => {
  try {
    console.log(`📖 Reading config file: ${filePath}`);
    
    const response = await fetch(
      `/api/dir-create/api/config-file?filePath=${encodeURIComponent(filePath)}&serverUrl=${encodeURIComponent(serverUrl)}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ File read successfully: ${filePath}`);
      return {
        success: true,
        content: data.content || '',
        filePath: data.filePath,
        timestamp: data.timestamp
      };
    } else {
      throw new Error(data.error || 'Failed to read file');
    }
  } catch (error) {
    console.error('Error reading config file:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * Write file content via MCP
 */
export const writeConfigFile = async (
  filePath: string,
  content: string,
  serverUrl: string
): Promise<FileWriteResponse> => {
  try {
    console.log(`✏️ Writing config file: ${filePath}`);
    
    const response = await fetch('/api/dir-create/api/config-file', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filePath,
        content,
        serverUrl
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ File saved successfully: ${filePath}`);
      return {
        success: true,
        message: data.message || 'File saved successfully',
        filePath: data.filePath,
        timestamp: data.timestamp
      };
    } else {
      throw new Error(data.error || 'Failed to save file');
    }
  } catch (error) {
    console.error('Error writing config file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * Check if file exists via MCP (using readFile with error handling)
 */
export const checkFileExists = async (
  filePath: string,
  serverUrl: string = 'http://172.28.142.23:8080'
): Promise<boolean> => {
  try {
    const result = await readConfigFile(filePath, serverUrl);
    return result.success;
  } catch (error) {
    return false;
  }
};

/**
 * Validate file path format
 */
export const validateFilePath = (filePath: string): { valid: boolean; error?: string } => {
  if (!filePath) {
    return { valid: false, error: 'File path is required' };
  }

  if (!filePath.trim()) {
    return { valid: false, error: 'File path cannot be empty' };
  }

  // Check for TCL file extension
  if (!filePath.toLowerCase().endsWith('.tcl')) {
    return { valid: false, error: 'File must have .tcl extension' };
  }

  // Check for valid path characters (basic validation)
  const invalidChars = /[<>:"|?*]/;
  if (invalidChars.test(filePath)) {
    return { valid: false, error: 'File path contains invalid characters' };
  }

  return { valid: true };
};

/**
 * Get file extension from path
 */
export const getFileExtension = (filePath: string): string => {
  const lastDot = filePath.lastIndexOf('.');
  return lastDot > 0 ? filePath.substring(lastDot + 1).toLowerCase() : '';
};

/**
 * Get filename from path
 */
export const getFileName = (filePath: string): string => {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;
};

/**
 * Get directory from path
 */
export const getDirectory = (filePath: string): string => {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSlash >= 0 ? filePath.substring(0, lastSlash) : '';
};

/**
 * Format file size (for future use)
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Escape special characters for safe display
 */
export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Basic TCL syntax validation (simple check)
 */
export const validateTclSyntax = (content: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Basic bracket matching
  let braceCount = 0;
  let bracketCount = 0;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '{') braceCount++;
    else if (char === '}') braceCount--;
    else if (char === '[') bracketCount++;
    else if (char === ']') bracketCount--;
  }
  
  if (braceCount !== 0) {
    errors.push(`Unmatched braces: ${braceCount > 0 ? 'missing' : 'extra'} closing brace(s)`);
  }
  
  if (bracketCount !== 0) {
    errors.push(`Unmatched brackets: ${bracketCount > 0 ? 'missing' : 'extra'} closing bracket(s)`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Get line and column from text position
 */
export const getLineColumn = (text: string, position: number): { line: number; column: number } => {
  const lines = text.substring(0, position).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
};

/**
 * Count lines in text
 */
export const countLines = (text: string): number => {
  return text.split('\n').length;
};

/**
 * Count words in text
 */
export const countWords = (text: string): number => {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

/**
 * Count characters in text
 */
export const countCharacters = (text: string): number => {
  return text.length;
};

/**
 * Get text statistics
 */
export const getTextStats = (text: string) => {
  return {
    lines: countLines(text),
    words: countWords(text),
    characters: countCharacters(text),
    charactersNoSpaces: text.replace(/\s/g, '').length
  };
};
