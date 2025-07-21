# DataSage: Advanced Data Analytics Platform

![DataSage Logo](https://github.com/yourusername/datasage/raw/main/public/favicon.svg)

DataSage is a comprehensive data analytics platform that combines powerful data processing capabilities with an intuitive user interface. It enables users to upload, analyze, visualize, and derive insights from their datasets through exploratory data analysis (EDA), natural language SQL queries, and machine learning model training.

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Installation](#installation)
- [Usage](#usage)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

## Features

DataSage offers a rich set of features designed to streamline your data analytics workflow:

### Data Management
- Upload and process CSV, Excel, and JSON files
- Session-based data storage with MongoDB integration
- Data preview and metadata extraction
- Download processed datasets

### Exploratory Data Analysis (EDA)
- Comprehensive dataset overview statistics
- Column-level statistics and distribution analysis
- Correlation analysis between variables
- Interactive data visualizations

### Natural Language SQL Assistant
- Convert natural language questions to SQL queries
- Execute SQL queries against your dataset
- View query results in a structured format
- Schema information for reference

### Data Preprocessing
- Handle missing values with various strategies
- Normalize and standardize numeric data
- Encode categorical variables
- Filter and transform data
- Track preprocessing history

### Model Training
- Train classification and regression models
- Hyperparameter tuning
- Model evaluation metrics
- Feature importance analysis

## Screenshots

### Home Page and Data Upload
![Home Page](https://i.imgur.com/GvpGBqK.png)
*The home page allows users to upload datasets or use sample data to explore the platform's features.*

### Data Overview
![Data Overview](https://i.imgur.com/nnEGBmb.png)
*The overview page provides a comprehensive summary of the dataset's structure and content.*

### Data Preprocessing
![Data Preprocessing](https://i.imgur.com/4Gj3tZZ.png)
*The preprocessing page offers various operations to clean and transform your data.*

### Exploratory Data Analysis
![EDA Page](https://i.imgur.com/BIcHPBJ.png)
*The EDA page offers various visualization options to explore relationships and distributions in your data.*

### SQL Assistant
![SQL Assistant](https://i.imgur.com/dGJYG7H.png)
*The SQL Assistant allows users to query their data using natural language and view the results instantly.*

## Installation

### Prerequisites
- Python 3.8 or higher
- Node.js 14 or higher
- MongoDB 4.4 or higher

### Backend Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/datasage.git
   cd datasage
   ```

2. Set up a Python virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install backend dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Set up MongoDB:
   - Install MongoDB Compass from [MongoDB Download Center](https://www.mongodb.com/try/download/compass)
   - Create a database named `datasage`

5. Create a `.env` file in the root directory:
   ```
   DEBUG=True
   SECRET_KEY=datasage-secret-key
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB=datasage
   LANGCHAIN_API_KEY=your_langchain_api_key
   GROQ_API_KEY=your_groq_api_key
   HOST=0.0.0.0
   PORT=5000
   ```

### Frontend Setup

1. Install frontend dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the root directory (if not already created):
   ```
   VITE_API_BASE_URL=http://localhost:5000/api
   ```

## Usage

### Running the Application

1. Start the backend server:
   ```
   python run.py
   ```

2. In a separate terminal, start the frontend development server:
   ```
   npm run dev
   ```

3. Access the application in your web browser at `http://localhost:5173`

### Basic Workflow

1. **Upload Data**: Start by uploading a dataset or using the sample data provided.
2. **Explore Overview**: View the dataset's structure, column types, and basic statistics.
3. **Perform EDA**: Analyze distributions, correlations, and visualize relationships in your data.
4. **Preprocess Data**: Clean and transform your data to prepare it for analysis or modeling.
5. **Query with SQL**: Use natural language to ask questions about your data.
6. **Train Models**: Build and evaluate machine learning models on your dataset.
7. **Generate Reports**: Create comprehensive reports of your findings.

## Architecture

DataSage follows a modern web application architecture:

- **Frontend**: React with Vite, Tailwind CSS, and Chart.js for visualizations
- **Backend**: Flask RESTful API with MongoDB for data storage
- **Data Processing**: Pandas, NumPy, and scikit-learn for data manipulation and analysis
- **Natural Language Processing**: Integration with language models for SQL translation

### Directory Structure

```
datasage/
├── backend/            # Flask backend
│   ├── config/         # Configuration settings
│   ├── database/       # Database models and connections
│   ├── routes/         # API endpoints
│   ├── services/       # Business logic
│   └── utils/          # Helper functions
├── src/                # React frontend
│   ├── api/            # API client
│   ├── components/     # Reusable UI components
│   ├── context/        # React context providers
│   ├── pages/          # Page components
│   └── utils/          # Helper functions
├── public/             # Static assets
├── sessions/           # Session data storage
├── models/             # Saved ML models
└── uploads/            # Temporary file uploads
```

## API Reference

DataSage provides a comprehensive RESTful API for all operations:

### Session Management
- `POST /api/sessions` - Create a new session
- `GET /api/sessions` - List all sessions
- `GET /api/sessions/{session_id}` - Get session details
- `DELETE /api/sessions/{session_id}` - Delete a session
- `GET /api/sessions/{session_id}/data` - Get session data
- `GET /api/sessions/{session_id}/metadata` - Get session metadata

### EDA
- `GET /api/eda/sessions/{session_id}/overview` - Get dataset overview
- `GET /api/eda/sessions/{session_id}/statistics` - Get dataset statistics
- `GET /api/eda/sessions/{session_id}/correlation` - Get correlation matrix

### SQL
- `POST /api/sql/query` - Execute natural language to SQL query
- `POST /api/sql/execute` - Execute direct SQL query
- `GET /api/sql/schema` - Get dataset schema

### Preprocessing
- `GET /api/preprocessing/operations` - Get available preprocessing operations
- `POST /api/preprocessing/operations/{operation}` - Apply preprocessing operation

### Model Training
- `GET /api/models/supported` - Get supported model types
- `POST /api/models/train` - Train a model
- `GET /api/models/{model_name}` - Get model details
- `POST /api/models/{model_name}/predict` - Make predictions

## Contributing

Contributions to DataSage are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

© 2025 DataSage. All rights reserved. 