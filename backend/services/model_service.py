import pandas as pd
import numpy as np
import pickle
import os
import json
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, LinearRegression
import xgboost as xgb
from sklearn.preprocessing import LabelEncoder
import logging
import matplotlib.pyplot as plt
import seaborn as sns
from io import BytesIO
import base64
import joblib
from backend.config.settings import MODELS_FOLDER
from backend.services.session_service import get_session_data
from datetime import datetime
from typing import Dict, List, Any, Tuple, Optional, Union
from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier

logger = logging.getLogger('datasage')

# Define supported models
CLASSIFICATION_MODELS = {
    'random_forest': RandomForestClassifier,
    'logistic_regression': LogisticRegression,
    'xgboost': xgb.XGBClassifier
}

REGRESSION_MODELS = {
    'random_forest': RandomForestRegressor,
    'linear_regression': LinearRegression,
    'xgboost': xgb.XGBRegressor
}

def preprocess_for_training(df, target_column, categorical_columns=None, drop_columns=None):
    """
    Preprocess data for model training
    
    Args:
        df (pd.DataFrame): Input DataFrame
        target_column (str): Target column name
        categorical_columns (list): List of categorical columns to encode
        drop_columns (list): List of columns to drop
    
    Returns:
        dict: Dictionary with preprocessed data and metadata
    """
    try:
        # Make a copy of the DataFrame
        data = df.copy()
        
        # Drop specified columns
        if drop_columns:
            data = data.drop(columns=[col for col in drop_columns if col in data.columns])
        
        # Check if target column exists
        if target_column not in data.columns:
            raise ValueError(f"Target column '{target_column}' not found in dataset")
        
        # Extract target variable
        y = data[target_column]
        X = data.drop(columns=[target_column])
        
        # Identify categorical columns if not provided
        if categorical_columns is None:
            categorical_columns = X.select_dtypes(include=['object', 'category']).columns.tolist()
        
        # Encode categorical variables
        encoders = {}
        for col in categorical_columns:
            if col in X.columns:
                le = LabelEncoder()
                X[col] = le.fit_transform(X[col].astype(str))
                encoders[col] = le
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Determine problem type (classification or regression)
        if pd.api.types.is_numeric_dtype(y):
            unique_values = y.nunique()
            if unique_values <= 10:  # Arbitrary threshold for determining classification
                problem_type = 'classification'
                # Check if binary or multiclass
                is_binary = unique_values <= 2
            else:
                problem_type = 'regression'
                is_binary = False
        else:
            problem_type = 'classification'
            # Encode target if it's categorical
            le = LabelEncoder()
            y_train = le.fit_transform(y_train.astype(str))
            y_test = le.transform(y_test.astype(str))
            encoders['target'] = le
            is_binary = len(le.classes_) <= 2
        
        return {
            'X_train': X_train,
            'X_test': X_test,
            'y_train': y_train,
            'y_test': y_test,
            'feature_names': X.columns.tolist(),
            'problem_type': problem_type,
            'is_binary': is_binary,
            'encoders': encoders
        }
    
    except Exception as e:
        logger.error(f"Error preprocessing data: {str(e)}")
        raise

def train_model(preprocessed_data, model_type, hyperparameters=None):
    """
    Train a machine learning model
    
    Args:
        preprocessed_data (dict): Preprocessed data from preprocess_for_training
        model_type (str): Type of model to train
        hyperparameters (dict): Model hyperparameters
    
    Returns:
        dict: Training results including model and evaluation metrics
    """
    try:
        X_train = preprocessed_data['X_train']
        X_test = preprocessed_data['X_test']
        y_train = preprocessed_data['y_train']
        y_test = preprocessed_data['y_test']
        problem_type = preprocessed_data['problem_type']
        is_binary = preprocessed_data['is_binary']
        
        # Select model based on problem type
        if problem_type == 'classification':
            if model_type not in CLASSIFICATION_MODELS:
                raise ValueError(f"Model type '{model_type}' not supported for classification")
            model_class = CLASSIFICATION_MODELS[model_type]
        else:  # regression
            if model_type not in REGRESSION_MODELS:
                raise ValueError(f"Model type '{model_type}' not supported for regression")
            model_class = REGRESSION_MODELS[model_type]
        
        # Initialize model with hyperparameters
        if hyperparameters:
            model = model_class(**hyperparameters)
        else:
            model = model_class()
        
        # Train model
        model.fit(X_train, y_train)
        
        # Evaluate model
        train_predictions = model.predict(X_train)
        test_predictions = model.predict(X_test)
        
        # Calculate metrics
        if problem_type == 'classification':
            train_metrics = calculate_classification_metrics(y_train, train_predictions, is_binary)
            test_metrics = calculate_classification_metrics(y_test, test_predictions, is_binary)
            
            # Generate confusion matrix
            confusion_matrix_img = create_confusion_matrix(y_test, test_predictions)
            
            # Generate feature importance
            if hasattr(model, 'feature_importances_'):
                feature_importance = {
                    'features': preprocessed_data['feature_names'],
                    'importance': model.feature_importances_.tolist()
                }
            else:
                feature_importance = None
        else:  # regression
            train_metrics = calculate_regression_metrics(y_train, train_predictions)
            test_metrics = calculate_regression_metrics(y_test, test_predictions)
            
            # Generate residual plot
            residual_plot_img = create_residual_plot(y_test, test_predictions)
            
            # Generate feature importance
            if hasattr(model, 'feature_importances_'):
                feature_importance = {
                    'features': preprocessed_data['feature_names'],
                    'importance': model.feature_importances_.tolist()
                }
            else:
                feature_importance = None
        
        # Create result dictionary
        result = {
            'model': model,
            'model_type': model_type,
            'problem_type': problem_type,
            'train_metrics': train_metrics,
            'test_metrics': test_metrics,
            'feature_names': preprocessed_data['feature_names'],
            'encoders': preprocessed_data['encoders'],
            'feature_importance': feature_importance
        }
        
        # Add visualization
        if problem_type == 'classification':
            result['confusion_matrix'] = confusion_matrix_img
        else:
            result['residual_plot'] = residual_plot_img
        
        return result
    
    except Exception as e:
        logger.error(f"Error training model: {str(e)}")
        raise

