/**
 * File Diff Service for efficient line-by-line editing
 * Calculates differences between original and edited content
 * Generates sed commands for minimal file modifications
 */

export interface LineChange {
  lineNumber: number;
  oldContent: string;
  newContent: string;
  changeType: 'modified' | 'added' | 'deleted';
}

export interface FileDiff {
  hasChanges: boolean;
  totalLines: number;
  changedLines: LineChange[];
  changeCount: number;
  isMinorEdit: boolean; // Less than 10% of lines changed
}

/**
 * Calculate diff between original and edited content
 */
export const calculateFileDiff = (originalContent: string, editedContent: string): FileDiff => {
  const originalLines = originalContent.split('\n');
  const editedLines = editedContent.split('\n');
  
  const changedLines: LineChange[] = [];
  const maxLines = Math.max(originalLines.length, editedLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const originalLine = originalLines[i] || '';
    const editedLine = editedLines[i] || '';
    
    if (originalLine !== editedLine) {
      if (i < originalLines.length && i < editedLines.length) {
        // Line modified
        changedLines.push({
          lineNumber: i + 1, // sed uses 1-based line numbers
          oldContent: originalLine,
          newContent: editedLine,
          changeType: 'modified'
        });
      } else if (i >= originalLines.length) {
        // Line added
        changedLines.push({
          lineNumber: i + 1,
          oldContent: '',
          newContent: editedLine,
          changeType: 'added'
        });
      } else {
        // Line deleted
        changedLines.push({
          lineNumber: i + 1,
          oldContent: originalLine,
          newContent: '',
          changeType: 'deleted'
        });
      }
    }
  }
  
  const changeCount = changedLines.length;
  const totalLines = Math.max(originalLines.length, editedLines.length);
  const isMinorEdit = changeCount <= Math.max(5, totalLines * 0.1); // Less than 10% or 5 lines max
  
  return {
    hasChanges: changeCount > 0,
    totalLines,
    changedLines,
    changeCount,
    isMinorEdit
  };
};

/**
 * Generate sed replacements for line changes
 */
export const generateSedReplacements = (changes: LineChange[]): Array<{lineNumber: number, newContent: string}> => {
  return changes
    .filter(change => change.changeType === 'modified') // Only handle modifications for now
    .map(change => ({
      lineNumber: change.lineNumber,
      newContent: change.newContent
    }));
};

/**
 * Determine the best save strategy based on diff analysis
 */
export const getSaveStrategy = (diff: FileDiff): 'full-replace' | 'line-edit' => {
  // Use line editing for minor edits (less than 10% changed or max 5 lines)
  if (diff.isMinorEdit && diff.changedLines.every(change => change.changeType === 'modified')) {
    return 'line-edit';
  }
  
  // Use full replace for major changes or when lines are added/deleted
  return 'full-replace';
};

/**
 * Format changes for user display
 */
export const formatChangeSummary = (diff: FileDiff): string => {
  if (!diff.hasChanges) {
    return 'No changes detected';
  }
  
  const strategy = getSaveStrategy(diff);
  const method = strategy === 'line-edit' ? 'Line editing' : 'Full file replacement';
  
  return `${diff.changeCount} line(s) changed using ${method}`;
}; 