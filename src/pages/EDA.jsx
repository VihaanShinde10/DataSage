import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChartBarIcon,
  ChartPieIcon,
  TableCellsIcon,
  ArrowsPointingOutIcon,
  ViewColumnsIcon,
  Square3Stack3DIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import { AppContext } from '../context/AppContext';
import { datasetApi } from '../api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

// Add more chart types for advanced visualizations
const CHART_TYPES = {
  BAR: 'bar',
  LINE: 'line',
  SCATTER: 'scatter',
  PIE: 'pie',
  AREA: 'area',
  RADAR: 'radar',
  COMPOSED: 'composed',
  HEATMAP: 'heatmap'
};

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

function EDA({ currentFile, datasetMetadata }) {
  // Get context values
  const { sessionId, updateDatasetFromSession, sampleData } = useContext(AppContext);
  const [selectedVisualization, setSelectedVisualization] = useState('distribution');
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [compareChartType, setCompareChartType] = useState(CHART_TYPES.BAR);
  const [visualizationData, setVisualizationData] = useState(null);
  const [statisticsData, setStatisticsData] = useState(null);
  const [xAxisColumn, setXAxisColumn] = useState(null);
  const [yAxisColumn, setYAxisColumn] = useState(null);
  const [hueColumn, setHueColumn] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiDiagnostics, setApiDiagnostics] = useState(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isAPIConnected, setIsAPIConnected] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);
  const [localMetadata, setLocalMetadata] = useState(null);
  const navigate = useNavigate();
  const abortControllerRef = useRef(null);

  // Get the current session ID
  const currentSessionId = sessionId || currentFile?.sessionId;
  
  // Use local metadata state or props
  const effectiveMetadata = localMetadata || datasetMetadata;
  
  // Try to get metadata if we don't have it
  useEffect(() => {
    if (!effectiveMetadata && currentSessionId && !isLoading) {
      console.log("EDA: No metadata but have session ID, fetching metadata:", currentSessionId);
      
      setIsLoading(true);
      datasetApi.getSessionMetadata(currentSessionId)
        .then(response => {
          const metadata = response.data.metadata || response.data;
          if (metadata) {
            const metadataWithSession = {
              ...metadata,
              sessionId: currentSessionId
            };
            console.log("EDA: Fetched metadata:", metadataWithSession);
            setLocalMetadata(metadataWithSession);
          }
        })
        .catch(err => {
          console.error("EDA: Failed to fetch metadata:", err);
          setError("Failed to fetch dataset metadata. Please try uploading the dataset again.");
        })
        .finally(() => setIsLoading(false));
    }
  }, [effectiveMetadata, currentSessionId]);
  
  // Debug logging for troubleshooting
  useEffect(() => {
    console.log('EDA Component - Current props:', {
      currentFile: currentFile ? {
        name: currentFile.name,
        id: currentFile.id,
        sessionId: currentFile.sessionId
      } : null,
      datasetMetadata: datasetMetadata ? {
        fields: datasetMetadata.fields ? `${datasetMetadata.fields.length} fields` : 'No fields',
        totalColumns: datasetMetadata.totalColumns,
        totalRows: datasetMetadata.totalRows,
        sessionId: datasetMetadata.sessionId
      } : null,
      localMetadata: localMetadata ? {
        fields: localMetadata.fields ? `${localMetadata.fields.length} fields` : 'No fields'
      } : null,
      contextSessionId: sessionId,
      currentSessionId,
      effectiveMetadata: effectiveMetadata ? true : false
    });
    
    if (!currentFile && !effectiveMetadata) {
      console.warn('EDA Component - No dataset or metadata available!');
    }
  }, [currentFile, datasetMetadata, sessionId, currentSessionId, localMetadata, effectiveMetadata]);
  
  // Set first column as selected when dataset metadata changes
  useEffect(() => {
    if (effectiveMetadata && effectiveMetadata.fields && effectiveMetadata.fields.length > 0 && !selectedColumn) {
      setSelectedColumn(effectiveMetadata.fields[0].name);
      console.log(`EDA Component - Selected first column: ${effectiveMetadata.fields[0].name}`);
    }
  }, [effectiveMetadata, selectedColumn]);

  // Check API connection on component mount
  useEffect(() => {
    const checkAPIConnection = async () => {
      try {
        const response = await datasetApi.checkHealth();
        setIsAPIConnected(response && response.status === 'ok');
        console.log('API connection check:', response);
      } catch (error) {
        console.error('API connection check failed:', error);
        setIsAPIConnected(false);
      }
    };
    
    checkAPIConnection();
  }, []);

  // Load data when column or visualization type changes
  useEffect(() => {
    if (selectedColumn && currentSessionId) {
      if (selectedVisualization === 'comparative' && selectedColumns.length > 0) {
        loadComparativeData([...selectedColumns, selectedColumn], {
          xAxis: xAxisColumn,
          yAxis: yAxisColumn,
          hue: hueColumn
        });
      } else {
        loadData(selectedColumn, selectedVisualization);
      }
    }
  }, [selectedColumn, selectedVisualization, selectedColumns, compareChartType, 
      currentSessionId, xAxisColumn, yAxisColumn, hueColumn]);

  // Clear error after 5 seconds
  useEffect(() => {
    let timer;
    if (error) {
      timer = setTimeout(() => {
        setError(null);
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [error]);

  // Load data from API
  const loadData = async (column, visualizationType) => {
    if (!column || !currentSessionId) return;
    
    setIsLoading(true);
    setError(null);
    
    // Create new abort controller for this request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('New data request started');
    }
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;
    
    try {
      console.log(`Loading ${visualizationType} data for column: ${column}`);
      
      // Different API calls based on visualization type
      let response;
      
      switch (visualizationType) {
        case 'distribution':
          response = await datasetApi.getColumnDistribution(currentSessionId, column, { signal });
          break;
        case 'correlation':
          // If we have multiple columns selected for correlation
          if (selectedColumns.length > 1) {
            response = await datasetApi.getColumnsCorrelation(currentSessionId, [...selectedColumns, column], { signal });
          } else {
            // Default to correlation matrix if only one column is selected
            response = await datasetApi.getCorrelationMatrix(currentSessionId, { signal });
          }
          break;
        case 'timeseries':
          // Assuming time series analysis works on date/datetime columns
          response = await datasetApi.getColumnStatistics(currentSessionId, column, { signal });
          break;
        case 'categorical':
          response = await datasetApi.getColumnDistribution(currentSessionId, column, { signal });
          break;
        default:
          throw new Error(`Unsupported visualization type: ${visualizationType}`);
      }
      
      // Also load statistics for this column
      const statsResponse = await datasetApi.getColumnStatistics(currentSessionId, column, { signal });
      
      // Process and set data
      if (response && response.data) {
        setVisualizationData(processApiResponse(response.data, visualizationType));
      } else {
        console.error('Empty or invalid API response:', response);
        throw new Error('Failed to load visualization data - empty response');
      }
      
      // Process and set statistics
      if (statsResponse && statsResponse.data) {
        setStatisticsData(statsResponse.data);
      }
      
    } catch (error) {
      // Ignore abort errors as they're intentional
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        console.log('Data loading request was aborted, ignoring error');
        return;
      }
      
      console.error('Failed to load data:', error);
      setError(`Error loading data: ${error.message || 'Unknown error'}`);
      
      // Fall back to mock data
      generateMockData(column, visualizationType);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Process API response into visualization-ready data
  const processApiResponse = (data, visualizationType) => {
    try {
      // Different processing based on visualization type
      switch (visualizationType) {
        case 'distribution':
          // Check if data is already in the right format
          if (data.distribution && Array.isArray(data.distribution)) {
            return data.distribution.map(item => ({
              value: item.bin_label || item.bin,
              count: item.count || item.frequency,
            }));
          } else if (data.bins && data.counts) {
            // Handle response with separate bins and counts arrays
            return data.bins.map((bin, index) => ({
              value: bin,
              count: data.counts[index] || 0,
            }));
          }
          break;
          
        case 'correlation':
          // Handle correlation data
          if (data.correlation_matrix) {
            // TODO: Transform correlation matrix to format needed by visualization
            return data.correlation_matrix;
          } else if (data.correlation) {
            return data.correlation;
          }
          break;
          
        case 'timeseries':
          // Handle time series data
          if (data.time_series) {
            return data.time_series.map(item => ({
              date: item.timestamp || item.date,
              value: item.value,
            }));
          }
          break;
          
        case 'categorical':
          // Handle categorical data
          if (data.categories) {
            return data.categories.map(item => ({
              name: item.category || item.name,
              value: item.count || item.value,
            }));
          }
          break;
      }
      
      // If we can't determine the format, return the original data
      console.warn('Unknown data format, returning original:', data);
      return data;
    } catch (error) {
      console.error('Error processing API response:', error);
      return null;
    }
  };
  
  // Dynamically determine available visualization types based on column type
  const getAvailableVisualizations = (columnName, metadata) => {
    if (!metadata || !metadata.fields) return visualizationTypes;
    
    const column = metadata.fields.find(field => field.name === columnName);
    if (!column) return visualizationTypes;
    
    // Base array of visualization types
    let availableTypes = [];
    
    // Add appropriate visualization types based on column data type
    switch (column.type) {
      case 'Numeric':
        availableTypes = [
          {
            id: 'distribution',
            name: 'Distribution Analysis',
            icon: ChartBarIcon,
            description: 'Analyze the distribution of numeric values',
          },
          {
            id: 'correlation',
            name: 'Correlation Analysis',
            icon: ArrowsPointingOutIcon,
            description: 'Explore relationships with other variables',
          },
          {
            id: 'comparative',
            name: 'Comparative Analysis',
            icon: ViewColumnsIcon,
            description: 'Compare with other columns',
          }
        ];
        break;
      case 'Categorical':
        availableTypes = [
          {
            id: 'categorical',
            name: 'Categorical Analysis',
            icon: ChartPieIcon,
            description: 'Analyze category distributions',
          },
          {
            id: 'comparative',
            name: 'Comparative Analysis',
            icon: ViewColumnsIcon,
            description: 'Compare with other columns',
          }
        ];
        break;
      case 'DateTime':
        availableTypes = [
          {
            id: 'timeseries',
            name: 'Time Series Analysis',
            icon: Square3Stack3DIcon,
            description: 'Analyze temporal patterns in your data',
          },
          {
            id: 'comparative',
            name: 'Comparative Analysis',
            icon: ViewColumnsIcon,
            description: 'Compare with other columns',
          }
        ];
        break;
      default:
        // Default to showing distribution and categorical for unknown types
        availableTypes = [
          {
            id: 'distribution',
            name: 'Distribution Analysis',
            icon: ChartBarIcon,
            description: 'Analyze the distribution of values',
          },
          {
            id: 'categorical',
            name: 'Categorical Analysis',
            icon: ChartPieIcon,
            description: 'Analyze as categories',
          },
          {
            id: 'comparative',
            name: 'Comparative Analysis',
            icon: ViewColumnsIcon,
            description: 'Compare with other columns',
          }
        ];
    }
    
    // Always add correlation if we have numeric columns to correlate with
    if (column.type !== 'Categorical' && 
        metadata.fields.some(f => f.name !== columnName && f.type === 'Numeric')) {
      if (!availableTypes.find(type => type.id === 'correlation')) {
        availableTypes.push({
          id: 'correlation',
          name: 'Correlation Analysis',
          icon: ArrowsPointingOutIcon,
          description: 'Explore relationships with numeric variables',
        });
      }
    }
    
    return availableTypes;
  };

  // Get numeric columns for correlation analysis
  const getNumericColumns = (metadata) => {
    if (!metadata || !metadata.fields) return [];
    return metadata.fields
      .filter(field => field.type === 'Numeric')
      .map(field => field.name);
  };

  // Dynamically generate mock data based on column type
  const generateMockData = (column, visualizationType) => {
    console.log(`Generating mock data for ${visualizationType} of column: ${column}`);
    
    let mockData;
    
    // Get column info from metadata if available
    const columnInfo = effectiveMetadata?.fields?.find(f => f.name === column);
    const columnType = columnInfo?.type || 'Unknown';
    
    // Generate different mock data based on visualization type and column type
    switch (visualizationType) {
      case 'distribution':
        if (columnType === 'Numeric') {
          // Generate a normal distribution for numeric columns
          mockData = Array.from({ length: 10 }, (_, i) => ({
            value: `${i * 10}-${(i + 1) * 10}`,
            count: Math.floor(Math.random() * 30) + 5
          }));
        } else {
          // For non-numeric, generate random category counts
          mockData = Array.from({ length: 5 }, (_, i) => ({
            value: `Category ${i + 1}`,
            count: Math.floor(Math.random() * 50) + 10
          }));
        }
        break;
        
      case 'correlation':
        // Generate random correlation data
        const numericColumns = getNumericColumns(effectiveMetadata);
        if (numericColumns.length > 1) {
          mockData = [];
          numericColumns.forEach(col1 => {
            numericColumns.forEach(col2 => {
              if (col1 !== col2) {
                mockData.push({
                  column1: col1,
                  column2: col2,
                  correlation: (Math.random() * 2 - 1).toFixed(2)
                });
              }
            });
          });
        } else {
          // Fallback mock correlation data
        mockData = [
          { x: 10, y: 15 },
          { x: 20, y: 25 },
          { x: 30, y: 35 },
          { x: 40, y: 45 },
          { x: 50, y: 55 },
        ];
        }
        break;
        
      case 'timeseries':
        // Generate time series data
        const today = new Date();
        mockData = Array.from({ length: 10 }, (_, i) => {
          const date = new Date(today);
          date.setDate(today.getDate() - (9 - i));
          return {
            date: date.toISOString().split('T')[0],
            value: Math.floor(Math.random() * 100) + 50
          };
        });
        break;
        
      case 'categorical':
        // Get sample values from column info if available
        const sampleValues = columnInfo?.sample?.split(', ') || [];
        
        if (sampleValues.length > 0) {
          mockData = sampleValues.map(value => ({
            name: value,
            value: Math.floor(Math.random() * 50) + 10
          }));
        } else {
          // Fallback mock category data
        mockData = [
          { name: 'Category A', value: 30 },
          { name: 'Category B', value: 25 },
          { name: 'Category C', value: 20 },
          { name: 'Category D', value: 15 },
          { name: 'Category E', value: 10 },
        ];
        }
        break;
    }
    
    // Set the mock data
    setVisualizationData(mockData);
    
    // Generate mock statistics based on column type
    if (columnType === 'Numeric') {
    setStatisticsData({
        mean: parseFloat((Math.random() * 50 + 25).toFixed(2)),
        median: parseFloat((Math.random() * 50 + 30).toFixed(2)),
        std_dev: parseFloat((Math.random() * 10 + 5).toFixed(2)),
        min: parseFloat((Math.random() * 20).toFixed(2)),
        max: parseFloat((Math.random() * 50 + 50).toFixed(2)),
        missing_values_percent: parseFloat((Math.random() * 5).toFixed(1)),
        count: effectiveMetadata?.totalRows || 100,
        skewness: parseFloat((Math.random() * 2 - 1).toFixed(2)),
        kurtosis: parseFloat((Math.random() * 4 + 1).toFixed(2))
      });
    } else {
      // For categorical columns
      const uniqueCount = columnInfo?.unique || 5;
      setStatisticsData({
        unique_count: uniqueCount,
        most_common: sampleValues?.[0] || 'Category A',
        least_common: sampleValues?.[sampleValues.length - 1] || 'Category E',
        missing_values_percent: parseFloat((Math.random() * 5).toFixed(1)),
        count: effectiveMetadata?.totalRows || 100
      });
    }
  };

  // Custom tooltip for more precise data display
  const CustomTooltip = ({ active, payload, label, xAxis, yAxis, chartType }) => {
    if (!active || !payload || payload.length === 0) return null;
    
    const getFormattedValue = (value) => {
      if (typeof value === 'number') {
        // If it's a whole number, don't show decimal places
        return Number.isInteger(value) ? value.toString() : value.toFixed(2);
      }
      return value;
    };
    
    // For scatter charts
    if (chartType === CHART_TYPES.SCATTER) {
      const data = payload[0].payload;
      const xLabel = data.xLabel || xAxis || 'X';
      const yLabel = data.yLabel || yAxis || 'Y';
      
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-md rounded-md">
          <p className="text-sm font-medium text-gray-700">{`${xLabel}: ${getFormattedValue(data.x)}`}</p>
          <p className="text-sm font-medium text-gray-700">{`${yLabel}: ${getFormattedValue(data.y)}`}</p>
          {data.hue !== undefined && (
            <p className="text-sm font-medium text-gray-700">{`${data.hueLabel || hueColumn}: ${data.hue}`}</p>
          )}
        </div>
      );
    }
    
    // For other chart types
    const categoryName = xAxis || 'Category';
    const categoryValue = label || 'Unknown';
    
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-md rounded-md">
        <p className="text-sm font-medium text-gray-700">{`${categoryName}: ${categoryValue}`}</p>
        {payload.map((entry, index) => (
          <p key={`tooltip-${index}`} className="text-sm" style={{ color: entry.color }}>
            {`${entry.name}: ${getFormattedValue(entry.value)}`}
          </p>
        ))}
      </div>
    );
  };

  const renderCorrelationVisualization = (data) => {
    // For correlation matrix
    if (data && Array.isArray(data) && data.length > 0 && 'column1' in data[0] && 'column2' in data[0]) {
      // Format data for heatmap-style display
      const columns = [...new Set(data.map(item => item.column1))];
      
      return (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 border border-gray-300 bg-gray-100 font-semibold">Variables</th>
                {columns.map(col => (
                  <th key={col} className="p-2 border border-gray-300 bg-gray-100 text-sm font-semibold">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columns.map(row => (
                <tr key={row}>
                  <th className="p-2 border border-gray-300 bg-gray-100 text-sm font-semibold">{row}</th>
                  {columns.map(col => {
                    const cell = data.find(item => 
                      item.column1 === row && item.column2 === col
                    );
                    const value = cell ? parseFloat(cell.correlation) : (row === col ? 1 : 0);
                    
                    // Calculate background color based on correlation value
                    const bgColor = value > 0 
                      ? `rgba(0, 136, 254, ${Math.abs(value)})`
                      : `rgba(254, 136, 0, ${Math.abs(value)})`;
                      
                    return (
                      <td 
                        key={col} 
                        className="p-2 border border-gray-300 text-center text-sm"
                        style={{
                          backgroundColor: row === col ? '#f3f4f6' : bgColor,
                          color: Math.abs(value) > 0.5 ? 'white' : 'black'
                        }}
                        title={`Correlation between ${row} and ${col}: ${value.toFixed(2)}`}
                      >
                        {row === col ? '1.00' : value.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-center items-center text-sm text-gray-600">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-orange-500 mr-1"></div>
              <span className="mr-3">Negative correlation</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-blue-500 mr-1"></div>
              <span>Positive correlation</span>
            </div>
          </div>
        </div>
      );
    }
    
    // Fallback to scatter plot for simple correlation
    return (
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              dataKey="x" 
              name={xAxisColumn || 'X Axis'}
              label={{ value: xAxisColumn || 'X Axis', position: 'insideBottom', offset: -5 }}
            />
            <YAxis 
              type="number" 
              dataKey="y" 
              name={yAxisColumn || 'Y Axis'}
              label={{ value: yAxisColumn || 'Y Axis', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip chartType={CHART_TYPES.SCATTER} />} />
            <Legend />
            <Scatter 
              name={xAxisColumn && yAxisColumn ? `${xAxisColumn} vs ${yAxisColumn}` : "Correlation"} 
              data={data} 
              fill="#00C49F" 
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderComparativeVisualization = () => {
    if (!visualizationData || visualizationData.length === 0) {
      return (
        <div className="text-center py-8">
          <ViewColumnsIcon className="h-10 w-10 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">Please select multiple columns to compare</p>
        </div>
      );
    }
    
    // For heatmap/correlation matrix
    if (compareChartType === CHART_TYPES.HEATMAP) {
      return renderCorrelationVisualization(visualizationData);
    }
    
    // For scatter plot
    if (compareChartType === CHART_TYPES.SCATTER) {
      // Determine if we need to group by hue
      const hasHueGroups = hueColumn && visualizationData.some(d => d.hue !== undefined && d.hue !== null);
      
      // Group data by hue if needed
      let groupedData = visualizationData;
      let hueGroups = [];
      
      if (hasHueGroups) {
        // Extract unique hue values and group data
        const hueValues = new Set(visualizationData
          .filter(d => d.hue !== undefined && d.hue !== null)
          .map(d => d.hue));
        hueGroups = Array.from(hueValues);
        
        // Group the data by hue values
        groupedData = hueGroups.map(hueValue => ({
          name: `${hueColumn}: ${hueValue}`,
          data: visualizationData.filter(d => d.hue === hueValue)
        }));
      }
      
      return (
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey="x" 
                name={xAxisColumn || 'X Axis'}
                label={{ value: xAxisColumn || 'X Axis', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                name={yAxisColumn || 'Y Axis'}
                label={{ value: yAxisColumn || 'Y Axis', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip chartType={CHART_TYPES.SCATTER} xAxis={xAxisColumn} yAxis={yAxisColumn} />} />
              <Legend />
              {hasHueGroups ? (
                groupedData.map((group, index) => (
                  <Scatter 
                    key={`scatter-${index}`} 
                    name={group.name} 
                    data={group.data} 
                    fill={COLORS[index % COLORS.length]} 
                  />
                ))
              ) : (
                <Scatter 
                  name={xAxisColumn && yAxisColumn ? `${xAxisColumn} vs ${yAxisColumn}` : "Data Points"} 
                  data={visualizationData} 
                  fill="#8884d8" 
                />
              )}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      );
    }
    
    // Get the dataKey for categories based on selected x-axis or default
    const categoryKey = xAxisColumn || 'category';
    
    // For bar chart
    if (compareChartType === CHART_TYPES.BAR) {
      // Determine which columns to show
      const columns = selectedColumns.filter(col => col !== xAxisColumn);
      if (selectedColumn && !columns.includes(selectedColumn) && selectedColumn !== xAxisColumn) {
        columns.push(selectedColumn);
      }
      
      // Handle grouping by hue if specified
      if (hueColumn && columns.length > 0) {
        return (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visualizationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey={categoryKey} 
                  label={{ value: xAxisColumn || 'Categories', position: 'insideBottom', offset: -5 }}
                  tickFormatter={(value) => {
                    // Try to keep labels short for readability
                    if (typeof value === 'string' && value.length > 15) {
                      return value.substring(0, 12) + '...';
                    }
                    return value;
                  }}
                />
                <YAxis 
                  label={{ value: 'Value', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<CustomTooltip chartType={CHART_TYPES.BAR} xAxis={xAxisColumn} />} />
                <Legend />
                {columns.map((column, index) => (
                  <Bar 
                    key={column} 
                    dataKey={column} 
                    name={column}
                    fill={COLORS[index % COLORS.length]} 
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }
      
      // Regular bar chart
      return (
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visualizationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey={categoryKey} 
                label={{ value: xAxisColumn || 'Categories', position: 'insideBottom', offset: -5 }}
                tickFormatter={(value) => {
                  // Try to keep labels short for readability
                  if (typeof value === 'string' && value.length > 15) {
                    return value.substring(0, 12) + '...';
                  }
                  return value;
                }}
              />
              <YAxis 
                label={{ value: 'Value', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip chartType={CHART_TYPES.BAR} xAxis={xAxisColumn} />} />
              <Legend />
              {columns.map((column, index) => (
                <Bar 
                  key={column} 
                  dataKey={column} 
                  fill={COLORS[index % COLORS.length]} 
                  name={column}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    
    // For line chart
    if (compareChartType === CHART_TYPES.LINE) {
      // Determine which columns to show
      const columns = selectedColumns.filter(col => col !== xAxisColumn);
      if (selectedColumn && !columns.includes(selectedColumn) && selectedColumn !== xAxisColumn) {
        columns.push(selectedColumn);
      }
      
      return (
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visualizationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey={categoryKey} 
                label={{ value: xAxisColumn || 'Categories', position: 'insideBottom', offset: -5 }}
                tickFormatter={(value) => {
                  // Try to keep labels short for readability
                  if (typeof value === 'string' && value.length > 15) {
                    return value.substring(0, 12) + '...';
                  }
                  return value;
                }}
              />
              <YAxis 
                label={{ value: 'Value', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip chartType={CHART_TYPES.LINE} xAxis={xAxisColumn} />} />
              <Legend />
              {columns.map((column, index) => (
                <Line 
                  key={column} 
                  type="monotone" 
                  dataKey={column} 
                  stroke={COLORS[index % COLORS.length]} 
                  name={column}
                  activeDot={{ r: 8 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }
    
    // For area chart
    if (compareChartType === CHART_TYPES.AREA) {
      // Determine which columns to show
      const columns = selectedColumns.filter(col => col !== xAxisColumn);
      if (selectedColumn && !columns.includes(selectedColumn) && selectedColumn !== xAxisColumn) {
        columns.push(selectedColumn);
      }
      
      return (
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={visualizationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey={categoryKey} 
                label={{ value: xAxisColumn || 'Categories', position: 'insideBottom', offset: -5 }}
                tickFormatter={(value) => {
                  // Try to keep labels short for readability
                  if (typeof value === 'string' && value.length > 15) {
                    return value.substring(0, 12) + '...';
                  }
                  return value;
                }}
              />
              <YAxis 
                label={{ value: 'Value', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip chartType={CHART_TYPES.AREA} xAxis={xAxisColumn} />} />
              <Legend />
              {columns.map((column, index) => (
                <Area 
                  key={column} 
                  type="monotone" 
                  dataKey={column} 
                  fill={COLORS[index % COLORS.length]} 
                  stroke={COLORS[index % COLORS.length]} 
                  name={column}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    }
    
    // Default fallback
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500">Select a chart type to compare columns</p>
      </div>
    );
  };

  const renderVisualization = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin" />
          <span className="ml-2 text-gray-600">Loading data...</span>
        </div>
      );
    }
    
    if (!visualizationData || (Array.isArray(visualizationData) && visualizationData.length === 0)) {
      return (
        <div className="text-center py-8">
          <TableCellsIcon className="h-10 w-10 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">No data available for visualization</p>
          <button 
            onClick={() => selectedColumn && loadData(selectedColumn, selectedVisualization)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Try Loading Data Again
          </button>
        </div>
      );
    }
    
    // For comparative visualization type
    if (selectedVisualization === 'comparative') {
      return renderComparativeVisualization();
    }
    
    // Make sure we have an array for visualization, even if API returns other format
    const safeData = Array.isArray(visualizationData) ? visualizationData : 
                    (visualizationData && typeof visualizationData === 'object') ? [visualizationData] : [];
    
    if (safeData.length === 0) {
      return (
        <div className="text-center py-8">
          <TableCellsIcon className="h-10 w-10 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">No data points available for visualization</p>
        </div>
      );
    }
    
    switch (selectedVisualization) {
      case 'distribution':
        return (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="value" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#0088FE" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'correlation':
        return renderCorrelationVisualization(safeData);

      case 'timeseries':
        return (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={safeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#8884D8" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );

      case 'categorical':
        return (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={safeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label
                >
                  {safeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );

      default:
        return null;
    }
  };

  const renderStatistics = () => {
    if (!selectedColumn || !statisticsData) return null;

    // Determine which statistics to show based on column type
    const columnInfo = effectiveMetadata?.fields?.find(f => f.name === selectedColumn);
    const isNumeric = columnInfo?.type === 'Numeric';
    
    if (isNumeric) {
      return (
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h4 className="text-sm font-medium text-gray-500">Mean</h4>
            <p className="text-lg font-semibold text-gray-900">{statisticsData.mean?.toFixed(2) || 'N/A'}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h4 className="text-sm font-medium text-gray-500">Median</h4>
            <p className="text-lg font-semibold text-gray-900">{statisticsData.median?.toFixed(2) || 'N/A'}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h4 className="text-sm font-medium text-gray-500">Standard Deviation</h4>
            <p className="text-lg font-semibold text-gray-900">{statisticsData.std_dev?.toFixed(2) || 'N/A'}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h4 className="text-sm font-medium text-gray-500">Min</h4>
            <p className="text-lg font-semibold text-gray-900">{statisticsData.min || 'N/A'}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h4 className="text-sm font-medium text-gray-500">Max</h4>
            <p className="text-lg font-semibold text-gray-900">{statisticsData.max || 'N/A'}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h4 className="text-sm font-medium text-gray-500">Missing Values</h4>
            <p className="text-lg font-semibold text-gray-900">{statisticsData.missing_values_percent?.toFixed(1) || 0}%</p>
          </div>
        </div>
      );
    } else {
      // For categorical columns
      return (
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h4 className="text-sm font-medium text-gray-500">Unique Categories</h4>
            <p className="text-lg font-semibold text-gray-900">{statisticsData.unique_count || columnInfo?.unique || 'N/A'}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h4 className="text-sm font-medium text-gray-500">Most Common</h4>
            <p className="text-lg font-semibold text-gray-900">{statisticsData.most_common || 'N/A'}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h4 className="text-sm font-medium text-gray-500">Missing Values</h4>
            <p className="text-lg font-semibold text-gray-900">{statisticsData.missing_values_percent?.toFixed(1) || 0}%</p>
          </div>
        </div>
      );
    }
  };
  
  // Add diagnostic function to check API endpoints
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
      statistics: { status: 'unknown', latency: null, message: 'Not checked' },
      distribution: { status: 'unknown', latency: null, message: 'Not checked' },
      correlation: { status: 'unknown', latency: null, message: 'Not checked' },
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
      if (!currentSessionId) {
        diagnosticResults.session = {
          status: 'warning',
          message: 'No session ID available'
        };
      } else {
        diagnosticResults.session = {
          status: 'success',
          message: `Using session ID: ${currentSessionId}`
        };
        
        // Check if we have column selected to test specific endpoints
        if (selectedColumn) {
          // Try to get column statistics
          diagnosticResults.statistics = await runDiagnostic(
            'statistics', 
            datasetApi.getColumnStatistics,
            [currentSessionId, selectedColumn]
          );
          
          // Try to get column distribution
          diagnosticResults.distribution = await runDiagnostic(
            'distribution', 
            datasetApi.getColumnDistribution,
            [currentSessionId, selectedColumn]
          );
        }
        
        // Check correlation matrix endpoint
        diagnosticResults.correlation = await runDiagnostic(
          'correlation', 
          datasetApi.getCorrelationMatrix,
          currentSessionId
        );
      }
      
      setApiDiagnostics(diagnosticResults);
      
      // Analyze results to help user
      const failedEndpoints = Object.values(diagnosticResults).filter(r => r.status === 'error').length;
      if (failedEndpoints > 0) {
        setError(`Diagnostic complete: ${failedEndpoints} API endpoints failed. See results below.`);
      } else {
        setError(null);
      }
    } catch (error) {
      console.error('Overall diagnostic process failed:', error);
    } finally {
      setIsDiagnosing(false);
    }
  }, [currentSessionId, selectedColumn]);

  // Add a function to try to recover the dataset
  const recoverDataset = async () => {
    setIsRecovering(true);
    setError(null);
    
    try {
      console.log("Attempting to recover dataset...");
      
      // First check if we have a session ID
      if (!currentSessionId) {
        throw new Error("No session ID available to recover dataset");
      }
      
      // Try to update the dataset from the session
      const success = await updateDatasetFromSession(currentSessionId);
      
      if (success) {
        // If successful, refresh the page to use the updated data
        window.location.reload();
        return;
      } else {
        throw new Error("Failed to recover dataset data");
      }
    } catch (error) {
      console.error("Recovery failed:", error);
      setError(`Recovery attempt failed: ${error.message}`);
      
      // Try to redirect to Home as a last resort
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } finally {
      setIsRecovering(false);
    }
  };

  // Load comparative data for multiple columns
  const loadComparativeData = async (columns, axisConfig = {}) => {
    if (!columns || columns.length === 0 || !currentSessionId) return;
    
    setIsLoading(true);
    setError(null);
    
    // Create new abort controller for this request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('New data request started');
    }
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;
    
    try {
      console.log(`Loading comparative data for columns:`, columns, 'with axis config:', axisConfig);
      
      // Different API calls based on chart type
      let response;
      
      switch (compareChartType) {
        case CHART_TYPES.SCATTER:
          if (columns.length >= 2) {
            // For scatter plots, we can specify x and y columns
            const xCol = axisConfig.xAxis || columns[0];
            const yCol = axisConfig.yAxis || columns[1];
            
            response = await datasetApi.getColumnsCorrelation(
              currentSessionId, 
              [xCol, yCol], 
              { signal }
            );
          }
          break;
        case CHART_TYPES.HEATMAP:
          // For heatmap, we want correlation matrix
          response = await datasetApi.getCorrelationMatrix(currentSessionId, { signal });
          break;
        default:
          // For bar, line, etc. get data for all columns
          response = await datasetApi.getMultipleColumnsData(
            currentSessionId, 
            columns, 
            { signal }
          );
          // If API doesn't have this endpoint, fall back to getting data individually
          if (!response) {
            const columnData = await Promise.all(
              columns.map(col => 
                datasetApi.getColumnDistribution(currentSessionId, col, { signal })
                  .then(res => ({
                    column: col,
                    data: res.data
                  }))
              )
            );
            response = { data: { columns: columnData } };
          }
      }
      
      // Process and set data
      if (response && response.data) {
        setVisualizationData(processComparativeData(response.data, columns, compareChartType, axisConfig));
      } else {
        console.error('Empty or invalid API response:', response);
        throw new Error('Failed to load comparative visualization data - empty response');
      }
      
    } catch (error) {
      // Ignore abort errors as they're intentional
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        console.log('Data loading request was aborted, ignoring error');
        return;
      }
      
      console.error('Failed to load comparative data:', error);
      setError(`Error loading comparative data: ${error.message || 'Unknown error'}`);
      
      // Fall back to mock data for comparative visualization
      generateMockComparativeData(columns, compareChartType, axisConfig);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Process comparative data from API
  const processComparativeData = (data, columns, chartType, axisConfig = {}) => {
    try {
      const { xAxis, yAxis, hue } = axisConfig;
      
      switch (chartType) {
        case CHART_TYPES.SCATTER:
          // For scatter plots
          if (data.scatter_data) {
            return data.scatter_data;
          } else if (Array.isArray(data)) {
            // Use the specified axes if available
            const xKey = xAxis || columns[0];
            const yKey = yAxis || columns[1];
            
            return data.map(point => ({
              x: point[xKey] !== undefined ? point[xKey] : point.x,
              y: point[yKey] !== undefined ? point[yKey] : point.y,
              // Include the actual value labels for better tooltip display
              xLabel: xKey,
              yLabel: yKey,
              // Store the original point for custom tooltips
              originalPoint: point,
              // Include hue data if specified
              ...(hue && { 
                hue: point[hue] !== undefined ? point[hue] : null, 
                hueLabel: hue 
              })
            }));
          }
          break;
          
        case CHART_TYPES.HEATMAP:
          // For heatmap/correlation matrix
          if (data.correlation_matrix) {
            return data.correlation_matrix;
          }
          break;
          
        default:
          // For bar, line charts, etc.
          if (data.columns) {
            // Merge data from multiple columns
            const allCategories = new Set();
            const columnData = {};
            const categoryLabels = {};
            
            // If x-axis is specified, use that for categories
            const categoryColumn = xAxis || 'category';
            
            // Extract all unique categories/bins across columns
            data.columns.forEach(col => {
              const colData = col.data.distribution || col.data;
              
              if (Array.isArray(colData)) {
                colData.forEach(item => {
                  // Get the appropriate category value
                  const category = item.bin_label || item.bin || item.category || item.value;
                  
                  // Don't add undefined or null categories
                  if (category !== undefined && category !== null) {
                    allCategories.add(category);
                    
                    // Store original labels for better display
                    if (item.bin_label || item.bin || item.category) {
                      categoryLabels[category] = item.bin_label || item.bin || item.category;
                    }
                  }
                });
                columnData[col.column] = colData;
              }
            });
            
            // Build combined dataset
            const processedData = Array.from(allCategories).map(category => {
              // Start with the category
              const point = { 
                [categoryColumn]: category,
                // Add a formatted label for display
                categoryLabel: categoryLabels[category] || category,
                // Store the raw category value
                rawCategory: category
              };
              
              // Add data for each column
              Object.keys(columnData).forEach(colName => {
                // Skip if this is being used as x-axis
                if (colName === xAxis) return;
                
                const matchingItem = columnData[colName].find(item => 
                  (item.bin_label || item.bin || item.category || item.value) === category
                );
                
                // Use the actual value and ensure it's a number for charts
                const value = matchingItem ? 
                  (matchingItem.count || matchingItem.frequency || matchingItem.value || 0) : 0;
                
                point[colName] = typeof value === 'string' ? parseFloat(value) || 0 : value;
                
                // Add formatted label if available
                if (matchingItem && (matchingItem.formatted_value || matchingItem.label)) {
                  point[`${colName}_label`] = matchingItem.formatted_value || matchingItem.label;
                }
              });
              
              return point;
            });
            
            // Sort data by categories if they appear to be orderable (numeric or date-like)
            const sampleCategory = allCategories.size > 0 ? 
              Array.from(allCategories)[0] : null;
              
            // Only attempt to sort if there are categories
            if (sampleCategory !== null) {
              // Check if categories are numeric
              const areNumeric = !isNaN(parseFloat(sampleCategory));
              
              // Check if categories look like dates
              const areDates = /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(sampleCategory);
              
              if (areNumeric) {
                // Sort numerically
                processedData.sort((a, b) => 
                  parseFloat(a[categoryColumn]) - parseFloat(b[categoryColumn])
                );
              } else if (areDates) {
                // Sort by date
                processedData.sort((a, b) => 
                  new Date(a[categoryColumn]) - new Date(b[categoryColumn])
                );
              }
            }
            
            return processedData;
          }
      }
      
      // If we can't process it, return the original data
      console.warn('Unknown comparative data format, returning original:', data);
      return data;
    } catch (error) {
      console.error('Error processing comparative data:', error);
      return null;
    }
  };
  
  // Generate mock data for comparative visualization
  const generateMockComparativeData = (columns, chartType, axisConfig = {}) => {
    console.log(`Generating mock comparative data for columns:`, columns, 'with axis config:', axisConfig);
    
    const { xAxis, yAxis, hue } = axisConfig;
    let mockData;
    
    // Use actual column names in the dataset if available
    const sampleCategories = effectiveMetadata && effectiveMetadata.fields ? 
      effectiveMetadata.fields
        .filter(field => field.type === 'Categorical')
        .flatMap(field => field.sample ? field.sample.split(', ') : [])
      : ['Category 1', 'Category 2', 'Category 3', 'Category 4', 'Category 5'];

    // If there are no categorical values, use the sample data if available
    const fallbackCategories = sampleData && sampleData.length > 0 ? 
      [...new Set(sampleData.map(row => 
        Object.values(row).filter(val => typeof val === 'string').slice(0, 10)
      ).flat())] : 
      ['Category 1', 'Category 2', 'Category 3', 'Category 4', 'Category 5'];
      
    // Use the best available categories
    const availableCategories = sampleCategories.length > 0 ? 
      sampleCategories : fallbackCategories.length > 0 ? 
      fallbackCategories : 
      ['Category 1', 'Category 2', 'Category 3', 'Category 4', 'Category 5'];
    
    switch (chartType) {
      case CHART_TYPES.SCATTER:
        // Generate scatter plot data with actual column names
        mockData = Array.from({ length: 20 }, (_, i) => {
          // Try to use realistic range values for the columns if metadata is available
          const xColInfo = effectiveMetadata?.fields?.find(f => f.name === xAxisColumn);
          const yColInfo = effectiveMetadata?.fields?.find(f => f.name === yAxisColumn);

          const xRange = xColInfo?.type === 'Numeric' ? 
            { min: xColInfo.min || 0, max: xColInfo.max || 100 } : 
            { min: 0, max: 100 };
            
          const yRange = yColInfo?.type === 'Numeric' ? 
            { min: yColInfo.min || 0, max: yColInfo.max || 100 } : 
            { min: 0, max: 100 };

          const point = {
            x: xRange.min + Math.random() * (xRange.max - xRange.min),
            y: yRange.min + Math.random() * (yRange.max - yRange.min),
            xLabel: xAxisColumn,
            yLabel: yAxisColumn
          };
          
          // Add hue value if specified using actual categories
          if (hue) {
            const hueOptions = effectiveMetadata?.fields?.find(f => f.name === hue)?.sample?.split(', ') || 
                              availableCategories;
            point.hue = hueOptions[Math.floor(Math.random() * hueOptions.length)];
            point.hueLabel = hue;
          }
          
          return point;
        });
        break;
        
      case CHART_TYPES.HEATMAP:
        // Generate correlation matrix with actual column names
        mockData = [];
        columns.forEach(col1 => {
          columns.forEach(col2 => {
            // Diagonal should be 1, other values random correlations
            const correlation = col1 === col2 ? 1 : (Math.random() * 2 - 1);
            mockData.push({
              column1: col1,
              column2: col2,
              correlation: correlation.toFixed(2)
            });
          });
        });
        break;
        
      default:
        // Generate mock data for bar/line/area charts
        // Use specified x-axis column or 'category' as default
        const categoryKey = xAxis || 'category';
        
        // If using a real column for categories, try to use its actual values
        const categorySource = xAxis ? 
                              effectiveMetadata?.fields?.find(f => f.name === xAxis) : null;
        
        const categoryValues = categorySource?.sample?.split(', ') || availableCategories;
        
        // Limit to reasonable number of categories
        const usedCategories = categoryValues.slice(0, 10);
        
        mockData = usedCategories.map((category, i) => {
          const point = { [categoryKey]: category };
          
          // Add data for each column with realistic values
          columns.forEach(col => {
            if (col !== xAxis) {
              const colInfo = effectiveMetadata?.fields?.find(f => f.name === col);
              
              let value;
              if (colInfo?.type === 'Numeric') {
                // Generate values in a sensible range for this column
                const min = colInfo.min || 0;
                const max = colInfo.max || 100;
                value = min + Math.random() * (max - min);
                
                // Round appropriately based on column characteristics
                if (col.toLowerCase().includes('price') || 
                    col.toLowerCase().includes('cost') || 
                    col.toLowerCase().includes('revenue') || 
                    col.toLowerCase().includes('profit')) {
                  value = parseFloat(value.toFixed(2));
                } else {
                  value = Math.round(value);
                }
              } else {
                // For non-numeric columns, just use a random number for visualization
                value = Math.floor(Math.random() * 100);
              }
              
              point[col] = value;
            }
          });
          
          // Add hue data if specified using actual categories
          if (hue && !columns.includes(hue)) {
            const hueOptions = effectiveMetadata?.fields?.find(f => f.name === hue)?.sample?.split(', ') || 
                              availableCategories;
            point[hue] = hueOptions[Math.floor(Math.random() * Math.min(3, hueOptions.length))];
          }
          
          return point;
        });
    }
    
    setVisualizationData(mockData);
  };

  // Add a ComparativeChartSelector component
  const ComparativeChartSelector = () => {
    if (selectedVisualization !== 'comparative') return null;
    
    const chartOptions = [
      { id: CHART_TYPES.BAR, name: 'Bar Chart', icon: ChartBarIcon },
      { id: CHART_TYPES.LINE, name: 'Line Chart', icon: Square3Stack3DIcon },
      { id: CHART_TYPES.SCATTER, name: 'Scatter Plot', icon: ArrowsPointingOutIcon },
      { id: CHART_TYPES.AREA, name: 'Area Chart', icon: ViewColumnsIcon },
      { id: CHART_TYPES.HEATMAP, name: 'Correlation Heatmap', icon: TableCellsIcon }
    ];
    
    return (
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Chart Type</h3>
        <div className="grid grid-cols-5 gap-2">
          {chartOptions.map(option => (
            <button
              key={option.id}
              onClick={() => setCompareChartType(option.id)}
              className={`p-2 rounded-lg border flex flex-col items-center justify-center ${
                compareChartType === option.id
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-gray-50'
              }`}
            >
              <option.icon className="h-5 w-5 mb-1" />
              <span className="text-xs">{option.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Add axis controls for comparative visualization
  const AxisControls = () => {
    if (selectedVisualization !== 'comparative' || !effectiveMetadata || !effectiveMetadata.fields) return null;
    
    // Get columns from metadata
    const availableColumns = effectiveMetadata.fields.map(field => field.name);
    
    // Reset axis selections if they're no longer valid
    useEffect(() => {
      if (compareChartType === CHART_TYPES.SCATTER) {
        // For scatter plots, ensure we have valid x and y axes
        if (!xAxisColumn || !availableColumns.includes(xAxisColumn)) {
          setXAxisColumn(availableColumns[0] || null);
        }
        if (!yAxisColumn || !availableColumns.includes(yAxisColumn)) {
          setYAxisColumn(availableColumns[1] || availableColumns[0] || null);
        }
      } else if (compareChartType !== CHART_TYPES.HEATMAP) {
        // For other charts, ensure x-axis is valid or null
        if (xAxisColumn && !availableColumns.includes(xAxisColumn)) {
          setXAxisColumn(null);
        }
      }
    }, [compareChartType, availableColumns]);
    
    // For heatmap, we don't need axis controls
    if (compareChartType === CHART_TYPES.HEATMAP) {
      return null;
    }
    
    // For scatter plots
    if (compareChartType === CHART_TYPES.SCATTER) {
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="x-axis" className="block text-sm font-medium text-gray-700 mb-1">
              X-Axis
            </label>
            <select
              id="x-axis"
              value={xAxisColumn || ''}
              onChange={(e) => setXAxisColumn(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Select X-Axis Column</option>
              {availableColumns.map(col => (
                <option key={`x-${col}`} value={col}>{col}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="y-axis" className="block text-sm font-medium text-gray-700 mb-1">
              Y-Axis
            </label>
            <select
              id="y-axis"
              value={yAxisColumn || ''}
              onChange={(e) => setYAxisColumn(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Select Y-Axis Column</option>
              {availableColumns.map(col => (
                <option key={`y-${col}`} value={col}>{col}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="hue" className="block text-sm font-medium text-gray-700 mb-1">
              Color By (Hue)
            </label>
            <select
              id="hue"
              value={hueColumn || ''}
              onChange={(e) => setHueColumn(e.target.value || null)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">No Color Grouping</option>
              {availableColumns.map(col => (
                <option key={`hue-${col}`} value={col}>{col}</option>
              ))}
            </select>
          </div>
        </div>
      );
    }
    
    // For bar, line, area charts
    return (
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="x-axis" className="block text-sm font-medium text-gray-700 mb-1">
            X-Axis (Categories)
          </label>
          <select
            id="x-axis"
            value={xAxisColumn || ''}
            onChange={(e) => setXAxisColumn(e.target.value || null)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="">Auto (bin values)</option>
            {availableColumns.map(col => (
              <option key={`x-${col}`} value={col}>{col}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="hue" className="block text-sm font-medium text-gray-700 mb-1">
            Group By (Series)
          </label>
          <select
            id="hue"
            value={hueColumn || ''}
            onChange={(e) => setHueColumn(e.target.value || null)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="">No Grouping</option>
            {availableColumns.map(col => (
              <option key={`hue-${col}`} value={col}>{col}</option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  // Add a MultiColumnSelector component
  const MultiColumnSelector = () => {
    if (selectedVisualization !== 'comparative' || !effectiveMetadata || !effectiveMetadata.fields) return null;
    
    const toggleColumn = (columnName) => {
      if (selectedColumns.includes(columnName)) {
        setSelectedColumns(selectedColumns.filter(name => name !== columnName));
      } else {
        setSelectedColumns([...selectedColumns, columnName]);
      }
    };
    
    return (
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Select Columns to Compare</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {effectiveMetadata.fields.map((field) => (
            <label
              key={field.name}
              className={`flex items-center p-2 rounded-lg border cursor-pointer hover:bg-gray-50 ${
                selectedColumns.includes(field.name) ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedColumns.includes(field.name)}
                onChange={() => toggleColumn(field.name)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="ml-2 text-sm truncate">{field.name}</div>
            </label>
          ))}
        </div>
      </div>
    );
  };

  const visualizationTypes = [
    {
      id: 'distribution',
      name: 'Distribution Analysis',
      icon: ChartBarIcon,
      description: 'Analyze the distribution of numeric variables',
    },
    {
      id: 'correlation',
      name: 'Correlation Analysis',
      icon: ArrowsPointingOutIcon,
      description: 'Explore relationships between variables',
    },
    {
      id: 'timeseries',
      name: 'Time Series Analysis',
      icon: Square3Stack3DIcon,
      description: 'Analyze temporal patterns in your data',
    },
    {
      id: 'categorical',
      name: 'Categorical Analysis',
      icon: ChartPieIcon,
      description: 'Analyze categorical variable distributions',
    },
    {
      id: 'comparative',
      name: 'Comparative Analysis',
      icon: ViewColumnsIcon,
      description: 'Compare multiple variables side by side',
    }
  ];

  // Get available visualization types based on selected column
  const availableVisualizations = selectedColumn ? getAvailableVisualizations(selectedColumn, effectiveMetadata) : visualizationTypes;

  if (!currentFile && !effectiveMetadata) {
      return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <div className="text-center">
          <ChartBarIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Dataset Detected</h3>
          <p className="text-sm text-gray-500">Please upload a dataset to begin analysis.</p>
          <p className="text-xs text-red-500 mt-2">If you've already uploaded a file, there may be an issue with the file format or the backend connection.</p>
          
          {!isAPIConnected && (
            <div className="mt-4 text-left bg-yellow-50 p-4 rounded-lg border border-yellow-200 max-w-md mx-auto">
              <h4 className="text-sm font-semibold text-yellow-700 mb-2">API Connection Issue Detected</h4>
              <p className="text-xs text-yellow-600 mb-2">
                We couldn't connect to the API backend. This could be because:
              </p>
              <ul className="text-xs text-yellow-600 list-disc pl-5 mb-2">
                <li>The API server is not running</li>
                <li>There's a network connectivity issue</li>
                <li>The API URL is misconfigured</li>
              </ul>
              <button
                onClick={diagnoseAPIEndpoints}
                className="mt-2 px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
              >
                Run Diagnostics
              </button>
          </div>
          )}
          
          {currentSessionId && (
            <div className="mt-6 max-w-md mx-auto">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                <h4 className="text-sm font-semibold text-blue-700 mb-2">Recovery Options</h4>
                <p className="text-xs text-blue-600 mb-3">
                  We detected a session ID ({currentSessionId.substring(0,8)}...) but couldn't load the dataset. You can:
                </p>
                <div className="flex space-x-3 justify-center">
                  <button 
                    onClick={recoverDataset}
                    disabled={isRecovering}
                    className={`px-3 py-2 rounded text-xs font-medium ${
                      isRecovering 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isRecovering ? (
                      <span className="flex items-center">
                        <ArrowPathIcon className="h-3 w-3 mr-1 animate-spin" />
                        Recovering...
                      </span>
                    ) : 'Try to Recover Dataset'}
                  </button>
                  <button 
                    onClick={() => navigate('/')}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200"
                  >
                    Return to Home
                  </button>
          </div>
                {error && (
                  <p className="mt-3 text-xs text-red-600">{error}</p>
                )}
        </div>
        </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Exploratory Data Analysis</h1>
          <p className="text-sm text-gray-500">Analyze and visualize your dataset</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => selectedColumn && loadData(selectedColumn, selectedVisualization)}
            disabled={isLoading || !selectedColumn}
            className={`px-4 py-2 rounded-lg font-medium flex items-center ${
              isLoading || !selectedColumn
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? 
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

      {/* Error Message */}
      <ErrorMessage message={error} onDismiss={() => setError(null)} />
      
      {/* API Diagnostics Results */}
      {apiDiagnostics && (
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
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Column Selection */}
        <div className="col-span-3 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Variables</h2>
            <p className="text-sm text-gray-500">Select variables to analyze</p>
          </div>
          <div className="p-4 space-y-2">
            {effectiveMetadata && effectiveMetadata.fields && effectiveMetadata.fields.map((field) => (
              <label
                key={field.name}
                className={`flex items-center p-2 rounded-lg cursor-pointer hover:bg-gray-50 ${
                  selectedColumn === field.name ? 'bg-blue-50' : ''
                }`}
              >
                <input
                  type="radio"
                  name="column"
                  checked={selectedColumn === field.name}
                  onChange={() => {
                    setSelectedColumn(field.name);
                    // Reset visualization type if not valid for this column
                    const validTypes = getAvailableVisualizations(field.name, effectiveMetadata)
                      .map(t => t.id);
                    if (!validTypes.includes(selectedVisualization)) {
                      setSelectedVisualization(validTypes[0]);
                    }
                  }}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">{field.name}</div>
                  <div className="text-xs text-gray-500">{field.type}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Visualization Area */}
        <div className="col-span-9">
          <div className="grid grid-cols-5 gap-4 mb-6">
            {availableVisualizations.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedVisualization(type.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                  selectedVisualization === type.id
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

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {selectedColumn ? (
              <>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedVisualization === 'correlation' 
                      ? 'Correlation Analysis' 
                      : selectedVisualization === 'comparative'
                      ? 'Comparative Analysis'
                      : `Analysis of ${selectedColumn}`}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {selectedVisualization === 'distribution'
                      ? 'Distribution of values and key statistics'
                      : selectedVisualization === 'correlation'
                      ? 'Relationship between selected variables'
                      : selectedVisualization === 'timeseries'
                      ? 'Temporal patterns and trends'
                      : selectedVisualization === 'comparative'
                      ? 'Compare multiple variables side by side'
                      : 'Distribution of categories'}
                  </p>
                </div>
                
                {/* Add chart type selector for comparative visualization */}
                <ComparativeChartSelector />
                
                {/* Add axis controls for comparative visualization */}
                <AxisControls />
                
                {/* Add multi-column selector for comparative visualization */}
                <MultiColumnSelector />
                
                {renderVisualization()}
                {selectedVisualization !== 'comparative' && renderStatistics()}
              </>
            ) : (
              <div className="text-center py-12">
                <ViewColumnsIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Variable</h3>
                <p className="text-sm text-gray-500">Choose a variable from the left panel to begin analysis</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EDA; 