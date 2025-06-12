# 🍽️ POS Cash Restaurant System

## Overview

**POS Cash** is a complete hardware-free restaurant point-of-sale system built on **CashApp** framework. Designed specifically for mobile devices, it provides all the functionality of traditional expensive POS systems while being completely mobile-friendly and requiring no specialized hardware.

This system transforms any tablet or smartphone into a full-featured restaurant POS terminal, supporting:
- ✅ Table service and floor management
- ✅ Kitchen display integration
- ✅ Mobile ordering and QR code menus  
- ✅ Contactless payments (Stripe, PayPal, Apple Pay, Google Pay)
- ✅ UK VAT compliance and HMRC integration
- ✅ Multi-location support
- ✅ Offline-first operation
- ✅ Real-time reporting and analytics

## 🚀 Key Features

### 📱 **Mobile-First Design**
- Responsive UI optimized for tablets and smartphones
- Touch-friendly interface with haptic feedback
- Works in landscape and portrait modes
- PWA support for native app-like experience

### 💳 **Advanced Payment Processing**
- **Stripe Integration**: Cards, contactless, Apple Pay, Google Pay
- **PayPal**: Full PayPal checkout integration
- **Bank Transfers**: BACS and Faster Payments support
- **Split Bills**: Multiple payment methods per order
- **Tips**: Built-in tip calculation and processing

### 🏴󠁧󠁢󠁥󠁮󠁧󠁿 **UK Business Ready**
- HMRC VAT compliance and reporting
- Companies House integration
- UK bank holiday calendar
- Sterling (£) as primary currency
- UK postal code validation

### 🍽️ **Restaurant Operations**
- Table management with visual floor plans
- Kitchen display system (KDS) integration
- Order modification and void capabilities
- Course timing and special instructions
- Allergen and dietary requirement tracking

### 📊 **Business Intelligence**
- Real-time sales analytics
- Staff performance metrics
- Inventory turnover reports
- Customer behavior insights
- Financial forecasting

### 🌐 **Online Integration**
- QR code menu generation
- Online ordering system
- Social media integration (Facebook, Instagram)
- Delivery partner APIs (Uber Eats, Deliveroo, Just Eat)
- Customer loyalty programs

### 🔒 **Security & Compliance**
- PCI DSS compliant payment processing
- GDPR compliant customer data handling
- Role-based access control
- End-to-end encryption
- Regular security audits

## 🛠️ Technology Stack

- **Backend**: Python 3.8+, Flask
- **Database**: Firebase Firestore (Cloud NoSQL) - *Currently implemented as placeholder integration*
- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Payments**: Stripe API, PayPal SDK
- **Mobile**: Progressive Web App (PWA)
- **Deployment**: Docker, Cloud hosting ready

## 📦 Installation

### Quick Start

```bash
git clone https://github.com/your-repo/cashapp-restaurant.git
cd cashapp-restaurant

# Run the installation script
chmod +x install_pos_cash.sh
./install_pos_cash.sh
```

### Manual Installation

1. **Setup Firebase Database** (*Placeholder Integration*):
   - Firebase integration is currently implemented with placeholder configuration
   - Create Firebase project at https://console.firebase.google.com/
   - Enable Firestore database
   - Download service account key as `firebase_config.json`
   - Replace placeholder values in configuration files with actual Firebase credentials

2. **Install Dependencies**:
```bash
# Create virtual environment
python3 -m venv pos_cash_venv
source pos_cash_venv/bin/activate

# Install requirements
pip install -r requirements_pos_cash_cleaned.txt
```

3. **Configure Environment**:
```bash
cp env.example .env
# Edit .env with your actual Firebase credentials and settings
# Note: Default configuration contains placeholder values
```

4. **Initialize CashApp**:
```bash
# Initialize Firebase connection (requires actual credentials)
python3 -c "
import firebase_admin
from firebase_admin import credentials, firestore
cred = credentials.Certificate('firebase_config.json')
firebase_admin.initialize_app(cred)
print('Firebase connected successfully')
"
```

