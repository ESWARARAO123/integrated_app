import React, { useState, useEffect } from 'react';
import {
  Heading,
  FormControl,
  FormLabel,
  Input,
  Button,
  Text,
  Select,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  Progress,
  Divider
} from '@chakra-ui/react';
import { Box, VStack, HStack } from '@chakra-ui/layout';
import predictorService, { AvailableTablesResponse, TableInfo } from '../../services/predictorService';

interface PredictionFormProps {
  onPredictionComplete?: (result: any) => void;
  defaultPlaceTable?: string;
  defaultCtsTable?: string;
}

const PredictionForm: React.FC<PredictionFormProps> = ({ 
  onPredictionComplete,
  defaultPlaceTable = '',
  defaultCtsTable = ''
}) => {
  const [placeTable, setPlaceTable] = useState(defaultPlaceTable);
  const [ctsTable, setCtsTable] = useState(defaultCtsTable);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTables, setAvailableTables] = useState<AvailableTablesResponse | null>(null);
  const [loadingTables, setLoadingTables] = useState(true);
  const [progress, setProgress] = useState(0);
  const [predictionStatus, setPredictionStatus] = useState<string>('');

  // Load available tables on component mount
  useEffect(() => {
    const loadTables = async () => {
      try {
        setLoadingTables(true);
        const tables = await predictorService.getAvailableTables();
        setAvailableTables(tables);
      } catch (error) {
        console.error('Error loading tables:', error);
        setError('Failed to load available tables');
      } finally {
        setLoadingTables(false);
      }
    };

    loadTables();
  }, []);

  // Update form when default values change
  useEffect(() => {
    if (defaultPlaceTable) setPlaceTable(defaultPlaceTable);
    if (defaultCtsTable) setCtsTable(defaultCtsTable);
  }, [defaultPlaceTable, defaultCtsTable]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProgress(0);
    setPredictionStatus('Initializing prediction...');

    try {
      // Validate inputs
      if (!placeTable || !ctsTable) {
        throw new Error('Both Place table and CTS table are required');
      }

      // Validate tables exist and are suitable
      if (availableTables) {
        const placeTableInfo = availableTables.all_tables.find(t => t.table_name === placeTable);
        const ctsTableInfo = availableTables.all_tables.find(t => t.table_name === ctsTable);

        if (!placeTableInfo) {
          throw new Error(`Place table "${placeTable}" not found`);
        }
        if (!ctsTableInfo) {
          throw new Error(`CTS table "${ctsTable}" not found`);
        }

        // Check if tables have required features
        const validation = predictorService.validateTablesForPrediction([placeTableInfo, ctsTableInfo]);
        if (!validation.valid) {
          throw new Error(validation.errors.join('; '));
        }
      }

      setProgress(25);
      setPredictionStatus('Sending prediction request...');

      const result = await predictorService.predict({
        place_table: placeTable,
        cts_table: ctsTable
      });

      setProgress(50);
      setPredictionStatus('Processing predictions...');

      if (!result || result.status === 'error') {
        throw new Error(result?.message || 'Failed to generate predictions');
      }

      setProgress(75);
      setPredictionStatus('Finalizing results...');

      // Simulate processing time for better UX
      await new Promise(resolve => setTimeout(resolve, 1000));

      setProgress(100);
      setPredictionStatus('Predictions completed successfully!');

      // Create success message for chat
      let predictionMessage = `? **Predictions Generated Successfully!**

?? **Prediction Configuration:**
 Place table: ${placeTable}
 CTS table: ${ctsTable}
 Total predictions: ${result.total_predictions || 'Multiple'}

?? **Results Summary:**`;

      if (result.statistics) {
        predictionMessage += `
 Average predicted slack: ${result.statistics.avg_slack?.toFixed(4) || 'N/A'}
 Min slack: ${result.statistics.min_slack?.toFixed(4) || 'N/A'}
 Max slack: ${result.statistics.max_slack?.toFixed(4) || 'N/A'}`;
      }

      predictionMessage += `

?? **Next Steps:**
View detailed results in the Results tab or download the CSV file for further analysis.`;

      // Dispatch event to add message to chat
      const event = new CustomEvent('addPredictorMessage', {
        detail: {
          message: {
            id: `predictor-predict-${Date.now()}`,
            role: 'assistant',
            content: predictionMessage,
            timestamp: new Date(),
            predictor: true,
            isServerResponse: true,
            isPredictorResult: true,
          },
        },
      });
      window.dispatchEvent(event);

      if (onPredictionComplete) {
        onPredictionComplete(result);
      }

      // Reset form
      setProgress(0);
      setPredictionStatus('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setProgress(0);
      setPredictionStatus('');

      // Dispatch error message to chat
      const event = new CustomEvent('addPredictorMessage', {
        detail: {
          message: {
            id: `predictor-predict-error-${Date.now()}`,
            role: 'assistant',
            content: `? **Prediction Failed**\n\n${errorMessage}\n\nPlease check your table selection and try again.`,
            timestamp: new Date(),
            predictor: true,
            isServerResponse: true,
            isPredictorResult: true,
          },
        },
      });
      window.dispatchEvent(event);
    } finally {
      setLoading(false);
    }
  };

  const getSuitableTablesForType = (type: 'place' | 'cts') => {
    if (!availableTables) return [];
    
    return availableTables.all_tables.filter(table => {
      if (type === 'place') {
        return table.table_name.toLowerCase().includes('place');
      } else {
        return table.table_name.toLowerCase().includes('cts');
      }
    });
  };

  if (loadingTables) {
    return (
      <Box p={4} bg="gray.800" borderRadius="md" boxShadow="md" maxW="500px" mx="auto" mb={4}>
        <VStack spacing={4}>
          <Spinner color="teal.500" />
          <Text color="white">Loading available tables...</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box p={4} bg="gray.800" borderRadius="md" boxShadow="md" maxW="500px" mx="auto" mb={4}>
      <form onSubmit={handleSubmit}>
        <VStack spacing={4}>
          <Heading size="md" color="white" textAlign="center">
            Generate Predictions
          </Heading>

          {availableTables && (
            <Box w="full">
              <Text fontSize="sm" color="gray.300" mb={2}>
                Available: {availableTables.total_tables} tables, {availableTables.suitable_for_training} suitable for prediction
              </Text>
            </Box>
          )}

          <FormControl isRequired>
            <FormLabel color="white">Place Table</FormLabel>
            <Select
              value={placeTable}
              onChange={(e) => setPlaceTable(e.target.value)}
              placeholder="Select place table"
              bg="white"
              color="black"
            >
              {getSuitableTablesForType('place').map((table) => (
                <option key={table.table_name} value={table.table_name}>
                  {table.table_name} ({table.row_count} rows)
                  {table.suitable_for_training ? ' ?' : ' ??'}
                </option>
              ))}
            </Select>
          </FormControl>

          <FormControl isRequired>
            <FormLabel color="white">CTS Table</FormLabel>
            <Select
              value={ctsTable}
              onChange={(e) => setCtsTable(e.target.value)}
              placeholder="Select CTS table"
              bg="white"
              color="black"
            >
              {getSuitableTablesForType('cts').map((table) => (
                <option key={table.table_name} value={table.table_name}>
                  {table.table_name} ({table.row_count} rows)
                  {table.suitable_for_training ? ' ?' : ' ??'}
                </option>
              ))}
            </Select>
          </FormControl>

          {/* Progress indicator */}
          {loading && (
            <Box w="full">
              <Text fontSize="sm" color="gray.300" mb={2}>
                {predictionStatus}
              </Text>
              <Progress value={progress} colorScheme="teal" size="sm" />
            </Box>
          )}

          {error && (
            <Alert status="error">
              <AlertIcon />
              <Text fontSize="sm">{error}</Text>
            </Alert>
          )}

          <Button
            type="submit"
            isLoading={loading}
            isDisabled={loading || !placeTable || !ctsTable}
            colorScheme="teal"
            width="full"
          >
            {loading ? 'Generating Predictions...' : 'Generate Predictions'}
          </Button>

          {availableTables && availableTables.complete_training_sets.length > 0 && (
            <>
              <Divider />
              <Box w="full">
                <Text fontSize="sm" color="gray.300" mb={2}>
                  Suggested table combinations:
                </Text>
                <VStack spacing={2} align="stretch">
                  {availableTables.complete_training_sets.slice(0, 3).map((set, index) => (
                    <HStack key={index} justify="space-between">
                      <Text fontSize="xs" color="gray.400">
                        {set.place_table} + {set.cts_table}
                      </Text>
                      <Button
                        size="xs"
                        variant="outline"
                        colorScheme="teal"
                        onClick={() => {
                          setPlaceTable(set.place_table);
                          setCtsTable(set.cts_table);
                        }}
                      >
                        Use
                      </Button>
                    </HStack>
                  ))}
                </VStack>
              </Box>
            </>
          )}
        </VStack>
      </form>
    </Box>
  );
};

export default PredictionForm;