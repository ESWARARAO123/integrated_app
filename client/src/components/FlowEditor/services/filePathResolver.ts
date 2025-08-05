/**
 * File Path Resolution Service
 * 
 * This service dynamically constructs file paths for config files based on:
 * - FlowDir execution records from database
 * - Block type (Floorplan, Placement, CTS, Route, etc.)
 * - User's working directory and project structure
 */

export interface BlockFileMapping {
  configFile: string;
  scriptPath: string;
  stage: string;
}

export interface FlowDirExecution {
  id: number;
  execution_id: string;
  user_id: string;
  project_name: string;
  block_name: string;
  tool_name: string;
  stage: string;
  run_name: string;
  working_directory: string;
  central_scripts_directory?: string;
  created_paths?: any; // JSONB field from database
  success: boolean;
  started_at: string;
  completed_at?: string;
  error_message?: string;
}

/**
 * Block Type → Config File Mapping
 * Case-sensitive file names (all lowercase for config files)
 */
export const BLOCK_FILE_MAPPING: Record<string, BlockFileMapping> = {
  // PD Flow Steps
  'Floorplan': {
    configFile: 'floorplan.tcl',
    scriptPath: 'scripts/Floorplan',
    stage: 'PD'
  },
  'Placement': {
    configFile: 'place.tcl',  // Note: place.tcl not placement.tcl
    scriptPath: 'scripts/Place',
    stage: 'PD'
  },
  // Also support "Place" as block type (matches directory name)
  'Place': {
    configFile: 'place.tcl',
    scriptPath: 'scripts/Place',
    stage: 'PD'
  },
  'CTS': {
    configFile: 'cts.tcl',
    scriptPath: 'scripts/CTS',
    stage: 'PD'
  },
  'Route': {
    configFile: 'route.tcl',
    scriptPath: 'scripts/Route',
    stage: 'PD'
  },
  
  // Stage Blocks
  'SYNTH': {
    configFile: 'synthesis.tcl',
    scriptPath: 'scripts',
    stage: 'SYNTH'
  },
  'PD': {
    configFile: 'pd.tcl',
    scriptPath: 'scripts',
    stage: 'PD'
  },
  'LEC': {
    configFile: 'lec.tcl',
    scriptPath: 'scripts',
    stage: 'LEC'
  },
  'STA': {
    configFile: 'sta.tcl',
    scriptPath: 'scripts',
    stage: 'STA'
  }
};

/**
 * Extract username from FlowDir execution paths
 * Pattern: {project}/Phase-0/{block}/{STAGE}/{USERNAME}/{run_name}/...
 * Examples:
 * - "Auradaine/Phase-0/Top_Encoder0/STA/yaswanth/run_cadence_run_01/PD/user_plugin"
 * - "Auradaine/Phase-0/Top_Encoder0/PD/yaswanth/run_cadence_run_01/config.tcl"
 */
export const extractUsernameFromPaths = (createdPaths: any): string | null => {
  console.log('🔍 Extracting username from paths:', createdPaths);
  console.log('🔍 Type of createdPaths:', typeof createdPaths);

  // Handle JSONB data from database - could be array or object
  let pathsArray: string[] = [];

  if (Array.isArray(createdPaths)) {
    pathsArray = createdPaths;
    console.log('✅ createdPaths is array, length:', pathsArray.length);
  } else if (createdPaths && typeof createdPaths === 'object') {
    // If it's an object, try to extract paths from common properties
    pathsArray = createdPaths.paths || createdPaths.directories || [];
    console.log('✅ createdPaths is object, extracted array length:', pathsArray.length);
  } else if (typeof createdPaths === 'string') {
    // If it's a string, try to parse as JSON
    try {
      const parsed = JSON.parse(createdPaths);
      pathsArray = Array.isArray(parsed) ? parsed : [];
      console.log('✅ createdPaths is string, parsed array length:', pathsArray.length);
    } catch (error) {
      console.log('❌ Failed to parse createdPaths as JSON:', error);
      pathsArray = [createdPaths];
    }
  }

  console.log('🔍 Processing paths array:', pathsArray.slice(0, 5)); // Show first 5 paths

  // Known stages that come before username
  const knownStages = ['PD', 'SYNTH', 'STA', 'LEC'];

  for (const path of pathsArray) {
    if (typeof path === 'string') {
      const pathParts = path.split('/');
      console.log('🔍 Path parts for', path, ':', pathParts);

      // Look for pattern: project/Phase-0/block/stage/username/run_name
      // Expected: [project, Phase-0, block, stage, username, run_name, ...]
      if (pathParts.length >= 6) {
        const stage = pathParts[3]; // Index 3 should be stage (PD, SYNTH, STA, LEC)
        const potentialUsername = pathParts[4]; // Index 4 should be username
        const potentialRunName = pathParts[5]; // Index 5 should be run name

        console.log('🔍 Stage at index 3:', stage);
        console.log('🔍 Potential username at index 4:', potentialUsername);
        console.log('🔍 Potential run name at index 5:', potentialRunName);

        // Validate that we have the right pattern
        if (knownStages.includes(stage) &&
            potentialUsername &&
            potentialRunName &&
            !potentialUsername.startsWith('run_') &&
            potentialRunName.startsWith('run_') &&
            potentialUsername !== 'scripts' &&
            potentialUsername !== 'logs' &&
            potentialUsername !== 'reports' &&
            potentialUsername !== 'outputs' &&
            potentialUsername !== 'config') {
          console.log('✅ Found username:', potentialUsername);
          console.log('✅ Found run name:', potentialRunName);
          return potentialUsername;
        }
      }
    }
  }

  console.log('❌ Could not extract username from any path');
  return null;
};

