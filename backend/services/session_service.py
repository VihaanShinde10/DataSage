import os
import json
import uuid
import logging
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import shutil
import pickle

from backend.config.settings import TEMP_FOLDER, SESSION_FOLDER
from backend.database.mongodb import (
    save_session_metadata, 
    get_session_metadata as get_mongo_session_metadata,
    save_dataset
)

logger = logging.getLogger('datasage')

# Sample data for mock sessions
SAMPLE_DATA = [
    {
        "age": 28,
        "salary": 72000,
        "experience": 5,
        "education": "Masters",
        "department": "Engineering",
        "performance_score": 85,
        "attendance": 92,
        "projects_completed": 7,
        "satisfaction_level": 4.2,
        "last_evaluation": 4.5
    },
    {
        "age": 34,
        "salary": 86000,
        "experience": 10,
        "education": "PhD",
        "department": "Research",
        "performance_score": 92,
        "attendance": 95,
        "projects_completed": 12,
        "satisfaction_level": 4.7,
        "last_evaluation": 4.8
    },
    {
        "age": 45,
        "salary": 115000,
        "experience": 18,
        "education": "Masters",
        "department": "Management",
        "performance_score": 88,
        "attendance": 90,
        "projects_completed": 9,
        "satisfaction_level": 4.0,
        "last_evaluation": 4.3
    },
    {
        "age": 31,
        "salary": 65000,
        "experience": 7,
        "education": "Bachelors",
        "department": "Marketing",
        "performance_score": 76,
        "attendance": 85,
        "projects_completed": 5,
        "satisfaction_level": 3.8,
        "last_evaluation": 3.9
    },
    {
        "age": 24,
        "salary": 55000,
        "experience": 2,
        "education": "Bachelors",
        "department": "Sales",
        "performance_score": 72,
        "attendance": 88,
        "projects_completed": 4,
        "satisfaction_level": 3.5,
        "last_evaluation": 3.7
    }
]

