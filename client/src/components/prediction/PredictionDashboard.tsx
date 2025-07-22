import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Badge,
  Text,
  Button,
  Alert,
  AlertIcon,
  Spinner,
  useToast,
  Divider
} from '@chakra-ui/react';
import TrainingForm from './TrainingForm';
import PredictionForm from './PredictionForm';
import PredictionResults from './PredictionResults';
import predictorService from '../../services/predictorService';

interface DatabaseStatus {
  configured: boolean;
  connected: boolean;
  message: string;
  total_tables?: number;
}

const PredictionDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [lastTraining, setLastTraining] = useState<{
    place_table: string;
    cts_table: string;
    route_table: string;
  } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const toast = useToast();

  // Check database status
  const checkDatabaseStatus = async () => {
    setLoadingStatus(true);
    try {
      const status = await predictorService.getDatabaseStatus();
      setDbStatus(status);
    } catch (error) {
      console.error('Error checking database status:', error);
      setDbStatus({
        configured: false,
        connected: false,
        message: 'Failed to check database status'
      });
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    checkDatabaseStatus();
    
    // Check for last training session
    const lastSession = predictorService.getLastTrainingSession();
    if (lastSession) {
      setLastTraining(lastSession);
    }
  }, []);

  const handleTrainingComplete = (result: any) => {
    console.log('Training completed:', result);
    
    // Update last training info
    if (result.place_table && result.cts_table && result.route_table) {
      setLastTraining({
        place_table: result.place_table,
        cts_table: result.cts_table,
        route_table: result.route_table
      });
    }

    toast({
      title: 'Training Complete',
      description: 'Model training completed successfully!',
      status: 'success',
      duration: 5000,
      isClosable: true,
    });

    // Switch to prediction tab
    setActiveTab(1);
  };

  const handlePredictionComplete = (result: any) => {
    console.log('Prediction completed:', result);
    
    toast({
      title: 'Prediction Complete',
      description: `Generated ${result.total_predictions || 'multiple'} predictions successfully!`,
      status: 'success',
      duration: 5000,
      isClosable: true,
    });

    // Show results
    setShowResults(true);
    setActiveTab(2);
  };

  const getStatusColor = (status: DatabaseStatus) => {
    if (status.connected) return 'green';
    if (status.configured) return 'yellow';
    return 'red';
  };

  const getStatusText = (status: DatabaseStatus) => {
    if (status.connected) return 'Connected';
    if (status.configured) return 'Configured';
    return 'Not Connected';
  };

  return (
    <Box maxW="1200px" mx="auto" p={4}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <HStack justify="space-between" align="center" mb={4}>
            <Text fontSize="2xl" fontWeight="bold">
              Prediction Dashboard
            </Text>
            <HStack>
              {loadingStatus ? (
                <Spinner size="sm" />
              ) : dbStatus ? (
                <Badge colorScheme={getStatusColor(dbStatus)} variant="solid">
                  {getStatusText(dbStatus)}
                  {dbStatus.total_tables ? ` (${dbStatus.total_tables} tables)` : ''}
                </Badge>
              ) : null}
              <Button size="sm" onClick={checkDatabaseStatus} variant="outline">
                Refresh Status
              </Button>
            </HStack>
          </HStack>

          {dbStatus && !dbStatus.connected && (
            <Alert status="warning" mb={4}>
              <AlertIcon />
              <VStack align="start" spacing={1}>
                <Text fontWeight="semibold">Database Connection Issue</Text>
                <Text fontSize="sm">{dbStatus.message}</Text>
                <Text fontSize="xs" color="gray.600">
                  Please configure your prediction database connection in the settings.
                </Text>
              </VStack>
            </Alert>
          )}

          {lastTraining && (
            <Alert status="info" mb={4}>
              <AlertIcon />
              <VStack align="start" spacing={1}>
                <Text fontWeight="semibold">Last Training Session</Text>
                <Text fontSize="sm">
                  Place: {lastTraining.place_table} | CTS: {lastTraining.cts_table} | Route: {lastTraining.route_table}
                </Text>
                <Text fontSize="xs" color="gray.600">
                  Model is ready for predictions with these tables.
                </Text>
              </VStack>
            </Alert>
          )}
        </Box>

        {/* Main Content */}
        <Tabs index={activeTab} onChange={setActiveTab} variant="enclosed" colorScheme="teal">
          <TabList>
            <Tab>
              <HStack>
                <Text>Training</Text>
                {!dbStatus?.connected && <Badge colorScheme="red" size="sm">!</Badge>}
              </HStack>
            </Tab>
            <Tab>
              <HStack>
                <Text>Prediction</Text>
                {!lastTraining && <Badge colorScheme="orange" size="sm">!</Badge>}
              </HStack>
            </Tab>
            <Tab>
              <HStack>
                <Text>Results</Text>
                {showResults && <Badge colorScheme="green" size="sm">New</Badge>}
              </HStack>
            </Tab>
          </TabList>

          <TabPanels>
            {/* Training Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontSize="lg" fontWeight="semibold" mb={2}>
                    Model Training
                  </Text>
                  <Text fontSize="sm" color="gray.600" mb={4}>
                    Train your prediction model using place, CTS, and route tables. 
                    The system will automatically detect suitable tables and suggest training sets.
                  </Text>
                </Box>
                
                <TrainingForm onTrainingComplete={handleTrainingComplete} />
              </VStack>
            </TabPanel>

            {/* Prediction Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontSize="lg" fontWeight="semibold" mb={2}>
                    Generate Predictions
                  </Text>
                  <Text fontSize="sm" color="gray.600" mb={4}>
                    Use your trained model to generate route slack predictions. 
                    Select place and CTS tables to predict route outcomes.
                  </Text>
                </Box>

                {!lastTraining ? (
                  <Alert status="warning">
                    <AlertIcon />
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="semibold">No Trained Model</Text>
                      <Text fontSize="sm">
                        Please train a model first before making predictions.
                      </Text>
                      <Button 
                        size="sm" 
                        colorScheme="teal" 
                        onClick={() => setActiveTab(0)}
                        mt={2}
                      >
                        Go to Training
                      </Button>
                    </VStack>
                  </Alert>
                ) : (
                  <PredictionForm 
                    onPredictionComplete={handlePredictionComplete}
                    defaultPlaceTable={lastTraining.place_table}
                    defaultCtsTable={lastTraining.cts_table}
                  />
                )}
              </VStack>
            </TabPanel>

            {/* Results Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontSize="lg" fontWeight="semibold" mb={2}>
                    Prediction Results
                  </Text>
                  <Text fontSize="sm" color="gray.600" mb={4}>
                    View and download your prediction results. Results are updated in real-time.
                  </Text>
                </Box>

                <PredictionResults
                  isVisible={true}
                  placeTable={lastTraining?.place_table}
                  ctsTable={lastTraining?.cts_table}
                  onDownload={() => setShowResults(false)}
                />
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* Footer */}
        <Divider />
        <Text fontSize="xs" color="gray.500" textAlign="center">
          Prediction Dashboard - Real-time model training and prediction results
        </Text>
      </VStack>
    </Box>
  );
};

export default PredictionDashboard;