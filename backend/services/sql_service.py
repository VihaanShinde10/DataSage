import pandas as pd
import sqlite3
import re
import logging
from io import StringIO
import json
import os
import requests

logger = logging.getLogger('datasage')

class SQLAssistant:
    def __init__(self):
        self.conn = None
        self.cursor = None
        self.table_name = "user_data"
        self.api_key = os.environ.get('GROQ_API_KEY', '')
    
    def connect_to_sqlite_memory(self, df):
        """
        Create an in-memory SQLite database from a DataFrame
        
        Args:
            df (pd.DataFrame): Input DataFrame
        """
        try:
            # Create SQLite connection
            self.conn = sqlite3.connect(':memory:')
            self.cursor = self.conn.cursor()
            
            # Clean column names (remove special characters)
            df_clean = df.copy()
            df_clean.columns = [re.sub(r'[^\w]', '_', col) for col in df_clean.columns]
            
            # Write DataFrame to SQLite
            df_clean.to_sql(self.table_name, self.conn, if_exists='replace', index=False)
            
            # Get table schema
            self.cursor.execute(f"PRAGMA table_info({self.table_name})")
            self.schema = self.cursor.fetchall()
            
            return True
        
        except Exception as e:
            logger.error(f"Error connecting to SQLite: {str(e)}")
            return False
    
    def close_connection(self):
        """Close the SQLite connection"""
        if self.conn:
            self.conn.close()
            self.conn = None
            self.cursor = None
    
    def get_schema(self):
        """Get the schema of the table"""
        if not self.conn:
            return None
        
        schema_info = []
        for col in self.schema:
            schema_info.append({
                'name': col[1],
                'type': col[2]
            })
        
        return schema_info
    
    def execute_query(self, query):
        """
        Execute an SQL query and return the results
        
        Args:
            query (str): SQL query to execute
        
        Returns:
            dict: Query results
        """
        if not self.conn:
            return {'error': 'No database connection'}
        
        try:
            # Execute query
            result = pd.read_sql_query(query, self.conn)
            
            # Convert to dict
            records = result.to_dict(orient='records')
            columns = result.columns.tolist()
            
            return {
                'columns': columns,
                'rows': records,
                'row_count': len(records)
            }
        
        except Exception as e:
            logger.error(f"Error executing query: {str(e)}")
            return {'error': str(e)}
    
    def natural_language_to_sql_with_groq(self, nl_query):
        """
        Convert natural language query to SQL using Groq API
        
        Args:
            nl_query (str): Natural language query
        
        Returns:
            str: SQL query
        """
        if not self.api_key:
            logger.warning("GROQ API key not set, falling back to rule-based translation")
            return self.natural_language_to_sql(nl_query)
            
        try:
            # Get schema for context
            schema = self.get_schema()
            if not schema:
                return None
                
            # Prepare schema description
            schema_description = "Table name: " + self.table_name + "\nColumns:\n"
            for col in schema:
                schema_description += f"- {col['name']} ({col['type']})\n"
                
            # Set up the API request to Groq
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "llama3-70b-8192",
                "messages": [
                    {
                        "role": "system", 
                        "content": f"You are an expert SQL query writer. Given a natural language query and a database schema, translate the query into valid SQLite SQL. Only return the SQL query, nothing else.\n\nSchema Information:\n{schema_description}"
                    },
                    {
                        "role": "user", 
                        "content": f"Convert this natural language query to SQL: {nl_query}"
                    }
                ],
                "temperature": 0.1,
                "max_tokens": 1000
            }
            
            # Make API call
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload
            )
            
            # Check response
            if response.status_code == 200:
                data = response.json()
                sql_query = data['choices'][0]['message']['content'].strip()
                
                # Clean up the SQL query if it's wrapped in markdown code blocks
                sql_query = re.sub(r'^```sql\s*', '', sql_query)
                sql_query = re.sub(r'\s*```$', '', sql_query)
                
                return sql_query
            else:
                logger.error(f"Error from GROQ API: {response.status_code} - {response.text}")
                # Fall back to rule-based translation
                return self.natural_language_to_sql(nl_query)
        
        except Exception as e:
            logger.error(f"Error using GROQ for SQL translation: {str(e)}")
            # Fall back to rule-based translation
            return self.natural_language_to_sql(nl_query)
    
    def natural_language_to_sql(self, nl_query):
        """
        Convert natural language to SQL using rule-based approach
        
        Args:
            nl_query (str): Natural language query
            
        Returns:
            str: SQL query
        """
        # Normalize query
        query = nl_query.lower().strip()
        
        # Get table schema
        column_names = [col[1] for col in self.schema]
        
        # Initialize SQL query
        sql_query = ""
        
        # Handle different query types
        if "average" in query or "avg" in query or "mean" in query:
            # Find which column to average
            for col in column_names:
                if col.lower() in query:
                    sql_query = f"SELECT AVG({col}) as average_{col} FROM {self.table_name}"
                    break
            
            # If no column found, use a default query
            if not sql_query:
                sql_query = f"SELECT * FROM {self.table_name} LIMIT 10"
        
        elif "sum" in query or "total" in query:
            # Find which column to sum
            for col in column_names:
                if col.lower() in query:
                    sql_query = f"SELECT SUM({col}) as sum_{col} FROM {self.table_name}"
                    break
        
        elif "count" in query:
            if "group by" in query or "grouped by" in query:
                # Find which column to group by
                for col in column_names:
                    if col.lower() in query:
                        sql_query = f"SELECT {col}, COUNT(*) as count FROM {self.table_name} GROUP BY {col}"
                        break
            else:
                sql_query = f"SELECT COUNT(*) as count FROM {self.table_name}"
        
        elif "maximum" in query or "max" in query:
            # Find which column to get max from
            for col in column_names:
                if col.lower() in query:
                    sql_query = f"SELECT MAX({col}) as max_{col} FROM {self.table_name}"
                    break
        
        elif "minimum" in query or "min" in query:
            # Find which column to get min from
            for col in column_names:
                if col.lower() in query:
                    sql_query = f"SELECT MIN({col}) as min_{col} FROM {self.table_name}"
                    break
        
        elif "group by" in query or "grouped by" in query:
            # Find which columns to group by and aggregate
            group_col = None
            agg_col = None
            
            for col in column_names:
                if col.lower() in query:
                    if not group_col:
                        group_col = col
                    else:
                        agg_col = col
                        break
            
            if group_col and agg_col:
                sql_query = f"SELECT {group_col}, AVG({agg_col}) as avg_{agg_col} FROM {self.table_name} GROUP BY {group_col}"
            elif group_col:
                sql_query = f"SELECT {group_col}, COUNT(*) as count FROM {self.table_name} GROUP BY {group_col}"
        
        elif "where" in query:
            # Simple where clause
            for col in column_names:
                if col.lower() in query:
                    # Check for comparison operators
                    if "greater than" in query or ">" in query:
                        value = 0  # Default
                        # Try to extract a number
                        numbers = re.findall(r'\d+', query)
                        if numbers:
                            value = numbers[0]
                        sql_query = f"SELECT * FROM {self.table_name} WHERE {col} > {value}"
                    elif "less than" in query or "<" in query:
                        value = 0  # Default
                        # Try to extract a number
                        numbers = re.findall(r'\d+', query)
                        if numbers:
                            value = numbers[0]
                        sql_query = f"SELECT * FROM {self.table_name} WHERE {col} < {value}"
                    elif "equal" in query or "=" in query:
                        value = 0  # Default
                        # Try to extract a number
                        numbers = re.findall(r'\d+', query)
                        if numbers:
                            value = numbers[0]
                        sql_query = f"SELECT * FROM {self.table_name} WHERE {col} = {value}"
                    else:
                        # Generic where clause
                        sql_query = f"SELECT * FROM {self.table_name} WHERE {col} IS NOT NULL"
                    break
        
        # Handle specific queries about age
        if "age" in query and not sql_query:
            if "average age" in query or "mean age" in query:
                sql_query = f"SELECT AVG(age) as average_age FROM {self.table_name}"
            elif "total age" in query or "sum of age" in query:
                sql_query = f"SELECT SUM(age) as total_age FROM {self.table_name}"
            elif "maximum age" in query or "oldest" in query:
                sql_query = f"SELECT MAX(age) as max_age FROM {self.table_name}"
            elif "minimum age" in query or "youngest" in query:
                sql_query = f"SELECT MIN(age) as min_age FROM {self.table_name}"
        
        # Handle specific queries about salary
        if "salary" in query and not sql_query:
            if "average salary" in query or "mean salary" in query:
                sql_query = f"SELECT AVG(salary) as average_salary FROM {self.table_name}"
            elif "total salary" in query or "sum of salary" in query:
                sql_query = f"SELECT SUM(salary) as total_salary FROM {self.table_name}"
            elif "maximum salary" in query or "highest salary" in query:
                sql_query = f"SELECT MAX(salary) as max_salary FROM {self.table_name}"
            elif "minimum salary" in query or "lowest salary" in query:
                sql_query = f"SELECT MIN(salary) as min_salary FROM {self.table_name}"
            elif "salary by department" in query or "salary per department" in query:
                sql_query = f"SELECT department, AVG(salary) as avg_salary FROM {self.table_name} GROUP BY department ORDER BY avg_salary DESC"
        
        # Default query if no patterns match
        if not sql_query:
            sql_query = f"SELECT * FROM {self.table_name} LIMIT 10"
        
        return sql_query
    
    def _get_numeric_columns(self):
        """Get list of numeric columns from schema"""
        if not self.schema:
            return []
        
        numeric_types = ['INTEGER', 'REAL', 'NUMERIC', 'DECIMAL', 'FLOAT']
        return [col[1] for col in self.schema if any(ntype in col[2].upper() for ntype in numeric_types)]

