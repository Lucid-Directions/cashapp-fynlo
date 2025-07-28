# Help Screen - Comprehensive Analysis

## Screen Overview
**File**: `src/screens/help/HelpScreen.tsx`  
**Purpose**: User support, documentation, and troubleshooting  
**Status**: 🟡 Basic UI with static content  
**Production Ready**: 20%

## 1. Current State Analysis

### What's Implemented ✅
- Help categories list
- FAQ section
- Contact support UI
- Video tutorials placeholders
- Search functionality (UI only)
- Professional help interface
- Theme-aware design

### What's Not Working ❌
- Search doesn't actually search
- FAQs are hardcoded
- No real video tutorials
- Contact form doesn't send
- No live chat integration
- Missing contextual help
- No offline documentation

### Code References
```typescript
// Lines 25-40: Hardcoded help content
const helpCategories = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'school',
    articles: [
      'First time setup',
      'Creating your first order',
      'Understanding the interface'
    ]
  },
  {
    id: 'pos-operations',
    title: 'POS Operations',
    icon: 'point-of-sale',
    articles: [
      'Taking orders',
      'Processing payments',
      'Managing refunds'
    ]
  }
  // ... more static categories
];
```

## 2. Data Flow Diagram

```
HelpScreen
    ↓
Static help content
    ↓
No backend connection
    ↓
Search filters locally
    ↓
Contact form → nowhere

Expected Flow:
HelpScreen
    ↓
GET /api/v1/help/articles
    ↓
Dynamic content based on:
  - User role
  - Subscription plan
  - Recent actions
    ↓
Contextual help system
    ↓
Support ticket creation
```

## 3. Every Function & Requirement

### Help System Components
1. **Knowledge Base**
   - Getting Started guides
   - Feature documentation
   - Video tutorials
   - Best practices
   - Troubleshooting guides
   - Release notes

2. **FAQ System**
   - Common questions
   - Role-specific FAQs
   - Feature-specific help
   - Error explanations
   - Quick solutions

3. **Support Channels**
   - In-app messaging
   - Email support
   - Phone support (Premium)
   - Live chat (Premium)
   - Ticket system
   - Community forum

4. **Contextual Help**
   - Screen-specific guides
   - Tooltip system
   - Interactive walkthroughs
   - Error help bubbles
   - Feature discovery

5. **Training Resources**
   - Video library
   - Interactive tutorials
   - Certification program
   - Webinar schedule
   - Documentation PDFs

### Expected Features
```typescript
// Help Article Structure
interface HelpArticle {
  id: string;
  title: string;
  category: string;
  content: string; // Markdown
  tags: string[];
  relatedArticles: string[];
  videos?: VideoResource[];
  images?: ImageResource[];
  
  // Metadata
  author: string;
  lastUpdated: Date;
  viewCount: number;
  helpfulCount: number;
  
  // Targeting
  roles: UserRole[]; // Who can see this
  subscriptionPlans: string[]; // Available for these plans
  versions: string[]; // App versions
}

// Support Ticket
interface SupportTicket {
  id: string;
  userId: string;
  restaurantId: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'pending' | 'resolved' | 'closed';
  
  subject: string;
  description: string;
  attachments: Attachment[];
  
  messages: TicketMessage[];
  assignedTo?: string;
  
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

// Contextual Help
interface ContextualHelp {
  screenId: string;
  elementId?: string;
  helpType: 'tooltip' | 'walkthrough' | 'video' | 'article';
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  showCondition?: {
    firstTime?: boolean;
    afterError?: boolean;
    onRequest?: boolean;
  };
}
```

