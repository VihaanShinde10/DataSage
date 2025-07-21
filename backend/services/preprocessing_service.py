import pandas as pd
import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, MinMaxScaler, LabelEncoder
import logging

logger = logging.getLogger('datasage')

def handle_missing_values(df, columns=None, strategy='mean'):
    """
    Handle missing values in a DataFrame.
    
    Args:
        df (pd.DataFrame): Input DataFrame
        columns (list): List of column names to process
        strategy (str): Strategy for numeric columns ('mean', 'median', 'constant')
    
    Returns:
        pd.DataFrame: Processed DataFrame
    """
    result_df = df.copy()
    
    try:
        # If no columns specified, use all columns
        if not columns:
            numeric_cols = result_df.select_dtypes(include='number').columns.tolist()
            categorical_cols = result_df.select_dtypes(exclude='number').columns.tolist()
            
            # Handle numeric columns
            if numeric_cols and strategy in ['mean', 'median', 'constant']:
                imputer = SimpleImputer(strategy=strategy)
                result_df[numeric_cols] = imputer.fit_transform(result_df[numeric_cols])
            
            # Handle categorical columns
            if categorical_cols:
                cat_imputer = SimpleImputer(strategy='most_frequent')
                result_df[categorical_cols] = cat_imputer.fit_transform(result_df[categorical_cols])
        else:
            # Process only specified columns
            for column in columns:
                if column in result_df.columns:
                    if pd.api.types.is_numeric_dtype(result_df[column]):
                        # Numeric column
                        if strategy in ['mean', 'median', 'constant']:
                            imputer = SimpleImputer(strategy=strategy)
                            result_df[[column]] = imputer.fit_transform(result_df[[column]])
                    else:
                        # Categorical column
                        cat_imputer = SimpleImputer(strategy='most_frequent')
                        result_df[[column]] = cat_imputer.fit_transform(result_df[[column]])
        
        return result_df
    
    except Exception as e:
        logger.error(f"Error handling missing values: {str(e)}")
        raise

def normalize_data(df, columns=None, method='minmax'):
    """
    Normalize numeric data in a DataFrame.
    
    Args:
        df (pd.DataFrame): Input DataFrame
        columns (list): List of column names to normalize
        method (str): Normalization method ('minmax' or 'zscore')
    
    Returns:
        pd.DataFrame: Processed DataFrame
    """
    result_df = df.copy()
    
    try:
        # If no columns specified, use all numeric columns
        if not columns:
            columns = result_df.select_dtypes(include='number').columns.tolist()
        else:
            # Filter to include only numeric columns
            columns = [col for col in columns if col in result_df.columns and pd.api.types.is_numeric_dtype(result_df[col])]
        
        if columns:
            if method == 'minmax':
                scaler = MinMaxScaler()
            else:  # 'zscore'
                scaler = StandardScaler()
            
            # Apply scaling
            result_df[columns] = scaler.fit_transform(result_df[columns])
        
        return result_df
    
    except Exception as e:
        logger.error(f"Error normalizing data: {str(e)}")
        raise

def encode_categorical(df, columns=None, method='onehot'):
    """
    Encode categorical variables in a DataFrame.
    
    Args:
        df (pd.DataFrame): Input DataFrame
        columns (list): List of column names to encode
        method (str): Encoding method ('onehot' or 'label')
    
    Returns:
        pd.DataFrame: Processed DataFrame
    """
    result_df = df.copy()
    
    try:
        # If no columns specified, use all categorical columns
        if not columns:
            columns = result_df.select_dtypes(exclude='number').columns.tolist()
        else:
            # Filter to include only non-numeric columns
            columns = [col for col in columns if col in result_df.columns and not pd.api.types.is_numeric_dtype(result_df[col])]
        
        for column in columns:
            if method == 'onehot':
                # One-hot encoding
                dummies = pd.get_dummies(result_df[column], prefix=column)
                result_df = pd.concat([result_df.drop(column, axis=1), dummies], axis=1)
            elif method == 'label':
                # Label encoding
                encoder = LabelEncoder()
                result_df[column] = encoder.fit_transform(result_df[column].astype(str))
        
        return result_df
    
    except Exception as e:
        logger.error(f"Error encoding data: {str(e)}")
        raise

