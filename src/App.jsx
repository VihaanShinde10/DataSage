import React, { useState, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { AppContext } from './context/AppContext';
import { datasetApi } from './api';

// Lazy load pages for better performance
const Home = React.lazy(() => import('./pages/Home'));
const Overview = React.lazy(() => import('./pages/Overview'));
const Preprocess = React.lazy(() => import('./pages/Preprocess'));
const EDA = React.lazy(() => import('./pages/EDA'));
const SQLAssistant = React.lazy(() => import('./pages/SQLAssistant'));
const Train = React.lazy(() => import('./pages/Train'));
const Report = React.lazy(() => import('./pages/Report'));

// Mock data for demo purposes
const MOCK_DATA = [
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
  },
  {
    age: "38",
    salary: "92000",
    experience: "12",
    education: "Masters",
    department: "Engineering",
    performance_score: "90",
    attendance: "94",
    projects_completed: "11",
    satisfaction_level: "4.6",
    last_evaluation: "4.7"
  },
  {
    age: "29",
    salary: "78000",
    experience: "6",
    education: "Bachelors",
    department: "Research",
    performance_score: "82",
    attendance: "91",
    projects_completed: "8",
    satisfaction_level: "4.0",
    last_evaluation: "4.2"
  },
  {
    age: "27",
    salary: "67000",
    experience: "4",
    education: "Masters",
    department: "Marketing",
    performance_score: "79",
    attendance: "87",
    projects_completed: "6",
    satisfaction_level: "3.9",
    last_evaluation: "4.0"
  },
  {
    age: "42",
    salary: "105000",
    experience: "15",
    education: "PhD",
    department: "Management",
    performance_score: "91",
    attendance: "93",
    projects_completed: "10",
    satisfaction_level: "4.3",
    last_evaluation: "4.6"
  },
  {
    age: "33",
    salary: "88000",
    experience: "9",
    education: "Masters",
    department: "Engineering",
    performance_score: "86",
    attendance: "92",
    projects_completed: "9",
    satisfaction_level: "4.1",
    last_evaluation: "4.4"
  }
];