def create_session():
    """Create a new empty session"""
    session_id = str(uuid.uuid4())
    
    # Create session directory for data storage
    session_dir = os.path.join(SESSION_FOLDER, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    # Initialize metadata in MongoDB
    metadata = {
        'created_at': datetime.now().isoformat(),
        'expires_at': (datetime.now() + timedelta(days=7)).isoformat(),
        'has_data': False
    }
    save_session_metadata(session_id, metadata)
    
    logger.info(f"Created empty session {session_id}")
    
    return session_id

def get_session(session_id):
    """Get a session by ID"""
    # Handle sample sessions
    if session_id and session_id.startswith('sample-'):
        return handle_sample_session(session_id)
        
    # Get metadata from MongoDB
    metadata = get_mongo_session_metadata(session_id)
    
    if not metadata:
        raise KeyError(f"Session {session_id} not found or expired")
    
    # Check if session directory exists
    session_dir = os.path.join(SESSION_FOLDER, session_id)
    if not os.path.exists(session_dir):
        os.makedirs(session_dir, exist_ok=True)
    
    # Create session info object
    session_info = {
        'id': session_id,
        'created_at': metadata.get('created_at', datetime.now().isoformat()),
        'expires_at': metadata.get('expires_at', (datetime.now() + timedelta(days=7)).isoformat()),
        'has_data': metadata.get('has_data', False)
    }
    
    # Add metadata if available
    if metadata:
        session_info.update(metadata)
    
    return session_info

def handle_sample_session(session_id):
    """Handle sample session data"""
    # Check if sample data exists in the session directory
    session_dir = os.path.join(SESSION_FOLDER, session_id)
    if not os.path.exists(session_dir):
        os.makedirs(session_dir, exist_ok=True)
        
        # Create a DataFrame from sample data
        df = pd.DataFrame(SAMPLE_DATA)
        
        # Save as pickle
        df_path = os.path.join(session_dir, 'data.pkl')
        with open(df_path, 'wb') as f:
            pickle.dump(df, f)
        
        # Save as CSV
        csv_path = os.path.join(session_dir, 'data.csv')
        df.to_csv(csv_path, index=False)
        
        # Create metadata
        metadata = {
            'filename': 'employee_data.csv',
            'rows': len(df),
            'columns': len(df.columns),
            'column_names': list(df.columns),
            'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()},
            'has_data': True,
            'file_path': df_path,
            'csv_path': csv_path,
            'is_sample': True,
            'created_at': datetime.now().isoformat(),
            'expires_at': (datetime.now() + timedelta(days=7)).isoformat()
        }
        
        # Save metadata
        save_session_metadata(session_id, metadata)
        
        # Return session info
        return {
            'id': session_id,
            'created_at': metadata['created_at'],
            'expires_at': metadata['expires_at'],
            'has_data': True,
            'df': df,
            'metadata': metadata
        }
    
    # Get metadata from MongoDB
    metadata = get_mongo_session_metadata(session_id)
    
    if not metadata:
        # Create new metadata if it doesn't exist
        df = pd.DataFrame(SAMPLE_DATA)
        metadata = {
            'filename': 'employee_data.csv',
            'rows': len(df),
            'columns': len(df.columns),
            'column_names': list(df.columns),
            'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()},
            'has_data': True,
            'file_path': os.path.join(session_dir, 'data.pkl'),
            'csv_path': os.path.join(session_dir, 'data.csv'),
            'is_sample': True,
            'created_at': datetime.now().isoformat(),
            'expires_at': (datetime.now() + timedelta(days=7)).isoformat()
        }
        save_session_metadata(session_id, metadata)
    
    # Return session info
    return {
        'id': session_id,
        'created_at': metadata.get('created_at', datetime.now().isoformat()),
        'expires_at': metadata.get('expires_at', (datetime.now() + timedelta(days=7)).isoformat()),
        'has_data': True,
        'metadata': metadata
    }

def add_session_data(session_id, df, filename=None):
    """Add dataframe to a session"""
    # Handle sample sessions
    if session_id and session_id.startswith('sample-'):
        return handle_sample_session(session_id)['id']
    
    # Get metadata
    metadata = get_mongo_session_metadata(session_id)
    
    if not metadata:
        raise KeyError(f"Session {session_id} not found or expired")
    
    # Save DataFrame to disk
    session_dir = os.path.join(SESSION_FOLDER, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    # Save as pickle for preserving types
    df_path = os.path.join(session_dir, 'data.pkl')
    with open(df_path, 'wb') as f:
        pickle.dump(df, f)
    
    # Also save as CSV for easier access
    csv_path = os.path.join(session_dir, 'data.csv')
    df.to_csv(csv_path, index=False)
    
    # Update metadata
    updated_metadata = {
        'filename': filename,
        'rows': len(df),
        'columns': len(df.columns),
        'column_names': list(df.columns),
        'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()},
        'has_data': True,
        'file_path': df_path,
        'csv_path': csv_path
    }
    
    # Save metadata to MongoDB
    metadata.update(updated_metadata)
    save_session_metadata(session_id, metadata)
    
    # Also save dataset info
    dataset_info = {
        'session_id': session_id,
        'filename': filename,
        'rows': len(df),
        'columns': len(df.columns),
        'file_path': df_path,
        'csv_path': csv_path,
        'file_type': os.path.splitext(filename)[1] if filename else '.csv',
        'file_size': os.path.getsize(df_path) if os.path.exists(df_path) else 0
    }
    save_dataset(dataset_info)
    
    logger.info(f"Added DataFrame of shape {df.shape} to session {session_id}")
    
    return session_id

def get_session_data(session_id):
    """Get dataframe from a session"""
    # Handle sample sessions
    if session_id and session_id.startswith('sample-'):
        session_dir = os.path.join(SESSION_FOLDER, session_id)
        df_path = os.path.join(session_dir, 'data.pkl')
        
        # If the file doesn't exist, create it
        if not os.path.exists(df_path):
            # Create the session and get the data
            session = handle_sample_session(session_id)
            if 'df' in session:
                return session['df']
            
            # If no df in session, create one from SAMPLE_DATA
            df = pd.DataFrame(SAMPLE_DATA)
            
            # Make sure directory exists
            os.makedirs(os.path.dirname(df_path), exist_ok=True)
            
            # Save the data
            with open(df_path, 'wb') as f:
                pickle.dump(df, f)
                
            return df
        
        # Load the data from file
        try:
            with open(df_path, 'rb') as f:
                return pickle.load(f)
        except Exception as e:
            logger.error(f"Error loading sample data: {str(e)}")
            # Return a DataFrame from SAMPLE_DATA as fallback
            return pd.DataFrame(SAMPLE_DATA)
    
    # Get metadata
    metadata = get_mongo_session_metadata(session_id)
    
    if not metadata:
        raise KeyError(f"Session {session_id} not found or expired")
    
    if not metadata.get('has_data', False):
        raise ValueError(f"No data associated with session {session_id}")
    
    # Load DataFrame from disk
    df_path = metadata.get('file_path')
    
    if not df_path or not os.path.exists(df_path):
        # Try default path
        df_path = os.path.join(SESSION_FOLDER, session_id, 'data.pkl')
        
        if not os.path.exists(df_path):
            raise ValueError(f"Data file not found for session {session_id}")
    
    try:
        with open(df_path, 'rb') as f:
            df = pickle.load(f)
    except Exception as e:
        # If pickle fails, try CSV
        csv_path = os.path.join(SESSION_FOLDER, session_id, 'data.csv')
        if os.path.exists(csv_path):
            df = pd.read_csv(csv_path)
        else:
            raise ValueError(f"Failed to load data for session {session_id}: {str(e)}")
    
    return df

def get_session_metadata(session_id):
    """Get metadata from a session"""
    # Get metadata from MongoDB
    metadata = get_mongo_session_metadata(session_id)
    
    if not metadata:
        raise ValueError(f"Session {session_id} not found or expired")
    
    return metadata

def update_session_data(session_id, df):
    """Update dataframe in a session"""
    # Get metadata
    metadata = get_mongo_session_metadata(session_id)
    
    if not metadata:
        raise ValueError(f"Session {session_id} not found or expired")
    
    # Save DataFrame to disk
    session_dir = os.path.join(SESSION_FOLDER, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    # Save as pickle for preserving types
    df_path = os.path.join(session_dir, 'data.pkl')
    with open(df_path, 'wb') as f:
        pickle.dump(df, f)
    
    # Also save as CSV for easier access
    csv_path = os.path.join(session_dir, 'data.csv')
    df.to_csv(csv_path, index=False)
    
    # Update metadata
    updated_metadata = {
        'rows': len(df),
        'columns': len(df.columns),
        'column_names': list(df.columns),
        'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()},
        'has_data': True,
        'file_path': df_path,
        'csv_path': csv_path,
        'updated_at': datetime.now().isoformat()
    }
    
    # Save metadata to MongoDB
    metadata.update(updated_metadata)
    save_session_metadata(session_id, metadata)
    
    logger.info(f"Updated session {session_id} with DataFrame of shape {df.shape}")
    
    return session_id

def update_session_metadata(session_id, new_metadata):
    """Update metadata in a session"""
    # Get existing metadata
    metadata = get_mongo_session_metadata(session_id)
    
    if not metadata:
        raise ValueError(f"Session {session_id} not found or expired")
    
    # Update metadata
    metadata.update(new_metadata)
    metadata['updated_at'] = datetime.now().isoformat()
    
    # Save to MongoDB
    save_session_metadata(session_id, metadata)
    
    return session_id

def delete_session(session_id):
    """Delete a session"""
    # Delete session directory
    session_dir = os.path.join(SESSION_FOLDER, session_id)
    if os.path.exists(session_dir):
        shutil.rmtree(session_dir)
    
    # MongoDB deletion is handled by TTL index
    
    logger.info(f"Deleted session {session_id}")
    return True

def get_all_sessions() -> List[Dict[str, Any]]:
    """
    Get all active sessions
    
    Returns:
        List[Dict[str, Any]]: List of all sessions with their details
    """
    # This would be implemented using MongoDB queries
    # For now, just return an empty list
    return []

def save_data_to_temp_file(session_id: str) -> str:
    """
    Save session data to a temporary CSV file
    
    Args:
        session_id (str): The session ID
        
    Returns:
        str: Path to the saved file
        
    Raises:
        KeyError: If session ID doesn't exist
        ValueError: If no data is associated with the session
    """
    data = get_session_data(session_id)
    
    # Create session directory if it doesn't exist
    session_dir = os.path.join(TEMP_FOLDER, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    # Save data to CSV
    file_path = os.path.join(session_dir, 'data.csv')
    data.to_csv(file_path, index=False)
    
    logger.info(f"Saved data for session {session_id} to {file_path}")
    return file_path

def load_data_from_temp_file(session_id: str, file_path: Optional[str] = None) -> pd.DataFrame:
    """
    Load data from a temporary file into a session
    
    Args:
        session_id (str): The session ID
        file_path (str, optional): Path to the file to load. If None, uses default path
        
    Returns:
        pd.DataFrame: The loaded data
        
    Raises:
        KeyError: If session ID doesn't exist
        FileNotFoundError: If the file doesn't exist
    """
    # Get metadata
    metadata = get_mongo_session_metadata(session_id)
    
    if not metadata:
        logger.warning(f"Attempted to load data to non-existent session: {session_id}")
        raise KeyError(f"Session {session_id} not found")
    
    if file_path is None:
        file_path = os.path.join(TEMP_FOLDER, session_id, 'data.csv')
    
    if not os.path.exists(file_path):
        logger.error(f"Attempted to load non-existent file: {file_path}")
        raise FileNotFoundError(f"File {file_path} not found")
    
    data = pd.read_csv(file_path)
    
    # Update session with loaded data
    update_session_data(session_id, data)
    
    logger.info(f"Loaded data for session {session_id} from {file_path}")
    return data 