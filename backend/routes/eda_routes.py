from flask import Blueprint, request, jsonify
import pandas as pd
import numpy as np
import logging
import json
import os
import matplotlib.pyplot as plt
import seaborn as sns
from io import BytesIO
import base64
import requests
import traceback
from flask_cors import CORS
from backend.services.session_service import get_session_data, get_session_metadata
from backend.config.settings import LANGCHAIN_API_KEY
# Removed JWT import as we're not using authentication
from backend.database.models import Dataset
from backend.utils.data_utils import load_dataset, get_column_statistics

logger = logging.getLogger('datasage')

# Create blueprint
eda_bp = Blueprint('eda', __name__, url_prefix='/api/eda')
CORS(eda_bp)  # Enable CORS for all routes in this blueprint

# Add route decorator to log all requests
@eda_bp.before_request
def log_request_info():
    """Log request details for debugging."""
    logger.info('Headers: %s', request.headers)
    logger.info('Body: %s', request.get_data())
    logger.info('Route: %s %s', request.method, request.path)
    logger.info('Args: %s', request.args)

@eda_bp.after_request
def add_cors_headers(response):
    """Add CORS headers to all responses."""
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@eda_bp.route('/sessions/<session_id>/overview', methods=['GET'])
def get_session_overview(session_id):
    """Get a general overview of a dataset"""
    try:
        # Get session data
        df = get_session_data(session_id)
        metadata = get_session_metadata(session_id)
        
        # Basic dataset info
        overview = {
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": df.columns.tolist(),
            "missing_values": int(df.isna().sum().sum()),
            "missing_percentage": round(df.isna().sum().sum() / (len(df) * len(df.columns)) * 100, 2),
            "duplicate_rows": int(df.duplicated().sum()),
            "memory_usage": int(df.memory_usage(deep=True).sum()),
            "filename": metadata.get('filename', 'Unknown'),
        }
        
        # Get data types overview
        dtypes = {
            "numeric": len(df.select_dtypes(include=['number']).columns),
            "categorical": len(df.select_dtypes(include=['object', 'category']).columns),
            "datetime": len(df.select_dtypes(include=['datetime']).columns),
            "boolean": len(df.select_dtypes(include=['bool']).columns),
            "other": len(df.select_dtypes(exclude=['number', 'object', 'category', 'datetime', 'bool']).columns)
        }
        overview["data_types"] = dtypes
        
        return jsonify({
            "status": "success",
            "overview": overview
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_session_overview: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@eda_bp.route('/sessions/<session_id>/all_statistics', methods=['GET'])
def get_all_session_statistics(session_id):
    """Get statistics for all columns in a session dataset"""
    try:
        # Get the session data
        df = get_session_data(session_id)
        if df is None:
            return jsonify({"error": "No data found for this session"}), 404
        
        # Generate statistics for all columns
        all_stats = {}
        for column in df.columns:
            all_stats[column] = get_column_statistics(df, column)
        
        return jsonify(all_stats), 200
        
    except Exception as e:
        logger.error(f"Error in get_all_session_statistics: {str(e)}")
        return jsonify({"error": str(e)}), 500

@eda_bp.route('/sessions/<session_id>/columns/<column_name>/statistics', methods=['GET'])
def get_column_statistics(session_id, column_name):
    """Get statistics for a specific column in a session dataset"""
    try:
        # Get session data
        df = get_session_data(session_id)
        
        if column_name not in df.columns:
            return jsonify({"error": f"Column '{column_name}' not found in dataset"}), 404
        
        # Get column statistics
        stats = get_column_stats(df, column_name)
        
        # Generate a visualization if applicable
        if pd.api.types.is_numeric_dtype(df[column_name]) or df[column_name].nunique() < 20:
            stats["visualization"] = create_column_visualization(df, column_name)
        
        return jsonify({
            "status": "success",
            "column_name": column_name,
            "statistics": stats
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_column_statistics: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@eda_bp.route('/sessions/<session_id>/correlation', methods=['GET'])
def get_correlation_matrix(session_id):
    """Get correlation matrix for all numeric columns"""
    try:
        # Get session data
        df = get_session_data(session_id)
        
        # Get only numeric columns
        numeric_df = df.select_dtypes(include=['number'])
        
        if numeric_df.empty or len(numeric_df.columns) < 2:
            return jsonify({"error": "Not enough numeric columns for correlation analysis"}), 400
        
        # Calculate correlation matrix
        corr_matrix = numeric_df.corr().fillna(0).round(3)
        
        # Convert to list format for frontend visualization
        correlations = []
        for i, col1 in enumerate(corr_matrix.columns):
            for j, col2 in enumerate(corr_matrix.columns):
                correlations.append({
                    "column1": col1,
                    "column2": col2,
                    "correlation": float(corr_matrix.iloc[i, j])
                })
        
        # Create heatmap visualization
        plt.figure(figsize=(10, 8))
        sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', vmin=-1, vmax=1)
        plt.title("Correlation Matrix")
        plt.tight_layout()
        
        # Convert plot to base64 image
        buf = BytesIO()
        plt.savefig(buf, format='png')
        plt.close()
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode('utf-8')
        
        return jsonify({
            "status": "success",
            "columns": corr_matrix.columns.tolist(),
            "correlations": correlations,
            "visualization": img_str
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_correlation_matrix: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@eda_bp.route('/sessions/<session_id>/columns/correlation', methods=['GET'])
def get_columns_correlation(session_id):
    """Get correlation between specified columns"""
    columns_param = request.args.get('columns')
    
    if not columns_param:
        return jsonify({"error": "Missing 'columns' parameter. Specify comma-separated column names."}), 400
    
    columns = columns_param.split(',')
    
    try:
        # Get session data
        df = get_session_data(session_id)
        
        # Verify that all columns exist
        missing_columns = [col for col in columns if col not in df.columns]
        if missing_columns:
            return jsonify({
                "error": f"Column(s) not found in dataset: {', '.join(missing_columns)}"
            }), 404
        
        # Filter dataframe to only include requested columns
        filtered_df = df[columns]
        
        # Check if we can perform correlation analysis
        numeric_cols = filtered_df.select_dtypes(include=['number']).columns.tolist()
        if len(numeric_cols) < 2:
            return jsonify({
                "error": "Need at least 2 numeric columns for correlation analysis",
                "numeric_columns": numeric_cols
            }), 400
        
        # Get only numeric columns for correlation
        numeric_df = filtered_df[numeric_cols]
        
        # Calculate correlation matrix
        corr_matrix = numeric_df.corr().fillna(0).round(3)
        
        # Convert to list format for frontend visualization
        correlations = []
        for i, col1 in enumerate(corr_matrix.columns):
            for j, col2 in enumerate(corr_matrix.columns):
                correlations.append({
                    "column1": col1,
                    "column2": col2,
                    "correlation": float(corr_matrix.iloc[i, j])
                })
        
        # Create scatter plots for each pair of columns
        scatter_data = {}
        if len(numeric_cols) >= 2:
            for i, col1 in enumerate(numeric_cols):
                for j, col2 in enumerate(numeric_cols):
                    if i < j:  # Only do pairs once
                        pair_key = f"{col1}_vs_{col2}"
                        # Sample up to 1000 points for the scatter plot
                        sample_size = min(1000, len(df))
                        sampled_df = df.sample(sample_size) if len(df) > sample_size else df
                        scatter_data[pair_key] = {
                            "x": sampled_df[col1].tolist(),
                            "y": sampled_df[col2].tolist(),
                            "correlation": float(corr_matrix.loc[col1, col2])
                        }
        
        # Create heatmap visualization
        plt.figure(figsize=(10, 8))
        sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', vmin=-1, vmax=1)
        plt.title(f"Correlation Heatmap: {', '.join(numeric_cols)}")
        plt.tight_layout()
        
        # Convert plot to base64 image
        buf = BytesIO()
        plt.savefig(buf, format='png')
        plt.close()
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode('utf-8')
        
        return jsonify({
            "status": "success",
            "columns": numeric_cols,
            "correlations": correlations,
            "scatter_data": scatter_data,
            "visualization": img_str
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_columns_correlation: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@eda_bp.route('/sessions/<session_id>/distribution/<column_name>', methods=['GET'])
def get_column_distribution(session_id, column_name):
    """Get distribution analysis for a specific column"""
    try:
        # Get session data
        df = get_session_data(session_id)
        
        if column_name not in df.columns:
            return jsonify({"error": f"Column '{column_name}' not found in dataset"}), 404
        
        # Get basic stats
        stats = {
            "count": int(df[column_name].count()),
            "missing": int(df[column_name].isna().sum()),
            "missing_percentage": round(df[column_name].isna().mean() * 100, 2),
            "unique_values": int(df[column_name].nunique()),
        }
        
        # Create visualization based on data type
        plt.figure(figsize=(10, 6))
        
        if pd.api.types.is_numeric_dtype(df[column_name]):
            # Add numeric stats
            stats.update({
                "min": float(df[column_name].min()) if not pd.isna(df[column_name].min()) else None,
                "max": float(df[column_name].max()) if not pd.isna(df[column_name].max()) else None,
                "mean": float(df[column_name].mean()) if not pd.isna(df[column_name].mean()) else None,
                "median": float(df[column_name].median()) if not pd.isna(df[column_name].median()) else None,
                "std": float(df[column_name].std()) if not pd.isna(df[column_name].std()) else None,
            })
            
            # Create histogram
            sns.histplot(df[column_name].dropna(), kde=True)
            plt.title(f"Distribution of {column_name}")
            plt.xlabel(column_name)
            plt.ylabel("Frequency")
            
            # Add quantiles
            quantiles = df[column_name].quantile([0.25, 0.5, 0.75]).to_dict()
            stats["quantiles"] = {str(k): float(v) for k, v in quantiles.items()}
        else:
            # Create bar plot for categorical data
            value_counts = df[column_name].value_counts().head(20)
            value_counts.plot(kind='bar')
            plt.title(f"Distribution of {column_name}")
            plt.xlabel(column_name)
            plt.ylabel("Count")
            plt.xticks(rotation=45, ha='right')
            
            # Add categorical stats - top values
            value_counts_dict = df[column_name].value_counts().head(10).to_dict()
            stats["top_values"] = {str(k): int(v) for k, v in value_counts_dict.items()}
        
        plt.tight_layout()
        
        # Convert plot to base64 image
        buf = BytesIO()
        plt.savefig(buf, format='png')
        plt.close()
        buf.seek(0)
        visualization = base64.b64encode(buf.read()).decode('utf-8')
        
        return jsonify({
            "status": "success",
            "column_name": column_name,
            "statistics": stats,
            "visualization": visualization
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_column_distribution: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# Helper function to get statistics for a column
def get_column_stats(df, column_name):
    """Generate statistics for a column based on its data type"""
    stats = {
        "name": column_name,
        "type": str(df[column_name].dtype),
        "count": int(df[column_name].count()),
        "missing": int(df[column_name].isna().sum()),
        "missing_percentage": round(df[column_name].isna().mean() * 100, 2),
        "unique_values": int(df[column_name].nunique()),
    }
    
    if pd.api.types.is_numeric_dtype(df[column_name]):
        # Add numeric stats
        numeric_stats = {
            "min": float(df[column_name].min()) if not pd.isna(df[column_name].min()) else None,
            "max": float(df[column_name].max()) if not pd.isna(df[column_name].max()) else None,
            "mean": float(df[column_name].mean()) if not pd.isna(df[column_name].mean()) else None,
            "median": float(df[column_name].median()) if not pd.isna(df[column_name].median()) else None,
            "std": float(df[column_name].std()) if not pd.isna(df[column_name].std()) else None,
            "quantiles": {
                "25%": float(df[column_name].quantile(0.25)) if not pd.isna(df[column_name].quantile(0.25)) else None,
                "50%": float(df[column_name].quantile(0.5)) if not pd.isna(df[column_name].quantile(0.5)) else None,
                "75%": float(df[column_name].quantile(0.75)) if not pd.isna(df[column_name].quantile(0.75)) else None,
            }
        }
        stats.update(numeric_stats)
    else:
        # Add categorical stats
        value_counts = df[column_name].value_counts().head(10).to_dict()
        stats["value_counts"] = {str(k): int(v) for k, v in value_counts.items()}
        
        if df[column_name].nunique() <= 20:
            stats["all_values"] = sorted([str(v) for v in df[column_name].unique() if not pd.isna(v)])
    
    return stats

# Helper function to create visualizations
def create_column_visualization(df, column_name):
    """Create a visualization for a column based on its data type"""
    plt.figure(figsize=(10, 6))
    
    if pd.api.types.is_numeric_dtype(df[column_name]):
        # Create histogram with KDE for numeric columns
        sns.histplot(df[column_name].dropna(), kde=True)
        plt.title(f"Distribution of {column_name}")
        plt.xlabel(column_name)
        plt.ylabel("Frequency")
    else:
        # Create bar plot for categorical columns
        value_counts = df[column_name].value_counts().head(15)
        value_counts.plot(kind='bar')
        plt.title(f"Top values for {column_name}")
        plt.xlabel(column_name)
        plt.ylabel("Count")
        plt.xticks(rotation=45, ha='right')
    
    plt.tight_layout()
    
    # Convert to base64
    buf = BytesIO()
    plt.savefig(buf, format='png')
    plt.close()
    buf.seek(0)
    img_str = base64.b64encode(buf.read()).decode('utf-8')
    
    return img_str

@eda_bp.route('/insights', methods=['GET'])
def get_insights_with_langchain():
    """Get AI-powered insights about the dataset using LangChain API"""
    session_id = request.args.get('session_id')
    
    if not session_id:
        return jsonify({"error": "Missing session_id parameter"}), 400
    
    try:
        # Get session data
        df = get_session_data(session_id)
        
        # Check if LangChain API key is available
        if not LANGCHAIN_API_KEY:
            return jsonify({"error": "LangChain API key not configured"}), 500
        
        # Create a sample of the dataset to avoid sending too much data
        sample_size = min(100, len(df))
        df_sample = df.sample(sample_size) if len(df) > sample_size else df
        
        # Convert to CSV string (limited size for API)
        csv_data = df_sample.to_csv(index=False)
        
        # Get dataset summary
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        categorical_cols = df.select_dtypes(exclude=['number']).columns.tolist()
        
        # Create dataset summary for context
        dataset_summary = {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "numeric_columns": numeric_cols,
            "categorical_columns": categorical_cols,
            "missing_values_percentage": df.isna().mean().mean() * 100
        }
        
        # Make API call to LangChain API for data insights
        headers = {
            "Authorization": f"Bearer {LANGCHAIN_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "input": {
                "csv_data": csv_data,
                "dataset_summary": dataset_summary,
                "request": "Provide a comprehensive analysis of this dataset with key insights, anomalies, patterns, and potential next steps for analysis."
            }
        }
        
        response = requests.post(
            "https://api.smith.langchain.com/functions/callable/",
            headers=headers,
            json=payload
        )
        
        if response.status_code == 200:
            result = response.json()
            insights = result.get("output", "No insights generated")
            
            return jsonify({
                "insights": insights
            }), 200
        else:
            logger.error(f"Error from LangChain API: {response.status_code} - {response.text}")
            # Provide basic insights if API fails
            return jsonify({
                "insights": "Basic dataset analysis: " + generate_basic_insights(df),
                "note": "Generated without LangChain API due to connection error"
            }), 200
    
    except Exception as e:
        logger.error(f"Error generating insights: {str(e)}")
        return jsonify({"error": str(e)}), 500

def generate_basic_insights(df):
    """Generate basic insights if API call fails"""
    insights = []
    
    # Dataset size
    insights.append(f"Dataset has {len(df)} rows and {len(df.columns)} columns.")
    
    # Missing values
    missing_percent = df.isna().mean().mean() * 100
    if missing_percent > 0:
        insights.append(f"Dataset contains {missing_percent:.2f}% missing values overall.")
    
    # Column types
    num_cols = len(df.select_dtypes(include=['number']).columns)
    cat_cols = len(df.select_dtypes(exclude=['number']).columns)
    insights.append(f"Contains {num_cols} numeric columns and {cat_cols} categorical columns.")
    
    # Basic correlations
    if num_cols >= 2:
        corr_matrix = df.select_dtypes(include=['number']).corr().abs()
        np.fill_diagonal(corr_matrix.values, 0)
        if corr_matrix.max().max() > 0.7:
            max_corr = corr_matrix.max().max()
            max_corr_cols = np.where(corr_matrix.values == max_corr)
            if len(max_corr_cols[0]) > 0:
                col1 = corr_matrix.columns[max_corr_cols[0][0]]
                col2 = corr_matrix.columns[max_corr_cols[1][0]]
                insights.append(f"Strong correlation detected between {col1} and {col2} ({max_corr:.2f}).")
    
    return " ".join(insights)

# DATA API endpoints
@eda_bp.route('/datasets/<dataset_id>/statistics', methods=['GET'])
def get_dataset_statistics(dataset_id):
    """Get statistics for all columns in a dataset"""
    try:
        # Special case for mock dataset ID
        if dataset_id == 'mock-dataset-1':
            # Define columns dynamically, matching the likely column set in MOCK_DATA
            mock_columns = [
                'age', 'salary', 'experience', 'education', 'department', 
                'performance_score', 'attendance', 'projects_completed', 
                'satisfaction_level', 'last_evaluation'
            ]
            
            # Generate statistics for each column dynamically
            mock_stats = {}
            
            for column_name in mock_columns:
                # Use column name as seed for consistent but different statistics
                seed = sum(ord(c) for c in column_name)
                np.random.seed(seed)
                
                # Determine if the column is likely numeric based on its name
                is_numeric = any(term in column_name.lower() for term in 
                               ['age', 'year', 'price', 'cost', 'revenue', 'income', 'expense', 
                                'sales', 'profit', 'salary', 'score', 'rate', 'count', 'number', 
                                'amount', 'value', 'qty', 'quantity', 'total', 'sum', 'average', 
                                'mean', 'median', 'min', 'max', 'ratio', 'percentage', 'level',
                                'id', 'completed', 'attendance', 'evaluation', 'experience'])
                
                if is_numeric:
                    # Generate numeric data
                    mean_value = np.random.uniform(20, 100)
                    std_dev = np.random.uniform(5, 15)
                    sample_size = 1000
                    sample_data = np.random.normal(mean_value, std_dev, sample_size)
                    
                    # Calculate IQR for outlier detection
                    q1 = np.percentile(sample_data, 25)
                    q3 = np.percentile(sample_data, 75)
                    iqr = q3 - q1
                    
                    # Detect outliers using IQR method
                    lower_bound = q1 - 1.5 * iqr
                    upper_bound = q3 + 1.5 * iqr
                    outliers = sample_data[(sample_data < lower_bound) | (sample_data > upper_bound)]
                    
                    # Generate histogram data
                    hist, bin_edges = np.histogram(sample_data, bins=10)
                    histogram_data = []
                    for i in range(len(hist)):
                        histogram_data.append({
                            "bin": f"{bin_edges[i]:.1f} - {bin_edges[i+1]:.1f}",
                            "count": int(hist[i])
                        })
                    
                    # Generate numeric statistics
                    mock_stats[column_name] = {
                        "missing": int(len(sample_data) * 0.05),  # 5% missing as example
                        "missingPercent": "5.0",
                        "unique": int(len(np.unique(sample_data))),
                        "mean": float(np.mean(sample_data)),
                        "median": float(np.median(sample_data)),
                        "stdDev": float(np.std(sample_data)),
                        "min": float(np.min(sample_data)),
                        "max": float(np.max(sample_data)),
                        "range": float(np.max(sample_data) - np.min(sample_data)),
                        "q1": float(q1),
                        "q3": float(q3),
                        "iqr": float(iqr),
                        "outliers": len(outliers),
                        "outliersPercent": f"{(len(outliers) / len(sample_data) * 100):.1f}",
                        "histogramData": histogram_data
                    }
                else:
                    # Generate categorical data
                    categories = ["Category A", "Category B", "Category C", "Category D", "Category E"]
                    # Use seed to shuffle categories so different columns get different distributions
                    rng = np.random.RandomState(seed)
                    rng.shuffle(categories)
                    
                    # Generate frequencies with descending order but some randomness
                    total = 100
                    frequencies = []
                    remaining = total
                    
                    for i in range(len(categories) - 1):
                        # Use seed to vary the distribution pattern
                        portion = int(remaining * (0.4 + (rng.rand() * 0.3))) 
                        frequencies.append(portion)
                        remaining -= portion
                    
                    frequencies.append(remaining)  # Add the remainder to the last category
                    
                    # Create histogram data
                    histogram_data = []
                    for i, (cat, freq) in enumerate(zip(categories, frequencies)):
                        histogram_data.append({
                            "category": cat,
                            "count": freq
                        })
                    
                    # Sort by frequency descending
                    histogram_data.sort(key=lambda x: x["count"], reverse=True)
                    
                    # Generate categorical statistics
                    mock_stats[column_name] = {
                        "missing": int(total * 0.05),  # 5% missing as example
                        "missingPercent": "5.0",
                        "unique": len(categories),
                        "histogramData": histogram_data
                    }
            
            return jsonify(mock_stats), 200
            
        # Validate dataset_id
        if dataset_id == 'undefined' or dataset_id == 'null' or not dataset_id:
            return jsonify({"error": "Invalid dataset ID"}), 400
            
        # For normal cases, we treat dataset_id as session_id
        # Find the dataset in the database
        try:
            # Get all statistics for the dataset by redirecting to the session-based endpoint
            return get_session_statistics(dataset_id)
        except Exception as e:
            logger.error(f"Error redirecting to session statistics: {str(e)}")
            return jsonify({"error": str(e)}), 500
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@eda_bp.route('/datasets/<dataset_id>/columns/<column_name>/statistics', methods=['GET'])
def get_dataset_column_statistics(dataset_id, column_name):
    """Get statistics for a specific column in a dataset"""
    try:
        # Special case for mock dataset ID
        if dataset_id == 'mock-dataset-1':
            # Generate dynamic statistics based on column name
            # This ensures consistent but different values for different columns
            seed = sum(ord(c) for c in column_name)
            np.random.seed(seed)
            
            # Determine if column is likely numeric based on common numeric column names
            is_numeric = any(term in column_name.lower() for term in 
                           ['age', 'year', 'price', 'cost', 'revenue', 'income', 'expense', 
                            'sales', 'profit', 'salary', 'score', 'rate', 'count', 'number', 
                            'amount', 'value', 'qty', 'quantity', 'total', 'sum', 'average', 
                            'mean', 'median', 'min', 'max', 'ratio', 'percentage', 'level',
                            'id', 'completed', 'attendance', 'evaluation', 'experience'])
            
            if is_numeric:
                # Generate numeric data
                mean_value = np.random.uniform(20, 100)
                std_dev = np.random.uniform(5, 15)
                sample_size = 1000
                sample_data = np.random.normal(mean_value, std_dev, sample_size)
                
                # Calculate IQR for outlier detection
                q1 = np.percentile(sample_data, 25)
                q3 = np.percentile(sample_data, 75)
                iqr = q3 - q1
                
                # Detect outliers using IQR method
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                outliers = sample_data[(sample_data < lower_bound) | (sample_data > upper_bound)]
                
                # Generate histogram data
                hist, bin_edges = np.histogram(sample_data, bins=10)
                histogram_data = []
                for i in range(len(hist)):
                    histogram_data.append({
                        "bin": f"{bin_edges[i]:.1f} - {bin_edges[i+1]:.1f}",
                        "count": int(hist[i])
                    })
                
                # Generate numeric statistics
                mock_stats = {
                    "missing": int(len(sample_data) * 0.05),  # 5% missing as example
                    "missingPercent": "5.0",
                    "unique": int(len(np.unique(sample_data))),
                    "mean": float(np.mean(sample_data)),
                    "median": float(np.median(sample_data)),
                    "stdDev": float(np.std(sample_data)),
                    "min": float(np.min(sample_data)),
                    "max": float(np.max(sample_data)),
                    "range": float(np.max(sample_data) - np.min(sample_data)),
                    "q1": float(q1),
                    "q3": float(q3),
                    "iqr": float(iqr),
                    "outliers": len(outliers),
                    "outliersPercent": f"{(len(outliers) / len(sample_data) * 100):.1f}",
                    "histogramData": histogram_data
                }
            else:
                # Generate categorical data
                categories = ["Category A", "Category B", "Category C", "Category D", "Category E"]
                # Use seed to shuffle categories so different columns get different distributions
                rng = np.random.RandomState(seed)
                rng.shuffle(categories)
                
                # Generate frequencies with descending order but some randomness
                total = 100
                frequencies = []
                remaining = total
                
                for i in range(len(categories) - 1):
                    # Use seed to vary the distribution pattern
                    portion = int(remaining * (0.4 + (rng.rand() * 0.3))) 
                    frequencies.append(portion)
                    remaining -= portion
                
                frequencies.append(remaining)  # Add the remainder to the last category
                
                # Create histogram data
                histogram_data = []
                for i, (cat, freq) in enumerate(zip(categories, frequencies)):
                    histogram_data.append({
                        "category": cat,
                        "count": freq
                    })
                
                # Sort by frequency descending
                histogram_data.sort(key=lambda x: x["count"], reverse=True)
                
                # Generate categorical statistics
                mock_stats = {
                    "missing": int(total * 0.05),  # 5% missing as example
                    "missingPercent": "5.0",
                    "unique": len(categories),
                    "histogramData": histogram_data
                }
            
            return jsonify(mock_stats), 200
            
        # For non-mock datasets, treat dataset_id as session_id
        try:
            # Redirect to the session-based endpoint
            return get_session_column_statistics(dataset_id, column_name)
        except Exception as e:
            logger.error(f"Error redirecting to session column statistics: {str(e)}")
            return jsonify({"error": str(e)}), 500
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# SESSION API endpoints
@eda_bp.route('/sessions/<session_id>/columns/<column_name>/statistics', methods=['GET'])
def get_session_column_statistics(session_id, column_name):
    """Get statistics for a specific column in a session dataset"""
    try:
        # Get the session data
        df = get_session_data(session_id)
        if df is None:
            return jsonify({"error": "No data found for this session"}), 404
        
        # Check if column exists
        if column_name not in df.columns:
            return jsonify({"error": f"Column '{column_name}' not found in dataset"}), 404
        
        # Generate statistics for the column
        stats = get_column_statistics(df, column_name)
        
        return jsonify(stats), 200
    
    except Exception as e:
        logger.error(f"Error in get_session_column_statistics: {str(e)}")
        return jsonify({"error": str(e)}), 500

@eda_bp.route('/datasets/<dataset_id>/columns/correlation', methods=['GET'])
def get_dataset_columns_correlation(dataset_id):
    """Get correlation between selected columns in a dataset"""
    try:
        # Parse input parameters
        columns_str = request.args.get('columns')
        if not columns_str:
            return jsonify({"error": "Missing columns parameter"}), 400
        
        columns = columns_str.split(',')
        
        # Special case for mock dataset ID
        if dataset_id == 'mock-dataset-1':
            # Generate mock correlation data
            mock_correlations = []
            scatter_data = []
            
            # Create a consistent seed based on columns
            seed = sum(ord(c) for c in ''.join(columns))
            np.random.seed(seed)
            
            # Generate pairwise correlations
            for i, col1 in enumerate(columns):
                for j, col2 in enumerate(columns):
                    if i < j:  # Only upper triangle
                        # Generate correlation value based on column names for consistency
                        col1_seed = sum(ord(c) for c in col1)
                        col2_seed = sum(ord(c) for c in col2)
                        combined_seed = (col1_seed + col2_seed) % 100
                        np.random.seed(combined_seed)
                        
                        # Generate a correlation coefficient between -1 and 1
                        # Use a beta distribution skewed toward higher absolute values
                        corr_value = np.random.beta(2, 2) * 2 - 1
                        
                        mock_correlations.append({
                            "column1": col1,
                            "column2": col2,
                            "correlation": float(corr_value),
                            "correlation_type": "pearson"
                        })
                        
                        # Generate scatter plot data
                        num_points = 50
                        x_values = np.linspace(0, 100, num_points) + np.random.normal(0, 5, num_points)
                        
                        # Generate y values with specified correlation
                        noise = np.random.normal(0, 10, num_points)
                        y_values = corr_value * x_values + noise
                        y_values = np.clip(y_values, 0, 100)  # Keep in reasonable range
                        
                        points = [{"x": float(x), "y": float(y)} for x, y in zip(x_values, y_values)]
                        
                        scatter_data.append({
                            "x_column": col1,
                            "y_column": col2,
                            "points": points
                        })
            
            # Create mock visualization image
            mock_response = {
                "correlations": mock_correlations,
                "scatter_data": scatter_data,
                "visualization": None  # No image in mock data
            }
            
            return jsonify(mock_response), 200
        
        # For non-mock datasets, treat dataset_id as session_id
        try:
            # Redirect to the session-based endpoint
            return get_session_columns_correlation(dataset_id)
        except Exception as e:
            logger.error(f"Error redirecting to session columns correlation: {str(e)}")
            return jsonify({"error": str(e)}), 500
        
    except Exception as e:
        logger.error(f"Error getting dataset columns correlation: {str(e)}")
        return jsonify({"error": str(e)}), 500

@eda_bp.route('/sessions/<session_id>/columns/correlation', methods=['GET'])
def get_session_columns_correlation(session_id):
    """Get correlation between selected columns in a session dataset"""
    try:
        # Parse input parameters
        columns_str = request.args.get('columns')
        if not columns_str:
            return jsonify({"error": "Missing columns parameter"}), 400
        
        columns = columns_str.split(',')
        
        # Get the session data
        df = get_session_data(session_id)
        if df is None:
            return jsonify({"error": "No data found for this session"}), 404
        
        # Check if all columns exist
        missing_columns = [col for col in columns if col not in df.columns]
        if missing_columns:
            return jsonify({"error": f"Columns not found in dataset: {', '.join(missing_columns)}"}), 400
        
        # Filter out non-numeric columns
        numeric_columns = df[columns].select_dtypes(include=np.number).columns.tolist()
        non_numeric = [col for col in columns if col not in numeric_columns]
        
        if not numeric_columns:
            return jsonify({"error": "No numeric columns selected for correlation"}), 400
        
        if non_numeric:
            logger.warning(f"Non-numeric columns excluded from correlation: {non_numeric}")
        
        # Calculate correlation matrix
        corr_matrix = df[numeric_columns].corr()
        
        # Convert to format expected by frontend
        correlations = []
        for i, col1 in enumerate(numeric_columns):
            for j, col2 in enumerate(numeric_columns):
                if i < j:  # Only upper triangle
                    correlations.append({
                        "column1": col1,
                        "column2": col2,
                        "correlation": float(corr_matrix.loc[col1, col2]),
                        "correlation_type": "pearson"
                    })
        
        # Generate scatter plot data
        scatter_data = []
        for i, col1 in enumerate(numeric_columns):
            for j, col2 in enumerate(numeric_columns):
                if i < j:  # Only upper triangle
                    # Sample data points (up to 50)
                    sample_size = min(50, len(df))
                    sample_df = df.sample(n=sample_size) if len(df) > sample_size else df
                    
                    points = [{"x": float(x), "y": float(y)} for x, y in 
                              zip(sample_df[col1].values, sample_df[col2].values)]
                    
                    scatter_data.append({
                        "x_column": col1,
                        "y_column": col2,
                        "points": points
                    })
        
        # Return results without visualization image for now
        response = {
            "correlations": correlations,
            "scatter_data": scatter_data,
            "visualization": None  # No image in this implementation
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error getting session columns correlation: {str(e)}")
        return jsonify({"error": str(e)}), 500 