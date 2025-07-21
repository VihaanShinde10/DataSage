import React, { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  ChartPieIcon,
  MinusCircleIcon,
  ArrowsPointingOutIcon,
  XMarkIcon,
  BoltIcon,
  DocumentTextIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, 
  ScatterChart, Scatter, ZAxis,
  ComposedChart, Area, Rectangle
} from 'recharts';
import { datasetApi } from '../api';

const ColumnOverview = ({ column, data = [], onClose, datasetId }) => {
  const [loading, setLoading] = useState(false);
  const [columnStats, setColumnStats] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchColumnStatistics = async () => {
      if (!column || !datasetId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        console.log(`Fetching column statistics for ${column.name} from dataset ${datasetId}`);
        const response = await datasetApi.getColumnStatistics(datasetId, column.name);
        console.log('Column statistics response:', response.data);
        setColumnStats(response.data);
      } catch (err) {
        console.error('Error fetching column statistics:', err);
        setError('Failed to load column statistics. Using sample data for analysis.');
        // Fallback to calculating stats from sample data
        const stats = calculateColumnStats(
          data.map(item => item[column.name]),
          column.type === 'Numeric'
        );
        setColumnStats(stats);
      } finally {
        setLoading(false);
      }
    };
    
    fetchColumnStatistics();
  }, [column, datasetId]);

  if (!column) return null;

  // Safely extract column data from the dataset for chart visualization
  // We still need this for visualization if backend data isn't available
  const columnData = data
    .filter(item => item && typeof item === 'object')
    .map(item => item[column.name]);
  
  const nonNullValues = columnData.filter(val => val !== null && val !== undefined && val !== '');
  const isNumeric = column.type === 'Numeric';

  // Use backend stats if available, otherwise calculate from sample
  const stats = columnStats || calculateColumnStats(columnData, isNumeric);

  // Generate histogram data - use backend data or generate from sample
  const histogramData = columnStats?.histogramData || 
    (isNumeric ? generateHistogramData(columnData) : generateCategoryData(columnData));

  // Safe rendering of numeric values
  const formatNumber = (value, decimals = 2) => {
    if (value === undefined || value === null || isNaN(value)) return '0';
    return typeof value === 'number' ? value.toFixed(decimals) : '0';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Loading column analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        {error && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <p className="text-sm text-yellow-700">{error}</p>
          </div>
        )}
        
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            {isNumeric ? (
              <ChartBarIcon className="h-6 w-6 text-blue-500" />
            ) : (
              <DocumentTextIcon className="h-6 w-6 text-indigo-500" />
            )}
            <h2 className="text-lg font-semibold text-gray-900">{column.name}</h2>
            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
              {column.type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Summary Card */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                <InformationCircleIcon className="h-5 w-5 mr-2 text-blue-500" />
                Summary
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Total Values</span>
                  <span className="text-sm font-medium">{columnData.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Non-null Values</span>
                  <span className="text-sm font-medium">{nonNullValues.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Missing Values</span>
                  <span className="text-sm font-medium">{stats.missing} ({stats.missingPercent}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Unique Values</span>
                  <span className="text-sm font-medium">{stats.unique}</span>
                </div>
                {isNumeric && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Mean</span>
                      <span className="text-sm font-medium">{formatNumber(stats.mean)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Median</span>
                      <span className="text-sm font-medium">{formatNumber(stats.median)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Standard Deviation</span>
                      <span className="text-sm font-medium">{formatNumber(stats.stdDev)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Min</span>
                      <span className="text-sm font-medium">{formatNumber(stats.min)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Max</span>
                      <span className="text-sm font-medium">{formatNumber(stats.max)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Outliers</span>
                      <span className="text-sm font-medium">{stats.outliers} ({stats.outliersPercent}%)</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Distribution Chart */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col">
              <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                <ChartBarIcon className="h-5 w-5 mr-2 text-blue-500" />
                {isNumeric ? 'Value Distribution' : 'Category Distribution'}
              </h3>
              <div className="flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  {isNumeric ? (
                    histogramData.length > 0 ? (
                      <ComposedChart data={histogramData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="bin" />
                        <YAxis />
                        <YAxis yAxisId={1} orientation="right" domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" fill="#3b82f6" name="Count" />
                        <Line type="monotone" dataKey="cumulativePercent" stroke="#8884d8" name="Cumulative %" yAxisId={1} />
                      </ComposedChart>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        No data available for visualization
                      </div>
                    )
                  ) : (
                    histogramData.length > 0 ? (
                      <BarChart data={histogramData} layout="vertical" margin={{ left: 70 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="category" width={70} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" fill="#3b82f6" name="Count" />
                      </BarChart>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        No data available for visualization
                      </div>
                    )
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Smart Recommendations */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                <BoltIcon className="h-5 w-5 mr-2 text-yellow-500" />
                Smart Recommendations
              </h3>
              <ul className="space-y-2">
                {generateRecommendations(stats, isNumeric, columnData).map((rec, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span className="text-sm text-gray-700">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Additional Charts */}
            {isNumeric ? (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col">
                <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                  <ArrowsPointingOutIcon className="h-5 w-5 mr-2 text-green-500" />
                  Box Plot
                </h3>
                <div className="flex-1 min-h-[200px]">
                  {stats.min !== stats.max ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart 
                        layout="vertical"
                        data={[{
                          min: stats.min,
                          q1: stats.q1,
                          median: stats.median,
                          q3: stats.q3,
                          max: stats.max,
                          name: column.name
                        }]}
                        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          type="number" 
                          domain={[
                            stats.min - Math.max(0.1, stats.range * 0.1), 
                            stats.max + Math.max(0.1, stats.range * 0.1)
                          ]} 
                        />
                        <YAxis dataKey="name" type="category" />
                        <Tooltip formatter={(value) => formatNumber(value)} />
                        <defs>
                          <linearGradient id="colorUv" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          </linearGradient>
                        </defs>
                        <Area 
                          dataKey="min" 
                          stroke="none" 
                          fill="none" 
                          isAnimationActive={false}
                        />
                        <Area 
                          dataKey="max" 
                          stroke="none" 
                          fill="none" 
                          isAnimationActive={false} 
                        />
                        <Bar
                          dataKey="max"
                          fill="url(#colorUv)"
                          minPointSize={5}
                          barSize={30}
                          shape={
                            <CustomBoxPlot />
                          }
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      Cannot create boxplot: all values are identical
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col">
                <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                  <ChartPieIcon className="h-5 w-5 mr-2 text-green-500" />
                  Proportion Overview
                </h3>
                <div className="flex-1 min-h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {histogramData.length > 0 ? (
                      <PieChart>
                        <Pie
                          data={histogramData.slice(0, 5)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name || 'Unknown'} (${((percent || 0) * 100).toFixed(0)}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                          nameKey="category"
                        >
                          {histogramData.slice(0, 5).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        No data available for visualization
                      </div>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper components
const CustomBoxPlot = (props) => {
  const { x, y, width, height, payload } = props;
  
  // If no payload data, return empty
  if (!payload) return null;
  
  // Extract boxplot values
  const { min, q1, median, q3, max } = payload;
  
  // Safety check - if any values are NaN or undefined, return empty
  if ([min, q1, median, q3, max].some(val => val === undefined || val === null || isNaN(val))) {
    return null;
  }
  
  // If min equals max, draw a simple line
  if (min === max) {
    return (
      <g>
        <line 
          x1={x} 
          y1={y + height/2} 
          x2={x + width} 
          y2={y + height/2} 
          stroke="#000" 
        />
        <line 
          x1={x + width/2} 
          y1={y + height/4} 
          x2={x + width/2} 
          y2={y + height*3/4} 
          stroke="#000" 
          strokeWidth={2} 
        />
      </g>
    );
  }
  
  // Calculate positions
  const xMin = x + (min - min) / (max - min) * width;
  const xQ1 = x + (q1 - min) / (max - min) * width;
  const xMedian = x + (median - min) / (max - min) * width;
  const xQ3 = x + (q3 - min) / (max - min) * width;
  const xMax = x + (max - min) / (max - min) * width;
  
  return (
    <g>
      {/* Whiskers */}
      <line x1={xMin} y1={y + height/2} x2={xQ1} y2={y + height/2} stroke="#000" />
      <line x1={xQ3} y1={y + height/2} x2={xMax} y2={y + height/2} stroke="#000" />
      <line x1={xMin} y1={y + height/2 - 10} x2={xMin} y2={y + height/2 + 10} stroke="#000" />
      <line x1={xMax} y1={y + height/2 - 10} x2={xMax} y2={y + height/2 + 10} stroke="#000" />
      
      {/* Box */}
      <rect 
        x={xQ1} 
        y={y + height/4} 
        width={Math.max(1, xQ3 - xQ1)} 
        height={height/2} 
        fill="url(#colorUv)" 
        stroke="#000" 
      />
      
      {/* Median */}
      <line 
        x1={xMedian} 
        y1={y + height/4} 
        x2={xMedian} 
        y2={y + height/4 + height/2} 
        stroke="#000" 
        strokeWidth={2} 
      />
    </g>
  );
};

// Constants
const COLORS = ['#4f46e5', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#38bdf8', '#0ea5e9'];

// Helper functions
const calculateColumnStats = (columnData, isNumeric) => {
  // Handle empty array case
  if (!columnData || columnData.length === 0) {
    return {
      missing: 0,
      missingPercent: "0.0",
      unique: 0,
      mean: 0,
      median: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      min: 0,
      max: 0,
      range: 0,
      stdDev: 0,
      outliers: 0,
      outliersPercent: "0.0"
    };
  }

  const nonNullValues = columnData.filter(val => val !== null && val !== undefined && val !== '');
  const missing = columnData.length - nonNullValues.length;
  const missingPercent = columnData.length > 0 ? ((missing / columnData.length) * 100).toFixed(1) : "0.0";
  const uniqueValues = new Set(nonNullValues);
  
  if (isNumeric) {
    const numericValues = nonNullValues
      .map(v => typeof v === 'string' ? parseFloat(v) : v)
      .filter(v => !isNaN(v));
    
    // Handle empty numeric array
    if (numericValues.length === 0) {
      return {
        missing,
        missingPercent,
        unique: uniqueValues.size,
        mean: 0,
        median: 0,
        q1: 0,
        q3: 0,
        iqr: 0,
        min: 0,
        max: 0,
        range: 0,
        stdDev: 0,
        outliers: 0,
        outliersPercent: "0.0"
      };
    }
    
    // Sort the values for calculations
    const sortedValues = [...numericValues].sort((a, b) => a - b);
    const len = sortedValues.length;
    
    // Calculate quartiles safely
    const q1 = sortedValues[Math.floor(len * 0.25)] || 0;
    const median = len % 2 === 0 
      ? ((sortedValues[len/2 - 1] || 0) + (sortedValues[len/2] || 0)) / 2 
      : sortedValues[Math.floor(len/2)] || 0;
    const q3 = sortedValues[Math.floor(len * 0.75)] || 0;
    const iqr = q3 - q1;
    
    // Get min, max, and range
    const min = sortedValues[0];
    const max = sortedValues[len - 1];
    const range = max - min;
    
    // Calculate outlier bounds
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    // Count outliers
    const outliers = numericValues.filter(v => v < lowerBound || v > upperBound).length;
    const outliersPercent = numericValues.length > 0 
      ? ((outliers / numericValues.length) * 100).toFixed(1) 
      : "0.0";
    
    // Calculate mean and standard deviation
    const sum = numericValues.reduce((acc, val) => acc + val, 0);
    const mean = numericValues.length > 0 ? sum / numericValues.length : 0;
    
    // Calculate variance and std dev safely
    let stdDev = 0;
    if (numericValues.length > 1) {
      const variance = numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numericValues.length;
      stdDev = Math.sqrt(variance);
    }
    
    return {
      missing,
      missingPercent,
      unique: uniqueValues.size,
      mean,
      median,
      q1,
      q3,
      iqr,
      min,
      max,
      range,
      stdDev,
      outliers,
      outliersPercent
    };
  } else {
    // Categorical stats
    const valueCounts = {};
    nonNullValues.forEach(val => {
      const strVal = String(val);
      valueCounts[strVal] = (valueCounts[strVal] || 0) + 1;
    });
    
    // Get most frequent
    let mostFrequentValue = '';
    let maxCount = 0;
    
    Object.entries(valueCounts).forEach(([value, count]) => {
      if (count > maxCount) {
        mostFrequentValue = value;
        maxCount = count;
      }
    });
    
    return {
      missing,
      missingPercent,
      unique: uniqueValues.size,
      mostFrequent: mostFrequentValue,
      mostFrequentCount: maxCount,
      mostFrequentPercent: nonNullValues.length > 0 
        ? ((maxCount / nonNullValues.length) * 100).toFixed(1) 
        : "0.0"
    };
  }
};

const generateHistogramData = (columnData) => {
  if (!columnData || columnData.length === 0) {
    return [];
  }
  
  // Filter out non-numeric values
  const numericValues = columnData
    .filter(val => val !== null && val !== undefined && val !== '')
    .map(v => typeof v === 'string' ? parseFloat(v) : v)
    .filter(v => !isNaN(v));
  
  if (numericValues.length === 0) {
    return [];
  }
  
  // Determine number of bins (Sturges' rule)
  const numBins = Math.max(5, Math.ceil(1 + 3.322 * Math.log10(numericValues.length)));
  
  // Calculate bin width
  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);
  
  // Handle case where all values are the same
  if (min === max) {
    return [{
      bin: min.toFixed(2),
      count: numericValues.length,
      cumulativePercent: 100
    }];
  }
  
  const binWidth = (max - min) / numBins;
  
  // Create bins
  const bins = Array(numBins).fill().map((_, i) => {
    const binStart = min + i * binWidth;
    const binEnd = min + (i + 1) * binWidth;
    return {
      binStart,
      binEnd,
      count: 0
    };
  });
  
  // Count values in each bin
  numericValues.forEach(val => {
    // Special case for max value
    if (val === max) {
      bins[bins.length - 1].count++;
      return;
    }
    
    const binIndex = Math.floor((val - min) / binWidth);
    if (binIndex >= 0 && binIndex < bins.length) {
      bins[binIndex].count++;
    }
  });
  
  // Create histogram data with cumulative percentages
  let cumulativeCount = 0;
  const totalCount = numericValues.length;
  
  return bins.map(bin => {
    cumulativeCount += bin.count;
    const cumulativePercent = (cumulativeCount / totalCount) * 100;
    
    return {
      bin: `${bin.binStart.toFixed(1)} - ${bin.binEnd.toFixed(1)}`,
      count: bin.count,
      cumulativePercent: parseFloat(cumulativePercent.toFixed(1))
    };
  });
};

const generateCategoryData = (columnData) => {
  if (!columnData || columnData.length === 0) {
    return [];
  }
  
  // Filter out null values
  const validValues = columnData.filter(val => val !== null && val !== undefined && val !== '');
  
  if (validValues.length === 0) {
    return [];
  }
  
  // Count occurrences of each value
  const valueCounts = {};
  validValues.forEach(val => {
    const strVal = String(val);
    valueCounts[strVal] = (valueCounts[strVal] || 0) + 1;
  });
  
  // Convert to array and sort by count (descending)
  let result = Object.entries(valueCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  
  // Limit to top 10 categories
  if (result.length > 10) {
    const otherCount = result.slice(10).reduce((sum, item) => sum + item.count, 0);
    result = result.slice(0, 10);
    if (otherCount > 0) {
      result.push({ category: 'Other', count: otherCount });
    }
  }
  
  return result;
};

const generateRecommendations = (stats, isNumeric, columnData = []) => {
  const recommendations = [];
  
  if (!stats) {
    return ["Insufficient data to provide recommendations."];
  }
  
  // Add missing value recommendations
  if (stats.missingPercent > 0) {
    if (stats.missingPercent > 20) {
      recommendations.push(`High percentage of missing values (${stats.missingPercent}%) - consider imputation techniques or dropping the column.`);
    } else if (stats.missingPercent > 5) {
      recommendations.push(`Moderate missing values (${stats.missingPercent}%) - consider filling with mean/median/mode.`);
    }
  }
  
  if (isNumeric) {
    // Add recommendations for numerical columns
    if (stats.outliers && stats.outliersPercent) {
      if (parseFloat(stats.outliersPercent) > 10) {
        recommendations.push(`High percentage of outliers (${stats.outliersPercent}%) detected - consider removing or capping outliers.`);
      } else if (parseFloat(stats.outliersPercent) > 0) {
        recommendations.push(`Some outliers detected (${stats.outliersPercent}%) - check if they represent valid data points.`);
      }
    }
    
    // Safe checks for skewness detection
    if (stats.mean !== undefined && stats.median !== undefined && stats.stdDev !== undefined && stats.stdDev > 0) {
      // Skewness detection (approximation)
      const skewIndication = Math.abs(stats.mean - stats.median) / stats.stdDev;
      if (skewIndication > 0.5) {
        recommendations.push(`Data appears to be skewed (mean and median differ significantly) - consider log transformation or other normalizing transformations.`);
      }
      
      // Check variance
      if (stats.mean !== 0 && stats.stdDev / Math.abs(stats.mean) > 1) {
        recommendations.push(`High variance detected - consider standardization or normalization before modeling.`);
      }
    }
  } else {
    // Add recommendations for categorical columns
    if (stats.unique > 100) {
      recommendations.push(`High cardinality (${stats.unique} unique values) - consider grouping less frequent categories.`);
    } else if (stats.unique === 1) {
      recommendations.push(`Only one unique value detected - this column has no variability and might not be useful for analysis.`);
    }
    
    if (columnData && columnData.length > 0 && stats.unique / columnData.length > 0.9) {
      recommendations.push(`Almost every value is unique - this might be an ID column or contain free text.`);
    }
  }
  
  // Add a general recommendation if no specific ones were generated
  if (recommendations.length === 0) {
    recommendations.push(`This column appears to be in good shape for analysis.`);
  }
  
  return recommendations;
};

export default ColumnOverview; 