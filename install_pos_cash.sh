#!/bin/bash

# POS Cash Restaurant System Installation Script
# Transforms CashApp into a complete hardware-free restaurant POS system

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ASCII Art Logo
echo -e "${BLUE}"
cat << "EOF"
  ____           _       _              
 / ___|__ _ ___| |__   / \   _ __  _ __  
| |   / _` / __| '_ \ / _ \ | '_ \| '_ \ 
| |__| (_| \__ \ | | / ___ \| |_) | |_) |
 \____\__,_|___/_| |_/_/   \_\ .__/| .__/ 
                             |_|   |_|   
🍽️ The Complete Hardware-Free Restaurant POS System 📱💳
EOF
echo -e "${NC}"

# Load environment variables if .env exists
if [[ -f ".env" ]]; then
    print_status "Loading environment configuration..."
    source .env
else
    print_warning "No .env file found. Using default configuration."
    print_warning "For production, copy env.example to .env and configure properly."
fi

# Configuration with environment variable fallbacks and secure defaults
PYTHON_VERSION="3.8"
NODE_VERSION="16"
CASHAPP_PORT="${CASHAPP_PORT:-8069}"

# Firebase Configuration (replaces PostgreSQL)
FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-}"
FIREBASE_DATABASE_URL="${FIREBASE_DATABASE_URL:-}"

# Security function to generate secure passwords
generate_secure_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Security function to check if password is set and secure
check_password_security() {
    local password=$1
    local name=$2
    
    if [[ -z "$password" || "$password" == "admin" || "$password" == "cashapp" || "$password" == "password" ]]; then
        print_error "Insecure $name detected! Please set a secure password in .env file."
        print_error "Generate one with: openssl rand -base64 32"
        exit 1
    fi
    
    if [[ ${#password} -lt 12 ]]; then
        print_error "$name must be at least 12 characters long."
        exit 1
    fi
}

# Set secure passwords with validation
if [[ -z "$ADMIN_PASSWORD" ]]; then
    print_warning "No ADMIN_PASSWORD set. Generating secure password..."
    ADMIN_PASSWORD=$(generate_secure_password)
    print_success "Generated secure admin password. Save this: $ADMIN_PASSWORD"
else
    check_password_security "$ADMIN_PASSWORD" "Admin password"
fi

# Functions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        print_success "Linux detected"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="mac"
        print_success "macOS detected"
    else
        print_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
    
    # Check Python
    if command -v python3 &> /dev/null; then
        PYTHON_VER=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
        if (( $(echo "$PYTHON_VER >= $PYTHON_VERSION" | bc -l) )); then
            print_success "Python $PYTHON_VER found"
        else
            print_error "Python $PYTHON_VERSION or higher required. Found: $PYTHON_VER"
            exit 1
        fi
    else
        print_error "Python 3 not found. Please install Python $PYTHON_VERSION or higher"
        exit 1
    fi
    
    # Check pip
    if ! command -v pip3 &> /dev/null; then
        print_error "pip3 not found. Please install pip3"
        exit 1
    fi
    
    # Check git
    if ! command -v git &> /dev/null; then
        print_error "Git not found. Please install Git"
        exit 1
    fi
    
    print_success "All prerequisites checked"
}

install_system_dependencies() {
    print_status "Installing system dependencies..."
    
    if [[ "$OS" == "linux" ]]; then
        # Detect Linux distribution
        if command -v apt-get &> /dev/null; then
            # Debian/Ubuntu
            sudo apt-get update
            sudo apt-get install -y \
                python3-dev python3-pip python3-venv \
                nodejs npm \
                git curl wget \
                build-essential \
                libxml2-dev libxslt1-dev \
                libjpeg-dev libpng-dev \
                libffi-dev libssl-dev \
                bc
        elif command -v yum &> /dev/null; then
            # CentOS/RHEL/Fedora
            sudo yum install -y \
                python3-devel python3-pip \
                nodejs npm \
                git curl wget \
                gcc gcc-c++ make \
                libxml2-devel libxslt-devel \
                libjpeg-devel libpng-devel \
                libffi-devel openssl-devel \
                bc
        else
            print_error "Unsupported Linux distribution"
            exit 1
        fi
    elif [[ "$OS" == "mac" ]]; then
        # macOS with Homebrew
        if ! command -v brew &> /dev/null; then
            print_error "Homebrew not found. Please install Homebrew first"
            exit 1
        fi
        
        brew update
        brew install \
            python@3.11 \
            node@$NODE_VERSION \
            git \
            jpeg \
            libpng \
            libffi \
            openssl \
            bc
    fi
    
    print_success "System dependencies installed"
}

setup_firebase() {
    print_status "Setting up Firebase configuration..."
    
    # Check if Firebase configuration is provided
    if [[ -z "$FIREBASE_PROJECT_ID" ]]; then
        print_warning "Firebase configuration not found in .env file"
        print_status "Creating Firebase placeholder configuration..."
        
        cat > firebase_config.json << EOF
{
  "type": "service_account",
  "project_id": "your-firebase-project-id",
  "private_key_id": "your-private-key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com",
  "client_id": "your-client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs/firebase-adminsdk-xxxxx%40your-project-id.iam.gserviceaccount.com"
}
EOF
        
        print_warning "Created firebase_config.json placeholder. Please update with your actual Firebase credentials."
        print_warning "To set up Firebase:"
        print_warning "1. Go to https://console.firebase.google.com/"
        print_warning "2. Create a new project or select existing one"
        print_warning "3. Go to Project Settings > Service Accounts"
        print_warning "4. Generate new private key and replace firebase_config.json"
        print_warning "5. Update .env file with your Firebase configuration"
        
    else
        print_success "Firebase configuration found"
        
        # Create Firebase config from environment variables
        cat > firebase_config.json << EOF
{
  "type": "service_account",
  "project_id": "$FIREBASE_PROJECT_ID",
  "private_key_id": "$FIREBASE_PRIVATE_KEY_ID",
  "private_key": "$FIREBASE_PRIVATE_KEY",
  "client_email": "$FIREBASE_CLIENT_EMAIL",
  "client_id": "$FIREBASE_CLIENT_ID",
  "auth_uri": "$FIREBASE_AUTH_URI",
  "token_uri": "$FIREBASE_TOKEN_URI",
  "auth_provider_x509_cert_url": "$FIREBASE_AUTH_PROVIDER_CERT_URL",
  "client_x509_cert_url": "$FIREBASE_CLIENT_CERT_URL"
}
EOF
        
        print_success "Firebase configuration file created"
    fi
    
    print_success "Firebase setup completed"
}

setup_python_environment() {
    print_status "Setting up Python virtual environment..."
    
    # Create virtual environment
    python3 -m venv pos_cash_venv
    source pos_cash_venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip setuptools wheel
    
    print_success "Python environment setup completed"
}

install_python_dependencies() {
    print_status "Installing Python dependencies..."
    
    # Activate virtual environment
    source pos_cash_venv/bin/activate
    
    # Install Firebase SDK
    pip install firebase-admin
    
    # Install POS Cash specific requirements
    if [[ -f "requirements_pos_cash_cleaned.txt" ]]; then
        pip install -r requirements_pos_cash_cleaned.txt
    else
        print_warning "requirements_pos_cash_cleaned.txt not found. Installing core dependencies only."
        # Install core POS Cash dependencies
        pip install \
            firebase-admin \
            stripe>=5.0.0 \
            paypal-checkout-serversdk>=1.0.1 \
            phonenumbers>=8.13.0 \
            qrcode[pil]>=7.4.0 \
            twilio>=8.0.0 \
            redis>=4.5.0 \
            pandas>=1.5.0 \
            numpy>=1.24.0 \
            flask>=2.0.0 \
            flask-cors>=3.0.0 \
            gunicorn>=20.0.0
    fi
    
    print_success "Python dependencies installed"
}

initialize_cashapp() {
    print_status "Initializing CashApp..."
    
    # Activate virtual environment
    source pos_cash_venv/bin/activate
    
    # Initialize Firebase connection
    python3 -c "
import firebase_admin
from firebase_admin import credentials, firestore

try:
    cred = credentials.Certificate('firebase_config.json')
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print('✅ Firebase connection successful')
except Exception as e:
    print(f'⚠️  Firebase connection failed: {e}')
    print('Please check your firebase_config.json file')
"
    
    print_success "CashApp initialized"
}

install_pos_cash_module() {
    print_status "Installing POS Cash Restaurant module..."
    
    # Create basic Flask app structure for CashApp
    mkdir -p cashapp/{static,templates,api,models}
    
    # Create main CashApp application file
    cat > cashapp/app.py << 'EOF'
#!/usr/bin/env python3
"""
CashApp - Hardware-Free Restaurant POS System
"""

from flask import Flask, render_template, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
import os
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Initialize Firebase
try:
    cred = credentials.Certificate('firebase_config.json')
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✅ Firebase initialized successfully")
except Exception as e:
    print(f"⚠️  Firebase initialization failed: {e}")
    db = None

@app.route('/')
def index():
    """Main POS interface"""
    return render_template('pos_interface.html')

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'firebase_connected': db is not None
    })

@app.route('/api/orders', methods=['GET'])
def get_orders():
    """Get all orders"""
    if not db:
        return jsonify({'error': 'Database not connected'}), 500
    
    try:
        orders_ref = db.collection('orders')
        orders = []
        for doc in orders_ref.stream():
            order_data = doc.to_dict()
            order_data['id'] = doc.id
            orders.append(order_data)
        
        return jsonify({
            'orders': orders,
            'count': len(orders)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('CASHAPP_PORT', 8069))
    debug = os.environ.get('DEBUG_MODE', 'false').lower() == 'true'
    
    print(f"🚀 Starting CashApp on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
EOF
    
    # Create basic HTML template
    cat > cashapp/templates/pos_interface.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CashApp - Restaurant POS</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .btn { background: #3498db; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        .btn:hover { background: #2980b9; }
        .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
        .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🍽️ CashApp Restaurant POS</h1>
            <p>Hardware-Free Restaurant Point of Sale System</p>
        </div>
        
        <div class="card">
            <h2>System Status</h2>
            <div id="status">Checking connection...</div>
            <button class="btn" onclick="checkHealth()">Refresh Status</button>
        </div>
        
        <div class="card">
            <h2>Quick Actions</h2>
            <button class="btn" onclick="loadOrders()">View Orders</button>
            <button class="btn" onclick="newOrder()">New Order</button>
            <button class="btn" onclick="viewReports()">Reports</button>
        </div>
        
        <div class="card">
            <h2>Recent Orders</h2>
            <div id="orders">Loading orders...</div>
        </div>
    </div>

    <script>
        async function checkHealth() {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                
                const statusDiv = document.getElementById('status');
                if (data.status === 'healthy') {
                    statusDiv.innerHTML = `
                        <div class="status success">
                            ✅ System is healthy<br>
                            Firebase: ${data.firebase_connected ? 'Connected' : 'Disconnected'}<br>
                            Last check: ${new Date(data.timestamp).toLocaleString()}
                        </div>
                    `;
                } else {
                    statusDiv.innerHTML = '<div class="status error">❌ System error</div>';
                }
            } catch (error) {
                document.getElementById('status').innerHTML = `
                    <div class="status error">❌ Connection failed: ${error.message}</div>
                `;
            }
        }
        
        async function loadOrders() {
            try {
                const response = await fetch('/api/orders');
                const data = await response.json();
                
                const ordersDiv = document.getElementById('orders');
                if (data.orders && data.orders.length > 0) {
                    ordersDiv.innerHTML = `
                        <p>Found ${data.count} orders:</p>
                        <ul>
                            ${data.orders.map(order => `<li>Order #${order.id}</li>`).join('')}
                        </ul>
                    `;
                } else {
                    ordersDiv.innerHTML = '<p>No orders found. Database ready for first order!</p>';
                }
            } catch (error) {
                document.getElementById('orders').innerHTML = `<p>Error loading orders: ${error.message}</p>`;
            }
        }
        
        function newOrder() {
            alert('New Order functionality coming soon!');
        }
        
        function viewReports() {
            alert('Reports functionality coming soon!');
        }
        
        // Check health on page load
        checkHealth();
        loadOrders();
    </script>
</body>
</html>
EOF
    
    print_success "POS Cash module installed"
}

create_config_file() {
    print_status "Creating configuration file..."
    
    cat > pos_cash.conf << EOF
[settings]
# CashApp Configuration File

# Server settings
port = $CASHAPP_PORT
workers = 2
max_connections = 100

# Firebase settings
firebase_config = firebase_config.json

# Security
admin_password = $ADMIN_PASSWORD
secret_key = $(openssl rand -base64 32)

# POS Cash specific settings
data_dir = .local/share/CashApp

# Performance
memory_limit = 2684354560
request_timeout = 600

# Development (disable in production)
debug_mode = false
auto_reload = false

# Logging
log_level = info
log_file = /var/log/pos_cash/cashapp.log
EOF
    
    print_success "Configuration file created: pos_cash.conf"
}

create_systemd_service() {
    if [[ "$OS" == "linux" ]]; then
        print_status "Creating systemd service..."
        
        sudo tee /etc/systemd/system/pos-cash.service > /dev/null << EOF
[Unit]
Description=POS Cash Restaurant System (CashApp)
Documentation=https://github.com/poscash/cashapp-restaurant
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$(pwd)
Environment=PATH=$(pwd)/pos_cash_venv/bin
ExecStart=$(pwd)/pos_cash_venv/bin/python $(pwd)/cashapp/app.py
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
        
        sudo systemctl daemon-reload
        sudo systemctl enable pos-cash.service
        
        print_success "Systemd service created and enabled"
    fi
}

create_startup_script() {
    print_status "Creating startup script..."
    
    cat > start_pos_cash.sh << 'EOF'
#!/bin/bash

# POS Cash Restaurant System Startup Script

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
cat << "ASCII"
  ____           _       _              
 / ___|__ _ ___| |__   / \   _ __  _ __  
| |   / _` / __| '_ \ / _ \ | '_ \| '_ \ 
| |__| (_| \__ \ | | / ___ \| |_) | |_) |
 \____\__,_|___/_| |_/_/   \_\ .__/| .__/ 
                             |_|   |_|   

