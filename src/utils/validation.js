// Validation utility functions

export const validateFileType = (file, allowedTypes) => {
  if (!file) {
    console.error('validateFileType: File is null or undefined');
    return false;
  }
  
  // If file has no type, try to infer from name
  if (!file.type || file.type === '') {
    console.warn('validateFileType: File has no type property, attempting to infer from name');
    
    if (!file.name) {
      console.error('validateFileType: File has no name property to infer type from');
      return false;
    }
    
    const extension = file.name.split('.').pop().toLowerCase();
    
    // Map extensions to mime types
    const extensionToMimeType = {
      'csv': 'text/csv',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'json': 'application/json'
    };
    
    const inferredType = extensionToMimeType[extension];
    console.log(`validateFileType: Inferred type ${inferredType} from extension .${extension}`);
    
    return inferredType && allowedTypes.includes(inferredType);
  }
  
  return allowedTypes.includes(file.type);
};

export const validateFileSize = (file, maxSize) => {
  if (!file || typeof file.size !== 'number') {
    return false;
  }
  return file.size <= maxSize;
};

export const validateCSVStructure = (csvText) => {
  try {
    if (!csvText || typeof csvText !== 'string') {
      return { isValid: false, error: 'Invalid CSV content.' };
    }

    // Split the CSV text into lines and remove empty lines
    const lines = csvText.trim().split('\n').filter(line => line.trim());
    
    // Check if file is empty
    if (lines.length === 0) {
      return { isValid: false, error: 'The file appears to be empty.' };
    }

    // Check if there are headers
    const headers = lines[0].split(',').map(header => header.trim());
    if (headers.length === 0) {
      return { isValid: false, error: 'No headers found in the CSV file.' };
    }

    // Check for duplicate headers
    const uniqueHeaders = new Set(headers);
    if (uniqueHeaders.size !== headers.length) {
      return { isValid: false, error: 'Duplicate column headers found in the CSV file.' };
    }

    // Check if all rows have the same number of columns
    const headerCount = headers.length;
    const invalidRows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',').map(col => col.trim());
      if (columns.length !== headerCount) {
        invalidRows.push({
          row: i + 1,
          expected: headerCount,
          actual: columns.length
        });
      }
    }

    if (invalidRows.length > 0) {
      const errorDetails = invalidRows
        .map(row => `Row ${row.row}: ${row.actual} columns (expected ${row.expected})`)
        .join('; ');
      return { 
        isValid: false, 
        error: `Inconsistent number of columns found in the following rows: ${errorDetails}` 
      };
    }

    // Check for empty headers
    const emptyHeaders = headers.filter(header => !header);
    if (emptyHeaders.length > 0) {
      return {
        isValid: false,
        error: `Empty column headers found at positions: ${emptyHeaders.map((_, i) => i + 1).join(', ')}`
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('CSV validation error:', error);
    return { 
      isValid: false, 
      error: 'Error validating CSV structure: ' + (error.message || 'Unknown error') 
    };
  }
};

export const validateNumericColumn = (data, column) => {
  if (!Array.isArray(data) || !column) {
    return false;
  }
  return data.every(row => {
    const value = row[column];
    return value === '' || value === null || !isNaN(parseFloat(value));
  });
};

export const validateDateColumn = (data, column) => {
  if (!Array.isArray(data) || !column) {
    return false;
  }
  return data.every(row => {
    const value = row[column];
    if (value === '' || value === null) return true;
    const date = new Date(value);
    return date instanceof Date && !isNaN(date);
  });
};

export const validateBooleanColumn = (data, column) => {
  if (!Array.isArray(data) || !column) {
    return false;
  }
  const validValues = ['true', 'false', '1', '0', '', null];
  return data.every(row => {
    const value = String(row[column]).toLowerCase().trim();
    return validValues.includes(value);
  });
};

export const validateRequiredFields = (data, requiredFields) => {
  if (!Array.isArray(data) || !Array.isArray(requiredFields)) {
    return { isValid: false, missingFields: [] };
  }

  const missingFields = [];
  
  requiredFields.forEach(field => {
    if (!field) return;
    const hasEmptyValues = data.some(row => 
      row[field] === '' || row[field] === null || row[field] === undefined
    );
    if (hasEmptyValues) missingFields.push(field);
  });
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
};

export const validateDataRange = (data, column, min, max) => {
  if (!Array.isArray(data) || !column || typeof min !== 'number' || typeof max !== 'number') {
    return false;
  }
  return data.every(row => {
    const value = parseFloat(row[column]);
    return isNaN(value) || (value >= min && value <= max);
  });
};

export const validateUniqueValues = (data, column) => {
  if (!Array.isArray(data) || !column) {
    return false;
  }
  const values = data.map(row => row[column]).filter(value => value !== '' && value !== null);
  const uniqueValues = new Set(values);
  return values.length === uniqueValues.size;
}; 