/**
 * Extract run name from FlowDir execution paths
 * Pattern: {project}/Phase-0/{block}/{STAGE}/{USERNAME}/{RUN_NAME}/...
 */
export const extractRunNameFromPaths = (createdPaths: any): string | null => {
  console.log('🔍 Extracting run name from paths:', typeof createdPaths);

  // Handle JSONB data from database - could be array or object
  let pathsArray: string[] = [];

  if (Array.isArray(createdPaths)) {
    pathsArray = createdPaths;
  } else if (createdPaths && typeof createdPaths === 'object') {
    pathsArray = createdPaths.paths || createdPaths.directories || [];
  } else if (typeof createdPaths === 'string') {
    try {
      const parsed = JSON.parse(createdPaths);
      pathsArray = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      pathsArray = [createdPaths];
    }
  }

  // Known stages that come before username
  const knownStages = ['PD', 'SYNTH', 'STA', 'LEC'];

  for (const path of pathsArray) {
    if (typeof path === 'string') {
      const pathParts = path.split('/');

      // Look for pattern: project/Phase-0/block/stage/username/run_name
      if (pathParts.length >= 6) {
        const stage = pathParts[3]; // Index 3 should be stage (PD, SYNTH, STA, LEC)
        const potentialUsername = pathParts[4]; // Index 4 should be username
        const potentialRunName = pathParts[5]; // Index 5 should be run name

        // Validate that we have the right pattern
        if (knownStages.includes(stage) &&
            potentialUsername &&
            potentialRunName &&
            !potentialUsername.startsWith('run_') &&
            potentialRunName.startsWith('run_') &&
            potentialUsername !== 'scripts' &&
            potentialUsername !== 'logs' &&
            potentialUsername !== 'reports' &&
            potentialUsername !== 'outputs' &&
            potentialUsername !== 'config') {
          console.log('✅ Found run name from paths:', potentialRunName);
          return potentialRunName;
        }
      }
    }
  }

  console.log('❌ Could not extract run name from any path');
  return null;
};

/**
 * Construct full file path for a block's config file
 */