### State Management
```typescript
// Current State (Static)
const [selectedCategory, setSelectedCategory] = useState<string>('');
const [searchQuery, setSearchQuery] = useState('');
const [showContactForm, setShowContactForm] = useState(false);
const [articles, setArticles] = useState<HelpArticle[]>([]);

// Should Have
const [isLoading, setIsLoading] = useState(true);
const [userTickets, setUserTickets] = useState<SupportTicket[]>([]);
const [contextualHelp, setContextualHelp] = useState<ContextualHelp[]>([]);
const [videoProgress, setVideoProgress] = useState<Record<string, number>>({});
const [bookmarkedArticles, setBookmarkedArticles] = useState<string[]>([]);
```

## 4. Platform Connections

### Content Management
1. **Platform-Level Content**
   - System announcements
   - Platform policies
   - Billing help
   - Account management
   - Feature availability

2. **Restaurant-Level Content**
   - Custom procedures
   - Restaurant policies
   - Local regulations
   - Custom workflows

### Support Routing
```typescript
// Support ticket routing based on issue type
interface SupportRouting {
  technical: {
    level1: 'in_app_help';
    level2: 'email_support';
    level3: 'phone_support';
  };
  billing: {
    handler: 'platform_support';
    escalation: 'account_manager';
  };
  feature_request: {
    handler: 'product_team';
    voting: true;
  };
}
```

## 5. Backend Requirements

### Help System API
```python
# Help articles
GET /api/v1/help/articles
Query params:
  - category: string
  - search: string
  - role: string
  - tags: string[]
Response: {
  articles: HelpArticle[],
  categories: Category[],
  featured: HelpArticle[]
}

GET /api/v1/help/articles/{id}
Response: HelpArticle

POST /api/v1/help/articles/{id}/helpful
Body: { helpful: boolean }

# FAQ System
GET /api/v1/help/faq
Query params:
  - category: string
  - role: string
Response: {
  faqs: [{
    id: string,
    question: string,
    answer: string,
    category: string,
    order: number
  }]
}

# Support Tickets
GET /api/v1/support/tickets
Response: {
  tickets: SupportTicket[],
  stats: {
    open: number,
    resolved: number,
    avgResponseTime: number
  }
}

POST /api/v1/support/tickets
Body: {
  category: string,
  priority: string,
  subject: string,
  description: string,
  attachments?: File[]
}

GET /api/v1/support/tickets/{id}
POST /api/v1/support/tickets/{id}/messages
PUT /api/v1/support/tickets/{id}/status

# Contextual Help
GET /api/v1/help/contextual/{screenId}
Response: {
  tooltips: Tooltip[],
  walkthroughs: Walkthrough[],
  videos: Video[]
}

# Search
GET /api/v1/help/search
Query params:
  - q: string
  - type: 'article' | 'faq' | 'video'
Response: {
  results: SearchResult[],
  suggestions: string[]
}
```