5. **Start the Application**:
```bash
./start_pos_cash.sh
```

6. **Access Your System**:
   - Open browser to http://localhost:8069
   - Configure your restaurant settings
   - Start taking orders!

## ⚙️ Configuration

### Database Setup (Firebase Placeholder Integration)

🔧 **Important Note**: The current Firebase integration is implemented as a placeholder system that requires actual Firebase configuration to function properly.

**To set up actual Firebase integration:**

1. **Create Firebase Project**:
   ```bash
   # Visit https://console.firebase.google.com/
   # Create new project or select existing
   # Enable Firestore Database in test mode
   ```

2. **Generate Service Account Key**:
   ```bash
   # In Firebase Console: Project Settings → Service Accounts
   # Click "Generate New Private Key"
   # Download JSON file and save as firebase_config.json
   ```

3. **Update Configuration**:
   ```bash
   # Replace placeholder values in .env file:
   FIREBASE_PROJECT_ID=your-actual-project-id
   FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com/
   # Add other Firebase configuration values from your service account key
   ```

4. **Test Connection**:
   ```bash
   # Verify Firebase connection works with actual credentials
   python3 -c "
   import firebase_admin
   from firebase_admin import credentials, firestore
   try:
       cred = credentials.Certificate('firebase_config.json')
       firebase_admin.initialize_app(cred)
       db = firestore.client()
       print('✅ Firebase connection successful')
   except Exception as e:
       print(f'❌ Firebase connection failed: {e}')
   "
   ```

**Placeholder Features**:
- Firebase configuration templates in `env.example`
- Placeholder service account JSON structure
- Mock Firebase initialization in installation script
- Database connection testing with fallback handling

### Payment Methods

