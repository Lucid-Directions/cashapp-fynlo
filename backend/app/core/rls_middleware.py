"""
RLS Middleware for automatic session context management


from typing import Callable, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_user_optional
from app.core.rls_session_context import RLSSessionContext
from app.core.security_monitor import security_monitor


class RLSMiddleware(BaseHTTPMiddleware):
    """
    Middleware to automatically set and clear RLS session context
    for all authenticated requests
    
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request with RLS context management
        """
        db: Optional[Session] = None
        user = None
        
        try:
            # Skip RLS for non-API routes
            if not request.url.path.startswith("/api/"):
                return await call_next(request)
            
            # Skip for health checks and public endpoints
            skip_paths = [
                "/api/health",
                "/api/v1/auth/login",
                "/api/v1/auth/register",
                "/api/v1/auth/refresh",
                "/docs",
                "/redoc",
                "/openapi.json"
            ]
            
            if any(request.url.path.startswith(path) for path in skip_paths):
                return await call_next(request)
            
            # Try to get current user (may not exist for public endpoints)
            try:
                # Get DB session
                db_gen = get_db()
                db = next(db_gen)
                
                # Get user if authenticated
                user = await get_current_user_optional(request, db)
                
                if user:
                    # Set RLS context for authenticated users
                    await RLSSessionContext.set_tenant_context(db, user, request)
                    
                    # Log if platform owner is accessing data
                    if hasattr(user, 'role') and user.role == 'platform_owner':
                        # Extract restaurant ID from path if present
                        path_parts = request.url.path.split('/')
                        restaurant_id = None
                        
                        if 'restaurants' in path_parts:
                            idx = path_parts.index('restaurants')
                            if idx + 1 < len(path_parts):
                                restaurant_id = path_parts[idx + 1]
                        
                        if restaurant_id and restaurant_id != str(user.restaurant_id):
                            # Platform owner accessing different restaurant
                            await security_monitor.log_platform_owner_access(
                                user=user,
                                target_restaurant_id=restaurant_id,
                                action=request.method,
                                resource_type=request.url.path,
                                details={
                                    'method': request.method,
                                    'path': request.url.path,
                                    'ip': request.client.host if request.client else 'unknown'
                                }
                            )
                
            except Exception as e:
                # If we can't get user, continue without RLS
                # This allows public endpoints to work
                pass
            
            # Process request
            response = await call_next(request)
            
            return response
            
        except Exception as e:
            # Log error but don't break the request
            import logging
            logging.error(f"RLS Middleware error: {str(e)}")
            
            # Continue without RLS rather than breaking
            return await call_next(request)
            
        finally:
            # Always clear RLS context after request
            if db and user:
                try:
                    await RLSSessionContext.clear_tenant_context(db)
                except:
                    pass  # Don't break on cleanup errors
            
            # Close DB session if we opened it
            if db:
                try:
                    db.close()
                except:
                    pass


def setup_rls_middleware(app):
    """
    Setup RLS middleware on the FastAPI app
    """
    app.add_middleware(RLSMiddleware)