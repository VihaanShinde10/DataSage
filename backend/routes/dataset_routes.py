from flask import Blueprint, request, jsonify, send_from_directory
import os
from werkzeug.utils import secure_filename
import pandas as pd
import logging
import numpy as np

from backend.services.session_service import (
    create_session, get_session, get_session_data, get_session_metadata,
    add_session_data, update_session_metadata, delete_session, save_data_to_temp_file
)
from backend.database.mongodb import (
    save_session_metadata, get_session_metadata as get_mongo_metadata,
    save_dataset, get_dataset, list_datasets, delete_dataset
)
from backend.config.settings import UPLOAD_FOLDER, ALLOWED_EXTENSIONS

logger = logging.getLogger('datasage')

# Create Blueprint for dataset routes
dataset_bp = Blueprint('dataset', __name__, url_prefix='/api')

def allowed_file(filename):
    """Check if the file has an allowed extension"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@dataset_bp.route('/dataset/upload', methods=['POST'])
def upload_dataset():
    """Upload a dataset file"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        # Create a new session for this upload
        session_id = create_session()
        
        # Save the file temporarily
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        try:
            # Read file into DataFrame based on extension
            if filename.endswith('.csv'):
                df = pd.read_csv(filepath)
            elif filename.endswith(('.xls', '.xlsx')):
                df = pd.read_excel(filepath)
            else:
                return jsonify({'error': 'Unsupported file format'}), 400
            
            # Save DataFrame to session
            add_session_data(session_id, df, filename)
            
            # Remove the temporary file
            os.remove(filepath)
            
            # Return metadata about the uploaded file
            metadata = get_session_metadata(session_id)
            
            return jsonify({
                'message': 'File uploaded successfully',
                'session_id': session_id,
                'filename': filename,
                'rows': metadata.get('rows', len(df)),
                'columns': metadata.get('columns', len(df.columns)),
                'column_names': metadata.get('column_names', list(df.columns))
            }), 200
            
        except Exception as e:
            logger.error(f"Error processing uploaded file: {str(e)}")
            # Cleanup temporary file if it exists
            if os.path.exists(filepath):
                os.remove(filepath)
            return jsonify({'error': f'Error processing file: {str(e)}'}), 500
    
    return jsonify({'error': 'Invalid file format'}), 400

@dataset_bp.route('/dataset/query', methods=['POST'])
def query_dataset():
    """Query a dataset using natural language (SQL conversion)
    
    Note: This route is maintained for backward compatibility.
    New clients should use /api/sql/query instead.
    """
    data = request.json
    session_id = data.get('session_id')
    query = data.get('query')
    use_api = data.get('use_api', True)  # Default to using the API
    
    if not session_id or not query:
        return jsonify({'error': 'Missing session_id or query parameter'}), 400
    
    try:
        # Get the session data
        df = get_session_data(session_id)
        
        # Import here to avoid circular imports
        from backend.services.sql_service import execute_sql_from_natural_language
        
        # Execute the query
        result = execute_sql_from_natural_language(df, query, use_groq=use_api)
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify(result), 200
    
    except Exception as e:
        logger.error(f"Error executing dataset query: {str(e)}")
        return jsonify({'error': f'Error executing query: {str(e)}'}), 500

