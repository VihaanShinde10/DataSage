// Chart helper functions

export const getChartColors = (count) => {
  const baseColors = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
    '#82CA9D', '#FFC658', '#FF7C43', '#A4DE6C', '#D0ED57'
  ];
  
  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }
  
  // Generate additional colors if needed
  const colors = [...baseColors];
  for (let i = baseColors.length; i < count; i++) {
    const hue = (i * 137.508) % 360; // Golden angle approximation
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }
  
  return colors;
};

export const prepareBarChartData = (data, xField, yField) => {
  const aggregatedData = {};
  
  data.forEach(row => {
    const xValue = row[xField];
    const yValue = parseFloat(row[yField]) || 0;
    
    if (!aggregatedData[xValue]) {
      aggregatedData[xValue] = 0;
    }
    aggregatedData[xValue] += yValue;
  });
  
  return Object.entries(aggregatedData).map(([name, value]) => ({
    name,
    value
  }));
};

export const prepareLineChartData = (data, xField, yField) => {
  return data
    .map(row => ({
      name: row[xField],
      value: parseFloat(row[yField]) || 0
    }))
    .sort((a, b) => new Date(a.name) - new Date(b.name));
};

export const preparePieChartData = (data, field) => {
  const aggregatedData = {};
  
  data.forEach(row => {
    const value = row[field];
    if (!aggregatedData[value]) {
      aggregatedData[value] = 0;
    }
    aggregatedData[value]++;
  });
  
  return Object.entries(aggregatedData).map(([name, value]) => ({
    name,
    value
  }));
};

export const prepareScatterPlotData = (data, xField, yField) => {
  return data.map(row => ({
    x: parseFloat(row[xField]) || 0,
    y: parseFloat(row[yField]) || 0
  }));
};

export const calculateCorrelationMatrix = (data, numericColumns) => {
  const matrix = {};
  
  numericColumns.forEach(col1 => {
    matrix[col1] = {};
    numericColumns.forEach(col2 => {
      if (col1 === col2) {
        matrix[col1][col2] = 1;
      } else {
        matrix[col1][col2] = calculateCorrelation(
          data.map(row => parseFloat(row[col1]) || 0),
          data.map(row => parseFloat(row[col2]) || 0)
        );
      }
    });
  });
  
  return matrix;
};

const calculateCorrelation = (x, y) => {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
};

export const getChartOptions = (type, title) => {
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: title
      }
    }
  };
  
  switch (type) {
    case 'bar':
      return {
        ...baseOptions,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      };
    case 'line':
      return {
        ...baseOptions,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      };
    case 'pie':
      return {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          legend: {
            position: 'right'
          }
        }
      };
    case 'scatter':
      return {
        ...baseOptions,
        scales: {
          x: {
            type: 'linear',
            position: 'bottom'
          },
          y: {
            type: 'linear',
            position: 'left'
          }
        }
      };
    default:
      return baseOptions;
  }
}; 