export const constructConfigFilePath = async (
  execution: FlowDirExecution,
  blockType: string,
  username?: string
): Promise<string | null> => {
  // Try direct match first
  let blockMapping = BLOCK_FILE_MAPPING[blockType];

  // If no direct match, try case-insensitive match
  if (!blockMapping) {
    const exactMatch = Object.keys(BLOCK_FILE_MAPPING).find(
      key => key.toLowerCase() === blockType.toLowerCase()
    );
    if (exactMatch) {
      blockMapping = BLOCK_FILE_MAPPING[exactMatch];
    }
  }

  // If still no match, try aliases
  if (!blockMapping) {
    const aliases: Record<string, string> = {
      'place': 'Placement',
      'placement': 'Placement',
      'floorplan': 'Floorplan',
      'floor': 'Floorplan',
      'cts': 'CTS',
      'clock': 'CTS',
      'route': 'Route',
      'routing': 'Route',
      'synth': 'SYNTH',
      'synthesis': 'SYNTH',
      'pd': 'PD',
      'lec': 'LEC',
      'sta': 'STA',
      'timing': 'STA'
    };

    const aliasMatch = aliases[blockType.toLowerCase()];
    if (aliasMatch) {
      blockMapping = BLOCK_FILE_MAPPING[aliasMatch];
    }
  }

  if (!blockMapping) {
    console.warn(`No file mapping found for block type: ${blockType}`);
    return null;
  }

  // Extract username and run name from paths if not provided
  let resolvedUsername = username || extractUsernameFromPaths(execution.created_paths);
  let resolvedRunName = extractRunNameFromPaths(execution.created_paths) || execution.run_name;

  // Fallback: If created_paths is undefined/empty, get username from authenticated user
  if (!resolvedUsername) {
    console.log('🔄 created_paths is undefined, trying to get username from authenticated user');

    try {
      // Import the user service dynamically to avoid circular dependencies
      const { getCurrentUser } = await import('./userService');
      const currentUser = await getCurrentUser();

      if (currentUser && currentUser.username) {
        resolvedUsername = currentUser.username;
        console.log('🔄 Using authenticated username:', resolvedUsername);
      } else {
        console.warn('🔄 No authenticated user found');
      }
    } catch (error) {
      console.error('🔄 Error getting authenticated user:', error);
    }
  }

  if (!resolvedUsername) {
    console.warn('Could not extract username from FlowDir execution paths or fallback methods');
    return null;
  }

  // Construct the full path based on the actual FlowDir structure
  // From your database: "Auradaine/Phase-0/Top_Encoder0/PD/yaswanth/run_cadence_run_01/scripts/Floorplan"

  let fullPath: string;

  console.log('🔧 Constructing path for:', {
    blockType,
    blockMapping,
    execution: {
      working_directory: execution.working_directory,
      project_name: execution.project_name,
      block_name: execution.block_name,
      stage: execution.stage,
      run_name: execution.run_name
    },
    resolvedUsername
  });

  console.log('🔧 Raw execution data:', execution);
  console.log('🔧 Database run_name:', execution.run_name);
  console.log('🔧 Database working_directory:', execution.working_directory);
  console.log('🔧 Resolved run_name from paths:', resolvedRunName);
  console.log('🔧 Resolved username:', resolvedUsername);

  if (blockMapping.stage === 'PD' && ['Floorplan', 'Placement', 'Place', 'CTS', 'Route'].includes(blockType)) {
    // For PD flow steps, the config files are in the PD stage directory
    // Pattern: {workingDirectory}/{projectName}/Phase-0/{blockName}/PD/{username}/{runName}/scripts/{FlowStep}/{configFile}

    // Map block type to directory name (Placement → Place)
    let directoryName = blockType;
    if (blockType === 'Placement') {
      directoryName = 'Place';
    }

    // Get working directory from execution record or settings
    let rawWorkingDir = execution.working_directory;

    // If not in execution record, get from flow editor settings
    if (!rawWorkingDir) {
      rawWorkingDir = await getWorkingDirectoryFromSettings();
      console.log('🔧 Got working directory from settings:', rawWorkingDir);
    }

    // Final fallback
    if (!rawWorkingDir) {
      console.warn('🔧 No working directory found, using fallback');
      rawWorkingDir = '/nas/nas_v1/Innovus_trials/users';
    }

    // Ensure working directory ends with proper separator
    const workingDir = rawWorkingDir.endsWith('/')
      ? rawWorkingDir.slice(0, -1)
      : rawWorkingDir;

    console.log('🔧 Using working directory:', workingDir);

    fullPath = [
      workingDir,
      execution.project_name,
      'Phase-0',
      execution.block_name,
      'PD', // Always PD for these flow steps
      resolvedUsername,
      resolvedRunName, // Use the actual run name from paths like "run_cadence_run_01"
      'scripts',
      directoryName, // Floorplan, Place, CTS, Route
      blockMapping.configFile
    ].join('/');
  } else {
    // For stage blocks (SYNTH, LEC, STA), the config files are in their respective stage directories
    // Pattern: {workingDirectory}/{projectName}/Phase-0/{blockName}/{stage}/{username}/{runName}/scripts/{configFile}

    // Get working directory from execution record or settings
    let rawWorkingDir = execution.working_directory;

    // If not in execution record, get from flow editor settings
    if (!rawWorkingDir) {
      rawWorkingDir = await getWorkingDirectoryFromSettings();
      console.log('🔧 Got working directory from settings:', rawWorkingDir);
    }

    // Final fallback
    if (!rawWorkingDir) {
      console.warn('🔧 No working directory found, using fallback');
      rawWorkingDir = '/nas/nas_v1/Innovus_trials/users';
    }

    // Ensure working directory ends with proper separator
    const workingDir = rawWorkingDir.endsWith('/')
      ? rawWorkingDir.slice(0, -1)
      : rawWorkingDir;

    console.log('🔧 Using working directory:', workingDir);

    fullPath = [
      workingDir,
      execution.project_name,
      'Phase-0',
      execution.block_name,
      execution.stage, // SYNTH, LEC, STA, etc.
      resolvedUsername,
      resolvedRunName, // Use the actual run name from paths like "run_cadence_run_01"
      'scripts',
      blockMapping.configFile
    ].join('/');
  }

  console.log('📁 Constructed full path:', fullPath);
  return fullPath;
};

