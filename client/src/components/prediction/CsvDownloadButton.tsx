import React from 'react';
import { Button, useToast } from '@chakra-ui/react';
import { DownloadIcon } from '@chakra-ui/icons';

interface CsvDownloadButtonProps {
  csvData?: string;
  filename?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: string;
}

const CsvDownloadButton: React.FC<CsvDownloadButtonProps> = ({
  csvData,
  filename = 'prediction_results.csv',
  disabled = false,
  size = 'sm',
  variant = 'outline'
}) => {
  const toast = useToast();

  const handleDownload = () => {
    if (!csvData) {
      toast({
        title: 'Download Failed',
        description: 'No CSV data available for download',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      // Create a blob with the CSV data
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      
      // Create a download link
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      
      // Add to DOM, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      URL.revokeObjectURL(url);

      toast({
        title: 'Download Complete',
        description: `${filename} downloaded successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download CSV file',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Button
      leftIcon={<DownloadIcon />}
      onClick={handleDownload}
      disabled={disabled || !csvData}
      size={size}
      variant={variant}
      colorScheme="blue"
    >
      Download CSV
    </Button>
  );
};

export default CsvDownloadButton;