import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Base directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Directory for uploaded files
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', os.path.join(BASE_DIR, 'uploads'))
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Directory for temporary files
TEMP_FOLDER = os.getenv('TEMP_FOLDER', os.path.join(BASE_DIR, 'temp'))
os.makedirs(TEMP_FOLDER, exist_ok=True)

# Directory for saving trained models
MODEL_FOLDER = os.environ.get('MODEL_FOLDER', os.path.join(BASE_DIR, 'models'))
os.makedirs(MODEL_FOLDER, exist_ok=True)

# Alias for MODEL_FOLDER for backward compatibility
MODELS_FOLDER = MODEL_FOLDER

# Directory for sessions
SESSION_FOLDER = os.environ.get('SESSION_FOLDER', os.path.join(BASE_DIR, 'sessions'))
os.makedirs(SESSION_FOLDER, exist_ok=True)

# MongoDB configuration
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
MONGODB_DB = os.getenv('MONGODB_DB', 'datasage')
MONGODB_COLLECTION_SESSIONS = 'sessions'
MONGODB_COLLECTION_DATASETS = 'datasets'
MONGODB_COLLECTION_USERS = 'users'

# API Keys - should be set in environment variables
LANGCHAIN_API_KEY = os.getenv('LANGCHAIN_API_KEY', '')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')

# Session settings
SESSION_TIMEOUT = 60 * 60 * 24  # 24 hours (in seconds)

# Flask settings
DEBUG = os.environ.get('DEBUG', 'True').lower() == 'true'
SECRET_KEY = os.environ.get('SECRET_KEY', 'datasage-secret-key')
HOST = os.environ.get('HOST', '0.0.0.0')
PORT = int(os.environ.get('PORT', 5000))

# Maximum file size for uploads (200MB)
MAX_CONTENT_LENGTH = 200 * 1024 * 1024  # 200MB

# Supported file types for upload
ALLOWED_EXTENSIONS = {'csv', 'xls', 'xlsx'}

# Model training settings
MAX_TRAINING_ROWS = 100000  # Maximum number of rows to use for training
TRAIN_TEST_SPLIT = 0.2  # Fraction of data to use for testing

# Logging configuration
LOGGING_CONFIG = {
    'version': 1,
    'formatters': {
        'default': {
            'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S'
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'default',
            'level': 'INFO',
        },
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'formatter': 'default',
            'filename': os.path.join(BASE_DIR, 'logs', 'datasage.log'),
            'maxBytes': 10485760,  # 10MB
            'backupCount': 5,
            'level': 'INFO',
        },
    },
    'loggers': {
        'datasage': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': True,
        },
    }
}

# Setup logging
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('datasage') 