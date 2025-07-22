import React, { useState, useEffect } from 'react';
import {
  Box,
  Progress,
  Text,
  VStack,
  HStack,
  Badge,
  Alert,
  AlertIcon,
  Spinner,
  Divider,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid
} from '@chakra-ui/react';

interface TrainingStatus {
  is_training: boolean;
  progress: number;
  stage: string;
  message: string;
  start_time: number | null;
  estimated_completion: number | null;
  current_step: number;
  total_steps: number;
  error: string | null;
  tables: {
    place_table: string;
    cts_table: string;
    route_table: string;
  } | null;
  metrics: any | null;
}

interface TrainingProgressProps {
  isVisible: boolean;
  onComplete?: (metrics: any) => void;
  onError?: (error: string) => void;
}

const TrainingProgress: React.FC<TrainingProgressProps> = ({ 
  isVisible, 
  onComplete, 
  onError 
}) => {
  const [status, setStatus] = useState<TrainingStatus>({
    is_training: false,
    progress: 0,
    stage: 'idle',
    message: 'Ready to train',
    start_time: null,
    estimated_completion: null,
    current_step: 0,
    total_steps: 0,
    error: null,
    tables: null,
    metrics: null
  });

  const [elapsedTime, setElapsedTime] = useState<string>('0s');

  // Poll training status
  useEffect(() => {
    if (!isVisible) return;

    const pollStatus = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8088/training-status');
        const data = await response.json();
        
        if (data.status === 'success') {
          const newStatus = data.training_status;
          setStatus(newStatus);

          // Handle completion
          if (!newStatus.is_training && newStatus.stage === 'completed' && newStatus.metrics) {
            onComplete?.(newStatus.metrics);
          }

          // Handle error
          if (newStatus.error) {
            onError?.(newStatus.error);
          }
        }
      } catch (error) {
        console.error('Error polling training status:', error);
      }
    };

    // Poll every 1 second
    const interval = setInterval(pollStatus, 1000);
    
    // Initial poll
    pollStatus();

    return () => clearInterval(interval);
  }, [isVisible, onComplete, onError]);

  // Update elapsed time
  useEffect(() => {
    if (!status.start_time) return;

    const updateElapsed = () => {
      const elapsed = Date.now() / 1000 - status.start_time!;
      const minutes = Math.floor(elapsed / 60);
      const seconds = Math.floor(elapsed % 60);
      
      if (minutes > 0) {
        setElapsedTime(`${minutes}m ${seconds}s`);
      } else {
        setElapsedTime(`${seconds}s`);
      }
    };

    const interval = setInterval(updateElapsed, 1000);
    updateElapsed();

    return () => clearInterval(interval);
  }, [status.start_time]);

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'initialization': return 'blue';
      case 'validation': return 'orange';
      case 'data_loading': return 'purple';
      case 'preprocessing': return 'cyan';
      case 'training_model_1': return 'green';
      case 'training_model_2': return 'green';
      case 'evaluation': return 'teal';
      case 'completed': return 'green';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'initialization': return 'Initializing';
      case 'validation': return 'Validating';
      case 'data_loading': return 'Loading Data';
      case 'preprocessing': return 'Preprocessing';
      case 'training_model_1': return 'Training Model 1';
      case 'training_model_2': return 'Training Model 2';
      case 'evaluation': return 'Evaluating';
      case 'completed': return 'Completed';
      case 'error': return 'Error';
      default: return stage;
    }
  };

  if (!isVisible) return null;

  return (
    <Box p={4} borderWidth={1} borderRadius="md" bg="gray.50">
      <VStack spacing={4} align="stretch">
        <HStack justify="space-between">
          <Text fontSize="lg" fontWeight="bold">
            Training Progress
          </Text>
          {status.is_training && (
            <HStack>
              <Spinner size="sm" />
              <Text fontSize="sm" color="gray.600">
                {elapsedTime}
              </Text>
            </HStack>
          )}
        </HStack>

        {status.error ? (
          <Alert status="error">
            <AlertIcon />
            <Text>{status.error}</Text>
          </Alert>
        ) : (
          <>
            <Box>
              <HStack justify="space-between" mb={2}>
                <Badge colorScheme={getStageColor(status.stage)} variant="solid">
                  {getStageLabel(status.stage)}
                </Badge>
                <Text fontSize="sm" color="gray.600">
                  Step {status.current_step} of {status.total_steps}
                </Text>
              </HStack>
              
              <Progress 
                value={status.progress} 
                colorScheme={getStageColor(status.stage)}
                size="lg"
                hasStripe={status.is_training}
                isAnimated={status.is_training}
              />
              
              <Text mt={2} fontSize="sm" color="gray.700">
                {status.message}
              </Text>
            </Box>

            {status.tables && (
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                  Training Tables:
                </Text>
                <VStack align="start" spacing={1}>
                  <Text fontSize="xs">Place: {status.tables.place_table}</Text>
                  <Text fontSize="xs">CTS: {status.tables.cts_table}</Text>
                  <Text fontSize="xs">Route: {status.tables.route_table}</Text>
                </VStack>
              </Box>
            )}

            {status.metrics && (
              <>
                <Divider />
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={3}>
                    Training Results:
                  </Text>
                  <SimpleGrid columns={2} spacing={4}>
                    {status.metrics.place_to_cts && (
                      <Stat size="sm">
                        <StatLabel>Place ? CTS Model</StatLabel>
                        <StatNumber fontSize="md">
                          R² {status.metrics.place_to_cts.r2_score?.toFixed(3)}
                        </StatNumber>
                        <StatHelpText>
                          MAE: {status.metrics.place_to_cts.mae?.toFixed(4)}
                        </StatHelpText>
                      </Stat>
                    )}
                    
                    {status.metrics.combined_to_route && (
                      <Stat size="sm">
                        <StatLabel>Combined ? Route Model</StatLabel>
                        <StatNumber fontSize="md">
                          R² {status.metrics.combined_to_route.r2_score?.toFixed(3)}
                        </StatNumber>
                        <StatHelpText>
                          MAE: {status.metrics.combined_to_route.mae?.toFixed(4)}
                        </StatHelpText>
                      </Stat>
                    )}
                  </SimpleGrid>
                  
                  {status.metrics.training_time && (
                    <Text fontSize="xs" color="gray.600" mt={2}>
                      Training completed in {status.metrics.training_time.toFixed(1)}s
                    </Text>
                  )}
                </Box>
              </>
            )}
          </>
        )}
      </VStack>
    </Box>
  );
};

export default TrainingProgress;