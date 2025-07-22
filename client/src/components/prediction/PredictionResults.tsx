import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  VStack,
  HStack,
  Badge,
  Button,
  Spinner,
  Alert,
  AlertIcon,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Divider,
  useToast
} from '@chakra-ui/react';
import { DownloadIcon } from '@chakra-ui/icons';

interface PredictionResult {
  id: number;
  beginpoint: string;
  endpoint: string;
  predicted_slack: number;
  confidence_score?: number;
  created_at: string;
}

interface PredictionStats {
  total_predictions: number;
  avg_slack: number;
  min_slack: number;
  max_slack: number;
  high_confidence_count: number;
}

interface PredictionResultsProps {
  isVisible: boolean;
  placeTable?: string;
  ctsTable?: string;
  onDownload?: () => void;
}

const PredictionResults: React.FC<PredictionResultsProps> = ({
  isVisible,
  placeTable,
  ctsTable,
  onDownload
}) => {
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [stats, setStats] = useState<PredictionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  // Fetch prediction results
  const fetchResults = async () => {
    if (!isVisible) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch latest results
      const resultsResponse = await fetch('http://127.0.0.1:8088/results?limit=50');
      const resultsData = await resultsResponse.json();

      if (resultsData.status === 'success') {
        setResults(resultsData.results || []);
      }

      // Fetch statistics
      const statsResponse = await fetch('http://127.0.0.1:8088/results/stats');
      const statsData = await statsResponse.json();

      if (statsData.status === 'success') {
        setStats(statsData.statistics);
      }
    } catch (error) {
      console.error('Error fetching prediction results:', error);
      setError('Failed to fetch prediction results');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh results
  useEffect(() => {
    if (!isVisible) return;

    fetchResults();

    // Refresh every 5 seconds
    const interval = setInterval(fetchResults, 5000);

    return () => clearInterval(interval);
  }, [isVisible]);

  const handleDownload = async () => {
    try {
      const url = new URL('http://127.0.0.1:8088/results/download');
      if (placeTable) url.searchParams.set('place_table', placeTable);
      if (ctsTable) url.searchParams.set('cts_table', ctsTable);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `prediction_results_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: 'Download Complete',
        description: 'Prediction results downloaded successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onDownload?.();
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download prediction results',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const formatSlack = (slack: number) => {
    return slack.toFixed(4);
  };

  const getSlackColor = (slack: number) => {
    if (slack < 0) return 'red';
    if (slack < 0.1) return 'orange';
    if (slack < 0.5) return 'yellow';
    return 'green';
  };

  if (!isVisible) return null;

  return (
    <Box p={4} borderWidth={1} borderRadius="md" bg="white" boxShadow="sm">
      <VStack spacing={4} align="stretch">
        <HStack justify="space-between">
          <Text fontSize="lg" fontWeight="bold">
            Prediction Results
          </Text>
          <HStack>
            <Button
              size="sm"
              leftIcon={<DownloadIcon />}
              onClick={handleDownload}
              colorScheme="blue"
              variant="outline"
            >
              Download CSV
            </Button>
            <Button
              size="sm"
              onClick={fetchResults}
              isLoading={loading}
              colorScheme="gray"
              variant="outline"
            >
              Refresh
            </Button>
          </HStack>
        </HStack>

        {error && (
          <Alert status="error">
            <AlertIcon />
            <Text>{error}</Text>
          </Alert>
        )}

        {stats && (
          <Box>
            <Text fontSize="md" fontWeight="semibold" mb={3}>
              Statistics
            </Text>
            <SimpleGrid columns={4} spacing={4}>
              <Stat size="sm">
                <StatLabel>Total Predictions</StatLabel>
                <StatNumber>{stats.total_predictions}</StatNumber>
              </Stat>
              <Stat size="sm">
                <StatLabel>Average Slack</StatLabel>
                <StatNumber>{formatSlack(stats.avg_slack)}</StatNumber>
              </Stat>
              <Stat size="sm">
                <StatLabel>Min Slack</StatLabel>
                <StatNumber color={getSlackColor(stats.min_slack)}>
                  {formatSlack(stats.min_slack)}
                </StatNumber>
              </Stat>
              <Stat size="sm">
                <StatLabel>Max Slack</StatLabel>
                <StatNumber color={getSlackColor(stats.max_slack)}>
                  {formatSlack(stats.max_slack)}
                </StatNumber>
              </Stat>
            </SimpleGrid>
          </Box>
        )}

        <Divider />

        {loading && results.length === 0 ? (
          <HStack justify="center" py={8}>
            <Spinner />
            <Text>Loading prediction results...</Text>
          </HStack>
        ) : results.length === 0 ? (
          <Text textAlign="center" color="gray.500" py={8}>
            No prediction results found
          </Text>
        ) : (
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th>ID</Th>
                  <Th>Begin Point</Th>
                  <Th>End Point</Th>
                  <Th>Predicted Slack</Th>
                  <Th>Confidence</Th>
                  <Th>Created</Th>
                </Tr>
              </Thead>
              <Tbody>
                {results.map((result) => (
                  <Tr key={result.id}>
                    <Td>{result.id}</Td>
                    <Td>
                      <Text fontSize="xs" maxW="120px" isTruncated>
                        {result.beginpoint}
                      </Text>
                    </Td>
                    <Td>
                      <Text fontSize="xs" maxW="120px" isTruncated>
                        {result.endpoint}
                      </Text>
                    </Td>
                    <Td>
                      <Badge colorScheme={getSlackColor(result.predicted_slack)}>
                        {formatSlack(result.predicted_slack)}
                      </Badge>
                    </Td>
                    <Td>
                      {result.confidence_score ? (
                        <Badge 
                          colorScheme={result.confidence_score > 0.8 ? 'green' : result.confidence_score > 0.6 ? 'yellow' : 'red'}
                        >
                          {(result.confidence_score * 100).toFixed(1)}%
                        </Badge>
                      ) : (
                        <Text fontSize="xs" color="gray.400">N/A</Text>
                      )}
                    </Td>
                    <Td>
                      <Text fontSize="xs">
                        {new Date(result.created_at).toLocaleString()}
                      </Text>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}

        {placeTable && ctsTable && (
          <Text fontSize="xs" color="gray.600" textAlign="center">
            Results from tables: {placeTable} ? {ctsTable}
          </Text>
        )}
      </VStack>
    </Box>
  );
};

export default PredictionResults;