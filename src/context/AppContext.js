import { createContext } from 'react';

// Create a context with default values
export const AppContext = createContext({
  currentFile: null,
  datasetMetadata: null,
  sampleData: [],
  datasets: [],
  sessionId: null,  // Add sessionId to track the current session
});

export default AppContext; 