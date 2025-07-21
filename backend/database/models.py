from datetime import datetime
import uuid

# MongoDB compatible models (schema definitions)

class User:
    """User model for authentication"""
    def __init__(self, name, email, password):
        self.id = str(uuid.uuid4())
        self.name = name
        self.email = email
        self.password = password
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'password': self.password,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }
    
    @classmethod
    def from_dict(cls, data):
        user = cls(data['name'], data['email'], data['password'])
        user.id = data.get('id', str(uuid.uuid4()))
        user.created_at = data.get('created_at', datetime.utcnow())
        user.updated_at = data.get('updated_at', datetime.utcnow())
        return user

class Dataset:
    """Dataset model for storing uploaded datasets"""
    def __init__(self, name, file_path, file_type, file_size, user_id=None):
        self.id = str(uuid.uuid4())
        self.name = name
        self.description = None
        self.file_path = file_path
        self.file_type = file_type
        self.file_size = file_size
        self.row_count = None
        self.column_count = None
        self.dataset_metadata = {}
        self.user_id = user_id
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'file_path': self.file_path,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'row_count': self.row_count,
            'column_count': self.column_count,
            'dataset_metadata': self.dataset_metadata,
            'user_id': self.user_id,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }
    
    @classmethod
    def from_dict(cls, data):
        dataset = cls(
            data['name'], 
            data['file_path'], 
            data['file_type'], 
            data['file_size'], 
            data.get('user_id')
        )
        dataset.id = data.get('id', str(uuid.uuid4()))
        dataset.description = data.get('description')
        dataset.row_count = data.get('row_count')
        dataset.column_count = data.get('column_count')
        dataset.dataset_metadata = data.get('dataset_metadata', {})
        dataset.created_at = data.get('created_at', datetime.utcnow())
        dataset.updated_at = data.get('updated_at', datetime.utcnow())
        return dataset
    
    @property
    def file_size_formatted(self):
        """Return human-readable file size"""
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB" 