// Data processing utility functions

export const processCSVData = (csvText) => {
  try {
    if (!csvText || typeof csvText !== 'string') {
      throw new Error('Invalid CSV content');
    }

    // Split the CSV text into lines and remove empty lines
    const lines = csvText.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('Empty CSV file');
    }

    // Process headers
    const headers = lines[0].split(',').map(header => header.trim());
    if (headers.length === 0) {
      throw new Error('No headers found in CSV file');
    }

    // Check for duplicate headers
    const uniqueHeaders = new Set(headers);
    if (uniqueHeaders.size !== headers.length) {
      throw new Error('Duplicate column headers found');
    }

    // Process data rows
    const data = lines.slice(1).map((line, index) => {
      const values = line.split(',').map(value => value.trim());
      
      // Ensure each row has the same number of columns as headers
      if (values.length !== headers.length) {
        throw new Error(`Row ${index + 2} has ${values.length} columns while headers have ${headers.length} columns`);
      }

      // Create object with header-value pairs
      return headers.reduce((obj, header, i) => {
        obj[header] = values[i];
        return obj;
      }, {});
    });

    return { headers, data };
  } catch (error) {
    console.error('CSV processing error:', error);
    throw error;
  }
};

export const detectColumnTypes = (data) => {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      return {};
    }

    const columnTypes = {};
    const firstRow = data[0];

    Object.keys(firstRow).forEach(column => {
      const values = data
        .map(row => row[column])
        .filter(val => val !== '' && val !== null && val !== undefined);
      
      if (values.length === 0) {
        columnTypes[column] = 'Unknown';
        return;
      }

      // Check if all values are numbers
      if (values.every(val => !isNaN(parseFloat(val)) && isFinite(val))) {
        columnTypes[column] = 'Numeric';
        return;
      }

      // Check if all values are dates
      if (values.every(val => {
        const date = new Date(val);
        return date instanceof Date && !isNaN(date);
      })) {
        columnTypes[column] = 'DateTime';
        return;
      }

      // Check if all values are boolean
      const booleanValues = ['true', 'false', '0', '1', 'yes', 'no'];
      if (values.every(val => booleanValues.includes(String(val).toLowerCase().trim()))) {
        columnTypes[column] = 'Boolean';
        return;
      }

      // Default to categorical
      columnTypes[column] = 'Categorical';
    });

    return columnTypes;
  } catch (error) {
    console.error('Column type detection error:', error);
    return {};
  }
};

export const calculateStatistics = (data, column) => {
  try {
    if (!Array.isArray(data) || !column || data.length === 0) {
      return null;
    }

    const values = data
      .map(row => parseFloat(row[column]))
      .filter(val => !isNaN(val) && isFinite(val));
    
    if (!values.length) return null;
    
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0 
      ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2
      : sorted[Math.floor(sorted.length/2)];
      
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      mean,
      median,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
      missing: data.length - values.length
    };
  } catch (error) {
    console.error('Statistics calculation error:', error);
    return null;
  }
};

export const fillMissingValues = (data, column, method, value = null) => {
  try {
    if (!Array.isArray(data) || !column || data.length === 0) {
      return data;
    }

    const stats = calculateStatistics(data, column);
    if (!stats) return data;
    
    return data.map(row => {
      if (row[column] === '' || row[column] === null || row[column] === undefined) {
        switch (method) {
          case 'mean':
            return { ...row, [column]: stats.mean };
          case 'median':
            return { ...row, [column]: stats.median };
          case 'mode':
            // Implement mode calculation if needed
            return row;
          case 'constant':
            return { ...row, [column]: value };
          default:
            return row;
        }
      }
      return row;
    });
  } catch (error) {
    console.error('Fill missing values error:', error);
    return data;
  }
};

export const normalizeData = (data, column) => {
  try {
    if (!Array.isArray(data) || !column || data.length === 0) {
      return data;
    }

    const stats = calculateStatistics(data, column);
    if (!stats) return data;
    
    return data.map(row => {
      const value = parseFloat(row[column]);
      if (!isNaN(value) && isFinite(value)) {
        return { ...row, [column]: (value - stats.min) / (stats.max - stats.min) };
      }
      return row;
    });
  } catch (error) {
    console.error('Data normalization error:', error);
    return data;
  }
};

export const standardizeData = (data, column) => {
  try {
    if (!Array.isArray(data) || !column || data.length === 0) {
      return data;
    }

    const stats = calculateStatistics(data, column);
    if (!stats) return data;
    
    return data.map(row => {
      const value = parseFloat(row[column]);
      if (!isNaN(value) && isFinite(value)) {
        return { ...row, [column]: (value - stats.mean) / stats.stdDev };
      }
      return row;
    });
  } catch (error) {
    console.error('Data standardization error:', error);
    return data;
  }
};

export const calculateMissingPercentage = (data) => {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      return '0%';
    }
    
    const totalCells = data.length * Object.keys(data[0]).length;
    let missingCells = 0;

    data.forEach(row => {
      Object.values(row).forEach(value => {
        if (value === '' || value === null || value === undefined) {
          missingCells++;
        }
      });
    });

    const percentage = (missingCells / totalCells) * 100;
    return `${percentage.toFixed(1)}%`;
  } catch (error) {
    console.error('Missing percentage calculation error:', error);
    return '0%';
  }
};

export const calculateColumnMissingPercentage = (data, column) => {
  try {
    if (!Array.isArray(data) || !column || data.length === 0) {
      return '0%';
    }
    
    let missingCount = 0;
    data.forEach(row => {
      if (row[column] === '' || row[column] === null || row[column] === undefined) {
        missingCount++;
      }
    });

    const percentage = (missingCount / data.length) * 100;
    return `${percentage.toFixed(1)}%`;
  } catch (error) {
    console.error('Column missing percentage calculation error:', error);
    return '0%';
  }
};

export const countUniqueValues = (data, column) => {
  try {
    if (!Array.isArray(data) || !column || data.length === 0) {
      return 0;
    }
    
    const uniqueValues = new Set(
      data
        .map(row => row[column])
        .filter(val => val !== '' && val !== null && val !== undefined)
    );
    return uniqueValues.size;
  } catch (error) {
    console.error('Unique values count error:', error);
    return 0;
  }
};

export const getSampleValues = (data, column) => {
  try {
    if (!Array.isArray(data) || !column || data.length === 0) {
      return '';
    }
    
    const values = data
      .map(row => row[column])
      .filter(val => val !== '' && val !== null && val !== undefined)
      .slice(0, 3);
      
    return values.join(', ');
  } catch (error) {
    console.error('Sample values extraction error:', error);
    return '';
  }
};

export const formatFileSize = (bytes) => {
  try {
    if (typeof bytes !== 'number' || bytes < 0) {
      return '0 Bytes';
    }
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  } catch (error) {
    console.error('File size formatting error:', error);
    return '0 Bytes';
  }
}; 