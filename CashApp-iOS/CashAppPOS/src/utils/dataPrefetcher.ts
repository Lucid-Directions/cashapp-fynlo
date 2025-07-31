// utils/dataPrefetcher.ts (new)
// import { queryClient } from '../services/QueryClient'; // Assuming QueryClient is set up
import DataService from '../services/DataService';

// Placeholder for queryClient if not fully set up yet.
// In a real scenario, this would be imported from a React Query setup.
const queryClient = {
  prefetchQuery: async (queryKey: unknown, queryFn: unknown) => {
    logger.info(`[dataPrefetcher] Attempting to prefetch ${queryKey.join('/')}`);
    try {
      await queryFn();
      logger.info(`[dataPrefetcher] Successfully prefetched ${queryKey.join('/')}`);
    } catch (error) {
      logger.error(`[dataPrefetcher] Error prefetching ${queryKey.join('/')}:`, error);
    }
  },
};

export async function prefetchInitialData() {
  const dataService = DataService.getInstance();

  // These methods (getMenu, getProfile) are assumed to exist on DataService
  // and would typically fetch data without needing arguments for general prefetch.
  // If they need specific IDs or params for prefetching, this would need adjustment.
  await Promise.all([
    queryClient.prefetchQuery(['menu'], () => dataService.getProducts()), // Using getProducts as a stand-in for getMenu
    queryClient.prefetchQuery(['profile'], () => dataService.getUserProfile()), // Assuming getUserProfile exists
    // queryClient.prefetchQuery(['categories'], () => dataService.getCategories()), // Example
    // add more APIs here …
  ]);
}

// It's also common to prefetch user-specific data after login.
export async function prefetchUserData() {
  const _dataService = DataService.getInstance();
  // Example:
  // await queryClient.prefetchQuery(['userOrders'], () => dataService.getRecentOrders(5));
  logger.info(
    '[dataPrefetcher] prefetchUserData called (currently no specific user data to prefetch here).'
  );
}

/**
 * How to use in App.tsx:
 *
 * import { prefetchInitialData, prefetchUserData } from './utils/dataPrefetcher';
 * import { queryClient, QueryClientProvider } from './services/QueryClient'; // Actual QueryClient setup
 *
 * function App() {
 *   const [isLoggedIn, setIsLoggedIn] = useState(false); // Or from AuthContext
 *
 *   useEffect(() => {
 *     prefetchInitialData();
 *   }, []);
 *
 *   useEffect(() => {
 *     if (isLoggedIn) {
 *       prefetchUserData();
 *     }
 *   }, [isLoggedIn]);
 *
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       { // ... rest of your app }
 *     </QueryClientProvider>
 *   );
 * }
 */