### Database Schema
```sql
-- Help articles
CREATE TABLE help_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  category VARCHAR(100),
  content TEXT NOT NULL,
  tags VARCHAR[] DEFAULT '{}',
  related_articles UUID[] DEFAULT '{}',
  
  -- Metadata
  author_id UUID REFERENCES users(id),
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  
  -- Targeting
  roles VARCHAR[] DEFAULT '{}',
  subscription_plans VARCHAR[] DEFAULT '{}',
  min_app_version VARCHAR(20),
  
  -- Timestamps
  published_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- FAQ entries
CREATE TABLE faq_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(100),
  tags VARCHAR[] DEFAULT '{}',
  order_index INTEGER DEFAULT 0,
  roles VARCHAR[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Support tickets
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number VARCHAR(20) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  restaurant_id UUID REFERENCES restaurants(id),
  
  category VARCHAR(50),
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'open',
  
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  assigned_to UUID REFERENCES users(id),
  resolved_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  
  -- Metrics
  first_response_at TIMESTAMP,
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5)
);

-- Ticket messages
CREATE TABLE ticket_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_internal_note BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Help analytics
CREATE TABLE help_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  article_id UUID REFERENCES help_articles(id),
  action VARCHAR(50), -- 'view', 'search', 'helpful', 'not_helpful'
  search_query TEXT,
  session_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 6. Current Issues

### Critical Issues
1. **No Dynamic Content**
   ```typescript
   // Everything is hardcoded
   const faqs = [
     { q: 'How do I process a refund?', a: 'Go to Orders...' },
     { q: 'How do I add a new item?', a: 'Navigate to Menu...' }
   ];
   // No API calls, no updates
   ```

2. **Search Non-functional**
   ```typescript
   const handleSearch = (query: string) => {
     setSearchQuery(query);
     // Just filters the hardcoded list
     // No actual search functionality
   };
   ```

3. **Contact Form Broken**
   ```typescript
   const handleSubmitTicket = () => {
     // Shows success message but doesn't send anything
     showToast('Ticket submitted successfully!');
     setShowContactForm(false);
   };
   ```

### Missing Features
1. **No Contextual Help**
   - Can't get help for current screen
   - No tooltips on complex features
   - No interactive guides

2. **No Video Content**
   - Placeholders only
   - No video player integration
   - No progress tracking

3. **No Offline Support**
   - Requires internet for static content
   - No cached articles
   - No downloadable guides

## 7. Required Fixes

### Dynamic Content System (Priority 1)
```typescript
// services/HelpService.ts
class HelpService {
  private cache: Map<string, any> = new Map();
  
  async getArticles(category?: string, search?: string): Promise<HelpArticle[]> {
    const cacheKey = `articles_${category}_${search}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    try {
      const response = await DatabaseService.apiRequest('/api/v1/help/articles', {
        params: {
          category,
          search,
          role: AuthContext.getCurrentUser().role,
          subscription: AuthContext.getSubscriptionPlan()
        }
      });
      
      const articles = response.data.articles;
      
      // Cache for 5 minutes
      this.cache.set(cacheKey, articles);
      setTimeout(() => this.cache.delete(cacheKey), 300000);
      
      return articles;
    } catch (error) {
      console.error('Failed to fetch help articles:', error);
      return this.getOfflineArticles();
    }
  }
  
  async searchHelp(query: string): Promise<SearchResults> {
    try {
      const response = await DatabaseService.apiRequest('/api/v1/help/search', {
        params: { q: query }
      });
      
      return {
        articles: response.data.articles,
        faqs: response.data.faqs,
        videos: response.data.videos,
        suggestions: response.data.suggestions
      };
    } catch (error) {
      // Fallback to local search
      return this.localSearch(query);
    }
  }
  
  private async getOfflineArticles(): Promise<HelpArticle[]> {
    // Load from bundled JSON file
    return require('../../assets/help/offline-articles.json');
  }
}
```

### Support Ticket System (Priority 2)
```typescript
// components/SupportTicketForm.tsx
const SupportTicketForm: React.FC<Props> = ({ onClose }) => {
  const [form, setForm] = useState({
    category: '',
    priority: 'medium',
    subject: '',
    description: '',
    attachments: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const handleSubmit = async () => {
    // Validate form
    const validation = validateTicketForm(form);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    
    setSubmitting(true);
    try {
      const formData = new FormData();
      
      // Add text fields
      Object.entries(form).forEach(([key, value]) => {
        if (key !== 'attachments') {
          formData.append(key, value);
        }
      });
      
      // Add attachments
      form.attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });
      
      const response = await DatabaseService.apiRequest('/api/v1/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        body: formData
      });
      
      showToast(`Ticket #${response.data.ticketNumber} created`);
      onClose();
      
      // Navigate to ticket details
      navigation.navigate('TicketDetails', { ticketId: response.data.id });
    } catch (error) {
      showToast('Failed to create ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleAddAttachment = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true
    });
    
