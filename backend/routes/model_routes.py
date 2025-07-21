from flask import Blueprint, request, jsonify
import pandas as pd
import os
import json
import logging
from backend.services.model_service import (
    preprocess_for_training, train_model, save_model, 
    load_model, predict, CLASSIFICATION_MODELS, REGRESSION_MODELS
)
from backend.services.session_service import get_session_data
from backend.config.settings import MODELS_FOLDER

logger = logging.getLogger('datasage')

model_bp = Blueprint('model', __name__)

@model_bp.route('/api/models/supported', methods=['GET'])
def get_supported_models():
    """Get list of supported model types"""
    try:
        return jsonify({
            'classification': list(CLASSIFICATION_MODELS.keys()),
            'regression': list(REGRESSION_MODELS.keys())
        }), 200
    except Exception as e:
        logger.error(f"Error getting supported models: {str(e)}")
        return jsonify({"error": str(e)}), 500

@model_bp.route('/api/models/train', methods=['POST'])
def train_model_route():
    """Train a new model"""
    try:
        data = request.json
        session_id = data.get('session_id')
        target_column = data.get('target_column')
        model_type = data.get('model_type')
        model_name = data.get('model_name')
        hyperparameters = data.get('hyperparameters', {})
        categorical_columns = data.get('categorical_columns', None)
        drop_columns = data.get('drop_columns', None)
        
        # Validate inputs
        if not all([session_id, target_column, model_type, model_name]):
            return jsonify({"error": "Missing required parameters"}), 400
        
        # Get dataset from session
        session_data = get_session_data(session_id)
        if not session_data or 'df' not in session_data:
            return jsonify({"error": "No dataset found in session"}), 404
        
        df = session_data['df']
        
        # Preprocess data
        preprocessed_data = preprocess_for_training(
            df, 
            target_column, 
            categorical_columns, 
            drop_columns
        )
        
        # Train model
        model_result = train_model(
            preprocessed_data, 
            model_type, 
            hyperparameters
        )
        
        # Save model
        save_model(model_result, model_name)
        
        # Return metrics and metadata
        response = {
            'model_name': model_name,
            'problem_type': model_result['problem_type'],
            'train_metrics': model_result['train_metrics'],
            'test_metrics': model_result['test_metrics'],
            'feature_importance': model_result['feature_importance']
        }
        
        # Add visualizations if available
        if 'confusion_matrix' in model_result:
            response['confusion_matrix'] = model_result['confusion_matrix']
        if 'residual_plot' in model_result:
            response['residual_plot'] = model_result['residual_plot']
        
        return jsonify(response), 200
    
    except Exception as e:
        logger.error(f"Error training model: {str(e)}")
        return jsonify({"error": str(e)}), 500

@model_bp.route('/api/models', methods=['GET'])
def list_models():
    """List all saved models"""
    try:
        models = []
        
        if os.path.exists(MODELS_FOLDER):
            for model_name in os.listdir(MODELS_FOLDER):
                metadata_path = os.path.join(MODELS_FOLDER, model_name, 'metadata.json')
                if os.path.exists(metadata_path):
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                    
                    models.append({
                        'name': model_name,
                        'problem_type': metadata.get('problem_type'),
                        'model_type': metadata.get('model_type'),
                        'metrics': metadata.get('test_metrics')
                    })
        
        return jsonify(models), 200
    
    except Exception as e:
        logger.error(f"Error listing models: {str(e)}")
        return jsonify({"error": str(e)}), 500

@model_bp.route('/api/models/<model_name>', methods=['GET'])
def get_model_details(model_name):
    """Get detailed information about a specific model"""
    try:
        metadata_path = os.path.join(MODELS_FOLDER, model_name, 'metadata.json')
        if not os.path.exists(metadata_path):
            return jsonify({"error": f"Model '{model_name}' not found"}), 404
        
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        return jsonify(metadata), 200
    
    except Exception as e:
        logger.error(f"Error getting model details: {str(e)}")
        return jsonify({"error": str(e)}), 500

@model_bp.route('/api/models/<model_name>', methods=['DELETE'])
def delete_model(model_name):
    """Delete a model"""
    try:
        model_path = os.path.join(MODELS_FOLDER, model_name)
        
        if not os.path.exists(model_path):
            return jsonify({"error": f"Model '{model_name}' not found"}), 404
        
        # Delete model files
        for file in os.listdir(model_path):
            os.remove(os.path.join(model_path, file))
        
        # Delete directory
        os.rmdir(model_path)
        
        return jsonify({"message": f"Model '{model_name}' deleted successfully"}), 200
    
    except Exception as e:
        logger.error(f"Error deleting model: {str(e)}")
        return jsonify({"error": str(e)}), 500

@model_bp.route('/api/models/<model_name>/predict', methods=['POST'])
def predict_model(model_name):
    """Make predictions with a saved model"""
    try:
        data = request.json
        input_data_type = data.get('input_type', 'session')  # 'session' or 'direct'
        
        # Load input data
        if input_data_type == 'session':
            session_id = data.get('session_id')
            if not session_id:
                return jsonify({"error": "Missing session_id parameter"}), 400
            
            session_data = get_session_data(session_id)
            if not session_data or 'df' not in session_data:
                return jsonify({"error": "No dataset found in session"}), 404
            
            input_df = session_data['df']
        else:  # 'direct'
            input_json = data.get('input_data')
            if not input_json:
                return jsonify({"error": "Missing input_data parameter"}), 400
            
            input_df = pd.DataFrame(input_json)
        
        # Load model
        try:
            model_result = load_model(model_name)
        except Exception as e:
            return jsonify({"error": f"Error loading model: {str(e)}"}), 404
        
        # Make predictions
        predictions = predict(model_result, input_df)
        
        # Convert predictions to list
        predictions_list = predictions.tolist()
        
        # Return predictions along with original data if requested
        response = {"predictions": predictions_list}
        
        if data.get('include_input', False):
            response['input_data'] = input_df.to_dict(orient='records')
        
        return jsonify(response), 200
    
    except Exception as e:
        logger.error(f"Error making predictions: {str(e)}")
        return jsonify({"error": str(e)}), 500 