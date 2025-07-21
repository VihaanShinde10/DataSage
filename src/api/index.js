// API client for DataSage
import axios from 'axios';
import { 
  extractFileExtension, 
  getMimeTypeFromExtension, 
  isFileSupported,
  ensureFileProperties
} from '../utils/fileUtils';

// Create axios instance with base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Add timeout to prevent hanging requests
  timeout: 30000,
});

// Add a request interceptor to add auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`Making ${config.method?.toUpperCase()} request to: ${config.url}`);
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor for logging and error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`Response from ${response.config.url}:`, response.status);
    return response;
  },
  (error) => {
    console.error('API error:', error);
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request setup error:', error.message);
    }
    
    // Return a friendly error message
    return Promise.reject(
      error.response?.data?.error || error.message || 'Unknown error occurred'
    );
  }
);

// Utility to ensure valid ID
const ensureValidId = (id) => {
  // Debug log the input
  console.log(`ensureValidId called with:`, id);
  
  // Check if it's our special mock dataset ID
  if (id === 'mock-dataset-1') {
    return id;
  }
  
  // Handle different object types
  if (id && typeof id === 'object') {
    // If the object has an id property, use it
    if (id.id) {
      console.log(`Using object's id property: ${id.id}`);
      return id.id;
    }
    
    // For File objects or other objects with a name, use the mock ID
    if (id.name) {
      console.warn('File object without id property found, using mock dataset ID');
      return 'mock-dataset-1';
    }
    
    // For other objects, try to stringify or use mock ID
    console.warn('Object without id or name properties found, using mock dataset ID');
    return 'mock-dataset-1';
  }
  
  // Handle primitive types
  if (id === undefined || id === null || id === 'undefined' || id === 'null' || id === '') {
    console.error('Invalid dataset ID detected:', id);
    throw new Error('Invalid dataset ID');
  }
  
  // Return the ID as is for string/number types
  return id;
};

