import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  VStack,
  HStack,
  Text,
  Divider,
  Alert,
  AlertIcon,
  Checkbox,
  Badge,
  Box,
  Tooltip,
  Icon
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { 
  FolderOpenIcon, 
  CubeIcon, 
  PlayIcon, 
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

export interface FlowdirParameters {
  projectName: string;
  blockName: string;
  toolName: 'cadence' | 'synopsys';
  stage: 'all' | 'Synthesis' | 'PD' | 'LEC' | 'STA';
  runName: string;
  pdSteps: string; // For when stage is 'PD': 'all' | 'Floorplan' | 'Place' | 'CTS' | 'Route' or comma-separated
  referenceRun?: string;
  workingDirectory?: string;
  centralScripts?: string;
  mcpServerUrl?: string;
}

interface FlowdirApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (parameters: FlowdirParameters) => void;
  initialParameters: Partial<FlowdirParameters>;
  userSettings?: {
    workingDirectory?: string;
    centralScriptsDirectory?: string;
    mcpServerUrl?: string;
  };
}

const FlowdirApprovalModal: React.FC<FlowdirApprovalModalProps> = ({
  isOpen,
  onClose,
  onApprove,
  initialParameters,
  userSettings
}) => {
  const [parameters, setParameters] = useState<FlowdirParameters>({
    projectName: '',
    blockName: '',
    toolName: 'cadence',
    stage: 'all',
    runName: '',
    pdSteps: 'all',
    referenceRun: '',
    workingDirectory: userSettings?.workingDirectory || '/mnt/projects_107/vasu_backend',
    centralScripts: userSettings?.centralScriptsDirectory || '/mnt/projects_107/vasu_backend/flow/central_scripts',
    mcpServerUrl: userSettings?.mcpServerUrl || '',
    ...initialParameters
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);

  // Available PD steps
  const pdStepsOptions = [
    { value: 'all', label: 'All Steps (Floorplan + Place + CTS + Route)' },
    { value: 'Floorplan', label: 'Floorplan Only' },
    { value: 'Place', label: 'Place Only' },
    { value: 'CTS', label: 'CTS Only' },
    { value: 'Route', label: 'Route Only' },
    { value: 'Floorplan,Place', label: 'Floorplan + Place' },
    { value: 'Place,CTS', label: 'Place + CTS' },
    { value: 'CTS,Route', label: 'CTS + Route' },
    { value: 'Floorplan,Place,CTS', label: 'Floorplan + Place + CTS' },
    { value: 'Place,CTS,Route', label: 'Place + CTS + Route' }
  ];

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setParameters(prev => ({
        ...prev,
        ...initialParameters,
        workingDirectory: userSettings?.workingDirectory || prev.workingDirectory,
        centralScripts: userSettings?.centralScriptsDirectory || prev.centralScripts,
        mcpServerUrl: userSettings?.mcpServerUrl || prev.mcpServerUrl
      }));
      setErrors({});
    }
  }, [isOpen, initialParameters, userSettings]);

  const validateParameters = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!parameters.projectName.trim()) {
      newErrors.projectName = 'Project name is required';
    }

    if (!parameters.blockName.trim()) {
      newErrors.blockName = 'Block name is required';
    }

    if (!parameters.runName.trim()) {
      newErrors.runName = 'Run name is required';
    }

    if (!parameters.workingDirectory?.trim()) {
      newErrors.workingDirectory = 'Working directory is required';
    }

    if (!parameters.centralScripts?.trim()) {
      newErrors.centralScripts = 'Central scripts directory is required';
    }

    if (!parameters.mcpServerUrl?.trim()) {
      newErrors.mcpServerUrl = 'MCP server URL is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleApprove = async () => {
    setIsValidating(true);
    
    if (validateParameters()) {
      // Close modal immediately after validation
      onClose();
      onApprove(parameters);
    }
    
    // Always reset validation state
    setIsValidating(false);
  };

  const handleCancel = () => {
    setIsValidating(false);
    onClose();
  };

  // Reset validation state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsValidating(false);
      setErrors({});
    }
  }, [isOpen]);

  const handleParameterChange = (key: keyof FlowdirParameters, value: string) => {
    setParameters(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Clear error when user starts typing
    if (errors[key]) {
      setErrors(prev => ({
        ...prev,
        [key]: ''
      }));
    }
  };

  const getEstimatedDirectories = (): number => {
    const { stage, pdSteps } = parameters;
    let estimate = 20; // Base directories (RTL, config, etc.)
    
    if (stage === 'all') {
      estimate += 120; // All stages
    } else if (stage === 'PD') {
      const steps = pdSteps === 'all' ? 4 : pdSteps.split(',').length;
      estimate += steps * 15; // ~15 dirs per PD step
    } else if (stage === 'Synthesis') {
      estimate += 15;
    } else {
      estimate += 25; // LEC/STA
    }
    
    return estimate;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
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
      >
        <ModalHeader color="var(--color-text)">
          <HStack spacing={3}>
            <Icon as={CubeIcon} boxSize={6} color="var(--color-primary)" />
            <Text>FlowDir Execution Parameters</Text>
            <Badge colorScheme="blue" variant="subtle">
              ~{getEstimatedDirectories()} directories
            </Badge>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color="var(--color-text)" />

        <ModalBody>
          <VStack spacing={6} align="stretch">
            
            {/* Project Information */}
            <Box>
              <Text fontSize="lg" fontWeight="semibold" color="var(--color-text)" mb={3}>
                <Icon as={FolderOpenIcon} boxSize={5} mr={2} />
                Project Information
              </Text>
              
              <VStack spacing={4}>
                <HStack spacing={4} width="100%">
                  <FormControl isInvalid={!!errors.projectName}>
                    <FormLabel color="var(--color-text-secondary)">Project Name</FormLabel>
                    <Input
                      value={parameters.projectName}
                      onChange={(e) => handleParameterChange('projectName', e.target.value)}
                      placeholder="e.g., Bigendian"
                      bg="var(--color-input-bg)"
                      border="1px solid var(--color-border)"
                      color="var(--color-text)"
                      _placeholder={{ color: 'var(--color-text-tertiary)' }}
                    />
                    {errors.projectName && (
                      <Text color="red.500" fontSize="sm" mt={1}>{errors.projectName}</Text>
                    )}
                  </FormControl>

                  <FormControl isInvalid={!!errors.blockName}>
                    <FormLabel color="var(--color-text-secondary)">Block Name</FormLabel>
                    <Input
                      value={parameters.blockName}
                      onChange={(e) => handleParameterChange('blockName', e.target.value)}
                      placeholder="e.g., Top_encoder_01"
                      bg="var(--color-input-bg)"
                      border="1px solid var(--color-border)"
                      color="var(--color-text)"
                      _placeholder={{ color: 'var(--color-text-tertiary)' }}
                    />
                    {errors.blockName && (
                      <Text color="red.500" fontSize="sm" mt={1}>{errors.blockName}</Text>
                    )}
                  </FormControl>
                </HStack>

                <HStack spacing={4} width="100%">
                  <FormControl>
                    <FormLabel color="var(--color-text-secondary)">Tool</FormLabel>
                    <Select
                      value={parameters.toolName}
                      onChange={(e) => handleParameterChange('toolName', e.target.value as 'cadence' | 'synopsys')}
                      bg="var(--color-input-bg)"
                      border="1px solid var(--color-border)"
                      color="var(--color-text)"
                    >
                      <option value="cadence">Cadence</option>
                      <option value="synopsys">Synopsys</option>
                    </Select>
                  </FormControl>

                  <FormControl isInvalid={!!errors.runName}>
                    <FormLabel color="var(--color-text-secondary)">Run Name</FormLabel>
                    <Input
                      value={parameters.runName}
                      onChange={(e) => handleParameterChange('runName', e.target.value)}
                      placeholder="e.g., run-yaswanth-01"
                      bg="var(--color-input-bg)"
                      border="1px solid var(--color-border)"
                      color="var(--color-text)"
                      _placeholder={{ color: 'var(--color-text-tertiary)' }}
                    />
                    {errors.runName && (
                      <Text color="red.500" fontSize="sm" mt={1}>{errors.runName}</Text>
                    )}
                  </FormControl>
                </HStack>
              </VStack>
            </Box>

            <Divider borderColor="var(--color-border)" />

            {/* Flow Configuration */}
            <Box>
              <Text fontSize="lg" fontWeight="semibold" color="var(--color-text)" mb={3}>
                <Icon as={PlayIcon} boxSize={5} mr={2} />
                Flow Configuration
              </Text>
              
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel color="var(--color-text-secondary)">Stage</FormLabel>
                  <Select
                    value={parameters.stage}
                    onChange={(e) => handleParameterChange('stage', e.target.value as any)}
                    bg="var(--color-input-bg)"
                    border="1px solid var(--color-border)"
                    color="var(--color-text)"
                  >
                    <option value="all">All (SYNTH + PD + LEC + STA)</option>
                    <option value="Synthesis">Synthesis Only</option>
                    <option value="PD">Physical Design Only</option>
                    <option value="LEC">Logic Equivalence Check Only</option>
                    <option value="STA">Static Timing Analysis Only</option>
                  </Select>
                </FormControl>

                {/* PD Steps Selection - Only show when stage is PD */}
                {parameters.stage === 'PD' && (
                  <FormControl>
                    <FormLabel color="var(--color-text-secondary)">
                      PD Steps
                      <Tooltip label="Select which Physical Design steps to include">
                        <Icon as={InformationCircleIcon} boxSize={4} ml={1} color="var(--color-text-tertiary)" />
                      </Tooltip>
                    </FormLabel>
                    <Select
                      value={parameters.pdSteps}
                      onChange={(e) => handleParameterChange('pdSteps', e.target.value)}
                      bg="var(--color-input-bg)"
                      border="1px solid var(--color-border)"
                      color="var(--color-text)"
                    >
                      {pdStepsOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <FormControl>
                  <FormLabel color="var(--color-text-secondary)">
                    Reference Run (Optional)
                    <Tooltip label="Leave empty to create from scratch">
                      <Icon as={InformationCircleIcon} boxSize={4} ml={1} color="var(--color-text-tertiary)" />
                    </Tooltip>
                  </FormLabel>
                  <Input
                    value={parameters.referenceRun || ''}
                    onChange={(e) => handleParameterChange('referenceRun', e.target.value)}
                    placeholder="e.g., previous-run-name"
                    bg="var(--color-input-bg)"
                    border="1px solid var(--color-border)"
                    color="var(--color-text)"
                    _placeholder={{ color: 'var(--color-text-tertiary)' }}
                  />
                </FormControl>
              </VStack>
            </Box>

            <Divider borderColor="var(--color-border)" />

            {/* Execution Configuration */}
            <Box>
              <Text fontSize="lg" fontWeight="semibold" color="var(--color-text)" mb={3}>
                <Icon as={InformationCircleIcon} boxSize={5} mr={2} />
                Execution Configuration
              </Text>
              
              <VStack spacing={4}>
                <FormControl isInvalid={!!errors.workingDirectory}>
                  <FormLabel color="var(--color-text-secondary)">Working Directory</FormLabel>
                  <Input
                    value={parameters.workingDirectory || ''}
                    onChange={(e) => handleParameterChange('workingDirectory', e.target.value)}
                    placeholder="/mnt/projects_107/vasu_backend"
                    bg="var(--color-input-bg)"
                    border="1px solid var(--color-border)"
                    color="var(--color-text)"
                    _placeholder={{ color: 'var(--color-text-tertiary)' }}
                  />
                  {errors.workingDirectory && (
                    <Text color="red.500" fontSize="sm" mt={1}>{errors.workingDirectory}</Text>
                  )}
                </FormControl>

                <FormControl isInvalid={!!errors.centralScripts}>
                  <FormLabel color="var(--color-text-secondary)">Central Scripts Directory</FormLabel>
                  <Input
                    value={parameters.centralScripts || ''}
                    onChange={(e) => handleParameterChange('centralScripts', e.target.value)}
                    placeholder="/mnt/projects_107/vasu_backend/flow/central_scripts"
                    bg="var(--color-input-bg)"
                    border="1px solid var(--color-border)"
                    color="var(--color-text)"
                    _placeholder={{ color: 'var(--color-text-tertiary)' }}
                  />
                  {errors.centralScripts && (
                    <Text color="red.500" fontSize="sm" mt={1}>{errors.centralScripts}</Text>
                  )}
                </FormControl>

                <FormControl isInvalid={!!errors.mcpServerUrl}>
                  <FormLabel color="var(--color-text-secondary)">MCP Server URL</FormLabel>
                  <Input
                    value={parameters.mcpServerUrl || ''}
                    onChange={(e) => handleParameterChange('mcpServerUrl', e.target.value)}
                    placeholder="e.g., http://localhost:8080"
                    bg="var(--color-input-bg)"
                    border="1px solid var(--color-border)"
                    color="var(--color-text)"
                    _placeholder={{ color: 'var(--color-text-tertiary)' }}
                  />
                  {errors.mcpServerUrl && (
                    <Text color="red.500" fontSize="sm" mt={1}>{errors.mcpServerUrl}</Text>
                  )}
                </FormControl>
              </VStack>
            </Box>

            {/* Execution Preview */}
            <Alert status="info" bg="var(--color-info-bg)" border="1px solid var(--color-info-border)">
              <AlertIcon color="var(--color-info)" />
              <Box color="var(--color-text)">
                <Text fontWeight="semibold">Execution Preview:</Text>
                <Text fontSize="sm" mt={1}>
                  This will create approximately <strong>{getEstimatedDirectories()} directories</strong> for{' '}
                  <strong>{parameters.projectName || 'your project'}</strong> using{' '}
                  <strong>{parameters.toolName}</strong> tool
                  {parameters.stage === 'PD' && parameters.pdSteps !== 'all' && (
                    <> with <strong>{parameters.pdSteps}</strong> steps</>
                  )}.
                </Text>
              </Box>
            </Alert>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <HStack spacing={3}>
            <Button
              variant="ghost"
              onClick={handleCancel}
              color="var(--color-text-secondary)"
              _hover={{ bg: 'var(--color-hover)' }}
            >
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleApprove}
              isLoading={isValidating}
              loadingText="Validating..."
              leftIcon={<Icon as={CheckCircleIcon} boxSize={4} />}
            >
              Execute FlowDir
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default FlowdirApprovalModal; 