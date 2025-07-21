import { useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Card, Title, BarChart } from '@tremor/react';
import { prepareBarChartData, prepareScatterPlotData, getChartColors } from '../utils/chartHelpers';

function Report({ currentFile, datasetMetadata }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async (format) => {
    setLoading(true);
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      alert(`Report downloaded in ${format.toUpperCase()} format!`);
    } catch (error) {
      console.error('Error downloading report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!currentFile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please upload a dataset first</p>
      </div>
    );
  }

  // Mock data for visualizations
  const distributionData = prepareBarChartData(
    Array.from({ length: 100 }, (_, i) => ({ value: Math.random() * 100 })),
    'index',
    'value'
  );

  // Transform correlation data to work with BarChart instead of HeatMap
  const correlationData = Array.from({ length: 5 }, (_, i) => {
    const featureName = `Feature ${i + 1}`;
    return {
      name: featureName,
      ...Object.fromEntries(
        Array.from({ length: 5 }, (_, j) => [`Feature ${j + 1}`, Math.random()])
      )
    };
  });

  // Transform correlation data for a bar chart
  const correlationBarData = Object.keys(correlationData[0])
    .filter(key => key !== 'name')
    .map(feature => {
      return {
        name: feature,
        value: correlationData.reduce((sum, item) => sum + item[feature], 0) / correlationData.length
      };
    });

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Analysis Report</h1>
        <p className="mt-2 text-gray-600">Review and download your analysis report</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <Title>Dataset Summary</Title>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Total Rows</p>
                <p className="text-2xl font-bold text-primary-600">1,000</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Total Columns</p>
                <p className="text-2xl font-bold text-primary-600">10</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Missing Values</p>
                <p className="text-2xl font-bold text-primary-600">50</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Unique Values</p>
                <p className="text-2xl font-bold text-primary-600">100</p>
              </div>
            </div>
          </Card>

          <Card>
            <Title>Key Visualizations</Title>
            <div className="space-y-6 mt-4">
              <div className="h-64">
                <BarChart
                  data={distributionData}
                  index="name"
                  categories={["value"]}
                  colors={getChartColors(1)}
                  valueFormatter={(number) => number.toFixed(2)}
                  title="Feature Distribution"
                />
              </div>
              <div className="h-64">
                <BarChart
                  data={correlationBarData}
                  index="name"
                  categories={["value"]}
                  colors={["blue"]}
                  valueFormatter={(number) => number.toFixed(2)}
                  title="Feature Correlation"
                />
              </div>
            </div>
          </Card>

          <Card>
            <Title>Model Performance</Title>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Accuracy</p>
                  <p className="text-2xl font-bold text-primary-600">89.0%</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">F1 Score</p>
                  <p className="text-2xl font-bold text-primary-600">87.0%</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Feature Importance</h4>
                <div className="space-y-2">
                  {[
                    { feature: 'age', importance: 0.25 },
                    { feature: 'salary', importance: 0.35 },
                    { feature: 'experience', importance: 0.20 },
                    { feature: 'education', importance: 0.20 }
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-500 h-2 rounded-full"
                          style={{ width: `${feature.importance * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-24">{feature.feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <Title>Download Report</Title>
            <div className="space-y-4 mt-4">
              <button
                className="btn-primary w-full flex items-center justify-center"
                onClick={() => handleDownload('pdf')}
                disabled={loading}
              >
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                {loading ? 'Downloading...' : 'Download PDF'}
              </button>
              <button
                className="btn-secondary w-full flex items-center justify-center"
                onClick={() => handleDownload('html')}
                disabled={loading}
              >
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                {loading ? 'Downloading...' : 'Download HTML'}
              </button>
            </div>
          </Card>

          <Card>
            <Title>Report Sections</Title>
            <div className="space-y-2 mt-4">
              {[
                'Dataset Overview',
                'Data Preprocessing',
                'Exploratory Analysis',
                'Model Selection',
                'Training Results',
                'Conclusions'
              ].map((section, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-2 text-gray-600"
                >
                  <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                  <span>{section}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Report; 