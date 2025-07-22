import React, { useState, useEffect } from 'react';
import { Box, Heading, FormControl, FormLabel, Input, Button, Text, Select, VStack, HStack, Badge, Spinner } from '@chakra-ui/react';
import predictorService, { AvailableTablesResponse, TrainingSet } from '../services/predictiorService';
import TrainingProgress from './TrainingProgress';

interface TrainingFormProps {
  onTrainingComplete?: (result: any) => void;
}

const TrainingForm: React.FC<TrainingFormProps> = ({ onTrainingComplete }) => {
  const [placeTable, setPlaceTable] = useState('');
  const [ctsTable, setCtsTable] = useState('');
  const [routeTable, setRouteTable] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTables, setAvailableTables] = useState<AvailableTablesResponse | null>(null);
  const [loadingTables, setLoadingTables] = useState(true);
  const [selectedTrainingSet, setSelectedTrainingSet] = useState('custom');
  const [showProgress, setShowProgress] = useState(false);

  // Load available tables on component mount
  useEffect(() => {
    const loadTables = async () => {
      try {
        setLoadingTables(true);
        setError(null);
        
        // First check database status
        console.log('?? Checking database status before loading tables...');
        const dbStatus = await predictorService.getDatabaseStatus();
        
        if (!dbStatus.configured || !dbStatus.connected) {
          setError(`Database not configured or not accessible: ${dbStatus.message}. Please configure database connection in Settings ? Prediction Database Settings.`);
          return;
        }
        
        console.log('? Database is configured and connected, loading tables...');
        const tables = await predictorService.getAvailableTables();
        setAvailableTables(tables);
        
        // Auto-select first training set if available
        if (tables.complete_training_sets.length > 0) {
          const firstSet = tables.complete_training_sets[0];
          setSelectedTrainingSet(firstSet.group_name);
          setPlaceTable(firstSet.place_table);
          setCtsTable(firstSet.cts_table);
          setRouteTable(firstSet.route_table);
          console.log('? Auto-selected training set:', firstSet.group_name);
        } else {
          console.log('?? No complete training sets found in database');
          setError('No complete training sets found in the configured database. Please ensure your database contains tables with the required columns for prediction.');
        }
      } catch (error) {
        console.error('? Error loading tables:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('Database not configured')) {
          setError('Database not configured. Please configure database connection in Settings ? Prediction Database Settings.');
        } else {
          setError(`Failed to load available tables: ${errorMessage}`);
        }
      } finally {
        setLoadingTables(false);
      }
    };

    loadTables();
  }, []);

  // Handle training set selection
  const handleTrainingSetChange = (value: string) => {
    setSelectedTrainingSet(value);
    if (value === 'custom') {
      setPlaceTable('');
      setCtsTable('');
      setRouteTable('');
    } else if (availableTables) {
      const trainingSet = availableTables.complete_training_sets.find(set => set.group_name === value);
      if (trainingSet) {
        setPlaceTable(trainingSet.place_table);
        setCtsTable(trainingSet.cts_table);
        setRouteTable(trainingSet.route_table);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate that all required fields are filled
      if (!placeTable || !ctsTable || !routeTable) {
        throw new Error('All three tables (Place, CTS, and Route) are required for training');
      }

      // Validate tables before training
      if (availableTables) {
        const validation = predictorService.validateTables(availableTables, placeTable, ctsTable, routeTable);
        if (!validation.valid) {
          throw new Error(validation.errors.join('; '));
        }
      }

      // Show progress tracking
      setShowProgress(true);
      
      const result = await predictorService.trainModel({
        place_table: placeTable,
        cts_table: ctsTable,
        route_table: routeTable,
      });

      if (!result || result.status === 'error') {
        throw new Error(result?.message || 'Failed to trigger training');
      }

      // Store training session info for future predictions
      predictorService.setLastTrainingSession(placeTable, ctsTable, routeTable);

      let trainingMessage = `? **Training Completed Successfully!**

?? **Training Configuration:**
 Place table: ${placeTable}
 CTS table: ${ctsTable}
 Route table: ${routeTable}

?? **Next Steps:**
The model is now ready for predictions! Type "predict ${placeTable} ${ctsTable}" to generate route table predictions.`;

      const event = new CustomEvent('addPredictorMessage', {
        detail: {
          message: {
            id: `predictor-train-${Date.now()}`,
            role: 'assistant',
            content: trainingMessage,
            timestamp: new Date(),
            predictor: true,
            isServerResponse: true,
            isPredictorResult: true, // Added to identify predictor results
          },
        },
      });
      window.dispatchEvent(event);

      if (onTrainingComplete) {
        onTrainingComplete(result);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);

      const event = new CustomEvent('addPredictorMessage', {
        detail: {
          message: {
            id: `predictor-error-${Date.now()}`,
            role: 'assistant',
            content: `**Predictor Result**  
**Error:** ${errorMessage}`,
            timestamp: new Date(),
            predictor: true,
            isServerResponse: true,
            isPredictorResult: true, // Added to identify predictor errors
            error: errorMessage,
          },
        },
      });
      window.dispatchEvent(event);
    } finally {
      setLoading(false);
    }
  };

  const handleTrainingComplete = (metrics: any) => {
    console.log('Training completed with metrics:', metrics);
    setShowProgress(false);
    setLoading(false);
  };

  const handleTrainingError = (error: string) => {
    console.error('Training error:', error);
    setError(error);
    setShowProgress(false);
    setLoading(false);
  };

  if (loadingTables) {
    return (
      <Box p={4} bg="gray.800" borderRadius="md" boxShadow="md" maxW="500px" mx="auto" mb={4}>
        <VStack spacing={4}>
          <Spinner color="blue.500" />
          <Text color="gray.300">Loading available tables from database...</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box
      p={4}
      bg="gray.800"
      borderRadius="md"
      boxShadow="md"
      maxW="500px"
      mx="auto"
      mb={4}
    >
      <Heading as="h3" size="md" mb={4} color="white">
        Train Predictor Model
      </Heading>

      {availableTables && (
        <Box mb={4} p={3} bg="gray.700" borderRadius="md">
          <Text fontSize="sm" color="gray.300" mb={2}>
            Available Training Sets: {availableTables.complete_training_sets.length}
          </Text>
          <HStack spacing={2} flexWrap="wrap">
            {availableTables.complete_training_sets.map((set) => (
              <Badge key={set.group_name} colorScheme="blue" fontSize="xs">
                {set.group_name} ({set.total_rows.place + set.total_rows.cts + set.total_rows.route} rows)
              </Badge>
            ))}
          </HStack>
        </Box>
      )}

      <form onSubmit={handleSubmit}>
        {availableTables && availableTables.complete_training_sets.length > 0 && (
          <FormControl mb={4}>
            <FormLabel color="gray.300">Training Set</FormLabel>
            <Select
              value={selectedTrainingSet}
              onChange={(e) => handleTrainingSetChange(e.target.value)}
              bg="gray.700"
              color="white"
              borderColor="gray.600"
              _hover={{ borderColor: 'gray.500' }}
            >
              <option value="custom">Custom Tables</option>
              {availableTables.complete_training_sets.map((set) => (
                <option key={set.group_name} value={set.group_name}>
                  {set.group_name}
                </option>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl mb={4}>
          <FormLabel color="gray.300">Place Table Name</FormLabel>
          <Input
            type="text"
            value={placeTable}
            onChange={(e) => setPlaceTable(e.target.value)}
            placeholder={availableTables?.complete_training_sets[0]?.place_table || "e.g., your_place_table"}
            isDisabled={loading || selectedTrainingSet !== 'custom'}
            bg="gray.700"
            color="white"
            borderColor="gray.600"
            _hover={{ borderColor: 'gray.500' }}
            required
          />
        </FormControl>

        <FormControl mb={4}>
          <FormLabel color="gray.300">CTS Table Name</FormLabel>
          <Input
            type="text"
            value={ctsTable}
            onChange={(e) => setCtsTable(e.target.value)}
            placeholder={availableTables?.complete_training_sets[0]?.cts_table || "e.g., your_cts_table"}
            isDisabled={loading || selectedTrainingSet !== 'custom'}
            bg="gray.700"
            color="white"
            borderColor="gray.600"
            _hover={{ borderColor: 'gray.500' }}
            required
          />
        </FormControl>

        <FormControl mb={4}>
          <FormLabel color="gray.300">Route Table Name</FormLabel>
          <Input
            type="text"
            value={routeTable}
            onChange={(e) => setRouteTable(e.target.value)}
            placeholder={availableTables?.complete_training_sets[0]?.route_table || "e.g., your_route_table"}
            isDisabled={loading || selectedTrainingSet !== 'custom'}
            bg="gray.700"
            color="white"
            borderColor="gray.600"
            _hover={{ borderColor: 'gray.500' }}
            required
          />
        </FormControl>

        {error && (
          <Text color="red.400" fontSize="sm" mb={4}>
            {error}
          </Text>
        )}

        <Button
          type="submit"
          isLoading={loading}
          isDisabled={loading || !placeTable || !ctsTable || !routeTable}
          colorScheme="teal"
          width="full"
        >
          {loading ? 'Training...' : 'Train Model'}
        </Button>
      </form>

      {/* Training Progress Component */}
      <TrainingProgress
        isVisible={showProgress}
        onComplete={handleTrainingComplete}
        onError={handleTrainingError}
      />
    </Box>
  );
};

export default TrainingForm;