def filter_rows(df, column, operator, value):
    """
    Filter rows based on a condition.
    
    Args:
        df (pd.DataFrame): Input DataFrame
        column (str): Column name to filter on
        operator (str): Comparison operator ('>', '<', '==', '!=', etc.)
        value: Value to compare against
    
    Returns:
        pd.DataFrame: Filtered DataFrame
    """
    result_df = df.copy()
    
    try:
        if column not in result_df.columns:
            raise ValueError(f"Column {column} not found in dataset")
        
        # Apply filter based on operator
        if operator == '>':
            result_df = result_df[result_df[column] > value]
        elif operator == '<':
            result_df = result_df[result_df[column] < value]
        elif operator == '>=':
            result_df = result_df[result_df[column] >= value]
        elif operator == '<=':
            result_df = result_df[result_df[column] <= value]
        elif operator == '==':
            result_df = result_df[result_df[column] == value]
        elif operator == '!=':
            result_df = result_df[result_df[column] != value]
        elif operator == 'contains':
            result_df = result_df[result_df[column].astype(str).str.contains(str(value))]
        elif operator == 'starts_with':
            result_df = result_df[result_df[column].astype(str).str.startswith(str(value))]
        elif operator == 'ends_with':
            result_df = result_df[result_df[column].astype(str).str.endswith(str(value))]
        else:
            raise ValueError(f"Unsupported operator: {operator}")
        
        return result_df
    
    except Exception as e:
        logger.error(f"Error filtering rows: {str(e)}")
        raise

def apply_binning(df, columns=None, bins=5):
    """
    Apply binning to numeric columns.
    
    Args:
        df (pd.DataFrame): Input DataFrame
        columns (list): List of column names to apply binning
        bins (int): Number of bins to create
        
    Returns:
        pd.DataFrame: Processed DataFrame with binned columns
    """
    result_df = df.copy()
    
    try:
        # If no columns specified, use all numeric columns
        if not columns:
            columns = result_df.select_dtypes(include='number').columns.tolist()
        else:
            # Filter to include only numeric columns
            columns = [col for col in columns if col in result_df.columns and pd.api.types.is_numeric_dtype(result_df[col])]
        
        # Apply binning to each column
        for column in columns:
            result_df[f"{column}_binned"] = pd.cut(result_df[column], bins=bins)
        
        return result_df
    
    except Exception as e:
        logger.error(f"Error applying binning: {str(e)}")
        raise

def apply_log_transform(df, columns=None):
    """
    Apply log transformation to numeric columns.
    
    Args:
        df (pd.DataFrame): Input DataFrame
        columns (list): List of column names to transform
        
    Returns:
        pd.DataFrame: Processed DataFrame with log-transformed columns
    """
    result_df = df.copy()
    
    try:
        # If no columns specified, use all numeric columns
        if not columns:
            columns = result_df.select_dtypes(include='number').columns.tolist()
        else:
            # Filter to include only numeric columns
            columns = [col for col in columns if col in result_df.columns and pd.api.types.is_numeric_dtype(result_df[col])]
        
        # Apply log transformation to each column
        for column in columns:
            # Add a small constant to handle zeros and negative values
            min_val = result_df[column].min()
            offset = 0
            if min_val <= 0:
                offset = abs(min_val) + 1
            
            result_df[column] = np.log(result_df[column] + offset)
        
        return result_df
    
    except Exception as e:
        logger.error(f"Error applying log transformation: {str(e)}")
        raise

def apply_frequency_encoding(df, columns=None):
    """
    Apply frequency encoding to categorical columns.
    
    Args:
        df (pd.DataFrame): Input DataFrame
        columns (list): List of column names to encode
        
    Returns:
        pd.DataFrame: Processed DataFrame with frequency-encoded columns
    """
    result_df = df.copy()
    
    try:
        # If no columns specified, use all categorical columns
        if not columns:
            columns = result_df.select_dtypes(exclude='number').columns.tolist()
        else:
            # Filter to include only categorical columns
            columns = [col for col in columns if col in result_df.columns and not pd.api.types.is_numeric_dtype(result_df[col])]
        
        # Apply frequency encoding to each column
        for column in columns:
            frequency = result_df[column].value_counts(normalize=True)
            result_df[f"{column}_freq"] = result_df[column].map(frequency)
        
        return result_df
    
    except Exception as e:
        logger.error(f"Error applying frequency encoding: {str(e)}")
        raise 