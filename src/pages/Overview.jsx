import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import {
  ChartBarIcon,
  TableCellsIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentChartBarIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline';
import ColumnOverview from '../components/ColumnOverview';

function Overview() {
  // Get data from context instead of props
  const { currentFile, datasetMetadata, sampleData } = useContext(AppContext);
  
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [previewType, setPreviewType] = useState('sample'); // 'sample', 'head', 'tail'
  const [previewCount, setPreviewCount] = useState(10);
  const [isLoading, setIsLoading] = useState(false);

  // Validate data on component mount
  useEffect(() => {
    console.log('Overview component mounted with data:', {
      hasFile: !!currentFile,
      hasMetadata: !!datasetMetadata,
      hasSampleData: sampleData && sampleData.length > 0
    });

    if (!currentFile || !datasetMetadata || !sampleData || sampleData.length === 0) {
      console.warn('Missing required data in Overview component');
    }
  }, [currentFile, datasetMetadata, sampleData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Dataset</h3>
          <p className="text-sm text-gray-500">Please wait while we prepare your data.</p>
        </div>
      </div>
    );
  }

  if (!currentFile || !datasetMetadata) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)]">
        <div className="text-center p-4">
          <DocumentChartBarIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Dataset Selected</h3>
          <p className="text-sm text-gray-500 mb-4">Please upload a dataset to view its overview.</p>
          <button 
            onClick={() => navigate('/')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go to Upload Page
          </button>
        </div>
      </div>
    );
  }

  const dataQualityScore = 100 - (parseFloat(datasetMetadata.missingValues) || 0);
  const qualityColor = dataQualityScore >= 90 ? 'green' : dataQualityScore >= 70 ? 'yellow' : 'red';

  const tabs = [
    { id: 'summary', name: 'Summary', icon: DocumentChartBarIcon },
    { id: 'quality', name: 'Data Quality', icon: CheckCircleIcon },
    { id: 'columns', name: 'Column Overview', icon: ViewColumnsIcon },
    { id: 'preview', name: 'Data Preview', icon: TableCellsIcon },
  ];

  const handleColumnClick = (column) => {
    if (!column) return;
    setSelectedColumn(column);
  };

  const handleCloseColumnOverview = () => {
    setSelectedColumn(null);
  };

  // Get data for preview based on current settings
  const getPreviewData = () => {
    if (!sampleData || sampleData.length === 0) return [];
    
    try {
      switch (previewType) {
        case 'head':
          return sampleData.slice(0, previewCount);
        case 'tail':
          return sampleData.slice(-previewCount);
        case 'sample':
        default:
          // Basic random sampling without replacement
          if (sampleData.length <= previewCount) return sampleData;
          const indices = new Set();
          while (indices.size < previewCount) {
            indices.add(Math.floor(Math.random() * sampleData.length));
          }
          return Array.from(indices).map(idx => sampleData[idx]);
      }
    } catch (error) {
      console.error('Error getting preview data:', error);
      return sampleData.slice(0, Math.min(previewCount, sampleData.length));
    }
  };

  // Get available columns
  const getColumns = () => {
    return datasetMetadata?.fields || [];
  };

  // Safe rendering functions
  const renderDataPreview = () => {
    const previewData = getPreviewData();
    
    if (previewData.length === 0) {
      return (
        <div className="p-4 text-center">
          <p className="text-gray-500">No data available for preview</p>
        </div>
      );
    }
    
    // Get all column names from the first row
    const columns = Object.keys(previewData[0] || {});
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {previewData.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {columns.map((column) => (
                  <td key={`${rowIndex}-${column}`} className="px-3 py-2 text-xs text-gray-900 truncate max-w-xs">
                    {row[column] !== undefined && row[column] !== null ? String(row[column]) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">{currentFile.name}</h1>
          <p className="text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-500">Data Quality Score</p>
            <div className="text-xl md:text-2xl font-bold text-gray-900">
              {dataQualityScore.toFixed(1)}%
            </div>
          </div>
          <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full border-4 flex items-center justify-center
            ${qualityColor === 'green' ? 'border-green-500 text-green-500' : 
              qualityColor === 'yellow' ? 'border-yellow-500 text-yellow-500' : 
              'border-red-500 text-red-500'}`}>
            <CheckCircleIcon className="h-6 w-6 md:h-8 md:w-8" />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <TableCellsIcon className="h-5 w-5 md:h-6 md:w-6 text-blue-500" />
            <span className="text-xs font-medium text-gray-500">Columns</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-gray-900">
            {datasetMetadata.totalColumns || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <DocumentChartBarIcon className="h-5 w-5 md:h-6 md:w-6 text-indigo-500" />
            <span className="text-xs font-medium text-gray-500">Rows</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-gray-900">
            {(datasetMetadata.totalRows || 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <ExclamationTriangleIcon className="h-5 w-5 md:h-6 md:w-6 text-yellow-500" />
            <span className="text-xs font-medium text-gray-500">Missing Values</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-gray-900">
            {datasetMetadata.missingValues || '0%'}
          </div>
        </div>
        <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <ClockIcon className="h-5 w-5 md:h-6 md:w-6 text-purple-500" />
            <span className="text-xs font-medium text-gray-500">Size</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-gray-900">
            {datasetMetadata.datasetSize || '0 KB'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex space-x-4 md:space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                group inline-flex items-center py-3 md:py-4 px-1 border-b-2 font-medium text-xs md:text-sm whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <tab.icon className={`
                -ml-0.5 mr-2 h-4 w-4 md:h-5 md:w-5
                ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}
              `} />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-200">
        {activeTab === 'summary' && (
          <div className="p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Dataset Summary</h3>
            <div className="prose max-w-none">
              <p className="text-sm md:text-base text-gray-600">
                This dataset contains information about {(datasetMetadata.totalRows || 0).toLocaleString()} records
                with {datasetMetadata.totalColumns || 0} different attributes. The data quality score is {dataQualityScore.toFixed(1)}%,
                indicating {dataQualityScore >= 90 ? 'excellent' : dataQualityScore >= 70 ? 'good' : 'poor'} data quality.
              </p>
            </div>
            
            <div className="mt-6">
              <h4 className="text-sm md:text-base font-semibold text-gray-900 mb-3">Column Overview</h4>
              <p className="text-xs md:text-sm text-gray-600 mb-4">Click on any column to see detailed analytics.</p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {getColumns().map((field) => (
                  <div
                    key={field.name}
                    onClick={() => handleColumnClick(field)}
                    className="bg-gray-50 hover:bg-gray-100 rounded-lg p-3 border border-gray-200 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {field.type === 'Numeric' ? (
                        <ChartBarIcon className="h-4 w-4 text-blue-500" />
                      ) : field.type === 'DateTime' ? (
                        <ClockIcon className="h-4 w-4 text-purple-500" />
                      ) : (
                        <DocumentChartBarIcon className="h-4 w-4 text-indigo-500" />
                      )}
                      <h5 className="text-xs md:text-sm font-medium text-gray-900 truncate">{field.name}</h5>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{field.type}</span>
                      <span>Missing: {field.missing}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Data Quality Analysis</h3>
            <div className="space-y-3 md:space-y-4">
              {getColumns().map((field) => (
                <div 
                  key={field.name}
                  onClick={() => handleColumnClick(field)} 
                  className="flex flex-col md:flex-row md:items-center justify-between p-3 md:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="mb-2 md:mb-0">
                    <h4 className="font-medium text-gray-900">{field.name}</h4>
                    <p className="text-sm text-gray-500">{field.type}</p>
                  </div>
                  <div className="flex flex-wrap md:items-center gap-4 md:gap-8">
                    <div>
                      <p className="text-xs md:text-sm font-medium text-gray-500">Missing</p>
                      <p className="text-xs md:text-sm font-bold text-gray-900">{field.missing}</p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm font-medium text-gray-500">Unique</p>
                      <p className="text-xs md:text-sm font-bold text-gray-900">{field.unique}</p>
                    </div>
                    <div className="w-full md:w-32">
                      <p className="text-xs md:text-sm font-medium text-gray-500">Sample</p>
                      <p className="text-xs md:text-sm text-gray-900 truncate">{field.sample}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'columns' && (
          <div className="p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Column Overview</h3>
            <p className="text-sm text-gray-500 mb-4">Click on any column to see detailed analytics including distributions, statistics, and smart recommendations.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {getColumns().map((field) => (
                <div
                  key={field.name}
                  onClick={() => handleColumnClick(field)}
                  className="bg-gray-50 hover:bg-gray-100 rounded-lg p-4 border border-gray-200 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 mb-3">
                    {field.type === 'Numeric' ? (
                      <ChartBarIcon className="h-5 w-5 text-blue-500" />
                    ) : field.type === 'DateTime' ? (
                      <ClockIcon className="h-5 w-5 text-purple-500" />
                    ) : (
                      <DocumentChartBarIcon className="h-5 w-5 text-indigo-500" />
                    )}
                    <h4 className="text-sm md:text-base font-medium text-gray-900 truncate">{field.name}</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Type</span>
                      <span className="text-xs font-medium text-gray-900">{field.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Missing</span>
                      <span className="text-xs font-medium text-gray-900">{field.missing}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Unique</span>
                      <span className="text-xs font-medium text-gray-900">{field.unique}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2 md:mb-0">Data Preview</h3>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <label htmlFor="previewType" className="text-sm text-gray-500">View</label>
                  <select
                    id="previewType"
                    className="text-sm border border-gray-300 rounded-md p-1"
                    value={previewType}
                    onChange={(e) => setPreviewType(e.target.value)}
                  >
                    <option value="sample">Random Sample</option>
                    <option value="head">First Rows</option>
                    <option value="tail">Last Rows</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <label htmlFor="previewCount" className="text-sm text-gray-500">Rows</label>
                  <select
                    id="previewCount"
                    className="text-sm border border-gray-300 rounded-md p-1"
                    value={previewCount}
                    onChange={(e) => setPreviewCount(parseInt(e.target.value))}
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </div>
              </div>
            </div>
            
            {renderDataPreview()}
          </div>
        )}
      </div>

      {/* Column Overview Modal */}
      {selectedColumn && (
        <ColumnOverview 
          column={selectedColumn} 
          data={sampleData}
          datasetId={currentFile?.id} 
          onClose={handleCloseColumnOverview} 
        />
      )}
    </div>
  );
}

export default Overview; 