// Dataset API calls
export const datasetApi = {
  // Check backend health
  checkHealth: () => {
    return apiClient.get('/health')
      .then(response => response.data)
      .catch(error => {
        console.error('Health check failed:', error);
        return { status: 'error', error };
      });
  },

  // Create a new session
  createSession: () => {
    return apiClient.post('/sessions');
  },
  
  // Get session metadata
  getSessionMetadata: (sessionId) => {
    if (!sessionId) {
      return Promise.reject(new Error('Invalid session ID'));
    }
    
    // Handle special case for mock data
    if (sessionId.startsWith('mock-') || sessionId === 'mock-dataset-1') {
      console.log('Using mock metadata for session:', sessionId);
      return Promise.resolve({
        data: {
          metadata: {
            filename: 'employee_data.csv',
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
        }
      });
    }
    
    return apiClient.get(`/sessions/${sessionId}/metadata`)
      .catch(error => {
        console.error('Error fetching session metadata:', error);
        // Re-throw to be handled by calling function
        throw error;
      });
  },
  
  // Get session data (sample)
  getSessionData: (sessionId) => {
    if (!sessionId) {
      return Promise.reject(new Error('Invalid session ID'));
    }
    
    // Handle special case for mock data
    if (sessionId.startsWith('mock-') || sessionId === 'mock-dataset-1') {
      console.log('Using mock data for session:', sessionId);
      return Promise.resolve({
        data: {
          data: [
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
          ],
          total_rows: 100
        }
      });
    }
    
    return apiClient.get(`/sessions/${sessionId}/data`)
      .catch(error => {
        console.error('Error fetching session data:', error);
        // Re-throw to be handled by calling function
        throw error;
      });
  },
  
  // Get dataset sample - uses the session data endpoint
  getDatasetSample: (datasetId) => {
    // Handle various types of inputs for datasetId
    const id = ensureValidId(datasetId);
    if (!id) {
      return Promise.reject(new Error('Invalid dataset ID'));
    }
    
    // For mock-dataset-1, use the getSessionData endpoint since we're loading data in App.jsx
    if (id === 'mock-dataset-1') {
      console.log('Handling mock dataset via session API');
      
      // Instead of hardcoding, we'll try to get the data from the session API
      return apiClient.get(`/sessions/${id}/data`)
        .then(response => {
          if (response && response.data && response.data.data) {
            return {
              data: {
                sample: response.data.data,
                total_rows: response.data.total_rows || response.data.data.length
              }
            };
          }
          
          // If the API call fails or returns no data, we need a fallback
          // This fallback should come from AppContext and not be hardcoded
          // Try to access the data from the AppContext instead
          
          // Since we can't directly access AppContext here, we'll pass this behavior to the EDA component
          // Just return what we got
          console.warn('No data in API response for mock dataset');
          return response;
        })
        .catch(error => {
          console.error('Error fetching mock dataset:', error);
          
          // Allow the EDA component to handle this situation
          throw new Error('Could not load dataset sample: ' + (error.message || 'Unknown error'));
        });
    }
    
    // Call the session data endpoint which returns a sample of the data
    return apiClient.get(`/sessions/${id}/data`)
      .then(response => {
        // Format the response to match expected schema
        if (response && response.data && response.data.data) {
          return {
            data: {
              sample: response.data.data,
              total_rows: response.data.total_rows || response.data.data.length
            }
          };
        }
        
        // If we don't have proper data structure, throw an error
        console.error('Invalid response format:', response);
        throw new Error('Invalid response format from API');
      })
      .catch(error => {
        console.error('Error fetching dataset sample:', error);
        // Re-throw the error to be handled by the calling function
        throw error;
      });
  },
  
  // Upload a dataset
  uploadDataset: (file, metadata = {}) => {
    // Safety check for file object
    if (!file) {
      console.error('uploadDataset: File is null or undefined');
      return Promise.reject(new Error('Invalid file object'));
    }

    // Ensure file has all necessary properties (adds id and fixes type if needed)
    try {
      file = ensureFileProperties(file);
    } catch (error) {
      console.error('Error ensuring file properties:', error);
      return Promise.reject(error);
    }

    // Check if file type is supported
    if (!isFileSupported(file)) {
      console.error('Unsupported file type:', file.type || extractFileExtension(file.name));
      return Promise.reject(new Error('Unsupported file type. Please upload CSV, Excel, or JSON files.'));
    }

    // Log the file details for debugging
    console.log('Uploading dataset:', {
      name: file.name,
      type: file.type || 'undefined',
      size: file.size,
      id: file.id
    });

    // See if we have a session ID in the metadata
    const sessionId = metadata.session_id || null;
    console.log('Session ID from metadata:', sessionId);

    // If we have a sessionId, use it directly, otherwise create a new session
    const sessionPromise = sessionId
      ? Promise.resolve({ data: { session_id: sessionId } })
      : apiClient.post('/sessions');

    return sessionPromise
      .then(sessionResponse => {
        const sessionId = sessionResponse.data.session_id;
        console.log(`Using session: ${sessionId}`);
        
        // Special handling for mock datasets
        if (file.id === 'mock-dataset-1' || sessionId.startsWith('mock-')) {
          console.log('Using mock dataset upload flow');
          // For mock data, we don't actually upload anything, just return a success response
          return {
            data: {
              message: 'Mock dataset uploaded successfully',
              session_id: sessionId,
              filename: file.name,
              rows: typeof metadata.rows === 'number' ? metadata.rows : 10,
              columns: typeof metadata.columns === 'number' ? metadata.columns : 5
            }
          };
        }
        
        // Now upload the file to this session
        const formData = new FormData();
        formData.append('file', file);
        
        return apiClient.post(`/sessions/${sessionId}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }).then(uploadResponse => {
          // Update session metadata with any additional metadata
          if (Object.keys(metadata).length > 0) {
            const metadataToUpdate = { ...metadata };
            delete metadataToUpdate.session_id; // Remove session_id from metadata to avoid conflicts
            
            return apiClient.put(`/sessions/${sessionId}/metadata`, metadataToUpdate)
              .then(() => uploadResponse);
          }
          return uploadResponse;
        });
      });
  },

  // Get all sessions
  getAllSessions: () => {
    return apiClient.get('/sessions');
  },

  // Delete a session
  deleteSession: (sessionId) => {
    if (!sessionId) {
      return Promise.reject(new Error('Session ID is required'));
    }
    return apiClient.delete(`/sessions/${sessionId}`);
  },

  // EDA API calls
  getColumnStatistics: (datasetId, columnName) => {
    if (!datasetId || !columnName) {
      return Promise.reject(new Error('Dataset ID and column name are required'));
    }
    
    // Format the ID properly
    const id = ensureValidId(datasetId);
    
    // Try dataset endpoint first, then session endpoint if needed
    return apiClient.get(`/eda/datasets/${id}/columns/${columnName}/statistics`)
      .catch(error => {
        // If dataset endpoint fails, try session endpoint
        return apiClient.get(`/eda/sessions/${id}/columns/${columnName}/statistics`);
      });
  },

  getAllColumnStatistics: (datasetId) => {
    if (!datasetId) {
      return Promise.reject(new Error('Dataset ID is required'));
    }
    
    // Format the ID properly
    const id = ensureValidId(datasetId);
    
    // Try dataset endpoint first, then new all_statistics endpoint, then fall back to statistics endpoint
    return apiClient.get(`/eda/datasets/${id}/statistics`)
      .catch(error => {
        console.log('Dataset statistics endpoint failed, trying all_statistics endpoint:', error);
        // If dataset endpoint fails, try the new all_statistics endpoint
        return apiClient.get(`/eda/sessions/${id}/all_statistics`)
          .catch(allStatError => {
            console.log('All statistics endpoint failed, trying regular statistics endpoint:', allStatError);
            // If all_statistics fails too, try the original statistics endpoint
            return apiClient.get(`/eda/sessions/${id}/statistics`);
          });
      });
  },
  
  getColumnsCorrelation: (sessionId, columns) => {
    if (!sessionId || !columns || !columns.length) {
      return Promise.reject(new Error('Session ID and columns are required'));
    }
    
    // Determine if we should use datasets or sessions endpoint
    const id = ensureValidId(sessionId);
    
    // Handle both dataset IDs and session IDs
    // First try the dataset endpoint, then fall back to session if needed
    return apiClient.get(`/eda/datasets/${id}/columns/correlation`, {
      params: { columns: columns.join(',') }
    }).catch(error => {
      // If dataset endpoint fails, try the session endpoint
      return apiClient.get(`/eda/sessions/${id}/columns/correlation`, {
        params: { columns: columns.join(',') }
      });
    });
  },

  getDatasetOverview: (sessionId) => {
    if (!sessionId) {
      return Promise.reject(new Error('Session ID is required'));
    }
    return apiClient.get(`/eda/sessions/${sessionId}/overview`);
  },

  getCorrelationMatrix: (sessionId) => {
    if (!sessionId) {
      return Promise.reject(new Error('Session ID is required'));
    }
    return apiClient.get(`/eda/sessions/${sessionId}/correlation`);
  },

  getColumnDistribution: (sessionId, columnName) => {
    if (!sessionId || !columnName) {
      return Promise.reject(new Error('Session ID and column name are required'));
    }
    return apiClient.get(`/eda/sessions/${sessionId}/distribution/${columnName}`);
  }
};

// AI assistant API calls
export const aiApi = {
  // Send message to assistant
  sendMessage: (message, page, context = {}, sessionId = null, columnName = null) => {
    const payload = {
      message,
      page,
      context,
      ...(sessionId && { session_id: sessionId }),
      ...(columnName && { column_name: columnName })
    };
    
    return apiClient.post('/ai/chat', payload);
  }
};

// SQL API calls
export const sqlApi = {
  // Execute natural language query
  executeQuery: (sessionId, query, useApi = true) => {
    if (!sessionId || !query) {
      return Promise.reject(new Error('Session ID and query are required'));
    }
    
    return apiClient.post('/sql/query', {
      session_id: sessionId,
      query,
      use_api: useApi
    });
  },
  
  // Execute direct SQL query
  executeSQL: (sessionId, sql) => {
    if (!sessionId || !sql) {
      return Promise.reject(new Error('Session ID and SQL are required'));
    }
    
    return apiClient.post('/sql/execute', {
      session_id: sessionId,
      query: sql
    });
  },
  
  // Translate natural language to SQL
  translateQuery: (sessionId, nlQuery, useGroq = true) => {
    if (!sessionId || !nlQuery) {
      return Promise.reject(new Error('Session ID and natural language query are required'));
    }
    
    return apiClient.post('/sql/translate', {
      session_id: sessionId,
      nl_query: nlQuery,
      use_groq: useGroq
    });
  },
  
  // Get schema information
  getSchema: (sessionId) => {
    if (!sessionId) {
      return Promise.reject(new Error('Session ID is required'));
    }
    
    return apiClient.get('/sql/schema', {
      params: { session_id: sessionId }
    });
  }
};

// Preprocessing API calls
export const preprocessingApi = {
  // Apply preprocessing operation
  applyOperation: (sessionId, operation, params = {}) => {
    if (!sessionId || !operation) {
      return Promise.reject(new Error('Session ID and operation are required'));
    }
    
    // Make a copy of params and ensure session_id is included
    const requestParams = {
      session_id: sessionId,
      ...params
    };
    
    console.log(`Applying operation "${operation}" with params:`, requestParams);
    
    // Try direct API call with simplified error handling
    return apiClient.post(`/preprocessing/operations/${operation}`, requestParams)
      .catch(error => {
        console.error(`Operation failed:`, error);
        
        // Return mock success response instead of failing
        if (import.meta.env.DEV) {
          console.log('DEV MODE: Returning mock success response');
          return {
            data: {
              success: true,
              message: `Mock operation completed successfully`,
              rows: 100,
              columns: 10,
              session_id: sessionId
            }
          };
        }
        
        // Re-throw with simplified error
        throw new Error('Operation failed. Check if the backend server is running.');
      });
  },
  
  // Get available operations
  getAvailableOperations: (sessionId = null) => {
    const params = {};
    if (sessionId) {
      params.session_id = sessionId;
    }
    
    return apiClient.get(`/preprocessing/operations`, {
      params
    }).catch(error => {
      console.warn('Error fetching available operations:', error);
      // Return a fallback set of operations
      return {
        data: {
          'missing_values': {
            'description': 'Handle missing values in the dataset',
            'strategies': ['mean', 'median', 'constant'],
            'endpoint': '/api/preprocessing/missing-values'
          },
          'normalize': {
            'description': 'Normalize numeric columns in the dataset',
            'methods': ['minmax', 'zscore'],
            'endpoint': '/api/preprocessing/normalize'
          },
          'encode': {
            'description': 'Encode categorical variables',
            'methods': ['onehot', 'label'],
            'endpoint': '/api/preprocessing/encode'
          },
          'filter': {
            'description': 'Filter rows based on conditions',
            'operators': ['>', '<', '>=', '<=', '==', '!=', 'contains', 'starts_with', 'ends_with'],
            'endpoint': '/api/preprocessing/filter'
          }
        }
      };
    });
  },
  
  // Get operation history
  getOperationHistory: (sessionId) => {
    if (!sessionId) {
      return Promise.reject(new Error('Session ID is required'));
    }
    
    return apiClient.get(`/preprocessing/operations/history`, {
      params: { session_id: sessionId }
    });
  },

  // Get data preview
  getDataPreview: (sessionId) => {
    if (!sessionId) {
      return Promise.reject(new Error('Session ID is required'));
    }
    
    return apiClient.get(`/sessions/${sessionId}/preview`);
  }
};

// Auth API calls
export const authApi = {
  // Login user
  login: (email, password) => {
    return apiClient.post('/auth/login', { email, password });
  },

  // Register user
  register: (name, email, password) => {
    return apiClient.post('/auth/register', { name, email, password });
  },

  // Logout user
  logout: () => {
    return apiClient.post('/auth/logout');
  }
};

export default {
  dataset: datasetApi,
  ai: aiApi,
  auth: authApi,
  sql: sqlApi,
  preprocessing: preprocessingApi
}; 