    if (!result.cancelled && result.assets) {
      setForm(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...result.assets]
      }));
    }
  };
  
  return (
    <ScrollView>
      <Picker
        selectedValue={form.category}
        onValueChange={(value) => setForm({...form, category: value})}
      >
        <Picker.Item label="Technical Issue" value="technical" />
        <Picker.Item label="Billing Question" value="billing" />
        <Picker.Item label="Feature Request" value="feature" />
        <Picker.Item label="Training Request" value="training" />
      </Picker>
      
      {/* Rest of form */}
    </ScrollView>
  );
};
```

### Contextual Help System (Priority 3)
```typescript
// hooks/useContextualHelp.ts
export const useContextualHelp = (screenId: string) => {
  const [tooltips, setTooltips] = useState<Tooltip[]>([]);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [hasSeenWalkthrough, setHasSeenWalkthrough] = useState(false);
  
  useEffect(() => {
    loadContextualHelp();
  }, [screenId]);
  
  const loadContextualHelp = async () => {
    try {
      const response = await DatabaseService.apiRequest(
        `/api/v1/help/contextual/${screenId}`
      );
      
      setTooltips(response.data.tooltips);
      
      // Check if user has seen walkthrough
      const seenKey = `walkthrough_${screenId}_seen`;
      const hasSeen = await AsyncStorage.getItem(seenKey);
      
      if (!hasSeen && response.data.walkthrough) {
        startWalkthrough(response.data.walkthrough);
      }
    } catch (error) {
      console.error('Failed to load contextual help:', error);
    }
  };
  
  const showTooltip = (elementId: string) => {
    const tooltip = tooltips.find(t => t.elementId === elementId);
    if (tooltip) {
      setActiveTooltip(elementId);
    }
  };
  
  const startWalkthrough = async (walkthrough: Walkthrough) => {
    // Use react-native-copilot or similar
    const steps = walkthrough.steps.map(step => ({
      text: step.text,
      order: step.order,
      target: step.elementId
    }));
    
    // Start walkthrough
    copilot.start(steps);
    
    // Mark as seen
    await AsyncStorage.setItem(`walkthrough_${screenId}_seen`, 'true');
  };
  
  return {
    tooltips,
    activeTooltip,
    showTooltip,
    hideTooltip: () => setActiveTooltip(null),
    restartWalkthrough: () => startWalkthrough()
  };
};

// Usage in screens
const POSScreen = () => {
  const { showTooltip } = useContextualHelp('pos_screen');
  
  return (
    <View>
      <TouchableOpacity
        onLongPress={() => showTooltip('payment_button')}
      >
        <Text>Process Payment</Text>
      </TouchableOpacity>
    </View>
  );
};
```

### Video Tutorial System (Priority 4)
```typescript
// components/VideoTutorial.tsx
interface VideoTutorialProps {
  videoId: string;
  title: string;
  duration: number;
  thumbnail: string;
}

