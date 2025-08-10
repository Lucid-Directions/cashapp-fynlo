/**
 * Debug version of index.js to catch registration errors
 */

console.log('=== DEBUG: index.debug.js starting ===');

try {
  console.log('DEBUG: Importing React Native modules...');
  const { AppRegistry } = require('react-native');
  console.log('DEBUG: AppRegistry imported successfully');

  console.log('DEBUG: Importing App component...');
  const App = require('./App').default;
  console.log('DEBUG: App component imported successfully');

  console.log('DEBUG: Importing app.json...');
  const { name: appName } = require('./app.json');
  console.log('DEBUG: App name from app.json:', appName);

  console.log('DEBUG: Registering component...');
  AppRegistry.registerComponent(appName, () => {
    console.log('DEBUG: Component factory function called');
    return App;
  });
  console.log('DEBUG: Component registered successfully!');

} catch (error) {
  console.error('=== FATAL ERROR IN INDEX.JS ===');
  console.error('Error type:', error.name);
  console.error('Error message:', error.message);
  console.error('Stack trace:', error.stack);
  
  // Try to register a minimal fallback app
  try {
    const { AppRegistry, View, Text } = require('react-native');
    const React = require('react');
    
    const ErrorApp = () => {
      return React.createElement(View, {
        style: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'red' }
      }, 
        React.createElement(Text, { style: { color: 'white', fontSize: 20 } }, 
          'App Failed to Load: ' + error.message
        )
      );
    };
    
    AppRegistry.registerComponent('CashAppPOS', () => ErrorApp);
    console.log('DEBUG: Fallback error app registered');
  } catch (fallbackError) {
    console.error('DEBUG: Even fallback registration failed:', fallbackError);
  }
}

console.log('=== DEBUG: index.debug.js completed ===');