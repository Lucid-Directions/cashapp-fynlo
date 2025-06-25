#!/bin/bash

# Fix Square SDK Framework Embedding Issues
echo "🔧 Fixing Square SDK framework embedding..."

PROJECT_DIR="$(pwd)"
FRAMEWORKS_DIR="${PROJECT_DIR}/CashAppPOS/Frameworks"

# Create Frameworks directory if it doesn't exist
mkdir -p "${FRAMEWORKS_DIR}"

# Find and copy Square frameworks
echo "📦 Locating Square frameworks..."

# Find Square frameworks in Pods
SQUARE_IN_APP_PAYMENTS=$(find "${PROJECT_DIR}/Pods" -name "SquareInAppPaymentsSDK.framework" -type d | head -1)
SQUARE_BUYER_VERIFICATION=$(find "${PROJECT_DIR}/Pods" -name "SquareBuyerVerificationSDK.framework" -type d | head -1)
CORE_PAYMENT_CARD=$(find "${PROJECT_DIR}/Pods" -name "CorePaymentCard.framework" -type d | head -1)

if [ -z "$SQUARE_IN_APP_PAYMENTS" ]; then
    echo "❌ SquareInAppPaymentsSDK.framework not found in Pods"
    exit 1
fi

if [ -z "$SQUARE_BUYER_VERIFICATION" ]; then
    echo "❌ SquareBuyerVerificationSDK.framework not found in Pods"
    exit 1
fi

# CorePaymentCard might be embedded in Square frameworks
if [ -z "$CORE_PAYMENT_CARD" ]; then
    echo "⚠️  CorePaymentCard.framework not found separately, checking inside Square frameworks..."
    
    # Check if it's inside SquareInAppPaymentsSDK
    if [ -d "${SQUARE_IN_APP_PAYMENTS}/Frameworks/CorePaymentCard.framework" ]; then
        CORE_PAYMENT_CARD="${SQUARE_IN_APP_PAYMENTS}/Frameworks/CorePaymentCard.framework"
    elif [ -d "${SQUARE_BUYER_VERIFICATION}/Frameworks/CorePaymentCard.framework" ]; then
        CORE_PAYMENT_CARD="${SQUARE_BUYER_VERIFICATION}/Frameworks/CorePaymentCard.framework"
    fi
fi

# Copy frameworks to project
echo "📋 Copying frameworks to project..."

cp -R "$SQUARE_IN_APP_PAYMENTS" "${FRAMEWORKS_DIR}/" 2>/dev/null || true
cp -R "$SQUARE_BUYER_VERIFICATION" "${FRAMEWORKS_DIR}/" 2>/dev/null || true

if [ -n "$CORE_PAYMENT_CARD" ]; then
    cp -R "$CORE_PAYMENT_CARD" "${FRAMEWORKS_DIR}/" 2>/dev/null || true
fi

echo "✅ Frameworks copied to ${FRAMEWORKS_DIR}"

# Update project.pbxproj to embed frameworks
echo "🔨 Updating Xcode project settings..."

# Create a temporary Ruby script to update the project
cat > update_project.rb << 'EOF'
#!/usr/bin/env ruby
require 'xcodeproj'

project_path = './CashAppPOS.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Find the main app target
app_target = project.targets.find { |t| t.name == 'CashAppPOS' }

if app_target.nil?
  puts "❌ CashAppPOS target not found"
  exit 1
end

# Framework names to embed
frameworks = [
  'SquareInAppPaymentsSDK.framework',
  'SquareBuyerVerificationSDK.framework',  
  'CorePaymentCard.framework'
]

# Get or create Embed Frameworks build phase
embed_phase = app_target.build_phases.find { |p| p.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) && p.name == 'Embed Frameworks' }

if embed_phase.nil?
  embed_phase = app_target.new_copy_files_build_phase('Embed Frameworks')
  embed_phase.dst_subfolder_spec = '10' # Frameworks
  embed_phase.name = 'Embed Frameworks'
end

# Add frameworks to project and embed phase
frameworks_group = project.main_group['Frameworks'] || project.main_group.new_group('Frameworks')

frameworks.each do |framework_name|
  framework_path = "CashAppPOS/Frameworks/#{framework_name}"
  
  # Check if framework exists
  unless File.exist?(framework_path)
    puts "⚠️  #{framework_name} not found at #{framework_path}"
    next
  end
  
  # Add to project if not already there
  framework_ref = frameworks_group.files.find { |f| f.path.include?(framework_name) }
  
  if framework_ref.nil?
    framework_ref = frameworks_group.new_file(framework_path)
    app_target.frameworks_build_phase.add_file_reference(framework_ref)
  end
  
  # Add to embed phase
  unless embed_phase.files.any? { |f| f.file_ref&.path&.include?(framework_name) }
    build_file = embed_phase.add_file_reference(framework_ref)
    build_file.settings = { 'ATTRIBUTES' => ['CodeSignOnCopy', 'RemoveHeadersOnCopy'] }
  end
end

# Update build settings
app_target.build_configurations.each do |config|
  config.build_settings['LD_RUNPATH_SEARCH_PATHS'] ||= []
  unless config.build_settings['LD_RUNPATH_SEARCH_PATHS'].include?('@executable_path/Frameworks')
    config.build_settings['LD_RUNPATH_SEARCH_PATHS'] << '@executable_path/Frameworks'
  end
  
  config.build_settings['FRAMEWORK_SEARCH_PATHS'] ||= []
  unless config.build_settings['FRAMEWORK_SEARCH_PATHS'].include?('$(PROJECT_DIR)/CashAppPOS/Frameworks')
    config.build_settings['FRAMEWORK_SEARCH_PATHS'] << '$(PROJECT_DIR)/CashAppPOS/Frameworks'
  end
  
  # Enable Swift for Square SDK
  config.build_settings['ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES'] = 'YES'
  config.build_settings['ENABLE_BITCODE'] = 'NO'
end

# Save project
project.save

puts "✅ Xcode project updated successfully"
EOF

ruby update_project.rb

# Clean up
rm update_project.rb

echo "🎉 Square SDK framework embedding fixed!"
echo ""
echo "Next steps:"
echo "1. Run 'pod install' again"
echo "2. Clean build folder in Xcode (Cmd+Shift+K)"
echo "3. Build and run the project"