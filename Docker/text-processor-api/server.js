/**
 * Text Processor API Server
 * 
 * This server provides API endpoints for text extraction from documents,
 * running the Python extraction scripts within the container.
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3580;

// Configure middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Configure file upload with multer
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, '/tmp/uploads/');
  },
  filename: function(req, file, cb) {
    // Generate unique filename and preserve extension
    const originalExtension = path.extname(file.originalname);
    const filename = uuidv4() + originalExtension;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Ensure uploads directory exists
try {
  fs.mkdirSync('/tmp/uploads', { recursive: true });
} catch (err) {
  console.log('Uploads directory already exists or cannot be created');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Extract text endpoint
app.post('/extract-text', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const { userId, sessionId, documentId } = req.body;

    console.log(`Processing file: ${filePath}`);
    console.log(`User: ${userId}, Session: ${sessionId}, Document: ${documentId}`);
    console.log(`Original filename: ${req.file.originalname}, Mimetype: ${req.file.mimetype}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({
        success: false,
        error: `File not found at ${filePath}`
      });
    }

    // Execute Python script for text extraction
    const result = await extractText(filePath);

    // Clean up the temporary file
    fs.unlink(filePath, (err) => {
      if (err) console.error(`Error deleting temporary file: ${err.message}`);
    });

    res.json(result);
  } catch (error) {
    console.error('Error processing document:', error);
    res.status(500).json({
      success: false,
      error: `Error processing document: ${error.message}`
    });
  }
});

// Extract text with tables endpoint
app.post('/extract-tables', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const { userId, sessionId, documentId } = req.body;

    console.log(`Processing file with tables: ${filePath}`);
    console.log(`User: ${userId}, Session: ${sessionId}, Document: ${documentId}`);
    console.log(`Original filename: ${req.file.originalname}, Mimetype: ${req.file.mimetype}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({
        success: false,
        error: `File not found at ${filePath}`
      });
    }

    // Execute Python script for text extraction with tables
    const result = await extractTextWithTables(filePath);

    // Clean up the temporary file
    fs.unlink(filePath, (err) => {
      if (err) console.error(`Error deleting temporary file: ${err.message}`);
    });

    res.json(result);
  } catch (error) {
    console.error('Error processing document with tables:', error);
    res.status(500).json({
      success: false,
      error: `Error processing document with tables: ${error.message}`
    });
  }
});

/**
 * Extract text from a PDF file using the Python script
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<Object>} - Extraction result
 */
function extractText(filePath) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.resolve('/app/python/extract_text.py');
    
    console.log(`Running Python script: ${pythonScript}`);
    console.log(`File path: ${filePath}`);
    
    const pythonProcess = spawn('python', [pythonScript, filePath]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`Python stderr: ${data.toString()}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        console.error(`stderr: ${stderr}`);
        return resolve({
          success: false,
          error: `Python extraction failed with code ${code}: ${stderr}`
        });
      }
      
      try {
        const result = JSON.parse(stdout.trim());
        return resolve(result);
      } catch (error) {
        console.error('Error parsing Python output:', error);
        return resolve({
          success: false,
          error: `Error parsing Python output: ${error.message}`,
          rawOutput: stdout.substring(0, 500)
        });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('Error executing Python script:', error);
      reject(error);
    });
  });
}

/**
 * Extract text with tables from a PDF file using the Python script
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<Object>} - Extraction result
 */
function extractTextWithTables(filePath) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.resolve('/app/python/extract_text_with_tables.py');
    
    console.log(`Running Python script: ${pythonScript}`);
    console.log(`File path: ${filePath}`);
    
    const pythonProcess = spawn('python', [pythonScript, filePath]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`Python stderr: ${data.toString()}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        console.error(`stderr: ${stderr}`);
        return resolve({
          success: false,
          error: `Python extraction failed with code ${code}: ${stderr}`
        });
      }
      
      try {
        const result = JSON.parse(stdout.trim());
        return resolve(result);
      } catch (error) {
        console.error('Error parsing Python output:', error);
        return resolve({
          success: false,
          error: `Error parsing Python output: ${error.message}`,
          rawOutput: stdout.substring(0, 500)
        });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('Error executing Python script:', error);
      reject(error);
    });
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(`Text Processor API server running on port ${PORT}`);
}); 