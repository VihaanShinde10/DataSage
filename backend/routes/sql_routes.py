from flask import Blueprint, request, jsonify
import logging
from backend.services.sql_service import SQLAssistant, execute_sql_from_natural_language
from backend.services.session_service import get_session_data, get_session

logger = logging.getLogger('datasage')

# Create Blueprint for SQL routes
sql_bp = Blueprint('sql', __name__, url_prefix='/api/sql')

@sql_bp.route('/execute', methods=['POST'])
def execute_sql():
    """Execute a SQL query directly on the dataset"""
    try:
        data = request.json
        session_id = data.get('session_id')
        query = data.get('query')
        
        if not session_id or not query:
            return jsonify({'error': 'Missing session_id or query parameter'}), 400
        
        # Get the session data
        try:
            df = get_session_data(session_id)
        except Exception as e:
            logger.error(f"Error getting session data: {str(e)}")
            return jsonify({'error': f'Session not found or no dataset loaded: {str(e)}'}), 404
        
        # Create SQLAssistant instance
        sql_assistant = SQLAssistant()
        
        # Connect to in-memory SQLite with DataFrame
        if not sql_assistant.connect_to_sqlite_memory(df):
            return jsonify({'error': 'Failed to create in-memory SQL database'}), 500
        
        # Execute query
        result = sql_assistant.execute_query(query)
        
        # Close connection
        sql_assistant.close_connection()
        
        # Return results or error
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error executing SQL query: {str(e)}")
        return jsonify({'error': f'Error executing SQL query: {str(e)}'}), 500

@sql_bp.route('/translate', methods=['POST'])
def translate_natural_language():
    """Translate natural language to SQL"""
    try:
        data = request.json
        session_id = data.get('session_id')
        nl_query = data.get('nl_query')
        use_groq = data.get('use_groq', True)
        
        if not session_id or not nl_query:
            return jsonify({'error': 'Missing session_id or nl_query parameter'}), 400
        
        # Get the session data
        try:
            df = get_session_data(session_id)
        except Exception as e:
            logger.error(f"Error getting session data: {str(e)}")
            return jsonify({'error': f'Session not found or no dataset loaded: {str(e)}'}), 404
        
        # Create SQLAssistant instance
        sql_assistant = SQLAssistant()
        
        # Connect to in-memory SQLite with DataFrame
        if not sql_assistant.connect_to_sqlite_memory(df):
            return jsonify({'error': 'Failed to create in-memory SQL database'}), 500
        
        # Translate natural language to SQL
        if use_groq:
            sql_query = sql_assistant.natural_language_to_sql_with_groq(nl_query)
        else:
            sql_query = sql_assistant.natural_language_to_sql(nl_query)
        
        # Close connection
        sql_assistant.close_connection()
        
        if not sql_query:
            return jsonify({'error': 'Failed to translate natural language to SQL'}), 400
        
        return jsonify({
            'nl_query': nl_query,
            'sql_query': sql_query
        }), 200
        
    except Exception as e:
        logger.error(f"Error translating natural language to SQL: {str(e)}")
        return jsonify({'error': f'Error translating natural language to SQL: {str(e)}'}), 500

@sql_bp.route('/query', methods=['POST'])
def query_with_natural_language():
    """Query dataset using natural language"""
    try:
        data = request.json
        session_id = data.get('session_id')
        query = data.get('query')
        use_api = data.get('use_api', True)
        
        if not session_id or not query:
            return jsonify({'error': 'Missing session_id or query parameter'}), 400
        
        # Get the session data
        try:
            df = get_session_data(session_id)
        except Exception as e:
            logger.error(f"Error getting session data: {str(e)}")
            return jsonify({'error': f'Session not found or no dataset loaded: {str(e)}'}), 404
        
        # Execute the query
        result = execute_sql_from_natural_language(df, query, use_groq=use_api)
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        # Format response for the frontend
        response = {
            'sql_query': result.get('sql', ''),
            'generated_sql': result.get('sql', ''),
            'columns': result.get('results', {}).get('columns', []),
            'rows': result.get('results', {}).get('rows', []),
            'row_count': result.get('results', {}).get('row_count', 0),
            'natural_language': query
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error executing natural language query: {str(e)}")
        return jsonify({'error': f'Error executing natural language query: {str(e)}'}), 500

@sql_bp.route('/schema', methods=['GET'])
def get_schema():
    """Get schema of the dataset for SQL queries"""
    try:
        session_id = request.args.get('session_id')
        
        if not session_id:
            return jsonify({'error': 'Missing session_id parameter'}), 400
        
        # Get the session data
        try:
            df = get_session_data(session_id)
        except Exception as e:
            logger.error(f"Error getting session data: {str(e)}")
            return jsonify({'error': f'Session not found or no dataset loaded: {str(e)}'}), 404
        
        # Get schema information
        schema = []
        for column in df.columns:
            dtype = str(df[column].dtype)
            sql_type = 'TEXT'
            
            if 'int' in dtype:
                sql_type = 'INTEGER'
            elif 'float' in dtype:
                sql_type = 'REAL'
            elif 'bool' in dtype:
                sql_type = 'BOOLEAN'
            elif 'datetime' in dtype:
                sql_type = 'TIMESTAMP'
                
            schema.append({
                'column': column,
                'type': sql_type,
                'python_type': dtype,
                'sample': str(df[column].iloc[0]) if len(df) > 0 else None
            })
        
        return jsonify({
            'table_name': 'dataset',
            'columns': schema
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting schema: {str(e)}")
        return jsonify({'error': f'Error getting schema: {str(e)}'}), 500 