/**
 * Find the most recent FlowDir execution for a user
 */
export const findRecentExecution = async (): Promise<FlowDirExecution | null> => {
  try {
    // The API endpoint uses session-based authentication, so we don't need to pass userId
    const response = await fetch(`/api/flowdir-executions?limit=1`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // The API returns { success: true, data: { executions: [...], total, limit, offset } }
    if (result.success && result.data && result.data.executions.length > 0) {
      return result.data.executions[0];
    }

    return null;
  } catch (error) {
    console.error('Error fetching FlowDir executions:', error);
    return null;
  }
};

/**
 * Get working directory from flow editor settings
 */
const getWorkingDirectoryFromSettings = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/flow-editor-settings', {
      credentials: 'include'
    });

    if (response.ok) {
      const settings = await response.json();
      return settings.working_directory || null;
    }
  } catch (error) {
    console.warn('Could not fetch flow editor settings:', error);
  }

  return null;
};

/**
 * Resolve config file path for a block
 */
export const resolveConfigFilePath = async (
  blockType: string
): Promise<string | null> => {
  // Get the most recent FlowDir execution for the current user
  const execution = await findRecentExecution();
  if (!execution) {
    console.warn('No FlowDir execution found for user');
    return null;
  }

  // Construct the config file path
  const configPath = await constructConfigFilePath(execution, blockType);

  if (configPath) {
    console.log(`📁 Resolved config path for ${blockType}:`, configPath);
  }

  return configPath;
};

/**
 * Validate if a block type supports config file editing
 * Handles case variations and common aliases
 */
export const supportsConfigEditing = (blockType: string): boolean => {
  if (!blockType) return false;

  // Direct match
  if (blockType in BLOCK_FILE_MAPPING) {
    return true;
  }

  // Case-insensitive match
  const normalizedBlockType = blockType.toLowerCase();
  const supportedTypes = Object.keys(BLOCK_FILE_MAPPING).map(key => key.toLowerCase());

  if (supportedTypes.includes(normalizedBlockType)) {
    return true;
  }

  // Handle common aliases and variations
  const aliases: Record<string, string> = {
    'place': 'Placement',
    'placement': 'Placement',
    'floorplan': 'Floorplan',
    'floor': 'Floorplan',
    'cts': 'CTS',
    'clock': 'CTS',
    'route': 'Route',
    'routing': 'Route',
    'synth': 'SYNTH',
    'synthesis': 'SYNTH',
    'pd': 'PD',
    'lec': 'LEC',
    'sta': 'STA',
    'timing': 'STA'
  };

  const aliasMatch = aliases[normalizedBlockType];
  if (aliasMatch && aliasMatch in BLOCK_FILE_MAPPING) {
    return true;
  }

  console.log(`❌ Block type "${blockType}" not supported for config editing`);
  console.log(`📋 Supported types:`, Object.keys(BLOCK_FILE_MAPPING));

  return false;
};

/**
 * Get all supported block types
 */
export const getSupportedBlockTypes = (): string[] => {
  return Object.keys(BLOCK_FILE_MAPPING);
};

/**
 * Example usage and testing
 */
export const testFilePathResolution = () => {
  // Mock FlowDir execution data (from your logs)
  const mockExecution: FlowDirExecution = {
    id: 1,
    execution_id: 'f825e58b-7e5a-463a-881b-07c9f0c02abc',
    user_id: 'user-uuid-123',
    project_name: 'Auradaine',
    block_name: 'Top_Encoder0',
    tool_name: 'cadence',
    stage: 'all',
    run_name: 'run_01',
    working_directory: '/nas/nas_v1/Innovus_trials/users',
    success: true,
    created_paths: [
      'Auradaine/Phase-0/Top_Encoder0/PD/yaswanth/run_cadence_run_01/scripts/Floorplan',
      'Auradaine/Phase-0/Top_Encoder0/PD/yaswanth/run_cadence_run_01/scripts/Place',
      'Auradaine/Phase-0/Top_Encoder0/LEC/yaswanth/run_cadence_run_01/PD/scripts/CTS',
    ],
    started_at: new Date().toISOString()
  };

  console.log('🧪 Testing File Path Resolution:');
  
  // Test different block types
  const testBlocks = ['Floorplan', 'Placement', 'CTS', 'Route', 'SYNTH', 'LEC'];
  
  testBlocks.forEach(blockType => {
    const path = constructConfigFilePath(mockExecution, blockType);
    console.log(`${blockType}: ${path}`);
  });
};

// Uncomment to test
// testFilePathResolution();