const VideoTutorial: React.FC<VideoTutorialProps> = ({
  videoId,
  title,
  duration,
  thumbnail
}) => {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  useEffect(() => {
    loadProgress();
  }, [videoId]);
  
  const loadProgress = async () => {
    const saved = await AsyncStorage.getItem(`video_progress_${videoId}`);
    if (saved) {
      setProgress(parseFloat(saved));
    }
  };
  
  const saveProgress = async (currentTime: number) => {
    const percentage = (currentTime / duration) * 100;
    setProgress(percentage);
    await AsyncStorage.setItem(
      `video_progress_${videoId}`,
      percentage.toString()
    );
    
    // Track analytics
    if (percentage > 90) {
      await DatabaseService.apiRequest('/api/v1/help/videos/completed', {
        method: 'POST',
        body: { videoId }
      });
    }
  };
  
  const handlePlay = () => {
    navigation.navigate('VideoPlayer', {
      videoId,
      title,
      onProgress: saveProgress,
      startTime: (progress / 100) * duration
    });
  };
  
  return (
    <TouchableOpacity onPress={handlePlay}>
      <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
      <View style={styles.progressBar}>
        <View 
          style={[styles.progress, { width: `${progress}%` }]} 
        />
      </View>
      <Text>{title}</Text>
      <Text>{formatDuration(duration)}</Text>
      {progress > 0 && <Text>{Math.round(progress)}% watched</Text>}
    </TouchableOpacity>
  );
};
```

## 8. Testing Requirements

### Unit Tests
1. Search algorithm
2. Article filtering
3. Ticket validation
4. Progress tracking
5. Cache management

### Integration Tests
1. Article loading
2. Ticket submission
3. Search functionality
4. Video playback
5. Offline mode

### User Acceptance Criteria
- [ ] Search returns relevant results
- [ ] Articles load quickly
- [ ] Tickets can be submitted with attachments
- [ ] Videos track progress
- [ ] Contextual help appears appropriately
- [ ] Offline articles are available
- [ ] FAQs are role-specific

## 9. Platform Owner Portal Integration

### Content Management System
```typescript
// Platform owners can manage all help content
interface HelpContentCMS {
  articles: {
    create: (article: HelpArticle) => void;
    edit: (id: string, updates: Partial<HelpArticle>) => void;
    publish: (id: string) => void;
    unpublish: (id: string) => void;
    delete: (id: string) => void;
    
    // Bulk operations
    importFromMarkdown: (files: File[]) => void;
    exportToPDF: (articleIds: string[]) => void;
  };
  
  faqs: {
    manage: (faqs: FAQ[]) => void;
    reorder: (faqIds: string[]) => void;
    bulkImport: (csv: File) => void;
  };
  
  videos: {
    upload: (video: File, metadata: VideoMetadata) => void;
    updateTranscript: (videoId: string, transcript: string) => void;
    addChapters: (videoId: string, chapters: Chapter[]) => void;
  };
  
  analytics: {
    mostViewed: () => HelpArticle[];
    searchQueries: () => SearchQuery[];
    unhelpfulArticles: () => HelpArticle[];
    ticketTrends: () => TicketAnalytics;
  };
}
```

### Support Dashboard
```sql
-- Support metrics
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as tickets_created,
  COUNT(*) FILTER (WHERE status = 'resolved') as tickets_resolved,
  AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/60) as avg_response_time_minutes,
  AVG(satisfaction_rating) as avg_satisfaction
FROM support_tickets
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY date
ORDER BY date DESC;

-- Common issues
SELECT 
  category,
  COUNT(*) as ticket_count,
  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
FROM support_tickets
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY category
ORDER BY ticket_count DESC;

-- Help content effectiveness
SELECT 
  ha.title,
  ha.category,
  COUNT(DISTINCT han.user_id) as unique_views,
  SUM(CASE WHEN han.action = 'helpful' THEN 1 ELSE 0 END) as helpful_count,
  SUM(CASE WHEN han.action = 'not_helpful' THEN 1 ELSE 0 END) as not_helpful_count,
  ROUND(
    SUM(CASE WHEN han.action = 'helpful' THEN 1 ELSE 0 END)::numeric / 
    NULLIF(SUM(CASE WHEN han.action IN ('helpful', 'not_helpful') THEN 1 ELSE 0 END), 0) * 100, 
    2
  ) as helpful_percentage
FROM help_articles ha
LEFT JOIN help_analytics han ON ha.id = han.article_id
WHERE han.created_at > NOW() - INTERVAL '30 days'
GROUP BY ha.id
ORDER BY unique_views DESC;
```

## Next Steps

1. **Immediate**: Create help article API endpoint
2. **Today**: Implement search functionality
3. **Tomorrow**: Build ticket submission system
4. **This Week**: Add contextual help hooks
5. **Next Week**: Video tutorial integration
6. **Future**: AI-powered help assistant

## Related Documentation
- See `DatabaseService.ts` for API integration
- See `13_BACKEND_REQUIREMENTS.md` for help endpoints
- See `AuthContext.tsx` for role-based content