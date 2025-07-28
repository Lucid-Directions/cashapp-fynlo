#!/usr/bin/env python3

import re
import uuid

def generate_pbx_id():
    """Generate a unique PBX ID similar to Xcode format"""
    return str(uuid.uuid4()).replace('-', '').upper()[:24]

def add_bundle_to_project():
    project_file = '/Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/CashApp-iOS/CashAppPOS/ios/CashAppPOS.xcodeproj/project.pbxproj'
    
    # Read the project file
    with open(project_file, 'r') as f:
        content = f.read()
    
    # Generate unique IDs for the bundle
    bundle_file_ref_id = generate_pbx_id()
    bundle_build_file_id = generate_pbx_id()
    
    print(f"Generated file reference ID: {bundle_file_ref_id}")
    print(f"Generated build file ID: {bundle_build_file_id}")
    
    # Add the build file reference in PBXBuildFile section
    build_file_pattern = r'(\t\tF11748422D0307B40044C1D9 /\* AppDelegate\.swift in Sources \*/ = \{isa = PBXBuildFile; fileRef = F11748412D0307B40044C1D9 /\* AppDelegate\.swift \*/; \};\n)'
    build_file_replacement = f'\\1\t\t{bundle_build_file_id} /* main.jsbundle in Resources */ = {{isa = PBXBuildFile; fileRef = {bundle_file_ref_id} /* main.jsbundle */; }};\n'
    
    if re.search(build_file_pattern, content):
        content = re.sub(build_file_pattern, build_file_replacement, content)
        print("✅ Added PBXBuildFile entry")
    else:
        print("❌ Could not find PBXBuildFile insertion point")
        return False
    
    # Add the file reference in PBXFileReference section
    file_ref_pattern = r'(\t\tF11748442D0722820044C1D9 /\* CashAppPOS-Bridging-Header\.h \*/.*?\n)'
    file_ref_replacement = f'\\1\t\t{bundle_file_ref_id} /* main.jsbundle */ = {{isa = PBXFileReference; lastKnownFileType = text; name = main.jsbundle; path = CashAppPOS/main.jsbundle; sourceTree = "<group>"; }};\n'
    
    if re.search(file_ref_pattern, content, re.DOTALL):
        content = re.sub(file_ref_pattern, file_ref_replacement, content, flags=re.DOTALL)
        print("✅ Added PBXFileReference entry")
    else:
        print("❌ Could not find suitable location for PBXFileReference")
        return False
    
    # Add the file to the CashAppPOS group
    group_pattern = r'(\t\t\t\tD736FE8CE469B82F94153051 /\* PrivacyInfo\.xcprivacy \*/,\n)'
    group_replacement = f'\\1\t\t\t\t{bundle_file_ref_id} /* main.jsbundle */,\n'
    
    if re.search(group_pattern, content):
        content = re.sub(group_pattern, group_replacement, content)
        print("✅ Added file to CashAppPOS group")
    else:
        print("❌ Could not find CashAppPOS group")
        return False
    
    # Add the file to Resources build phase
    resources_pattern = r'(\t\t\t\t2F35FBD5920E05EA81AEFAEB /\* PrivacyInfo\.xcprivacy in Resources \*/,\n)'
    resources_replacement = f'\\1\t\t\t\t{bundle_build_file_id} /* main.jsbundle in Resources */,\n'
    
    if re.search(resources_pattern, content):
        content = re.sub(resources_pattern, resources_replacement, content)
        print("✅ Added file to Resources build phase")
    else:
        print("❌ Could not find Resources build phase")
        return False
    
    # Write the modified content back
    with open(project_file, 'w') as f:
        f.write(content)
    
    print("✅ Successfully added main.jsbundle to Xcode project!")
    return True

if __name__ == "__main__":
    success = add_bundle_to_project()
    if success:
        print("\n🎉 Bundle has been added to the Xcode project.")
        print("You can now build and run the app - it should find the JavaScript bundle.")
    else:
        print("\n❌ Failed to add bundle to project. You may need to add it manually through Xcode.")