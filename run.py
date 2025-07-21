import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Ensure API keys are available in environment
api_keys = {
    'LANGCHAIN_API_KEY': os.environ.get('LANGCHAIN_API_KEY'),
    'GROQ_API_KEY': os.environ.get('GROQ_API_KEY')
}

# Log if keys are missing (but don't print the actual keys)
for key, value in api_keys.items():
    if not value:
        print(f"Warning: {key} is not set in environment variables")
    else:
        print(f"Found {key} in environment")

# Import app after loading environment variables
from app import app

if __name__ == '__main__':
    app.run(
        debug=os.environ.get('DEBUG', 'True').lower() == 'true',
        host=os.environ.get('HOST', '0.0.0.0'),
        port=int(os.environ.get('PORT', 5000))
    ) 