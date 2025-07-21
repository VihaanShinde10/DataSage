import React, { useState, useEffect, useContext, Fragment, useCallback, useRef } from 'react';
import {
  TrashIcon,
  ArrowPathIcon,
  PlusIcon,
  AdjustmentsHorizontalIcon,
  DocumentDuplicateIcon,
  FunnelIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  XMarkIcon,
  ServerIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import { preprocessingApi, datasetApi } from '../api';
import { AppContext } from '../context/AppContext';

// Simple error message component
const ErrorMessage = ({ message, onDismiss }) => {
  if (!message) return null;
  
  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded flex items-start">
      <ExclamationCircleIcon className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-red-700 font-medium">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

// Modal component for operation details
const DetailsModal = ({ isOpen, onClose, details, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={onClose}>
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="text-lg font-medium text-gray-900">{title || 'Operation Details'}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="my-4 max-h-96 overflow-y-auto">
          <pre className="bg-gray-50 p-4 rounded text-sm overflow-x-auto">
            {JSON.stringify(details, null, 2)}
          </pre>
        </div>
        <div className="mt-3 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 text-xs font-medium rounded-md hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

function Preprocess() {
  // Get data from context instead of props
  const { currentFile, datasetMetadata, updateDatasetFromSession, sessionId } = useContext(AppContext);
  
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [activeOperation, setActiveOperation] = useState(null);
  const [operations, setOperations] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);
  const [processingError, setProcessingError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dataPreview, setDataPreview] = useState(null);
  const [showDataPreview, setShowDataPreview] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedOperationName, setSelectedOperationName] = useState('');
  const [isApiAvailable, setIsApiAvailable] = useState(true);
  const [activeTab, setActiveTab] = useState('operations');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  // Add new state for API diagnostics
  const [apiDiagnostics, setApiDiagnostics] = useState(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const abortControllerRef = useRef(null);

  // Add debug logging
  useEffect(() => {
    console.log('Preprocess component data:', {
      hasFile: !!currentFile,
      fileId: currentFile?.id,
      sessionId: sessionId || currentFile?.sessionId,
      hasMetadata: !!datasetMetadata,
      columnsCount: datasetMetadata?.fields?.length || 0
    });
    
    // Check API availability on component mount
    checkApiAvailability();
  }, [currentFile, datasetMetadata, sessionId]);

  // Load data preview when preview tab is activated
  useEffect(() => {
    if (activeTab === 'preview' && (sessionId || currentFile?.sessionId)) {
      loadDataPreview(sessionId || currentFile?.sessionId);
    }
  }, [activeTab, sessionId, currentFile?.sessionId]);

  // Check if the preprocessing API is available
  const checkApiAvailability = async () => {
    try {
      // Use the existing health check endpoint if available
      const response = await datasetApi.checkHealth();
      const isAvailable = response?.status === 'ok';
      setIsApiAvailable(isAvailable);
      console.log('API availability check:', response);
      
      if (!isAvailable) {
        // Show a specific error message for failed health check
        setProcessingError(
          'Backend API health check failed. Please ensure the Flask server is running correctly.'
        );
      } else {
        // If API is available, clear any previous error messages about availability
        setProcessingError(null);
      }
      
      return isAvailable;
    } catch (error) {
      console.error('API availability check failed:', error);
      setIsApiAvailable(false);
      
      // Check if this is a CORS error (common in development)
      const isCorsError = error.message?.includes('CORS') || 
                          error.message?.includes('Cross-Origin Request Blocked');
      
      // Show an error message in the UI with appropriate guidance
      if (isCorsError) {
        setProcessingError(
          'CORS error detected. This is likely due to the backend running on a different port. ' +
          'Please ensure your Flask backend has CORS enabled and is accessible from this application.'
        );
      } else if (error.message?.includes('Network Error') || error.message?.includes('Failed to fetch')) {
        setProcessingError(
          'Network error when connecting to the backend. Please ensure your Flask server is running ' +
          'and accessible at the correct URL (check your .env file for API_BASE_URL setting).'
        );
      } else {
        setProcessingError(
          'Backend API is not available. Please ensure the backend server is running correctly. ' +
          'Check for endpoint conflicts in your Flask server (e.g., duplicate route names like "eda.get_session_statistics").'
        );
      }
      
      return false;
    }
  };

  // Clear notifications after 5 seconds
  useEffect(() => {
    let timer;
    if (successMessage || processingError) {
      timer = setTimeout(() => {
        setSuccessMessage(null);
        setProcessingError(null);
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [successMessage, processingError]);

  // Show operation details
  const showOperationDetails = (details, name) => {
    setSelectedDetails(details);
    setSelectedOperationName(name || 'Operation Details');
    setShowDetailsModal(true);
  };

  if (!currentFile || !datasetMetadata) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <div className="text-center">
          <AdjustmentsHorizontalIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Dataset Selected</h3>
          <p className="text-sm text-gray-500">Please upload a dataset to begin preprocessing.</p>
        </div>
      </div>
    );
  }

  const operationTypes = [
    {
      id: 'clean',
      name: 'Clean Data',
      description: 'Handle missing values and outliers',
      icon: TrashIcon,
      operations: [
        { id: 'fill_mean', name: 'Fill with Mean', applicable: ['Numeric'] },
        { id: 'fill_median', name: 'Fill with Median', applicable: ['Numeric'] },
        { id: 'fill_mode', name: 'Fill with Mode', applicable: ['Categorical', 'Numeric'] },
        { id: 'fill_constant', name: 'Fill with Constant', applicable: ['Categorical', 'Numeric', 'DateTime'] },
        { id: 'drop_missing', name: 'Drop Missing Values', applicable: ['Categorical', 'Numeric', 'DateTime'] },
      ]
    },
    {
      id: 'transform',
      name: 'Transform',
      description: 'Apply mathematical transformations',
      icon: ArrowPathIcon,
      operations: [
        { id: 'normalize', name: 'Normalize', applicable: ['Numeric'] },
        { id: 'standardize', name: 'Standardize', applicable: ['Numeric'] },
        { id: 'log_transform', name: 'Log Transform', applicable: ['Numeric'] },
        { id: 'bin', name: 'Binning', applicable: ['Numeric'] },
      ]
    },
    {
      id: 'encode',
      name: 'Encode',
      description: 'Convert categorical data to numeric',
      icon: DocumentDuplicateIcon,
      operations: [
        { id: 'one_hot', name: 'One-Hot Encoding', applicable: ['Categorical'] },
        { id: 'label', name: 'Label Encoding', applicable: ['Categorical'] },
        { id: 'frequency', name: 'Frequency Encoding', applicable: ['Categorical'] },
      ]
    },
    {
      id: 'filter',
      name: 'Filter',
      description: 'Filter rows based on conditions',
      icon: FunnelIcon,
      operations: [
        { id: 'range_filter', name: 'Range Filter', applicable: ['Numeric'] },
        { id: 'value_filter', name: 'Value Filter', applicable: ['Categorical', 'Numeric'] },
        { id: 'date_filter', name: 'Date Filter', applicable: ['DateTime'] },
      ]
    }
  ];

  const handleColumnSelect = (columnName) => {
    console.log(`Selecting column: ${columnName}`);
    setSelectedColumns(prev => 
      prev.includes(columnName)
        ? prev.filter(col => col !== columnName)
        : [...prev, columnName]
    );
  };

  const addOperation = (operationType, operation) => {
    if (selectedColumns.length === 0) return;
    
    console.log(`Adding operation: ${operation.name} for columns: ${selectedColumns.join(', ')}`);
    
    const newOperation = {
      id: Date.now(),
      type: operationType,
      operation: operation,
      columns: [...selectedColumns],
      status: 'pending'
    };
    
    setOperations(prev => [...prev, newOperation]);
    setSelectedColumns([]);
    setActiveOperation(null);
    
    // Show immediate feedback
    setSuccessMessage(`Added ${operation.name} operation to the queue`);
    
    // If we have a data preview, mark it with a warning that it's outdated
    if (dataPreview && activeTab === 'preview') {
      setProcessingError('Preview may be outdated - apply operations to see changes');
    }
  };

  const removeOperation = (operationId) => {
    console.log(`Removing operation with ID: ${operationId}`);
    setOperations(prev => prev.filter(op => op.id !== operationId));
  };

  const processOperation = async (op, currentFile) => {
    console.log(`Processing operation: ${op.operation.name} for columns: ${op.columns.join(', ')}`);
    
    // Update UI immediately to show processing
    setOperations(prev => 
      prev.map(o => o.id === op.id ? { ...o, status: 'processing' } : o)
    );
    
    // Get the appropriate session ID
    const operationSessionId = sessionId || currentFile.sessionId || currentFile.id;
    console.log(`Using session ID for operation: ${operationSessionId}`);
    
    // Basic validation
    if (!operationSessionId) {
      throw new Error('Missing session ID for operation');
    }
    
    if (!op.columns || op.columns.length === 0) {
      throw new Error('No columns selected for this operation');
    }
    
    // Prepare params
    const operationParams = {
      columns: op.columns,
      operation_type: op.operation.id,
    };
    
    // Add specific parameters for certain operation types
    if (op.type === 'clean' && op.operation.id === 'fill_constant') {
      operationParams.value = op.value !== undefined ? op.value : '';
    } else if (op.type === 'filter' && op.operation.id === 'range_filter') {
      operationParams.min_value = op.min_value;
      operationParams.max_value = op.max_value;
    } else if (op.type === 'filter' && op.operation.id === 'value_filter') {
      operationParams.value = op.value;
      operationParams.operator = op.operator || '==';
    } else if (op.type === 'filter' && op.operation.id === 'date_filter') {
      operationParams.start_date = op.start_date;
      operationParams.end_date = op.end_date;
    } else if (op.type === 'transform' && op.operation.id === 'bin') {
      operationParams.bins = op.bins || 5;
    }
    
    try {
      // Set temporary status message
      setSuccessMessage(`Processing ${op.operation.name} operation...`);
      
      // Simple direct API call
      const response = await preprocessingApi.applyOperation(
        operationSessionId, 
        `${op.type}/${op.operation.id}`,
        operationParams
      );
      
      console.log(`Operation completed:`, response);
      
      // Update UI with success
      setOperations(prev => {
        return prev.map(o => 
          o.id === op.id ? { 
            ...o, 
            status: 'completed',
            responseData: response.data
          } : o
        );
      });
      
      setSuccessMessage(`Successfully completed: ${op.operation.name}`);
      return true;
    } catch (error) {
      console.error(`Error:`, error);
      
      // Show error and update UI
      setProcessingError(`Error: ${error.message || 'Unknown error'}`);
      setOperations(prev => {
        return prev.map(o => 
          o.id === op.id ? { 
            ...o, 
            status: 'failed',
            error: error.message || 'Operation failed'
          } : o
        );
      });
      
      return false;
    }
  };

  // Helper function to extract meaningful details from response for success messages
  const getSuccessDetailFromResponse = (op, response) => {
    // Handle both standard response.data and direct response objects
    const data = response?.data || response || {};
    
    // Handle different response formats
    if (data.rows !== undefined && data.columns !== undefined) {
      return ` (${data.rows} rows, ${data.columns} columns)`;
    }
    
    if (op.type === 'clean') {
      if (data.missing_values_count !== undefined) {
      return ` (${data.missing_values_count} missing values remaining)`;
      }
      if (data.filled_values !== undefined) {
        return ` (filled ${data.filled_values} missing values)`;
      }
    }
    
    if (op.type === 'filter' && data.rows !== undefined) {
      return ` (${data.rows} rows remain)`;
    }
    
    if (op.type === 'encode') {
      if (data.columns && data.column_names) {
      const newColumns = data.column_names.length - op.columns.length;
      if (newColumns > 0) {
        return ` (created ${newColumns} new columns)`;
        }
      }
      if (data.encoded_columns !== undefined) {
        return ` (encoded ${data.encoded_columns} columns)`;
      }
    }
    
    if (op.type === 'transform') {
      if (data.transformed_values !== undefined) {
        return ` (transformed ${data.transformed_values} values)`;
      }
    }
    
    // If there's a message in the response, use it
    if (data.message) {
      return ` (${data.message})`;
    }
    
    // Default: show success without details
    return '';
  };

  const applyOperations = async () => {
    // Get the session ID
    const operationSessionId = sessionId || currentFile?.sessionId || currentFile?.id;
    
    if (operations.length === 0 || !operationSessionId) {
      setProcessingError('Cannot apply operations: No session ID or operations to apply');
      return;
    }
    
    console.log(`Starting to apply operations using session ID: ${operationSessionId}`);
    setIsProcessing(true);
    setProcessingError(null);
    setSuccessMessage('Starting to apply operations...');
    
    try {
      let completedOps = 0;
      let failedOps = 0;
      const pendingOps = operations.filter(op => op.status === 'pending');
      const totalPending = pendingOps.length;
      
      // Process each operation sequentially
      for (const op of pendingOps) {
        setSuccessMessage(`Processing operation: ${op.operation.name} (${completedOps + 1} of ${totalPending})...`);
        
        try {
        const success = await processOperation(op, currentFile);
        
        if (success) {
          completedOps++;
        } else {
          failedOps++;
          }
        } catch (error) {
          console.error(`Error processing operation ${op.operation.name}:`, error);
          failedOps++;
        }
        
        // Update UI with progress
        if (completedOps > 0 && failedOps > 0) {
          setSuccessMessage(`Processed ${completedOps} operations successfully, ${failedOps} failed...`);
        } else if (completedOps > 0) {
          setSuccessMessage(`Processed ${completedOps} of ${totalPending} operations...`);
        } else if (failedOps > 0) {
          setProcessingError(`Failed to process ${failedOps} operations...`);
        }
      }
      
      // Final status message
      if (completedOps === totalPending) {
        setSuccessMessage(`Successfully applied all ${completedOps} operations to the dataset.`);
      } else if (completedOps > 0) {
        setSuccessMessage(`Applied ${completedOps} out of ${totalPending} operations.`);
        setProcessingError(`Failed to apply ${totalPending - completedOps} operations.`);
      } else {
        setProcessingError('Failed to apply any operations to the dataset.');
        setSuccessMessage(null);
      }
      
      // Switch to preview tab after operations are applied and load fresh data
      if (completedOps > 0) {
        setActiveTab('preview');
        
        // Ensure we get fresh data by introducing a small delay
        setTimeout(() => {
          loadDataPreview(operationSessionId);
        }, 500);
      }
    } catch (error) {
      console.error('Error in operation processing:', error);
      setProcessingError(`Error: ${error.message || 'An unexpected error occurred'}`);
      setSuccessMessage(null);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Add a diagnostic function to check all relevant API endpoints
  const diagnoseAPIEndpoints = useCallback(async () => {
    setIsDiagnosing(true);
    setApiDiagnostics(null);
    
    // Create a new AbortController for this diagnosis session
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('New diagnosis started');
    }
    abortControllerRef.current = new AbortController();
    
    const diagnosticResults = {
      health: { status: 'unknown', latency: null, message: 'Not checked' },
      session: { status: 'unknown', latency: null, message: 'Not checked' },
      sessionData: { status: 'unknown', latency: null, message: 'Not checked' },
      sampleData: { status: 'unknown', latency: null, message: 'Not checked' },
      preprocessing: { status: 'unknown', latency: null, message: 'Not checked' },
    };
    
    const runDiagnostic = async (name, apiCall, params = null) => {
      const start = Date.now();
      try {
        console.log(`Running diagnostic for ${name}...`);
        const result = await apiCall(params);
        const latency = Date.now() - start;
        console.log(`${name} diagnostic successful:`, result);
        
        return {
          status: 'success',
          latency,
          message: `OK (${latency}ms)`,
          data: result?.data
        };
      } catch (error) {
        const latency = Date.now() - start;
        console.error(`${name} diagnostic failed:`, error);
        return {
          status: 'error',
          latency,
          message: error.message || `Failed (${latency}ms)`,
          error
        };
      }
    };
    
    try {
      // Check health endpoint
      diagnosticResults.health = await runDiagnostic('health', datasetApi.checkHealth);
      
      // Check if session ID is available
      const sessionToUse = sessionId || currentFile?.sessionId;
      if (!sessionToUse) {
        diagnosticResults.session = {
          status: 'warning',
          message: 'No session ID available'
        };
      } else {
        // Try to get session data
        diagnosticResults.sessionData = await runDiagnostic(
          'sessionData', 
          datasetApi.getSessionData,
          sessionToUse
        );
        
        // Try to get sample data
        diagnosticResults.sampleData = await runDiagnostic(
          'sampleData', 
          datasetApi.getDatasetSample,
          sessionToUse
        );
        
        // Check if preprocessing API is available
        const availableOps = await runDiagnostic(
          'preprocessing', 
          preprocessingApi.getAvailableOperations,
          sessionToUse
        );
        diagnosticResults.preprocessing = availableOps;
      }
      
      // Check which data source to use based on diagnostics
      if (diagnosticResults.sessionData.status === 'success' && 
          diagnosticResults.sessionData.data?.data) {
        console.log('Session data endpoint is working, will use that');
      } else if (diagnosticResults.sampleData.status === 'success' && 
                 diagnosticResults.sampleData.data?.sample) {
        console.log('Sample data endpoint is working, will use that as fallback');
        
        // Try to load data preview from sample since session data failed
        if (sessionToUse) {
          tryFallbackSample(sessionToUse);
        }
      } else {
        console.log('All data endpoints failed, need to inform user');
      }
      
      setApiDiagnostics(diagnosticResults);
    } catch (error) {
      console.error('Overall diagnostic process failed:', error);
    } finally {
      setIsDiagnosing(false);
    }
  }, [sessionId, currentFile?.sessionId]);
  
  // Modified loadDataPreview function with session retry
  const loadDataPreview = async (sessionId) => {
    if (!sessionId) {
      console.error('Cannot load preview: No session ID provided');
      setProcessingError('Cannot load preview: No session ID available');
      return;
    }

    setIsLoadingPreview(true);
    setProcessingError(null);
    setSuccessMessage(null);
    
    // Create a new abort controller for this request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('New data request started');
    }
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;
    
    console.log('Loading data preview for session ID:', sessionId);
    
    try {
      // Add the signal to the axios request config
      const axiosConfig = { signal };
      
      // Fetch the latest data from the API
      const response = await datasetApi.getSessionData(sessionId, axiosConfig);
      console.log('Session data response received:', response);
      
      // Debug logging to help diagnose issues
      if (!response) {
        console.error('Response is undefined or null');
      } else if (!response.data) {
        console.error('Response data is undefined or null');
        console.log('Full response:', JSON.stringify(response));
      } else {
        console.log('Response data type:', typeof response.data);
        console.log('Response data preview:', 
          Array.isArray(response.data) ? 
            `Array with ${response.data.length} elements` : 
            JSON.stringify(response.data).substring(0, 200) + '...'
        );
      }
      
      // Check for empty or undefined response
      if (!response || !response.data) {
        throw new Error('No data received from API - empty response');
      }
      
      // First approach: Check if data is directly available in response.data.data
      if (response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
        console.log('Data format: Array of arrays with columns array');
        
        // Standard format with data and columns
        const previewData = {
          columns: response.data.columns || [],
          data: response.data.data,
          rowCount: response.data.total_rows || response.data.data.length,
          source: 'api'
        };
        
        setDataPreview(previewData);
        setSuccessMessage("Preview loaded with latest processed data");
        console.log('Data preview loaded successfully:', previewData);
        setIsLoadingPreview(false);
        return;
      }
      // Second approach: Check if data is an array of objects
      else if (response.data.sample && Array.isArray(response.data.sample) && response.data.sample.length > 0) {
        console.log('Data format: Array of objects');
        
        // Convert array of objects to array of arrays
        const firstRow = response.data.sample[0];
        const columns = Object.keys(firstRow);
        const data = response.data.sample.map(row => 
          columns.map(col => row[col])
        );
        
        const previewData = {
          columns,
          data,
          rowCount: response.data.total_rows || response.data.sample.length,
          source: 'api'
        };
        
        setDataPreview(previewData);
        setSuccessMessage("Preview loaded with latest processed data");
        console.log('Data preview loaded successfully (converted from objects):', previewData);
        setIsLoadingPreview(false);
        return;
      }
      // Third approach: The data itself is an array of objects
      else if (Array.isArray(response.data) && response.data.length > 0 && typeof response.data[0] === 'object') {
        console.log('Data format: Direct array of objects');
        
        const columns = Object.keys(response.data[0]);
        const data = response.data.map(row => 
          columns.map(col => row[col])
        );
        
        const previewData = {
          columns,
          data,
          rowCount: response.data.length,
          source: 'api'
        };
        
        setDataPreview(previewData);
        setSuccessMessage("Preview loaded with latest processed data");
        console.log('Data preview loaded successfully (direct array):', previewData);
        setIsLoadingPreview(false);
        return;
      }
      // Fourth approach: If we get here, the data format was not recognized
      else {
        console.error('Unknown data format received from API', response.data);
        throw new Error('Unknown data format received from API - could not parse data');
      }
    } catch (error) {
      // Check if the request was aborted and don't treat it as an error
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        console.log('Data preview request was aborted, ignoring error');
        return;
      }
      
      console.error('Failed to load data preview:', error);
      
      // Create better error messages
      let errorMessage = 'Could not load data preview';
      
      if (!error) {
        errorMessage += ': Unknown error occurred';
      } else if (typeof error === 'string') {
        errorMessage += ': ' + error;
      } else if (error.message) {
        // Prevent showing 'undefined' in the error message
        errorMessage += error.message === 'undefined' ? 
          ': API response error' : 
          ': ' + error.message;
      } else if (error.toString) {
        errorMessage += ': ' + error.toString();
      }
      
      // Set a user-friendly error message
      setProcessingError(errorMessage);
      
      // Run diagnostics automatically if we get certain types of errors
      if (error.message?.includes('Network Error') || 
          error.message?.includes('timeout') || 
          error.message?.includes('status code')) {
        // Don't await this to avoid blocking the UI
        diagnoseAPIEndpoints();
      } else {
        // Try fallback to dataset sample as a last resort
        tryFallbackSample(sessionId);
      }
    } finally {
      setIsLoadingPreview(false);
    }
  };
  
  // Separate function for the fallback sample loading
  const tryFallbackSample = async (sessionId) => {
    try {
      console.log('Attempting to load dataset sample as fallback');
      const sampleResponse = await datasetApi.getDatasetSample(sessionId);
      
      // Debug logging
      console.log('Sample response received:', sampleResponse);
      if (!sampleResponse || !sampleResponse.data) {
        console.error('Sample response is undefined or has no data property');
        return;
      }
      
      if (sampleResponse.data.sample && Array.isArray(sampleResponse.data.sample)) {
        // Handle sample data based on its format
        if (typeof sampleResponse.data.sample[0] === 'object') {
          const columns = Object.keys(sampleResponse.data.sample[0]);
          const data = sampleResponse.data.sample.map(row => 
            columns.map(col => row[col])
          );
          
          const previewData = {
            columns,
            data,
            rowCount: sampleResponse.data.total_rows || sampleResponse.data.sample.length,
            source: 'sample'
          };
          
          setDataPreview(previewData);
          setProcessingError("NOTE: Using original dataset (changes may not be reflected)");
          console.log('Data preview loaded from sample:', previewData);
        } else {
          throw new Error('Sample data is not in expected format');
        }
      } else {
        throw new Error('Invalid sample data format');
      }
    } catch (sampleError) {
      console.error('All data loading attempts failed:', sampleError);
      setProcessingError('Data preview unavailable. Please check API connection or try reloading the page.');
      
      // When all else fails, check for current file data
      if (currentFile && currentFile.data && Array.isArray(currentFile.data) && currentFile.data.length > 0) {
        console.log('Attempting to use current file data as last resort');
        try {
          const firstRow = currentFile.data[0];
          const columns = Object.keys(firstRow);
          const data = currentFile.data.slice(0, 100).map(row => 
            columns.map(col => row[col])
          );
          
          const previewData = {
            columns,
            data,
            rowCount: currentFile.data.length,
            source: 'file'
          };
          
          setDataPreview(previewData);
          setProcessingError("NOTE: Using local file data (operations not applied)");
          console.log('Using current file data as last resort');
        } catch (fileError) {
          console.error('Failed to use current file data:', fileError);
        }
      }
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Generate realistic mock data based on dataset metadata
  const generateMockData = () => {
    console.log('Generating mock data based on metadata');
    
    try {
      if (!datasetMetadata?.fields?.length) {
        throw new Error('No metadata available to generate mock data');
      }
      
      // Get column names from metadata
      const columns = datasetMetadata.fields.map(field => field.name);
      
      // Generate 10 rows of realistic sample data based on field types
      const numRows = 10;
      const data = [];
      
      for (let i = 0; i < numRows; i++) {
        const row = columns.map(colName => {
          const field = datasetMetadata.fields.find(f => f.name === colName);
          if (!field) return `Sample ${i+1}`;
          
          // Generate different mock data based on column type
          switch(field.type) {
            case 'Numeric':
              // For numeric columns, generate reasonable numbers
              return Math.round(Math.random() * 100);
              
            case 'DateTime':
              // For date columns, generate dates within the last month
              const date = new Date();
              date.setDate(date.getDate() - Math.floor(Math.random() * 30));
              return date.toISOString().split('T')[0];
              
            case 'Boolean':
              // For boolean columns
              return Math.random() > 0.5 ? true : false;
              
            default:
              // For categorical/text columns, generate contextual values based on column name
              if (colName.toLowerCase().includes('name')) {
                const names = ['John', 'Emma', 'Michael', 'Sophia', 'William', 'Olivia', 'James', 'Ava', 'Alexander', 'Isabella'];
                return names[Math.floor(Math.random() * names.length)];
              } else if (colName.toLowerCase().includes('city')) {
                const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
                return cities[Math.floor(Math.random() * cities.length)];
              } else if (colName.toLowerCase().includes('country')) {
                const countries = ['USA', 'Canada', 'UK', 'Germany', 'France', 'Japan', 'Australia', 'Brazil', 'India', 'China'];
                return countries[Math.floor(Math.random() * countries.length)];
              } else if (colName.toLowerCase().includes('email')) {
                const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
                const domain = domains[Math.floor(Math.random() * domains.length)];
                return `user${i+1}@${domain}`;
              } else {
                // Generic categorical values
                return `Sample ${colName} ${i+1}`;
              }
          }
        });
        
        data.push(row);
      }
      
      // Apply operations visually to demonstrate what would happen
      // E.g., if there's a 'fill_mean' operation, update null values
      const completedOperations = operations.filter(op => op.status === 'completed');
      
      // Simple visual representation of operations (doesn't actually calculate)
      completedOperations.forEach(op => {
        const colIndices = op.columns.map(col => columns.indexOf(col)).filter(idx => idx !== -1);
        
        if (op.operation.id === 'fill_mean' && colIndices.length > 0) {
          // Visual representation of filling with mean
          colIndices.forEach(colIdx => {
            // Make one value null then fill it
            const nullRowIdx = Math.floor(Math.random() * data.length);
            data[nullRowIdx][colIdx] = '[filled]';
          });
        } else if (op.operation.id.includes('normalize') && colIndices.length > 0) {
          // Visual representation of normalization
          colIndices.forEach(colIdx => {
            data.forEach((row, rowIdx) => {
              if (typeof row[colIdx] === 'number') {
                // Replace with normalized-looking values
                data[rowIdx][colIdx] = (Math.random() * 0.8 + 0.1).toFixed(2);
              }
            });
          });
        }
      });
      
      // Set the mock data in state
      const previewData = {
        columns,
        data,
        isMockData: true
      };
      
      setDataPreview(previewData);
      setSuccessMessage(null);
      setProcessingError("Using generated sample data for preview - API connection issue detected");
      console.log('Mock data generated successfully:', previewData);
    } catch (error) {
      console.error('Failed to generate mock data:', error);
      setProcessingError('Could not load or generate any preview data. Please check API connection.');
    }
  };
  
  // Add inputs for operations that need additional parameters
  const getOperationParams = (op) => {
    // Different operations need different additional parameters
    if (op.type === 'clean' && op.operation.id === 'fill_constant') {
      return (
        <input
          type="text"
          placeholder="Value to fill"
          className="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1"
          value={op.value || ''}
          onChange={(e) => {
            console.log(`Setting value for operation ${op.operation.name}: ${e.target.value}`);
            setOperations(prev => 
              prev.map(o => o.id === op.id ? { ...o, value: e.target.value } : o)
            );
          }}
        />
      );
    } else if (op.type === 'filter' && op.operation.id === 'range_filter') {
      return (
        <div className="grid grid-cols-2 gap-2 mt-1">
          <input
            type="number"
            placeholder="Min Value"
            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
            value={op.min_value || ''}
            onChange={(e) => {
              setOperations(prev => 
                prev.map(o => o.id === op.id ? { ...o, min_value: e.target.value } : o)
              );
            }}
          />
          <input
            type="number"
            placeholder="Max Value"
            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
            value={op.max_value || ''}
            onChange={(e) => {
              setOperations(prev => 
                prev.map(o => o.id === op.id ? { ...o, max_value: e.target.value } : o)
              );
            }}
          />
        </div>
      );
    } else if (op.type === 'filter' && op.operation.id === 'value_filter') {
      return (
        <div className="grid grid-cols-2 gap-2 mt-1">
          <select
            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
            value={op.operator || '=='}
            onChange={(e) => {
              setOperations(prev => 
                prev.map(o => o.id === op.id ? { ...o, operator: e.target.value } : o)
              );
            }}
          >
            <option value="==">Equals (==)</option>
            <option value="!=">Not Equals (!=)</option>
            <option value=">">Greater Than (&gt;)</option>
            <option value="<">Less Than (&lt;)</option>
            <option value=">=">Greater Than or Equal (&gt;=)</option>
            <option value="<=">Less Than or Equal (&lt;=)</option>
            <option value="contains">Contains</option>
            <option value="starts_with">Starts With</option>
            <option value="ends_with">Ends With</option>
          </select>
          <input
            type="text"
            placeholder="Value"
            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
            value={op.value || ''}
            onChange={(e) => {
              setOperations(prev => 
                prev.map(o => o.id === op.id ? { ...o, value: e.target.value } : o)
              );
            }}
          />
        </div>
      );
    } else if (op.type === 'filter' && op.operation.id === 'date_filter') {
      return (
        <div className="grid grid-cols-2 gap-2 mt-1">
          <input
            type="date"
            placeholder="Start Date"
            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
            value={op.start_date || ''}
            onChange={(e) => {
              setOperations(prev => 
                prev.map(o => o.id === op.id ? { ...o, start_date: e.target.value } : o)
              );
            }}
          />
          <input
            type="date"
            placeholder="End Date"
            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
            value={op.end_date || ''}
            onChange={(e) => {
              setOperations(prev => 
                prev.map(o => o.id === op.id ? { ...o, end_date: e.target.value } : o)
              );
            }}
          />
        </div>
      );
    } else if (op.type === 'transform' && op.operation.id === 'bin') {
      return (
        <div className="mt-1">
          <input
            type="number"
            placeholder="Number of Bins"
            min="2"
            max="20"
            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
            value={op.bins || 5}
            onChange={(e) => {
              setOperations(prev => 
                prev.map(o => o.id === op.id ? { ...o, bins: parseInt(e.target.value) } : o)
              );
            }}
          />
        </div>
      );
    }
    
    return null;
  };

  // Format operation timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Development mode processing (mock function)
  const mockProcessOperation = async (op) => {
    console.log('Using development mode mock processing for:', op);
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate success with mock data
    return {
      data: {
        success: true,
        message: `Mock operation ${op.operation.name} completed successfully`,
        rows: datasetMetadata?.rows || 100,
        columns: datasetMetadata?.columns?.length || 10,
        session_id: sessionId || currentFile?.sessionId || 'mock-session'
      }
    };
  };

  return (
    <div className="space-y-6">
      {/* Backend Error Banner */}
      <ErrorMessage message={processingError} onDismiss={() => setProcessingError(null)} />
    
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Preprocess Dataset</h1>
          <p className="text-sm text-gray-500">Clean, transform, and prepare your data for analysis</p>
        </div>
        <div className="flex items-center space-x-4">
          {activeTab === 'operations' && (
          <button
            onClick={applyOperations}
            disabled={operations.length === 0 || isProcessing}
            className={`px-4 py-2 rounded-lg font-medium flex items-center ${
              operations.length === 0 || isProcessing
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isProcessing && <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />}
            Apply Changes
            </button>
          )}
          {activeTab === 'preview' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => loadDataPreview(sessionId || currentFile?.sessionId)}
                disabled={isLoadingPreview}
                className={`px-4 py-2 rounded-lg font-medium flex items-center ${
                  isLoadingPreview
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isLoadingPreview ? 
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" /> : 
                  <ArrowPathIcon className="h-4 w-4 mr-2" />}
                Refresh Data
              </button>
              
              <button
                onClick={diagnoseAPIEndpoints}
                disabled={isDiagnosing}
                className={`px-4 py-2 rounded-lg font-medium flex items-center ${
                  isDiagnosing
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-yellow-500 text-white hover:bg-yellow-600'
                }`}
                title="Run API endpoint diagnostics"
              >
                {isDiagnosing ? 
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" /> : 
                  <ServerIcon className="h-4 w-4 mr-2" />}
                Diagnose API
          </button>
        </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('operations')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'operations'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Operations
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'preview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Data Preview
          </button>
        </nav>
      </div>

      {/* Status messages */}
      {(successMessage || processingError) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Status</h3>
          
          {successMessage && (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md flex items-start mb-2">
              <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-green-700 font-medium">{successMessage}</p>
                {isProcessing && (
                  <div className="mt-2 flex items-center">
                    <div className="bg-green-100 h-1.5 rounded-full w-full max-w-xs">
                      <div className="bg-green-500 h-1.5 rounded-full animate-pulse w-1/2"></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {processingError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start">
              <ExclamationCircleIcon className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-700 font-medium">{processingError}</p>
                <button 
                  onClick={() => setProcessingError(null)} 
                  className="mt-1 text-xs text-red-500 hover:text-red-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'operations' && (
      <div className="grid grid-cols-12 gap-6">
        {/* Column Selection */}
        <div className="col-span-3 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Columns</h2>
            <p className="text-sm text-gray-500">Select columns to process</p>
          </div>
          <div className="p-4 space-y-2">
            {datasetMetadata.fields.map((field) => (
              <label
                key={field.name}
                className={`flex items-center p-2 rounded-lg cursor-pointer hover:bg-gray-50 ${
                  selectedColumns.includes(field.name) ? 'bg-blue-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedColumns.includes(field.name)}
                  onChange={() => handleColumnSelect(field.name)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">{field.name}</div>
                  <div className="text-xs text-gray-500">{field.type}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Operations */}
        <div className="col-span-5 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Operations</h2>
            <p className="text-sm text-gray-500">Choose operations to apply</p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              {operationTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setActiveOperation(type)}
                  className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                    activeOperation?.id === type.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'
                  }`}
                >
                  <type.icon className="h-6 w-6 text-gray-400 mb-2" />
                  <h3 className="text-sm font-medium text-gray-900">{type.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{type.description}</p>
                </button>
              ))}
            </div>

            {activeOperation && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Available Operations
                </h3>
                <div className="space-y-2">
                  {activeOperation.operations.map((op) => (
                    <button
                      key={op.id}
                      onClick={() => addOperation(activeOperation.id, op)}
                      disabled={selectedColumns.length === 0}
                      className={`w-full p-3 rounded-lg border text-left transition-all duration-200 ${
                        selectedColumns.length === 0
                          ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900">{op.name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Applicable to: {op.applicable.join(', ')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Operation Queue */}
        <div className="col-span-4 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Operation Queue</h2>
              <p className="text-sm text-gray-500">Operations to be applied</p>
            </div>
            
            {operations.length > 0 && (
              <div className="flex items-center space-x-3">
                <div className="text-xs text-gray-500 flex space-x-2">
                  <span className="px-2 py-1 bg-gray-100 rounded-full">{operations.filter(op => op.status === 'pending').length} pending</span>
                  {operations.filter(op => op.status === 'completed').length > 0 && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">{operations.filter(op => op.status === 'completed').length} completed</span>
                  )}
                  {operations.filter(op => op.status === 'failed').length > 0 && (
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full">{operations.filter(op => op.status === 'failed').length} failed</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear all operations?')) {
                      setOperations([]);
                    }
                  }}
                  className="px-2 py-1 text-xs text-gray-600 hover:text-red-600 flex items-center border border-gray-200 rounded hover:border-red-300"
                >
                  <TrashIcon className="h-3 w-3 mr-1" />
                  Clear All
                </button>
              </div>
            )}
          </div>
          <div className="p-4">
            {operations.length === 0 ? (
              <div className="text-center py-8">
                <PlusIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">No operations added yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {operations.map((op, index) => {
                  // Force re-render by directly referencing the status here
                  const status = op.status; // Explicitly reference status to ensure component updates
                  
                  return (
                    <div
                      key={op.id}
                      className={`p-3 rounded-lg ${
                        status === 'failed' ? 'bg-red-50 border border-red-100' : 
                        status === 'completed' ? 'bg-green-50 border border-green-100' : 
                        status === 'processing' ? 'bg-blue-50 border border-blue-100 animate-pulse' : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {index + 1}. {op.operation.name} 
                            <span className="ml-2 text-xs font-normal text-gray-500">({status})</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Columns: {op.columns.join(', ')}
                          </div>
                          {op.responseData && status === 'completed' && (
                            <div className="text-xs text-green-600 mt-1">
                              {op.responseData.message || 'Operation completed successfully'}
                            </div>
                          )}
                          {op.error && (
                            <div className="text-xs text-red-600 mt-1">
                              Error: {op.error}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {status === 'completed' && (
                            <span className="flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                              ✓ Done
                            </span>
                          )}
                          {status === 'processing' && (
                            <span className="flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                              <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-blue-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing
                            </span>
                          )}
                          {status === 'failed' && (
                            <span className="flex items-center px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-medium">
                              ✕ Failed
                            </span>
                          )}
                          {status === 'pending' && (
                            <span className="flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-medium">
                              Pending
                            </span>
                          )}
                          {status !== 'processing' && (
                            <button
                              onClick={() => removeOperation(op.id)}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      {getOperationParams(op)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {activeTab === 'preview' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Dataset Preview</h2>
              <p className="text-sm text-gray-500">
                View the current state of your dataset after applied operations
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => loadDataPreview(sessionId || currentFile?.sessionId)}
                disabled={isLoadingPreview}
                className={`px-4 py-2 rounded-lg font-medium flex items-center ${
                  isLoadingPreview
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isLoadingPreview ? 
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" /> : 
                  <ArrowPathIcon className="h-4 w-4 mr-2" />}
                Refresh Data
              </button>
              
              <button 
                onClick={diagnoseAPIEndpoints}
                disabled={isDiagnosing}
                className={`px-4 py-2 rounded-lg font-medium flex items-center ${
                  isDiagnosing
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-yellow-500 text-white hover:bg-yellow-600'
                }`}
                title="Run API endpoint diagnostics"
              >
                {isDiagnosing ? 
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" /> : 
                  <ServerIcon className="h-4 w-4 mr-2" />}
                Diagnose API
              </button>
            </div>
          </div>
          
          {apiDiagnostics && (
            <div className="px-4 pt-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">API Diagnostics Results</h3>
                <div className="grid grid-cols-5 gap-2 text-xs">
                  {Object.entries(apiDiagnostics).map(([endpoint, result]) => (
                    <div 
                      key={endpoint} 
                      className={`p-2 rounded border ${
                        result.status === 'success' ? 'border-green-200 bg-green-50' :
                        result.status === 'error' ? 'border-red-200 bg-red-50' :
                        result.status === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                        'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="font-medium">{endpoint}</div>
                      <div className={`
                        ${result.status === 'success' ? 'text-green-700' :
                         result.status === 'error' ? 'text-red-700' :
                         result.status === 'warning' ? 'text-yellow-700' : 
                         'text-gray-500'}
                      `}>
                        {result.message}
                      </div>
                    </div>
                  ))}
                </div>
                {Object.values(apiDiagnostics).some(r => r.status === 'error') && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
                    <p className="font-medium">Potential Backend Issues Detected</p>
                    <p>It appears some API endpoints are not responding correctly. This may indicate:</p>
                    <ul className="list-disc pl-5 mt-1">
                      <li>The backend server is not running</li>
                      <li>Network connectivity issues</li>
                      <li>The API endpoints have changed</li>
                      <li>There might be CORS issues preventing requests</li>
                    </ul>
                    <p className="mt-1">Try checking your backend configuration or restarting the server.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="p-4">
            {isLoadingPreview ? (
              <div className="flex justify-center items-center py-8">
                <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin" />
                <span className="ml-2 text-gray-600">Loading data preview...</span>
              </div>
            ) : !dataPreview ? (
              <div className="text-center py-8">
                <TableCellsIcon className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">No data preview available</p>
                <div className="flex flex-col space-y-2 mt-4 items-center">
                  <button
                    onClick={() => loadDataPreview(sessionId || currentFile?.sessionId)}
                    className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-100 text-sm"
                  >
                    Load Data
                  </button>
                  <button
                    onClick={diagnoseAPIEndpoints}
                    className="px-4 py-2 bg-gray-50 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm"
                  >
                    Diagnose API Connection
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {dataPreview.source === 'sample' && (
                  <div className="border-l-4 border-yellow-400 bg-yellow-50 p-3 rounded flex items-center">
                    <ExclamationCircleIcon className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0" />
                    <p className="text-sm text-yellow-700">
                      Showing original dataset. Applied operations may not be reflected.
                    </p>
                  </div>
                )}
                
                {dataPreview.source === 'api' && operations.filter(op => op.status === 'completed').length > 0 && (
                  <div className="border-l-4 border-green-400 bg-green-50 p-3 rounded flex items-center">
                    <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <p className="text-sm text-green-700">
                      Showing data with {operations.filter(op => op.status === 'completed').length} applied operations
                    </p>
                  </div>
                )}
                
                <div className="bg-gray-50 p-2 rounded text-xs text-gray-500 flex justify-between items-center">
                  <span>
                    Showing {dataPreview.data.length} of {dataPreview.rowCount || dataPreview.data.length} rows
                  </span>
                  {dataPreview.data.length > 10 && (
                    <button 
                      onClick={() => {
                        setDataPreview({
                          ...dataPreview,
                          data: dataPreview.data.slice(0, dataPreview.data.length > 100 ? 100 : 10)
                        });
                      }}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      Show fewer rows
                    </button>
                  )}
                </div>
                
                <div className="overflow-x-auto">
                  {dataPreview.data && dataPreview.columns ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {dataPreview.columns.map((column, index) => (
                    <th 
                      key={index}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dataPreview.data.map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {row.map((cell, cellIndex) => (
                      <td 
                        key={cellIndex}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      >
                                {cell === null || cell === undefined ? 'NULL' : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">The data has an invalid format</p>
                    </div>
                  )}
          </div>
        </div>
      )}
          </div>
        </div>
      )}

      {/* Details Modal */}
      <DetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        details={selectedDetails}
        title={selectedOperationName}
      />
    </div>
  );
}

export default Preprocess; 