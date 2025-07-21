import pandas as pd
import numpy as np
import os

def load_dataset(file_path):
    """Load a dataset from a file path, supporting various file formats."""
    if not os.path.exists(file_path):
        return None
    
    file_ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if file_ext == '.csv':
            return pd.read_csv(file_path)
        elif file_ext in ['.xlsx', '.xls']:
            return pd.read_excel(file_path)
        elif file_ext == '.json':
            return pd.read_json(file_path)
        elif file_ext == '.parquet':
            return pd.read_parquet(file_path)
        else:
            # Default to CSV
            return pd.read_csv(file_path)
    except Exception as e:
        print(f"Error loading dataset: {str(e)}")
        return None

def get_column_statistics(df, column_name):
    """Get comprehensive statistics for a specific column in a dataframe."""
    if column_name not in df.columns:
        return {
            "error": f"Column {column_name} not found in dataset"
        }
    
    # Extract the column
    series = df[column_name]
    
    # Basic statistics
    total_values = len(series)
    non_null_values = series.count()
    missing_values = total_values - non_null_values
    missing_percent = (missing_values / total_values * 100) if total_values > 0 else 0
    unique_values = series.nunique()
    
    # Initialize result dictionary
    result = {
        "missing": missing_values,
        "missingPercent": missing_percent.round(1),
        "unique": unique_values,
    }
    
    # Check if column is numeric
    is_numeric = pd.api.types.is_numeric_dtype(series) and series.dropna().map(lambda x: isinstance(x, (int, float))).all()
    
    if is_numeric:
        # Get numeric values
        numeric_values = series.dropna().astype(float)
        
        if len(numeric_values) > 0:
            # Calculate statistics
            sorted_values = numeric_values.sort_values()
            min_val = sorted_values.iloc[0]
            max_val = sorted_values.iloc[-1]
            mean_val = numeric_values.mean()
            median_val = numeric_values.median()
            std_val = numeric_values.std()
            
            # Calculate quartiles
            q1 = numeric_values.quantile(0.25)
            q3 = numeric_values.quantile(0.75)
            iqr = q3 - q1
            
            # Identify outliers
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            outliers = numeric_values[(numeric_values < lower_bound) | (numeric_values > upper_bound)]
            outliers_count = len(outliers)
            outliers_percent = (outliers_count / len(numeric_values) * 100) if len(numeric_values) > 0 else 0
            
            # Add to result
            result.update({
                "mean": mean_val,
                "median": median_val,
                "stdDev": std_val,
                "min": min_val,
                "max": max_val,
                "range": max_val - min_val,
                "q1": q1,
                "q3": q3,
                "iqr": iqr,
                "outliers": outliers_count,
                "outliersPercent": outliers_percent.round(1),
            })
            
            # Generate histogram data
            # Determine number of bins (Sturges' rule)
            num_bins = max(5, int(1 + 3.322 * np.log10(len(numeric_values))))
            
            # Calculate bin width
            bin_width = (max_val - min_val) / num_bins if max_val > min_val else 1
            
            # Create histogram data
            histogram_data = []
            
            if max_val > min_val:
                hist, bin_edges = np.histogram(numeric_values, bins=num_bins)
                cumulative = np.cumsum(hist) / len(numeric_values) * 100
                
                for i in range(len(hist)):
                    histogram_data.append({
                        "bin": f"{bin_edges[i]:.1f} - {bin_edges[i+1]:.1f}",
                        "count": int(hist[i]),
                        "cumulativePercent": float(cumulative[i].round(1))
                    })
            else:
                # All values are the same
                histogram_data.append({
                    "bin": f"{min_val:.1f}",
                    "count": len(numeric_values),
                    "cumulativePercent": 100.0
                })
            
            result["histogramData"] = histogram_data
        
    else:
        # Categorical column
        value_counts = series.value_counts().reset_index()
        value_counts.columns = ['category', 'count']
        
        # Convert to list of dictionaries
        category_data = value_counts.to_dict('records')
        
        # Limit to top categories
        if len(category_data) > 10:
            top_categories = category_data[:10]
            other_count = sum(item['count'] for item in category_data[10:])
            
            if other_count > 0:
                top_categories.append({
                    "category": "Other", 
                    "count": other_count
                })
            
            category_data = top_categories
        
        # Add to result
        result["histogramData"] = category_data
    
    return result 