#### Stripe Setup
1. **Create Stripe Account**: [stripe.com](https://stripe.com)
2. **Get API Keys**: Dashboard → Developers → API Keys
3. **Configure in CashApp**: Similar to Stripe setup
4. **Test Payments**: Use test card `4242 4242 4242 4242`

#### PayPal Setup
1. **Create PayPal Business Account**: [paypal.com/business](https://www.paypal.com/business)
2. **Get Client ID and Secret**: Developer Dashboard
3. **Configure in CashApp**: Similar to Stripe setup
4. **Enable PayPal Checkout**: Test with PayPal sandbox

### UK Tax Configuration
```bash
# Configure VAT rates (automatic with UK setup)
# Standard rate: 20%
# Reduced rate (food): 5%
# Zero rate (some foods): 0%
```

### Advanced Configuration
```bash
./cashapp-bin --config=pos_cash_config.conf
```

## 📱 Mobile App

### Progressive Web App (PWA)
- **Install on iOS**: Safari → Share → Add to Home Screen
- **Install on Android**: Chrome → Menu → Add to Home Screen
- **Offline Support**: Continues working without internet
- **Push Notifications**: Order updates and alerts

### Native App Development
For custom branding and additional features:
```bash
# Using React Native or Flutter
npm install -g @ionic/cli
ionic start pos-cash-mobile tabs --type=react
```

## 🔧 Development

### Local Development Setup
```bash
# Clone repository
git clone https://github.com/your-username/cashapp-restaurant.git
cd cashapp-restaurant

# Install development dependencies
pip install -r requirements_dev.txt

# Run development server
python cashapp/app.py
```

### Testing
```bash
# Run unit tests
python -m pytest tests/

# Run integration tests
./cashapp-bin --test-enable --test-tags=pos_cash_restaurant --stop-after-init

# Test payment integration
./cashapp-bin --test-enable --test-tags=stripe_integration --stop-after-init

# Test mobile UI
./cashapp-bin --test-enable --test-tags=mobile_ui --stop-after-init
```

### API Documentation
```bash
# Generate API docs
sphinx-build -b html docs/ docs/_build/
```

## 🚀 Deployment

### Development Deployment
```bash
# Start development server
./start_pos_cash.sh
```

### Production Deployment
```bash
# Update database
./cashapp-bin -d pos_cash_prod --update=all --stop-after-init

# Start production server
./cashapp-bin --config=production.conf
```

### Docker Deployment
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY . .

RUN pip install -r requirements_pos_cash_cleaned.txt

EXPOSE 8069
CMD ["python", "cashapp/app.py"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  cashapp:
    build: .
    container_name: pos_cash_cashapp
    ports:
      - "8069:8069"
    environment:
      - FIREBASE_PROJECT_ID=your-project-id
      - FIREBASE_DATABASE_URL=your-database-url
    volumes:
      - ./firebase_config.json:/app/firebase_config.json
    restart: unless-stopped
```

### Cloud Deployment
**Recommended Platforms**:
- **Google Cloud Run**: Fully managed, Firebase integrated
- **AWS Lambda**: Serverless, cost-effective
- **Heroku**: Simple deployment, good for startups
- **DigitalOcean App Platform**: Developer-friendly

## 📊 Analytics & Reporting

### Built-in Reports
- **Sales Summary**: Daily, weekly, monthly sales
- **Product Performance**: Best/worst selling items
- **Staff Performance**: Server statistics and tips
- **Customer Analytics**: Repeat customers and preferences
- **Financial Reports**: P&L, cash flow, expenses

### Custom Reports
Create custom reports using the built-in query builder:
```python
# Example: Sales by hour
sales_by_hour = analytics.get_sales_report(
    start_date='2024-01-01',
    end_date='2024-01-31',
    group_by='hour'
)
```

## 🔗 Integrations

### Delivery Platforms
- **Uber Eats**: Menu sync and order management
- **Deliveroo**: Real-time order processing
- **Just Eat**: Automated dispatch
- **DoorDash**: US market support

### Accounting Software
- **Xero**: Automatic transaction sync
- **QuickBooks**: Invoice and payment integration
- **Sage**: UK-specific accounting features

### Marketing Tools
- **Mailchimp**: Customer email campaigns
- **Facebook Ads**: Targeted advertising
- **Google Analytics**: Website traffic analysis

## 🆘 Troubleshooting

### Common Issues

**Issue**: Firebase connection failed
```bash
# Solution: Check firebase_config.json credentials
python -c "
import firebase_admin
from firebase_admin import credentials
cred = credentials.Certificate('firebase_config.json')
print('Firebase config is valid')
"
```

**Issue**: Payment processing errors
```bash
# Solution: Verify API keys and webhook endpoints
curl -H "Authorization: Bearer sk_test_..." https://api.stripe.com/v1/charges
```

**Issue**: Mobile UI not responsive
```bash
# Solution: Clear browser cache and check viewport meta tag
# Add to <head>: <meta name="viewport" content="width=device-width, initial-scale=1">
```

### Getting Help
- **Documentation**: [docs.poscash.co.uk](https://docs.poscash.co.uk)
- **Community Forum**: [community.poscash.co.uk](https://community.poscash.co.uk)
- **GitHub Issues**: [github.com/poscash/cashapp-restaurant](https://github.com/poscash/cashapp-restaurant)
- **Email Support**: support@poscash.co.uk

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Code Standards
- **Python**: Follow PEP 8 style guide
- **JavaScript**: Use ESLint and Prettier
- **Testing**: Maintain >90% code coverage
- **Documentation**: Update docs for new features

## 📄 License

This project is licensed under the LGPL v3 License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Stripe** - For excellent payment processing APIs
- **PayPal** - For global payment solutions
- **Firebase** - For reliable cloud database services
- **CashApp Community** - For the excellent framework

## 📞 Support

### Business Hours Support
- **Email**: support@poscash.co.uk
- **Phone**: +44 20 1234 5678
- **Hours**: Monday-Friday, 9 AM - 6 PM GMT

### 24/7 Emergency Support
- **Critical Issues**: emergency@poscash.co.uk
- **Status Page**: [status.poscash.co.uk](https://status.poscash.co.uk)

---

**Made with ❤️ for UK restaurants by POS Cash**

*Transform your restaurant operations today with POS Cash - the complete hardware-free solution.* 