@dataset_bp.route('/dataset/columns', methods=['GET'])
def get_columns():
    """Get column names and types for a dataset"""
    session_id = request.args.get('session_id')
    
    if not session_id:
        return jsonify({'error': 'Missing session_id parameter'}), 400
    
    try:
        # Get the session data
        df = get_session_data(session_id)
        
        # Get column information
        columns = []
        for col in df.columns:
            col_type = str(df[col].dtype)
            # Determine simplified type
            if pd.api.types.is_numeric_dtype(df[col]):
                simple_type = 'numeric'
            elif pd.api.types.is_datetime64_dtype(df[col]):
                simple_type = 'datetime'
            elif pd.api.types.is_categorical_dtype(df[col]):
                simple_type = 'categorical'
            else:
                simple_type = 'text'
                
            columns.append({
                'name': col,
                'type': col_type,
                'simple_type': simple_type,
                'unique_values': df[col].nunique(),
                'missing_values': df[col].isna().sum()
            })
        
        return jsonify({
            'columns': columns
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving dataset columns: {str(e)}")
        return jsonify({'error': f'Error retrieving columns: {str(e)}'}), 500

@dataset_bp.route('/sessions', methods=['POST'])
def create_new_session():
    """Create a new empty session"""
    try:
        session_id = create_session()
        
        return jsonify({
            'message': 'New session created successfully',
            'session_id': session_id
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating new session: {str(e)}")
        return jsonify({'error': f'Error creating new session: {str(e)}'}), 500

@dataset_bp.route('/sessions', methods=['GET'])
def list_sessions():
    """List all active sessions"""
    try:
        # Get all datasets from MongoDB
        datasets = list_datasets()
        
        # Format the response
        sessions = []
        for dataset in datasets:
            sessions.append({
                'id': dataset.get('session_id'),
                'filename': dataset.get('filename'),
                'rows': dataset.get('rows'),
                'columns': dataset.get('columns'),
                'created_at': dataset.get('created_at'),
                'updated_at': dataset.get('updated_at')
            })
        
        return jsonify({'sessions': sessions}), 200
    except Exception as e:
        logger.error(f"Error listing sessions: {str(e)}")
        return jsonify({'error': f'Error listing sessions: {str(e)}'}), 500

@dataset_bp.route('/sessions/<session_id>', methods=['GET'])
def get_session_info(session_id):
    """Get session information"""
    try:
        session = get_session(session_id)
        return jsonify({"session": session})
    except KeyError:
        return jsonify({"error": "Session not found"}), 404
    except Exception as e:
        logger.error(f"Error getting session info: {str(e)}")
        return jsonify({'error': f'Error getting session info: {str(e)}'}), 500

@dataset_bp.route('/sessions/<session_id>', methods=['DELETE'])
def remove_session(session_id):
    """Delete a session"""
    try:
        # Delete from session service
        delete_session(session_id)
        
        # Also delete from MongoDB datasets collection
        delete_dataset(session_id)
        
        return jsonify({"status": "success", "message": "Session deleted"})
    except KeyError:
        return jsonify({"error": "Session not found"}), 404
    except Exception as e:
        logger.error(f"Error deleting session: {str(e)}")
        return jsonify({'error': f'Error deleting session: {str(e)}'}), 500

@dataset_bp.route('/sessions/<session_id>/data', methods=['GET'])
def get_session_data_route(session_id):
    """Get session data as JSON"""
    try:
        # Get the session data
        df = get_session_data(session_id)
        
        # Convert to JSON-compatible format
        data = df.head(100).to_dict(orient='records')
        
        return jsonify({
            "status": "success",
            "data": data,
            "total_rows": len(df),
            "showing_rows": min(100, len(df))
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving session data: {str(e)}")
        return jsonify({"error": f"Error retrieving session data: {str(e)}"}), 500

@dataset_bp.route('/sessions/<session_id>/metadata', methods=['GET'])
def get_session_metadata_route(session_id):
    """Get session metadata"""
    try:
        # Get the session metadata
        metadata = get_session_metadata(session_id)
        
        return jsonify({
            "status": "success",
            "metadata": metadata
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving session metadata: {str(e)}")
        return jsonify({"error": f"Error retrieving session metadata: {str(e)}"}), 500

@dataset_bp.route('/sessions/<session_id>/metadata', methods=['PUT'])
def update_session_metadata_route(session_id):
    """Update session metadata"""
    try:
        # Get JSON data from request
        data = request.get_json()
        if not data or not isinstance(data, dict):
            return jsonify({"error": "Invalid data format"}), 400
        
        # Update metadata
        update_session_metadata(session_id, data)
        
        # Return updated metadata
        metadata = get_session_metadata(session_id)
        return jsonify({"status": "success", "metadata": metadata})
    except KeyError:
        return jsonify({"error": "Session not found"}), 404
    except Exception as e:
        logger.error(f"Error updating metadata: {str(e)}")
        return jsonify({"error": f"Error updating metadata: {str(e)}"}), 500

@dataset_bp.route('/sessions/<session_id>/upload', methods=['POST'])
def upload_file_to_session(session_id):
    """Upload a file to a session"""
    # Check if session exists
    try:
        get_session(session_id)
    except KeyError:
        return jsonify({"error": "Session not found"}), 404
    
    # Check if file was uploaded
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    
    # Check if file is empty
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    # Check file extension
    if not allowed_file(file.filename):
        allowed = ', '.join(ALLOWED_EXTENSIONS)
        return jsonify({"error": f"File type not allowed. Allowed types: {allowed}"}), 400
    
    try:
        # Save the file temporarily
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        # Read the file based on its extension
        ext = file.filename.rsplit('.', 1)[1].lower()
        
        if ext == 'csv':
            data = pd.read_csv(filepath)
        elif ext in ['xls', 'xlsx']:
            data = pd.read_excel(filepath)
        
        # Add data to session
        add_session_data(session_id, data, file.filename)
        
        # Remove the temporary file
        os.remove(filepath)
        
        # Return basic metadata
        metadata = get_session_metadata(session_id)
        
        return jsonify({
            "status": "success",
            "message": "File uploaded successfully",
            "filename": file.filename,
            "rows": metadata.get('rows', 0),
            "columns": metadata.get('columns', 0)
        })
    
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        # Cleanup temporary file if it exists
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"error": f"Error processing file: {str(e)}"}), 500

@dataset_bp.route('/sessions/<session_id>/download', methods=['GET'])
def download_data(session_id):
    """Download session data as CSV"""
    try:
        # Save data to temp file
        file_path = save_data_to_temp_file(session_id)
        
        # Get the filename from metadata
        metadata = get_session_metadata(session_id)
        filename = metadata.get('filename', f"datasage_export_{session_id}.csv")
        
        # If original filename exists but isn't CSV, rename to CSV
        if filename and not filename.lower().endswith('.csv'):
            filename = f"{os.path.splitext(filename)[0]}.csv"
        
        # Return the file
        directory = os.path.dirname(file_path)
        return send_from_directory(
            directory=directory,
            path=os.path.basename(file_path),
            as_attachment=True,
            download_name=filename
        )
    except KeyError:
        return jsonify({"error": "Session not found"}), 404
    except ValueError:
        return jsonify({"error": "No data associated with this session"}), 404
    except Exception as e:
        logger.error(f"Error downloading data: {str(e)}")
        return jsonify({"error": f"Error downloading data: {str(e)}"}), 500

@dataset_bp.route('/sessions/<session_id>/preview', methods=['GET'])
def get_session_preview(session_id):
    """Get a preview of the session dataset"""
    try:
        # Get the session data
        df = get_session_data(session_id)
        
        # Limit to first 10 rows for preview
        preview_rows = min(10, len(df))
        preview_df = df.head(preview_rows)
        
        # Convert to lists for JSON serialization
        columns = preview_df.columns.tolist()
        data = preview_df.values.tolist()
        
        # Convert numpy types to Python types for JSON serialization
        data = [[str(cell) if isinstance(cell, (np.integer, np.floating, np.datetime64)) else cell for cell in row] for row in data]
        
        return jsonify({
            'columns': columns,
            'data': data,
            'totalRows': len(df),
            'previewRows': preview_rows
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting session preview: {str(e)}")
        return jsonify({'error': f'Error getting session preview: {str(e)}'}), 500 