import os
import logging
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pandas as pd

from backend.config.settings import (
    DEBUG, SECRET_KEY, HOST, PORT, UPLOAD_FOLDER, 
    MAX_CONTENT_LENGTH, ALLOWED_EXTENSIONS
)
from backend.services.session_service import (
    create_session, get_session, get_all_sessions, 
    add_session_data, get_session_data, get_session_metadata,
    update_session_metadata, delete_session, save_data_to_temp_file
)

# Import routes
from backend.routes.dataset_routes import dataset_bp
from backend.routes.eda_routes import eda_bp
from backend.routes.model_routes import model_bp
from backend.routes.preprocessing_routes import preprocessing_bp
from backend.routes.sql_routes import sql_bp

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('datasage')

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY
app.config['DEBUG'] = DEBUG
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Enable CORS
CORS(app)

# Register blueprints
app.register_blueprint(dataset_bp)
app.register_blueprint(eda_bp)
app.register_blueprint(model_bp)
app.register_blueprint(preprocessing_bp)
app.register_blueprint(sql_bp)

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok"})

# Debug route to list all available routes
@app.route('/api/debug/routes', methods=['GET'])
def list_routes():
    """List all available routes for debugging"""
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'path': str(rule)
        })
    return jsonify({'routes': routes})

# Main entry point
if __name__ == '__main__':
    # Ensure required directories exist
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    # Start the Flask app
    app.run(host=HOST, port=PORT, debug=DEBUG) 