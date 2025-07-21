import pymongo
import logging
from datetime import datetime, timedelta
from bson import ObjectId
import json
from backend.config.settings import MONGODB_URI, MONGODB_DB, MONGODB_COLLECTION_SESSIONS, MONGODB_COLLECTION_DATASETS

logger = logging.getLogger('datasage')

# MongoDB client
try:
    client = pymongo.MongoClient(MONGODB_URI)
    db = client[MONGODB_DB]
    logger.info(f"Connected to MongoDB at {MONGODB_URI}")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {str(e)}")
    # Create a fallback in-memory store for sessions
    logger.warning("Creating in-memory fallback for sessions")
    IN_MEMORY_SESSIONS = {}
    IN_MEMORY_DATASETS = {}

# Collections
sessions_collection = db[MONGODB_COLLECTION_SESSIONS]
datasets_collection = db[MONGODB_COLLECTION_DATASETS]

# Create indexes
try:
    # Set TTL index to 7 days instead of immediate expiration
    sessions_collection.create_index("expires_at", expireAfterSeconds=7*24*60*60)  
    sessions_collection.create_index("session_id", unique=True)
    sessions_collection.create_index("created_at")
    datasets_collection.create_index("created_at")
    datasets_collection.create_index("session_id")
    logger.info("MongoDB indexes created successfully")
except Exception as e:
    logger.error(f"Failed to create MongoDB indexes: {str(e)}")

class MongoJSONEncoder(json.JSONEncoder):
    """JSON encoder that can handle MongoDB ObjectId and datetime objects"""
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

def serialize_doc(doc):
    """Serialize MongoDB document to JSON-compatible dict"""
    if doc is None:
        return None
    
    # Convert ObjectId to string
    if '_id' in doc and isinstance(doc['_id'], ObjectId):
        doc['_id'] = str(doc['_id'])
    
    # Convert datetime objects
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
        elif isinstance(value, dict):
            doc[key] = serialize_doc(value)
    
    return doc

def save_session_metadata(session_id, metadata):
    """Save session metadata to MongoDB"""
    try:
        # Check if session exists
        existing = sessions_collection.find_one({"session_id": session_id})
        
        # Set expiration to 7 days in the future
        expires_at = datetime.now() + timedelta(days=7)
        
        if existing:
            # Update existing session
            sessions_collection.update_one(
                {"session_id": session_id},
                {"$set": {
                    "metadata": metadata,
                    "updated_at": datetime.now(),
                    "expires_at": expires_at
                }}
            )
        else:
            # Create new session document
            sessions_collection.insert_one({
                "session_id": session_id,
                "metadata": metadata,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "expires_at": expires_at
            })
        
        return True
    except Exception as e:
        logger.error(f"Error saving session metadata: {str(e)}")
        
        # Fallback to in-memory if MongoDB fails
        if 'IN_MEMORY_SESSIONS' in globals():
            logger.warning(f"Using in-memory fallback for session {session_id}")
            IN_MEMORY_SESSIONS[session_id] = {
                "metadata": metadata,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "expires_at": datetime.now() + timedelta(days=7)
            }
            return True
        
        return False

def get_session_metadata(session_id):
    """Get session metadata from MongoDB"""
    try:
        session = sessions_collection.find_one({"session_id": session_id})
        if not session:
            # Check if we're using sample- prefix (for mock data)
            if session_id.startswith('sample-'):
                logger.info(f"Creating sample session for {session_id}")
                # Create a new session for sample data
                metadata = {
                    'filename': 'employee_data.csv',
                    'has_data': True,
                    'is_sample': True
                }
                save_session_metadata(session_id, metadata)
                return metadata
                
            # Try in-memory fallback
            if 'IN_MEMORY_SESSIONS' in globals() and session_id in IN_MEMORY_SESSIONS:
                logger.info(f"Found session {session_id} in memory fallback")
                return IN_MEMORY_SESSIONS[session_id].get("metadata", {})
                
            logger.warning(f"Session {session_id} not found")
            return None
        
        # Update last access time and extend expiration
        sessions_collection.update_one(
            {"session_id": session_id},
            {"$set": {
                "updated_at": datetime.now(),
                "expires_at": datetime.now() + timedelta(days=7)
            }}
        )
        
        return serialize_doc(session.get("metadata", {}))
    except Exception as e:
        logger.error(f"Error getting session metadata: {str(e)}")
        
        # Try in-memory fallback
        if 'IN_MEMORY_SESSIONS' in globals() and session_id in IN_MEMORY_SESSIONS:
            logger.info(f"Using in-memory fallback for session {session_id}")
            return IN_MEMORY_SESSIONS[session_id].get("metadata", {})
            
        return None

def save_dataset(dataset_info):
    """Save dataset information to MongoDB"""
    try:
        # Check if dataset exists by filename and session_id
        existing = datasets_collection.find_one({
            "filename": dataset_info.get("filename"),
            "session_id": dataset_info.get("session_id")
        })
        
        if existing:
            # Update existing dataset
            datasets_collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    **dataset_info,
                    "updated_at": datetime.now()
                }}
            )
            return str(existing["_id"])
        else:
            # Create new dataset document
            result = datasets_collection.insert_one({
                **dataset_info,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            })
            return str(result.inserted_id)
    except Exception as e:
        logger.error(f"Error saving dataset: {str(e)}")
        return None

def get_dataset(dataset_id):
    """Get dataset by ID"""
    try:
        if isinstance(dataset_id, str) and len(dataset_id) == 24:
            # This looks like an ObjectId
            dataset = datasets_collection.find_one({"_id": ObjectId(dataset_id)})
        else:
            # Try as session_id
            dataset = datasets_collection.find_one({"session_id": dataset_id})
        
        return serialize_doc(dataset) if dataset else None
    except Exception as e:
        logger.error(f"Error getting dataset: {str(e)}")
        return None

def list_datasets(limit=100, skip=0):
    """List all datasets"""
    try:
        datasets = list(datasets_collection.find().sort("created_at", -1).skip(skip).limit(limit))
        return [serialize_doc(d) for d in datasets]
    except Exception as e:
        logger.error(f"Error listing datasets: {str(e)}")
        return []

def delete_dataset(dataset_id):
    """Delete dataset by ID"""
    try:
        if isinstance(dataset_id, str) and len(dataset_id) == 24:
            # This looks like an ObjectId
            result = datasets_collection.delete_one({"_id": ObjectId(dataset_id)})
        else:
            # Try as session_id
            result = datasets_collection.delete_one({"session_id": dataset_id})
        
        return result.deleted_count > 0
    except Exception as e:
        logger.error(f"Error deleting dataset: {str(e)}")
        return False 