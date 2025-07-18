from sqlalchemy import event, Engine
from sqlalchemy.engine import Connection
from datetime import datetime
import time
import logging
from typing import Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

class QueryPerformanceAnalyzer:
    """Analyzes and logs slow database queries"""
    
    def __init__(self, slow_query_threshold_ms: float = 100):
        self.slow_query_threshold_ms = slow_query_threshold_ms
        self.query_stats: Dict[str, Dict] = {}
        self.enabled = True
    
    def setup(self, engine: Engine):
        """Set up query monitoring on the engine"""
        if settings.ENVIRONMENT == "production":
            # Only log extremely slow queries in production
            self.slow_query_threshold_ms = 500
        
        @event.listens_for(engine, "before_cursor_execute")
        def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            conn.info.setdefault('query_start_time', []).append(time.time())
            
        @event.listens_for(engine, "after_cursor_execute")
        def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            if not self.enabled:
                return
                
            total_time = (time.time() - conn.info['query_start_time'].pop(-1)) * 1000
            
            # Log slow queries
            if total_time > self.slow_query_threshold_ms:
                logger.warning(
                    f"Slow query detected",
                    extra={
                        "query": statement[:500],  # Truncate long queries
                        "duration_ms": round(total_time, 2),
                        "parameters": str(parameters)[:200] if parameters else None
                    }
                )
            
            # Track query patterns
            query_pattern = self._extract_query_pattern(statement)
            if query_pattern not in self.query_stats:
                self.query_stats[query_pattern] = {
                    "count": 0,
                    "total_time_ms": 0,
                    "max_time_ms": 0,
                    "min_time_ms": float('inf')
                }
            
            stats = self.query_stats[query_pattern]
            stats["count"] += 1
            stats["total_time_ms"] += total_time
            stats["max_time_ms"] = max(stats["max_time_ms"], total_time)
            stats["min_time_ms"] = min(stats["min_time_ms"], total_time)
    
    def _extract_query_pattern(self, query: str) -> str:
        """Extract a pattern from the query for grouping similar queries"""
        # Simple pattern extraction - can be enhanced
        query_lower = query.lower().strip()
        
        if query_lower.startswith("select"):
            # Extract table name from FROM clause
            from_index = query_lower.find("from")
            if from_index > 0:
                table_part = query_lower[from_index + 4:].strip().split()[0]
                # Remove any backticks or quotes
                table_part = table_part.strip('`"\'')
                return f"SELECT FROM {table_part}"
        elif query_lower.startswith("insert"):
            into_index = query_lower.find("into")
            if into_index > 0:
                table_part = query_lower[into_index + 4:].strip().split()[0]
                table_part = table_part.strip('`"\'')
                return f"INSERT INTO {table_part}"
        elif query_lower.startswith("update"):
            table_part = query_lower[6:].strip().split()[0]
            table_part = table_part.strip('`"\'')
            return f"UPDATE {table_part}"
        elif query_lower.startswith("delete"):
            from_index = query_lower.find("from")
            if from_index > 0:
                table_part = query_lower[from_index + 4:].strip().split()[0]
                table_part = table_part.strip('`"\'')
                return f"DELETE FROM {table_part}"
        
        # For other queries, use first 50 characters
        return query_lower[:50]
    
    def get_query_stats(self) -> List[Dict]:
        """Get aggregated query statistics"""
        results = []
        for pattern, stats in self.query_stats.items():
            avg_time = stats["total_time_ms"] / stats["count"] if stats["count"] > 0 else 0
            results.append({
                "pattern": pattern,
                "count": stats["count"],
                "avg_time_ms": round(avg_time, 2),
                "max_time_ms": round(stats["max_time_ms"], 2),
                "min_time_ms": round(stats["min_time_ms"], 2) if stats["min_time_ms"] != float('inf') else 0,
                "total_time_ms": round(stats["total_time_ms"], 2)
            })
        
        # Sort by total time descending
        results.sort(key=lambda x: x["total_time_ms"], reverse=True)
        return results[:20]  # Top 20 query patterns
    
    def reset_stats(self):
        """Reset query statistics"""
        self.query_stats = {}
    
    def enable(self):
        """Enable query monitoring"""
        self.enabled = True
    
    def disable(self):
        """Disable query monitoring"""
        self.enabled = False
    
    def get_slow_query_count(self) -> int:
        """Get count of queries exceeding threshold"""
        count = 0
        for stats in self.query_stats.values():
            if stats["max_time_ms"] > self.slow_query_threshold_ms:
                count += stats["count"]
        return count
    
    def get_optimization_suggestions(self) -> List[str]:
        """Get optimization suggestions based on query patterns"""
        suggestions = []
        
        for pattern, stats in self.query_stats.items():
            avg_time = stats["total_time_ms"] / stats["count"]
            
            # Suggest indexes for slow SELECT queries
            if pattern.startswith("SELECT") and avg_time > 100:
                table_name = pattern.split()[-1]
                suggestions.append(
                    f"Consider adding indexes for table '{table_name}' - avg query time: {avg_time:.2f}ms"
                )
            
            # Warn about high-frequency queries
            if stats["count"] > 100:
                suggestions.append(
                    f"High frequency query pattern '{pattern}' executed {stats['count']} times - consider caching"
                )
            
            # Warn about consistently slow queries
            if stats["min_time_ms"] > self.slow_query_threshold_ms:
                suggestions.append(
                    f"Query pattern '{pattern}' is consistently slow (min: {stats['min_time_ms']:.2f}ms) - needs optimization"
                )
        
        return suggestions

# Global analyzer instance
query_analyzer = QueryPerformanceAnalyzer()