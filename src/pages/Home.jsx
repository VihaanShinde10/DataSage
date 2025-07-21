import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpTrayIcon as DocumentArrowUpIcon,
  DocumentTextIcon,
  TableCellsIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import { FILE_TYPES, ERROR_MESSAGES } from '../constants/config';
import { validateFileType, validateFileSize, validateCSVStructure } from '../utils/validation';
import { processCSVData, detectColumnTypes } from '../utils/dataProcessing';
import { datasetApi, preprocessingApi } from '../api';
import { formatFileSize } from '../utils/fileUtils';

// Mock dataset for testing
const MOCK_DATASETS = {
  'employee_data.csv': {
    status: 'READY',
    totalColumns: 10,
    totalRows: 100,
    missingValues: '2.5%',
    datasetSize: '5.2KB',
    fields: [
      { name: 'age', type: 'Numeric', missing: '0%', unique: 20, sample: '28, 34, 45' },
      { name: 'salary', type: 'Numeric', missing: '0%', unique: 100, sample: '72000, 86000, 115000' },
      { name: 'experience', type: 'Numeric', missing: '0%', unique: 15, sample: '5, 10, 18' },
      { name: 'education', type: 'Categorical', missing: '0%', unique: 3, sample: 'Masters, PhD, Bachelors' },
      { name: 'department', type: 'Categorical', missing: '0%', unique: 5, sample: 'Engineering, Research, Management' },
      { name: 'performance_score', type: 'Numeric', missing: '0%', unique: 15, sample: '85, 92, 88' },
      { name: 'attendance', type: 'Numeric', missing: '0%', unique: 10, sample: '92, 95, 90' },
      { name: 'projects_completed', type: 'Numeric', missing: '0%', unique: 8, sample: '7, 12, 9' },
      { name: 'satisfaction_level', type: 'Numeric', missing: '0%', unique: 12, sample: '4.2, 4.7, 4.0' },
      { name: 'last_evaluation', type: 'Numeric', missing: '0%', unique: 10, sample: '4.5, 4.8, 4.3' }
    ]
  }
};

// Sample data for the mock dataset
const MOCK_SAMPLE_DATA = [
  {
    age: "28",
    salary: "72000",
    experience: "5",
    education: "Masters",
    department: "Engineering",
    performance_score: "85",
    attendance: "92",
    projects_completed: "7",
    satisfaction_level: "4.2",
    last_evaluation: "4.5"
  },
  {
    age: "34",
    salary: "86000",
    experience: "10",
    education: "PhD",
    department: "Research",
    performance_score: "92",
    attendance: "95",
    projects_completed: "12",
    satisfaction_level: "4.7",
    last_evaluation: "4.8"
  },
  {
    age: "45",
    salary: "115000",
    experience: "18",
    education: "Masters",
    department: "Management",
    performance_score: "88",
    attendance: "90",
    projects_completed: "9",
    satisfaction_level: "4.0",
    last_evaluation: "4.3"
  },
  {
    age: "31",
    salary: "65000",
    experience: "7",
    education: "Bachelors",
    department: "Marketing",
    performance_score: "76",
    attendance: "85",
    projects_completed: "5",
    satisfaction_level: "3.8",
    last_evaluation: "3.9"
  },
  {
    age: "24",
    salary: "55000",
    experience: "2",
    education: "Bachelors",
    department: "Sales",
    performance_score: "72",
    attendance: "88",
    projects_completed: "4",
    satisfaction_level: "3.5",
    last_evaluation: "3.7"
  }
];