function App() {
  const [currentFile, setCurrentFile] = useState(null);
  const [datasetMetadata, setDatasetMetadata] = useState(null);
  const [sampleData, setSampleData] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [appReady, setAppReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Add debug logging for state changes
  useEffect(() => {
    console.log("App Context Updated - currentFile:", currentFile ? {
      id: currentFile.id,
      name: currentFile.name,
      type: currentFile.type,
      size: currentFile.size
    } : "null");
    console.log("Current session ID:", sessionId);
    
    // If we have valid data, mark the app as ready
    if (currentFile && datasetMetadata && sampleData && sampleData.length > 0) {
      setAppReady(true);
    }
  }, [currentFile, datasetMetadata, sampleData, sessionId]);

  // Load initial mock data for development
  useEffect(() => {
    // Only set up mock data if no data exists and we're in development
    if (!currentFile && !datasetMetadata && import.meta.env.DEV) {
      console.log("Development environment detected, loading mock data");
      
      // Create a unique mock session ID
      const mockSessionId = `mock-session-${Date.now()}`;
      handleSetSessionId(mockSessionId);
      
      // Create a mock file object with an id property
      const mockFile = {
        name: "employee_data.csv",
        type: "text/csv",
        size: 2500,
        id: "mock-dataset-1",
        sessionId: mockSessionId,
        lastModified: new Date().getTime()
      };
      handleSetCurrentFile(mockFile);

      // Create dataset metadata based on MOCK_DATA
      const mockMetadata = generateMockMetadata(MOCK_DATA);
      mockMetadata.sessionId = mockSessionId;
      handleSetDatasetMetadata(mockMetadata);
      handleSetSampleData(MOCK_DATA);
      
      console.log("Mock data loaded successfully");
    }
  }, []);

  // When session ID changes but we don't have metadata or data, try to load it
  useEffect(() => {
    if (sessionId && (!datasetMetadata || !sampleData || sampleData.length === 0) && !isLoading) {
      console.log("Session ID available but data missing, attempting to load from session:", sessionId);
      loadDatasetFromSession(sessionId);
    }
  }, [sessionId, datasetMetadata, sampleData]);

  // Function to load dataset metadata and sample data from session ID
  const loadDatasetFromSession = async (sid) => {
    if (!sid) return;
    
    setIsLoading(true);
    try {
      console.log("Loading dataset data from session:", sid);
      
      // Try to get session metadata
      const metadataResponse = await datasetApi.getSessionMetadata(sid);
      if (metadataResponse && metadataResponse.data) {
        const metadata = metadataResponse.data.metadata || metadataResponse.data;
        handleSetDatasetMetadata({
          ...metadata,
          sessionId: sid
        });
        
        // Try to get sample data
        const dataResponse = await datasetApi.getSessionData(sid);
        if (dataResponse && dataResponse.data && dataResponse.data.data) {
          handleSetSampleData(dataResponse.data.data);
          
          // Create a mock file object if we don't have one
          if (!currentFile) {
            const mockFile = {
              name: metadata.filename || "dataset.csv",
              type: "text/csv",
              size: metadata.datasetSize || 0,
              id: sid,
              sessionId: sid,
              lastModified: new Date().getTime()
            };
            handleSetCurrentFile(mockFile);
          }
        }
      }
    } catch (error) {
      console.error("Error loading dataset from session:", error);
      // Fall back to mock data if API fails
      if (!datasetMetadata || !sampleData || sampleData.length === 0) {
        console.log("API failed, falling back to mock data");
        const mockSessionId = `mock-session-${Date.now()}`;
        handleSetSessionId(mockSessionId);
        
        // Create a mock file object with an id property
        const mockFile = {
          name: "employee_data.csv",
          type: "text/csv",
          size: 2500,
          id: "mock-dataset-1",
          sessionId: mockSessionId,
          lastModified: new Date().getTime()
        };
        handleSetCurrentFile(mockFile);

        // Create dataset metadata based on MOCK_DATA
        const mockMetadata = generateMockMetadata(MOCK_DATA);
        mockMetadata.sessionId = mockSessionId;
        handleSetDatasetMetadata(mockMetadata);
        handleSetSampleData(MOCK_DATA);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced setter functions that include logging
  const handleSetCurrentFile = (file) => {
    console.log("Setting current file:", file ? file.name : "null");
    setCurrentFile(file);
  };

  const handleSetDatasetMetadata = (metadata) => {
    console.log("Setting dataset metadata:", metadata ? {
      totalColumns: metadata.totalColumns,
      totalRows: metadata.totalRows
    } : "null");
    setDatasetMetadata(metadata);
  };

  const handleSetSampleData = (data) => {
    console.log("Setting sample data:", data ? `${data.length} rows` : "null");
    setSampleData(data);
  };

  const handleSetSessionId = (id) => {
    console.log("Setting session ID:", id);
    setSessionId(id);
  };

  // Generate mock metadata from sample data
  const generateMockMetadata = (data) => {
    if (!data || data.length === 0) return null;

    const sample = data[0];
    const fields = Object.keys(sample).map(key => {
      let type = 'Categorical';
      // Simple type inference
      if (!isNaN(parseFloat(sample[key]))) {
        type = 'Numeric';
      } else if (!isNaN(Date.parse(sample[key]))) {
        type = 'DateTime';
      } else if (sample[key].toLowerCase() === 'true' || sample[key].toLowerCase() === 'false') {
        type = 'Boolean';
      }

      return {
        name: key,
        type: type,
        missing: '0%',
        unique: new Set(data.map(row => row[key])).size,
        sample: data.slice(0, 3).map(row => row[key]).join(', ')
      };
    });

    return {
      status: 'READY',
      totalColumns: fields.length,
      totalRows: data.length,
      missingValues: '0%',
      datasetSize: '2.5KB',
      fields
    };
  };

  // Protected route wrapper with better debugging
  const ProtectedRoute = ({ children }) => {
    // If still loading data, show a loading indicator
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading your dataset...</p>
        </div>
      );
    }
    
    const fileDataMissing = !currentFile || !datasetMetadata;
    
    // If we have a session ID but missing data, try to load it
    if (fileDataMissing && sessionId && !isLoading) {
      console.log("Protected route - We have a session ID but missing data, trying to load:", sessionId);
      loadDatasetFromSession(sessionId);
      
      return (
        <div className="flex flex-col items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading dataset from session...</p>
        </div>
      );
    }
    
    // Only redirect if we've checked all options
    if (fileDataMissing) {
      console.warn("Protected route redirecting - Missing required data", {
        hasFile: !!currentFile,
        hasMetadata: !!datasetMetadata,
        hasSampleData: sampleData && sampleData.length > 0,
        hasSessionId: !!sessionId
      });
      return <Navigate to="/" replace />;
    }
    
    return children;
  };

  const handleUpdateDatasetFromSession = async (sid) => {
    try {
      // Use provided session ID or fall back to the current one
      const sessionId = sid || sessionId;
      
      if (!sessionId) {
        console.error('No session ID provided for update');
        return false;
      }
      
      console.log(`Updating dataset from session: ${sessionId}`);
      setIsLoading(true);
      
      // Get updated data and metadata
      const [dataResponse, metadataResponse] = await Promise.allSettled([
        datasetApi.getSessionData(sessionId),
        datasetApi.getSessionMetadata(sessionId)
      ]);
      
      if (dataResponse.status === 'rejected' || metadataResponse.status === 'rejected') {
        console.error('Some requests failed:', {
          dataError: dataResponse.status === 'rejected' ? dataResponse.reason : null,
          metadataError: metadataResponse.status === 'rejected' ? metadataResponse.reason : null
        });
        
        // If both failed, return false
        if (dataResponse.status === 'rejected' && metadataResponse.status === 'rejected') {
          console.error('Both data and metadata requests failed');
          return false;
        }
      }
      
      // Extract values from responses that succeeded
      const updatedData = dataResponse.status === 'fulfilled' && dataResponse.value.data.data ? 
        dataResponse.value.data.data : [];
      
      const updatedMetadata = metadataResponse.status === 'fulfilled' ? 
        metadataResponse.value.data.metadata || metadataResponse.value.data : null;
      
      // Update the session ID if a new one was provided
      if (sid && sid !== sessionId) {
        handleSetSessionId(sid);
      }
      
      // Only update state with valid data
      if (updatedData.length > 0) {
        handleSetSampleData(updatedData);
        console.log('Sample data updated successfully');
      }
      
      if (updatedMetadata) {
        // Make sure session ID is in metadata
        const metadataWithSession = {
          ...updatedMetadata,
          sessionId: sessionId
        };
        handleSetDatasetMetadata(metadataWithSession);
        console.log('Metadata updated successfully');
        
        // Create a file object if needed
        if (!currentFile) {
          const fileObj = {
            name: updatedMetadata.filename || 'dataset.csv',
            type: updatedMetadata.fileType || 'text/csv',
            size: updatedMetadata.datasetSize || 0,
            id: sessionId,
            sessionId: sessionId,
            lastModified: new Date().getTime()
          };
          handleSetCurrentFile(fileObj);
          console.log('Created file object from metadata');
        }
      }
      
      // Return true if at least one update was successful
      const success = (updatedData.length > 0 || updatedMetadata !== null);
      console.log(`Dataset update ${success ? 'succeeded' : 'failed'}`);
      return success;
    } catch (err) {
      console.error('Failed to update dataset from session:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ErrorBoundary>
      <AppContext.Provider value={{ 
        currentFile, 
        datasetMetadata, 
        sampleData, 
        datasets,
        sessionId,
        appReady,
        updateDatasetFromSession: handleUpdateDatasetFromSession,
        setSessionId: handleSetSessionId
      }}>
        <Layout>
          <Suspense fallback={
            <div className="flex items-center justify-center h-screen">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          }>
            <Routes>
              <Route 
                path="/" 
                element={
                  <Home 
                    setCurrentFile={handleSetCurrentFile}
                    setDatasetMetadata={handleSetDatasetMetadata}
                    setSampleData={handleSetSampleData}
                    setSessionId={handleSetSessionId}
                  />
                } 
              />
              <Route 
                path="/overview" 
                element={
                  <ProtectedRoute>
                    <Overview />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/preprocess" 
                element={
                  <ProtectedRoute>
                    <Preprocess />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/eda" 
                element={
                  <ProtectedRoute>
                    <EDA 
                      currentFile={currentFile}
                      datasetMetadata={datasetMetadata}
                    />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/sql-assistant" 
                element={
                  <ProtectedRoute>
                    <SQLAssistant />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/train" 
                element={
                  <ProtectedRoute>
                    <Train />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/report" 
                element={
                  <ProtectedRoute>
                    <Report />
                  </ProtectedRoute>
                } 
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </AppContext.Provider>
    </ErrorBoundary>
  );
}

export default App; 