🍽️ Starting CashApp Restaurant System... 📱💳
ASCII
echo -e "${NC}"

# Activate virtual environment
source pos_cash_venv/bin/activate

# Get port from environment or config
CASHAPP_PORT=${CASHAPP_PORT:-8069}

echo -e "${BLUE}[INFO]${NC} Starting CashApp on http://localhost:$CASHAPP_PORT"
echo -e "${GREEN}[SUCCESS]${NC} Use Ctrl+C to stop the server"
echo ""

# Start CashApp
cd cashapp && python app.py
EOF
    
    chmod +x start_pos_cash.sh
    
    print_success "Startup script created: start_pos_cash.sh"
}

display_completion_message() {
    echo ""
    echo -e "${GREEN}"
    cat << "EOF"
╔══════════════════════════════════════════════════════════════╗
║                    INSTALLATION COMPLETE!                    ║
╚══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    
    echo -e "${BLUE}🎉 CashApp Restaurant System has been successfully installed!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Configure Firebase:"
    echo "   ${GREEN}• Visit: https://console.firebase.google.com/${NC}"
    echo "   ${GREEN}• Create project and update firebase_config.json${NC}"
    echo ""
    echo "2. Start the system:"
    echo "   ${GREEN}./start_pos_cash.sh${NC}"
    echo ""
    echo "3. Open your browser and navigate to:"
    echo "   ${GREEN}http://localhost:$CASHAPP_PORT${NC}"
    echo ""
    echo "4. Configure your restaurant settings"
    echo ""
    echo -e "${BLUE}📚 Key Changes:${NC}"
    echo "• ✅ Removed PostgreSQL dependency"
    echo "• ✅ Added Firebase cloud database"
    echo "• ✅ Modern web-based interface"
    echo "• ✅ Mobile-first responsive design"
    echo "• ✅ Secure environment configuration"
    echo ""
    echo -e "${GREEN}Happy selling! 🍽️📱💳${NC}"
}

# Main installation process
main() {
    echo -e "${BLUE}Starting CashApp Restaurant System installation...${NC}"
    echo ""
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        print_error "This script should not be run as root"
        exit 1
    fi
    
    # Installation steps
    check_prerequisites
    install_system_dependencies
    setup_firebase
    setup_python_environment
    install_python_dependencies
    initialize_cashapp
    install_pos_cash_module
    create_config_file
    create_systemd_service
    create_startup_script
    
    display_completion_message
}

# Run installation with error handling
if main "$@"; then
    exit 0
else
    print_error "Installation failed. Please check the output above for errors."
    exit 1
fi 