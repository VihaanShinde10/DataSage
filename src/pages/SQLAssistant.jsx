import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandLineIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  TableCellsIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { AppContext } from '../context/AppContext';
import { sqlApi } from '../api';

function SQLAssistant() {
  const navigate = useNavigate();
  const { currentFile, datasetMetadata, sessionId } = useContext(AppContext);
  const [query, setQuery] = useState('');
  const [sql, setSQL] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [schema, setSchema] = useState(null);

  // Fetch schema on component mount
  useEffect(() => {
    if (sessionId) {
      fetchSchema();
    }
  }, [sessionId]);

  const fetchSchema = async () => {
    try {
      const response = await sqlApi.getSchema(sessionId);
      setSchema(response.data);
    } catch (err) {
      console.error('Error fetching schema:', err);
    }
  };

  if (!currentFile || !datasetMetadata) {
    return (
      <div className="text-center py-12">
        <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Dataset Loaded</h3>
        <p className="text-sm text-gray-500 mb-4">Please upload a dataset to use the SQL Assistant</p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Upload Dataset
        </button>
      </div>
    );
  }

  const handleQuerySubmit = async () => {
    try {
      setError(null);
      setIsExecuting(true);
      
      // Call backend API to execute natural language query
      const response = await sqlApi.executeQuery(sessionId, query);
      
      // Update state with results
      if (response && response.data) {
        console.log("SQL response:", response.data);
        
        // Set the SQL query
        setSQL(response.data.sql_query || response.data.generated_sql || '');
        
        // Set the results
        if (response.data.columns && response.data.rows) {
          setResults({
            columns: response.data.columns,
            rows: response.data.rows
          });
        } else {
          // No results or empty results
          setResults(null);
        }
      } else {
        setError('Invalid response from server');
      }
    } catch (err) {
      console.error('Error executing query:', err);
      setError(err.toString());
    } finally {
      setIsExecuting(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => {
        // Show a temporary success message
        const button = document.getElementById('copy-button');
        if (button) {
          const originalText = button.innerText;
          button.innerText = 'Copied!';
          setTimeout(() => {
            button.innerText = originalText;
          }, 2000);
        }
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">SQL Assistant</h1>
      
      {/* Dataset Info */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex items-center mb-2">
          <TableCellsIcon className="h-5 w-5 text-blue-500 mr-2" />
          <h2 className="text-lg font-medium">Current Dataset: {datasetMetadata.filename}</h2>
        </div>
        <p className="text-sm text-gray-600">
          {datasetMetadata.totalRows} rows, {datasetMetadata.totalColumns} columns
        </p>
      </div>
      
      {/* Schema Info */}
      {schema && (
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <h2 className="text-lg font-medium mb-2">Schema</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Column</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sample</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {schema.columns.map((column, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{column.column}</td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">{column.type}</td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">{column.sample}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Query Input */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
          Enter your question in natural language
        </label>
        <div className="flex">
          <input
            type="text"
            id="query"
            className="flex-1 block w-full rounded-l-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="e.g., Show me the average salary by department"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleQuerySubmit()}
          />
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            onClick={handleQuerySubmit}
            disabled={isExecuting || !query.trim()}
          >
            {isExecuting ? (
              <>
                <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CommandLineIcon className="h-5 w-5 mr-2" />
                Execute
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Generated SQL */}
      {sql && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 rounded-t-lg">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium text-gray-900">Generated SQL</h3>
              <button
                id="copy-button"
                className="text-sm text-blue-600 hover:text-blue-800"
                onClick={() => copyToClipboard(sql)}
              >
                <ClipboardDocumentIcon className="h-4 w-4 inline mr-1" />
                Copy
              </button>
            </div>
          </div>
          <div className="p-4">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap">{sql}</pre>
          </div>
        </div>
      )}
      
      {/* Results */}
      {results && results.columns && results.columns.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">Query Results</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {results.columns.map((column, index) => (
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
                {results.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {results.columns.map((column, colIndex) => (
                      <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {row[column] !== null && row[column] !== undefined ? String(row[column]) : 'NULL'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default SQLAssistant; 