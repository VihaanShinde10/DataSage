// Application configuration constants

export const FILE_TYPES = {
  CSV: {
    id: 'CSV',
    mimeType: 'text/csv',
    maxSize: 10 * 1024 * 1024, // 10MB
    description: 'Comma-separated values'
  },
  EXCEL: {
    id: 'EXCEL',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    maxSize: 20 * 1024 * 1024, // 20MB
    description: 'Microsoft Excel files'
  },
  JSON: {
    id: 'JSON',
    mimeType: 'application/json',
    maxSize: 10 * 1024 * 1024, // 10MB
    description: 'JavaScript Object Notation'
  }
};

export const DATA_TYPES = {
  NUMERIC: 'Numeric',
  CATEGORICAL: 'Categorical',
  DATETIME: 'DateTime',
  BOOLEAN: 'Boolean',
};

export const CHART_TYPES = {
  BAR: 'bar',
  LINE: 'line',
  PIE: 'pie',
  SCATTER: 'scatter',
  HEATMAP: 'heatmap',
};

export const PREPROCESSING_OPERATIONS = {
  CLEAN: {
    id: 'clean',
    name: 'Clean Data',
    operations: [
      { id: 'fill_mean', name: 'Fill with Mean', applicable: ['Numeric'] },
      { id: 'fill_median', name: 'Fill with Median', applicable: ['Numeric'] },
      { id: 'fill_mode', name: 'Fill with Mode', applicable: ['Categorical', 'Numeric'] },
      { id: 'fill_constant', name: 'Fill with Constant', applicable: ['Categorical', 'Numeric', 'DateTime'] },
      { id: 'drop_missing', name: 'Drop Missing Values', applicable: ['Categorical', 'Numeric', 'DateTime'] },
    ],
  },
  TRANSFORM: {
    id: 'transform',
    name: 'Transform',
    operations: [
      { id: 'normalize', name: 'Normalize', applicable: ['Numeric'] },
      { id: 'standardize', name: 'Standardize', applicable: ['Numeric'] },
      { id: 'log_transform', name: 'Log Transform', applicable: ['Numeric'] },
      { id: 'bin', name: 'Binning', applicable: ['Numeric'] },
    ],
  },
  ENCODE: {
    id: 'encode',
    name: 'Encode',
    operations: [
      { id: 'one_hot', name: 'One-Hot Encoding', applicable: ['Categorical'] },
      { id: 'label', name: 'Label Encoding', applicable: ['Categorical'] },
      { id: 'ordinal', name: 'Ordinal Encoding', applicable: ['Categorical'] },
    ],
  },
};

export const ML_MODELS = {
  CLASSIFICATION: [
    {
      id: 'random_forest',
      name: 'Random Forest',
      description: 'Ensemble learning method for classification',
      parameters: {
        n_estimators: { type: 'number', default: 100, min: 10, max: 1000 },
        max_depth: { type: 'number', default: null, min: 1, max: 100 },
        min_samples_split: { type: 'number', default: 2, min: 1, max: 20 },
      },
    },
    {
      id: 'xgboost',
      name: 'XGBoost',
      description: 'Gradient boosting framework',
      parameters: {
        n_estimators: { type: 'number', default: 100, min: 10, max: 1000 },
        max_depth: { type: 'number', default: 3, min: 1, max: 20 },
        learning_rate: { type: 'number', default: 0.1, min: 0.01, max: 1 },
      },
    },
  ],
  REGRESSION: [
    {
      id: 'linear_regression',
      name: 'Linear Regression',
      description: 'Linear model for regression',
      parameters: {
        fit_intercept: { type: 'boolean', default: true },
      },
    },
    {
      id: 'ridge_regression',
      name: 'Ridge Regression',
      description: 'L2 regularization for regression',
      parameters: {
        alpha: { type: 'number', default: 1.0, min: 0.1, max: 10 },
      },
    },
  ],
};

export const CHART_COLORS = {
  primary: [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
    '#82CA9D', '#FFC658', '#FF7C43', '#A4DE6C', '#D0ED57'
  ],
  secondary: [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
    '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71'
  ],
};

export const ERROR_MESSAGES = {
  FILE_UPLOAD: {
    INVALID_TYPE: 'Invalid file type. Please upload a CSV, Excel, or JSON file.',
    TOO_LARGE: 'File is too large. Maximum size allowed is 20MB.',
    INVALID_STRUCTURE: 'Invalid file structure. Please check your file format.',
    EMPTY_FILE: 'The file appears to be empty.',
    NO_HEADERS: 'No headers found in the CSV file.',
    PROCESSING_ERROR: 'Error processing the file. Please try again.'
  },
  DATA_PROCESSING: {
    INVALID_DATA: 'Invalid data format.',
    MISSING_REQUIRED: 'Missing required fields.',
    TYPE_MISMATCH: 'Data type mismatch in one or more columns.'
  },
  MODEL_TRAINING: {
    INSUFFICIENT_DATA: 'Not enough data for training.',
    INVALID_FEATURES: 'Invalid feature selection.',
    TRAINING_FAILED: 'Model training failed. Please try again.',
  },
}; 