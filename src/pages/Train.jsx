import { useState } from 'react';
import { SparklesIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

function Train({ currentFile, datasetMetadata }) {
  const [targetColumn, setTargetColumn] = useState('');
  const [selectedModel, setSelectedModel] = useState(null);
  const [trainingResults, setTrainingResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const models = [
    {
      id: 'random_forest',
      name: 'Random Forest',
      description: 'Ensemble learning method for classification and regression',
      icon: '🌳'
    },
    {
      id: 'xgboost',
      name: 'XGBoost',
      description: 'Gradient boosting framework for classification and regression',
      icon: '🚀'
    },
    {
      id: 'lightgbm',
      name: 'LightGBM',
      description: 'Light Gradient Boosting Machine for classification and regression',
      icon: '⚡'
    },
    {
      id: 'neural_network',
      name: 'Neural Network',
      description: 'Deep learning model for complex pattern recognition',
      icon: '🧠'
    }
  ];

  const handleTrain = async () => {
    if (!targetColumn || !selectedModel) return;
    
    setLoading(true);
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock training results
      setTrainingResults({
        accuracy: 0.89,
        f1Score: 0.87,
        rocAuc: 0.92,
        confusionMatrix: [
          [150, 20],
          [15, 115]
        ],
        featureImportance: [
          { feature: 'age', importance: 0.25 },
          { feature: 'salary', importance: 0.35 },
          { feature: 'experience', importance: 0.20 },
          { feature: 'education', importance: 0.20 }
        ]
      });
    } catch (error) {
      console.error('Error training model:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    // Mock download functionality
    alert('Model downloaded successfully!');
  };

  if (!currentFile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please upload a dataset first</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Model Training</h1>
        <p className="mt-2 text-gray-600">Select target variable and train your model</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Target Column</h3>
            <select
              className="dropdown"
              value={targetColumn}
              onChange={(e) => setTargetColumn(e.target.value)}
            >
              <option value="">Select Target Column</option>
              {datasetMetadata?.columns.map(column => (
                <option key={column.name} value={column.name}>
                  {column.name}
                </option>
              ))}
            </select>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Model</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {models.map(model => (
                <div
                  key={model.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors
                    ${selectedModel === model.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-300'
                    }`}
                  onClick={() => setSelectedModel(model.id)}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{model.icon}</span>
                    <div>
                      <h4 className="font-medium text-gray-900">{model.name}</h4>
                      <p className="text-sm text-gray-500">{model.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            className="btn-primary w-full"
            onClick={handleTrain}
            disabled={loading || !targetColumn || !selectedModel}
          >
            {loading ? 'Training...' : 'Train Model'}
          </button>
        </div>

        <div className="space-y-6">
          {trainingResults && (
            <>
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Model Performance</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">Accuracy</p>
                      <p className="text-2xl font-bold text-primary-600">
                        {(trainingResults.accuracy * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">F1 Score</p>
                      <p className="text-2xl font-bold text-primary-600">
                        {(trainingResults.f1Score * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">ROC AUC</p>
                      <p className="text-2xl font-bold text-primary-600">
                        {(trainingResults.rocAuc * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Importance</h3>
                <div className="space-y-2">
                  {trainingResults.featureImportance.map((feature, index) => (
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

              <button
                className="btn-secondary w-full flex items-center justify-center"
                onClick={handleDownload}
              >
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Download Model
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Train; 