# Function to create a SQL assistant instance and handle a query
def execute_sql_from_natural_language(df, nl_query, use_groq=True):
    """
    Execute a natural language query on a DataFrame using SQL
    
    Args:
        df (pd.DataFrame): Input DataFrame
        nl_query (str): Natural language query
        use_groq (bool): Whether to use GROQ API for translation
    
    Returns:
        dict: Query results or error
    """
    try:
        # Convert string columns that should be numeric to numeric types
        df_processed = df.copy()
        for col in df_processed.columns:
            # Try to convert to numeric if it looks like a number
            if df_processed[col].dtype == 'object':
                try:
                    # Check if all values in the column can be converted to numeric
                    numeric_series = pd.to_numeric(df_processed[col], errors='coerce')
                    if numeric_series.notna().all():
                        df_processed[col] = numeric_series
                except:
                    pass  # Keep as string if conversion fails
        
        # Create SQL assistant
        assistant = SQLAssistant()
        success = assistant.connect_to_sqlite_memory(df_processed)
        
        if not success:
            return {'error': 'Failed to create SQL database from dataset'}
        
        # Convert natural language to SQL
        if use_groq:
            sql_query = assistant.natural_language_to_sql_with_groq(nl_query)
        else:
            sql_query = assistant.natural_language_to_sql(nl_query)
        
        # Execute query
        results = assistant.execute_query(sql_query)
        
        # Close connection
        assistant.close_connection()
        
        # Return both the SQL query and results
        return {
            'natural_language': nl_query,
            'sql': sql_query,
            'results': results
        }
    
    except Exception as e:
        logger.error(f"Error executing SQL from natural language: {str(e)}")
        return {'error': str(e)} 