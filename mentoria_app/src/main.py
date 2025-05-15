import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, render_template, send_from_directory
from supabase import create_client, Client

# Import Blueprints
from src.routes.mentoria_routes import mentoria_bp

app = Flask(__name__)

# Supabase Configuration
SUPABASE_URL = "https://nueuuwsfgydkjnmmgbyg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZXV1d3NmZ3lka2pubW1nYnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4MjI1MzUsImV4cCI6MjA2MDM5ODUzNX0.QOq9-QV9DHdId96UJP29wgu7lStGD3sV4B5kwIlqqfI"

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    app.config['SUPABASE_CLIENT'] = supabase
    print("Supabase client initialized successfully.")
except Exception as e:
    print(f"Error initializing Supabase client: {e}")
    supabase = None # Ensure supabase is None if initialization fails
    app.config['SUPABASE_CLIENT'] = None

# Configure upload folder for images
UPLOAD_FOLDER = os.path.join(app.root_path, 'static', 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Register Blueprints
app.register_blueprint(mentoria_bp, url_prefix='/api')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    # Ensure Supabase client is available before running
    if not app.config.get('SUPABASE_CLIENT'):
        print("CRITICAL: Supabase client not available. Application cannot start.")
    else:
        app.run(host='0.0.0.0', port=5000, debug=True)

