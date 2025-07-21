import pandas as pd
import numpy as np
import json
import matplotlib.pyplot as plt
import seaborn as sns
from io import BytesIO
import base64
from scipy import stats
import logging

logger = logging.getLogger('datasage')

def get_data_summary(df):
    """
    Get general summary statistics for the dataset
    
    Args:
        df (pd.DataFrame): Input DataFrame
    
    Returns:
        dict: Summary statistics
    """
    try:
        # Basic statistics
        summary = {
            'rows': len(df),
            'columns': len(df.columns),
            'missing_values': int(df.isna().sum().sum()),
            'missing_percentage': float(df.isna().sum().sum() / (df.shape[0] * df.shape[1]) * 100),
            'memory_usage': float(df.memory_usage(deep=True).sum() / 1024 / 1024),  # MB
            'column_types': {
                'numeric': len(df.select_dtypes(include='number').columns),
                'categorical': len(df.select_dtypes(include='object').columns),
                'datetime': len(df.select_dtypes(include='datetime').columns),
                'boolean': len(df.select_dtypes(include='bool').columns)
            }
        }
        
        return summary
    
    except Exception as e:
        logger.error(f"Error generating data summary: {str(e)}")
        raise

def get_numeric_stats(df, column):
    """
    Get statistics for a numeric column
    
    Args:
        df (pd.DataFrame): Input DataFrame
        column (str): Column name
        
    Returns:
        dict: Numeric statistics
    """
    try:
        if column not in df.columns:
            raise ValueError(f"Column {column} not found in dataset")
        
        if not pd.api.types.is_numeric_dtype(df[column]):
            raise ValueError(f"Column {column} is not numeric")
        
        # Calculate statistics
        data = df[column].dropna()
        
        stats = {
            'count': int(data.count()),
            'mean': float(data.mean()),
            'median': float(data.median()),
            'std': float(data.std()),
            'min': float(data.min()),
            'max': float(data.max()),
            '25%': float(data.quantile(0.25)),
            '50%': float(data.quantile(0.5)),
            '75%': float(data.quantile(0.75)),
            'skewness': float(data.skew()),
            'kurtosis': float(data.kurtosis()),
            'missing_count': int(df[column].isna().sum()),
            'missing_percentage': float(df[column].isna().sum() / len(df) * 100)
        }
        
        # Check if distribution is normal
        if len(data) > 8:
            _, p_value = stats.normaltest(data)
            stats['is_normal'] = bool(p_value > 0.05)
            stats['normality_p_value'] = float(p_value)
        
        return stats
    
    except Exception as e:
        logger.error(f"Error generating numeric stats for {column}: {str(e)}")
        raise

def get_categorical_stats(df, column):
    """
    Get statistics for a categorical column
    
    Args:
        df (pd.DataFrame): Input DataFrame
        column (str): Column name
        
    Returns:
        dict: Categorical statistics
    """
    try:
        if column not in df.columns:
            raise ValueError(f"Column {column} not found in dataset")
        
        data = df[column].dropna()
        
        # Get value counts
        value_counts = data.value_counts().reset_index()
        value_counts.columns = ['value', 'count']
        value_counts['percentage'] = value_counts['count'] / len(data) * 100
        
        # Convert to JSON serializable format
        categories = [
            {
                'value': str(row['value']),
                'count': int(row['count']),
                'percentage': float(row['percentage'])
            }
            for _, row in value_counts.iterrows()
        ]
        
        stats = {
            'count': int(data.count()),
            'unique_values': int(data.nunique()),
            'top': str(data.mode().iloc[0] if not data.mode().empty else None),
            'top_frequency': int(data.value_counts().iloc[0] if not data.value_counts().empty else 0),
            'missing_count': int(df[column].isna().sum()),
            'missing_percentage': float(df[column].isna().sum() / len(df) * 100),
            'categories': categories[:20]  # Limit to top 20 categories
        }
        
        return stats
    
    except Exception as e:
        logger.error(f"Error generating categorical stats for {column}: {str(e)}")
        raise

def create_histogram(df, column, bins=10):
    """
    Create a histogram for a numeric column
    
    Args:
        df (pd.DataFrame): Input DataFrame
        column (str): Column name
        bins (int): Number of bins
        
    Returns:
        str: Base64 encoded image
    """
    try:
        if column not in df.columns:
            raise ValueError(f"Column {column} not found in dataset")
        
        if not pd.api.types.is_numeric_dtype(df[column]):
            raise ValueError(f"Column {column} is not numeric")
        
        plt.figure(figsize=(10, 6))
        sns.histplot(df[column].dropna(), kde=True, bins=bins)
        plt.title(f'Distribution of {column}')
        plt.xlabel(column)
        plt.ylabel('Frequency')
        plt.tight_layout()
        
        # Save plot to bytesIO object
        buf = BytesIO()
        plt.savefig(buf, format='png')
        plt.close()
        buf.seek(0)
        
        # Encode to base64
        image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        return image_base64
    
    except Exception as e:
        logger.error(f"Error creating histogram for {column}: {str(e)}")
        raise

def create_bar_chart(df, column, limit=20):
    """
    Create a bar chart for a categorical column
    
    Args:
        df (pd.DataFrame): Input DataFrame
        column (str): Column name
        limit (int): Maximum number of categories to display
        
    Returns:
        str: Base64 encoded image
    """
    try:
        if column not in df.columns:
            raise ValueError(f"Column {column} not found in dataset")
        
        # Get value counts
        value_counts = df[column].value_counts().sort_values(ascending=False).head(limit)
        
        plt.figure(figsize=(12, 6))
        sns.barplot(x=value_counts.index, y=value_counts.values)
        plt.title(f'Counts of {column}')
        plt.xlabel(column)
        plt.ylabel('Count')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        
        # Save plot to bytesIO object
        buf = BytesIO()
        plt.savefig(buf, format='png')
        plt.close()
        buf.seek(0)
        
        # Encode to base64
        image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        return image_base64
    
    except Exception as e:
        logger.error(f"Error creating bar chart for {column}: {str(e)}")
        raise

def create_scatter_plot(df, x_column, y_column):
    """
    Create a scatter plot for two numeric columns
    
    Args:
        df (pd.DataFrame): Input DataFrame
        x_column (str): X-axis column name
        y_column (str): Y-axis column name
        
    Returns:
        str: Base64 encoded image
    """
    try:
        if x_column not in df.columns or y_column not in df.columns:
            raise ValueError(f"Column {x_column} or {y_column} not found in dataset")
        
        if not pd.api.types.is_numeric_dtype(df[x_column]) or not pd.api.types.is_numeric_dtype(df[y_column]):
            raise ValueError(f"Both {x_column} and {y_column} must be numeric")
        
        plt.figure(figsize=(10, 6))
        sns.scatterplot(x=df[x_column], y=df[y_column])
        
        # Calculate correlation
        correlation = df[[x_column, y_column]].corr().iloc[0, 1]
        plt.title(f'Scatter plot of {x_column} vs {y_column} (r = {correlation:.2f})')
        plt.xlabel(x_column)
        plt.ylabel(y_column)
        plt.tight_layout()
        
        # Save plot to bytesIO object
        buf = BytesIO()
        plt.savefig(buf, format='png')
        plt.close()
        buf.seek(0)
        
        # Encode to base64
        image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        return image_base64
    
    except Exception as e:
        logger.error(f"Error creating scatter plot for {x_column} vs {y_column}: {str(e)}")
        raise 