function Home({ setCurrentFile, setDatasetMetadata, setSampleData = () => {}, setSessionId = () => {} }) {
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [isBackendAvailable, setIsBackendAvailable] = useState(true); // Assume backend is available by default

  // Check backend health on component mount
  useEffect(() => {
    datasetApi.checkHealth()
      .then(response => {
        console.log('Backend health status:', response);
        setIsBackendAvailable(response?.status === 'ok');
      })
      .catch(err => {
        console.warn('Backend health check failed:', err);
        setIsBackendAvailable(false);
      });
  }, []);

  // Helper functions for data processing
  const calculateMissingPercentage = (data) => {
    if (!data.length) return '0%';
    const totalCells = data.length * Object.keys(data[0] || {}).length;
    const missingCells = data.reduce((count, row) => {
      return count + Object.values(row).filter(val => val === '' || val === null || val === undefined).length;
    }, 0);
    return `${((missingCells / totalCells) * 100).toFixed(1)}%`;
  };

  const calculateColumnMissingPercentage = (data, column) => {
    if (!data.length) return '0%';
    const missingCount = data.filter(row => !row[column] || row[column] === '').length;
    return `${((missingCount / data.length) * 100).toFixed(1)}%`;
  };

  const countUniqueValues = (data, column) => {
    if (!data.length) return 0;
    return new Set(data.map(row => row[column]).filter(Boolean)).size;
  };

  const getSampleValues = (data, column) => {
    if (!data.length) return '';
    return data
      .slice(0, 3)
      .map(row => row[column])
      .filter(Boolean)
      .join(', ');
  };

  const handleFileProcess = async (file) => {
    try {
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

      // Validate file type
      const allowedTypes = Object.values(FILE_TYPES).map(type => type.mimeType);
      if (!validateFileType(file, allowedTypes)) {
        throw new Error(ERROR_MESSAGES.FILE_UPLOAD.INVALID_TYPE);
      }

      // Validate file size
      const fileTypeConfig = Object.values(FILE_TYPES).find(type => type.mimeType === file.type);
      if (!validateFileSize(file, fileTypeConfig?.maxSize || 10 * 1024 * 1024)) {
        throw new Error(ERROR_MESSAGES.FILE_UPLOAD.TOO_LARGE);
      }

      setUploadProgress(20);

      // Create a unique session ID for this upload
      const uniqueSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      // Check if backend is available
      if (isBackendAvailable) {
        try {
          // First create a new session
          console.log('Creating new session with ID:', uniqueSessionId);
          
          // Try to create a session or use an existing one
          const sessionResponse = await datasetApi.createSession();
          const session_id = sessionResponse.data.session_id;
          console.log('Backend assigned session ID:', session_id);
          
          // Update the app-level session ID
          setSessionId(session_id);
          
          // Start file upload to backend
          console.log('Uploading file to backend:', file.name);
          const response = await datasetApi.uploadDataset(file, { session_id });
          setUploadProgress(50);
          
          if (!response || !response.data) {
            throw new Error('Invalid response from server');
          }
          
          // Make sure we set the file object with the session ID
          const fileWithSession = {
            ...file,
            id: session_id,
            sessionId: session_id
          };
          setCurrentFile(fileWithSession);
          
          console.log('File uploaded, session ID:', session_id);
          
          // Get dataset metadata from backend
          const metadataResponse = await datasetApi.getSessionMetadata(session_id);
          const metadata = metadataResponse.data.metadata || metadataResponse.data;
          
          // Add session ID to metadata
          const metadataWithSession = {
            ...metadata,
            sessionId: session_id,
            filename: file.name
          };
          
          console.log('Setting dataset metadata with session ID:', metadataWithSession);
          
          setUploadProgress(70);
          
          // Get sample data from backend
          const dataResponse = await datasetApi.getSessionData(session_id);
          const sampleData = dataResponse.data.data || [];
          setUploadProgress(90);
          
          setDatasetMetadata(metadataWithSession);
          setSampleData(sampleData);
          setUploadProgress(100);
          
          // Navigate to overview after successful upload
          setTimeout(() => {
            navigate('/overview');
          }, 500);
          return;
        } catch (apiError) {
          console.error('Backend API error:', apiError);
          console.warn('Backend processing failed, falling back to client-side processing with generated session ID:', uniqueSessionId);
        }
      } else {
        console.log('Backend unavailable, using client-side processing with generated session ID:', uniqueSessionId);
      }
      
      // If we reach here, either backend is unavailable or failed
      // Fall back to client-side processing with our generated session ID
      setSessionId(uniqueSessionId);
      await processFallback(file, uniqueSessionId);
    } catch (err) {
      console.error('File processing error:', err);
      setError(err.message || ERROR_MESSAGES.FILE_UPLOAD.GENERIC_ERROR);
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  // Fallback processing method if backend fails
  const processFallback = async (file, sessionId) => {
    if (file.type === FILE_TYPES.CSV.mimeType) {
      setUploadProgress(30);
      const text = await file.text();
      setUploadProgress(50);
      
      const validationResult = validateCSVStructure(text);
      if (!validationResult.isValid) {
        throw new Error(validationResult.error || ERROR_MESSAGES.FILE_UPLOAD.INVALID_STRUCTURE);
      }
      setUploadProgress(70);
      
      const { headers, data } = processCSVData(text);
      if (!headers.length || !data.length) {
        throw new Error(ERROR_MESSAGES.FILE_UPLOAD.EMPTY_FILE);
      }
      setUploadProgress(80);
      
      const columnTypes = detectColumnTypes(data);
      setUploadProgress(90);
      
      // Create file with sessionId
      const fileWithSession = {
        ...file,
        id: sessionId,
        sessionId: sessionId
      };
      
      const metadata = {
        status: 'READY',
        totalColumns: headers.length,
        totalRows: data.length,
        missingValues: calculateMissingPercentage(data),
        datasetSize: formatFileSize(file.size),
        fields: headers.map(header => ({
          name: header,
          type: columnTypes[header] || 'Unknown',
          missing: calculateColumnMissingPercentage(data, header),
          unique: countUniqueValues(data, header),
          sample: getSampleValues(data, header),
        })),
        filename: file.name,
        sessionId: sessionId // Include session ID in metadata
      };

      setCurrentFile(fileWithSession);
      setDatasetMetadata(metadata);
      setSampleData(data);
      setUploadProgress(100);
      
      // Navigate to overview after successful upload
      setTimeout(() => {
        navigate('/overview');
      }, 500);
    } else {
      throw new Error(ERROR_MESSAGES.FILE_UPLOAD.UNSUPPORTED_FORMAT);
    }
  };

  const loadSampleData = () => {
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    // Create a unique session ID for sample data
    const uniqueSessionId = `sample-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Check if backend is available
    if (isBackendAvailable) {
      // Try to load sample dataset from backend
      datasetApi.createSession()
        .then(sessionResponse => {
          const session_id = sessionResponse.data.session_id;
          // Update app-level session ID
          setSessionId(session_id);
          setUploadProgress(30);
          
          return preprocessingApi.applyOperation(session_id, 'load_sample', { dataset: 'employee_data' })
            .then(() => {
              setUploadProgress(60);
              
              // Get metadata and sample data
              return Promise.all([
                datasetApi.getSessionMetadata(session_id),
                datasetApi.getSessionData(session_id)
              ]);
            })
            .then(([metadataResponse, dataResponse]) => {
              const metadata = metadataResponse.data.metadata || metadataResponse.data;
              const sampleData = dataResponse.data.data || [];
              
              // Create a mock file object with the session ID
              const mockFile = new File([''], 'employee_data.csv', { type: 'text/csv' });
              mockFile.id = session_id;
              mockFile.sessionId = session_id;
              
              // Add session ID to metadata
              const metadataWithSession = {
                ...metadata,
                sessionId: session_id
              };
              
              setCurrentFile(mockFile);
              setDatasetMetadata(metadataWithSession);
              setSampleData(sampleData);
              setUploadProgress(100);
              
              setTimeout(() => {
                navigate('/overview');
              }, 500);
            })
            .catch(error => {
              console.warn('Failed to load sample from backend:', error);
              loadMockData(uniqueSessionId);
            });
        })
        .catch(() => {
          console.warn('Failed to create session, using local mock data with generated session ID:', uniqueSessionId);
          loadMockData(uniqueSessionId);
        });
    } else {
      console.log('Backend unavailable, using mock data with generated session ID:', uniqueSessionId);
      loadMockData(uniqueSessionId);
    }
  };
  
  // Helper function to load mock data
  const loadMockData = (sessionId) => {
    // Update app-level session ID
    setSessionId(sessionId);
    setUploadProgress(50);
    
    // Create a mock file object with the session ID
    const mockFile = new File([''], 'employee_data.csv', { type: 'text/csv' });
    mockFile.id = sessionId;
    mockFile.sessionId = sessionId;
    
    setUploadProgress(70);

    // Use our predefined mock data
    const mockMetadata = MOCK_DATASETS['employee_data.csv'];
    // Add session ID to metadata
    mockMetadata.sessionId = sessionId;
    
    setCurrentFile(mockFile);
    setDatasetMetadata(mockMetadata);
    setSampleData(MOCK_SAMPLE_DATA);
    setUploadProgress(100);

    setTimeout(() => {
      navigate('/overview');
      setIsUploading(false);
    }, 500);
  };

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      handleFileProcess(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/json': ['.json']
    },
    maxSize: 20 * 1024 * 1024, // 20MB
    multiple: false
  });

  const fileTypes = [
    { id: FILE_TYPES.CSV.id, icon: DocumentTextIcon, description: 'Comma-separated values' },
    { id: FILE_TYPES.EXCEL.id, icon: TableCellsIcon, description: 'Microsoft Excel files' },
    { id: FILE_TYPES.JSON.id, icon: DocumentTextIcon, description: 'JavaScript Object Notation' }
  ];

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-6 md:mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 md:mb-4">
          Upload Your Dataset
        </h1>
        <p className="text-base md:text-lg text-gray-600">
          Drag and drop your file or click to browse
        </p>
      </div>

      {/* File Upload Area */}
      <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-200 p-4 md:p-8 mb-6 md:mb-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg md:rounded-xl p-6 md:p-12 text-center cursor-pointer transition-all duration-200 ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <DocumentArrowUpIcon className="h-12 w-12 md:h-16 md:w-16 mx-auto text-gray-400 mb-3 md:mb-4" />
          <p className="text-lg md:text-xl text-gray-600 mb-1 md:mb-2">
            {isDragActive ? 'Drop your file here' : 'Drag and drop your file here'}
          </p>
          <p className="text-sm text-gray-500">Supported formats: CSV, Excel, JSON</p>
          <p className="text-xs text-gray-400 mt-2">Maximum file size: 20MB</p>
        </div>
      </div>

      {/* Sample Data Button */}
      <div className="text-center mb-6">
        <button
          onClick={loadSampleData}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <BeakerIcon className="h-5 w-5 mr-2" />
          Use Sample Dataset
        </button>
        <p className="text-xs text-gray-500 mt-2">
          Don't have a dataset? Use our sample employee data to explore the application.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg md:rounded-xl p-3 md:p-4 mb-6 md:mb-8">
          <div className="flex items-center">
            <ExclamationCircleIcon className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* File Type Selection (Optional) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 md:mb-8">
        {fileTypes.map((type) => (
          <div key={type.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center hover:shadow-md transition-shadow duration-200">
            <type.icon className="h-8 w-8 mx-auto text-blue-500 mb-2" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">{type.id}</h3>
            <p className="text-xs text-gray-500">{type.description}</p>
          </div>
        ))}
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl md:rounded-2xl p-6 md:p-8 text-center w-full max-w-sm mx-4">
            <div className="relative">
              <ArrowPathIcon className="h-8 w-8 mx-auto text-blue-600 animate-spin mb-4" />
              {uploadProgress === 100 && (
                <CheckCircleIcon className="h-8 w-8 mx-auto text-green-600 absolute top-0 left-1/2 transform -translate-x-1/2" />
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {uploadProgress === 100 ? 'Upload Complete!' : 'Processing Your Data'}
            </h3>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500">
              {uploadProgress === 100
                ? 'Redirecting to overview...'
                : 'This will only take a moment...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home; 