def calculate_classification_metrics(y_true, y_pred, is_binary):
    """Calculate metrics for classification models"""
    metrics = {
        'accuracy': float(accuracy_score(y_true, y_pred)),
        'precision': float(precision_score(y_true, y_pred, average='weighted')),
        'recall': float(recall_score(y_true, y_pred, average='weighted')),
        'f1': float(f1_score(y_true, y_pred, average='weighted')),
    }
    
    # Add ROC AUC for binary classification
    if is_binary:
        try:
            metrics['roc_auc'] = float(roc_auc_score(y_true, y_pred))
        except:
            metrics['roc_auc'] = None
    
    return metrics

def calculate_regression_metrics(y_true, y_pred):
    """Calculate metrics for regression models"""
    return {
        'r2': float(r2_score(y_true, y_pred)),
        'mse': float(mean_squared_error(y_true, y_pred)),
        'rmse': float(np.sqrt(mean_squared_error(y_true, y_pred))),
        'mae': float(mean_absolute_error(y_true, y_pred))
    }

def create_confusion_matrix(y_true, y_pred):
    """Create confusion matrix visualization"""
    try:
        plt.figure(figsize=(8, 6))
        cm = pd.crosstab(y_true, y_pred, rownames=['Actual'], colnames=['Predicted'])
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues')
        plt.title('Confusion Matrix')
        plt.tight_layout()
        
        buf = BytesIO()
        plt.savefig(buf, format='png')
        plt.close()
        buf.seek(0)
        
        image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        return image_base64
    except Exception as e:
        logger.error(f"Error creating confusion matrix: {str(e)}")
        return None

def create_residual_plot(y_true, y_pred):
    """Create residual plot for regression models"""
    try:
        plt.figure(figsize=(10, 6))
        residuals = y_true - y_pred
        plt.scatter(y_pred, residuals)
        plt.axhline(y=0, color='r', linestyle='-')
        plt.xlabel('Predicted Values')
        plt.ylabel('Residuals')
        plt.title('Residual Plot')
        plt.tight_layout()
        
        buf = BytesIO()
        plt.savefig(buf, format='png')
        plt.close()
        buf.seek(0)
        
        image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        return image_base64
    except Exception as e:
        logger.error(f"Error creating residual plot: {str(e)}")
        return None

def save_model(model_result, model_name):
    """
    Save trained model and metadata
    
    Args:
        model_result (dict): Result from train_model
        model_name (str): Name to save the model under
    
    Returns:
        str: Path to saved model
    """
    try:
        model_path = os.path.join(MODELS_FOLDER, model_name)
        os.makedirs(model_path, exist_ok=True)
        
        # Save model file
        model_file = os.path.join(model_path, 'model.joblib')
        joblib.dump(model_result['model'], model_file)
        
        # Save encoders
        encoders_file = os.path.join(model_path, 'encoders.joblib')
        joblib.dump(model_result['encoders'], encoders_file)
        
        # Save model metadata (everything except the actual model object)
        metadata = {k: v for k, v in model_result.items() if k not in ['model', 'encoders']}
        metadata_file = os.path.join(model_path, 'metadata.json')
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, default=str)
        
        return model_file
    
    except Exception as e:
        logger.error(f"Error saving model: {str(e)}")
        raise

def load_model(model_name):
    """
    Load trained model and metadata
    
    Args:
        model_name (str): Name of the model to load
    
    Returns:
        dict: Model and metadata
    """
    try:
        model_path = os.path.join(MODELS_FOLDER, model_name)
        
        # Load model file
        model_file = os.path.join(model_path, 'model.joblib')
        model = joblib.load(model_file)
        
        # Load encoders
        encoders_file = os.path.join(model_path, 'encoders.joblib')
        encoders = joblib.load(encoders_file)
        
        # Load model metadata
        metadata_file = os.path.join(model_path, 'metadata.json')
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
        
        # Combine everything
        result = {
            'model': model,
            'encoders': encoders,
            **metadata
        }
        
        return result
    
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}")
        raise

def predict(model_result, input_data):
    """
    Make predictions using a trained model
    
    Args:
        model_result (dict): Model and metadata from train_model or load_model
        input_data (pd.DataFrame): Input data for prediction
    
    Returns:
        np.ndarray: Predictions
    """
    try:
        model = model_result['model']
        feature_names = model_result['feature_names']
        encoders = model_result['encoders']
        
        # Check input data has required features
        missing_features = [f for f in feature_names if f not in input_data.columns]
        if missing_features:
            raise ValueError(f"Missing features in input data: {missing_features}")
        
        # Select and order features
        X = input_data[feature_names].copy()
        
        # Apply encoders to categorical features
        for col, encoder in encoders.items():
            if col in X.columns:
                X[col] = encoder.transform(X[col].astype(str))
        
        # Make prediction
        predictions = model.predict(X)
        
        # Decode target if it's a classification problem
        if model_result['problem_type'] == 'classification' and 'target' in encoders:
            predictions = encoders['target'].inverse_transform(predictions)
        
        return predictions
    
    except Exception as e:
        logger.error(f"Error making prediction: {str(e)}")
        raise 