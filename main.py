from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename
import pandas as pd
import numpy as np
from sklearn.impute import KNNImputer, IterativeImputer
from sklearn.preprocessing import (
    LabelEncoder, OneHotEncoder, StandardScaler, 
    MinMaxScaler, RobustScaler, PowerTransformer
)
from sklearn.feature_selection import VarianceThreshold, RFE, mutual_info_classif
from sklearn.ensemble import IsolationForest
import logging
from pathlib import Path
import json
from datetime import datetime
import io
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure upload directory exists
Path(app.config['UPLOAD_FOLDER']).mkdir(parents=True, exist_ok=True)

class DataPreprocessor:
    def __init__(self):
        self.data = None
        self.original_data = None
        self.preprocessing_steps = []
        
    def load_data(self, file_path, encoding='utf-8'):
        """Load CSV data with specified encoding"""
        try:
            self.data = pd.read_csv(file_path, encoding=encoding)
            self.original_data = self.data.copy()
            self.preprocessing_steps.append({
                'step': 'data_loading',
                'timestamp': datetime.now().isoformat(),
                'details': f'Loaded CSV with shape {self.data.shape}'
            })
            return True
        except Exception as e:
            logger.error(f"Error loading data: {str(e)}")
            return False

    def handle_missing_values(self, strategy, columns=None):
        """Handle missing values using specified strategy"""
        try:
            if columns is None:
                columns = self.data.columns

            if strategy == 'drop':
                self.data = self.data.dropna(subset=columns)
            elif strategy in ['mean', 'median', 'mode']:
                for col in columns:
                    if self.data[col].dtype in ['int64', 'float64']:
                        if strategy == 'mean':
                            self.data[col].fillna(self.data[col].mean(), inplace=True)
                        elif strategy == 'median':
                            self.data[col].fillna(self.data[col].median(), inplace=True)
                    elif strategy == 'mode':
                        self.data[col].fillna(self.data[col].mode()[0], inplace=True)
            elif strategy == 'knn':
                imputer = KNNImputer(n_neighbors=5)
                self.data[columns] = imputer.fit_transform(self.data[columns])
            
            self.preprocessing_steps.append({
                'step': 'missing_value_handling',
                'strategy': strategy,
                'columns': columns,
                'timestamp': datetime.now().isoformat()
            })
            return True
        except Exception as e:
            logger.error(f"Error handling missing values: {str(e)}")
            return False

    def encode_categorical(self, encoding_type, columns):
        """Encode categorical variables"""
        try:
            if encoding_type == 'label':
                for col in columns:
                    le = LabelEncoder()
                    self.data[col] = le.fit_transform(self.data[col])
            elif encoding_type == 'onehot':
                encoder = OneHotEncoder(sparse=False, handle_unknown='ignore')
                encoded = encoder.fit_transform(self.data[columns])
                encoded_df = pd.DataFrame(
                    encoded,
                    columns=encoder.get_feature_names_out(columns)
                )
                self.data = pd.concat(
                    [self.data.drop(columns, axis=1), encoded_df],
                    axis=1
                )
            
            self.preprocessing_steps.append({
                'step': 'categorical_encoding',
                'encoding_type': encoding_type,
                'columns': columns,
                'timestamp': datetime.now().isoformat()
            })
            return True
        except Exception as e:
            logger.error(f"Error encoding categorical variables: {str(e)}")
            return False

    def scale_features(self, scaling_type, columns):
        """Scale numerical features"""
        try:
            if scaling_type == 'standard':
                scaler = StandardScaler()
            elif scaling_type == 'minmax':
                scaler = MinMaxScaler()
            elif scaling_type == 'robust':
                scaler = RobustScaler()
            elif scaling_type == 'power':
                scaler = PowerTransformer()
            
            self.data[columns] = scaler.fit_transform(self.data[columns])
            
            self.preprocessing_steps.append({
                'step': 'feature_scaling',
                'scaling_type': scaling_type,
                'columns': columns,
                'timestamp': datetime.now().isoformat()
            })
            return True
        except Exception as e:
            logger.error(f"Error scaling features: {str(e)}")
            return False

    def detect_outliers(self, method, columns, threshold=3):
        """Detect and remove outliers"""
        try:
            if method == 'zscore':
                z_scores = np.abs((self.data[columns] - self.data[columns].mean()) / 
                                self.data[columns].std())
                self.data = self.data[(z_scores < threshold).all(axis=1)]
            elif method == 'iqr':
                Q1 = self.data[columns].quantile(0.25)
                Q3 = self.data[columns].quantile(0.75)
                IQR = Q3 - Q1
                self.data = self.data[~((self.data[columns] < (Q1 - 1.5 * IQR)) | 
                                      (self.data[columns] > (Q3 + 1.5 * IQR))).any(axis=1)]
            elif method == 'isolation_forest':
                iso_forest = IsolationForest(contamination=0.1, random_state=42)
                outliers = iso_forest.fit_predict(self.data[columns])
                self.data = self.data[outliers == 1]
            
            self.preprocessing_steps.append({
                'step': 'outlier_detection',
                'method': method,
                'columns': columns,
                'threshold': threshold,
                'timestamp': datetime.now().isoformat()
            })
            return True
        except Exception as e:
            logger.error(f"Error detecting outliers: {str(e)}")
            return False

    def generate_report(self):
        """Generate preprocessing report"""
        return {
            'original_shape': self.original_data.shape,
            'processed_shape': self.data.shape,
            'preprocessing_steps': self.preprocessing_steps,
            'missing_values_summary': self.data.isnull().sum().to_dict(),
            'column_types': self.data.dtypes.astype(str).to_dict()
        }

preprocessor = DataPreprocessor()

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'Only CSV files are supported'}), 400
    
    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        encoding = request.form.get('encoding', 'utf-8')
        if preprocessor.load_data(filepath, encoding):
            return jsonify({
                'message': 'File uploaded successfully',
                'shape': preprocessor.data.shape,
                'columns': preprocessor.data.columns.tolist()
            })
        else:
            return jsonify({'error': 'Error loading file'}), 500
    except Exception as e:
        logger.error(f"Error in upload: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/process', methods=['POST'])
def process_data():
    if preprocessor.data is None:
        return jsonify({'error': 'No data loaded'}), 400
    
    try:
        config = request.json
        
        # Handle missing values
        if 'missing_values' in config:
            preprocessor.handle_missing_values(
                config['missing_values']['strategy'],
                config['missing_values'].get('columns')
            )
        
        # Encode categorical variables
        if 'categorical_encoding' in config:
            preprocessor.encode_categorical(
                config['categorical_encoding']['method'],
                config['categorical_encoding']['columns']
            )
        
        # Scale features
        if 'scaling' in config:
            preprocessor.scale_features(
                config['scaling']['method'],
                config['scaling']['columns']
            )
        
        # Detect outliers
        if 'outliers' in config:
            preprocessor.detect_outliers(
                config['outliers']['method'],
                config['outliers']['columns'],
                config['outliers'].get('threshold', 3)
            )
        
        return jsonify({
            'message': 'Processing completed',
            'report': preprocessor.generate_report()
        })
    except Exception as e:
        logger.error(f"Error in processing: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/download', methods=['GET'])
def download_processed():
    if preprocessor.data is None:
        return jsonify({'error': 'No processed data available'}), 400
    
    try:
        output = io.StringIO()
        preprocessor.data.to_csv(output, index=False)
        output.seek(0)
        
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/csv',
            as_attachment=True,
            download_name='processed_data.csv'
        )
    except Exception as e:
        logger.error(f"Error in download: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)