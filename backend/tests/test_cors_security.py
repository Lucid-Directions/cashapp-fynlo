"""
CORS Security Configuration Tests
Ensures CORS is properly configured and secure in all environments
"""

import pytest
import os
from pathlib import Path
from unittest.mock import patch, MagicMock
from pydantic import ValidationError

# Import settings class
from app.core.config import Settings

# Get the backend directory path for file reading
BACKEND_DIR = Path(__file__).parent.parent


class TestCORSSecurityConfiguration:
    """Test suite for CORS security configuration"""

    def test_cors_no_wildcard_in_production(self):
        """Ensure wildcard CORS is never allowed in production"""
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                ENVIRONMENT="production",
                CORS_ALLOW_ALL_ORIGINS="true",
                DATABASE_URL="postgresql://test",
                REDIS_URL="redis://test",
                SECRET_KEY="x" * 32,
                SUPABASE_URL="https://test.supabase.co",
                SUPABASE_ANON_KEY="test-key",
            )
        
        # Check that the error message mentions CORS security
        error_str = str(exc_info.value)
        assert "CORS_ALLOW_ALL_ORIGINS cannot be true in production" in error_str

    def test_cors_origins_parsed_correctly(self):
        """Test CORS origins are parsed from comma-separated string"""
        settings = Settings(
            CORS_ALLOWED_ORIGINS="https://example.com,https://test.com,https://app.test.com",
            DATABASE_URL="postgresql://test",
            REDIS_URL="redis://test",
            SECRET_KEY="x" * 32,
            SUPABASE_URL="https://test.supabase.co",
            SUPABASE_ANON_KEY="test-key",
            ENVIRONMENT="development",
        )
        
        origins = settings.get_cors_origins
        assert "https://example.com" in origins
        assert "https://test.com" in origins
        assert "https://app.test.com" in origins

    def test_cors_production_defaults_included(self):
        """Test production defaults are always included in production"""
        settings = Settings(
            ENVIRONMENT="production",
            DATABASE_URL="postgresql://test",
            REDIS_URL="redis://test",
            SECRET_KEY="x" * 32,
            SUPABASE_URL="https://test.supabase.co",
            SUPABASE_ANON_KEY="test-key",
        )
        
        origins = settings.get_cors_origins
        # Check production defaults are included
        assert "https://app.fynlo.co.uk" in origins
        assert "https://fynlo.co.uk" in origins
        assert "https://fynlo.vercel.app" in origins
        # Localhost should NOT be in production
        assert "http://localhost:3000" not in origins
        assert "http://localhost:8080" not in origins

    def test_cors_development_includes_localhost(self):
        """Test development environment includes localhost origins"""
        settings = Settings(
            ENVIRONMENT="development",
            DATABASE_URL="postgresql://test",
            REDIS_URL="redis://test",
            SECRET_KEY="x" * 32,
            SUPABASE_URL="https://test.supabase.co",
            SUPABASE_ANON_KEY="test-key",
        )
        
        origins = settings.get_cors_origins
        # Check localhost origins are included in development
        assert "http://localhost:3000" in origins
        assert "http://localhost:8080" in origins
        assert "http://localhost:8081" in origins
        assert "http://127.0.0.1:3000" in origins

    def test_cors_no_duplicates_in_origins(self):
        """Test that duplicate origins are removed"""
        settings = Settings(
            CORS_ALLOWED_ORIGINS="https://app.fynlo.co.uk,https://test.com,https://app.fynlo.co.uk",
            ENVIRONMENT="production",
            DATABASE_URL="postgresql://test",
            REDIS_URL="redis://test",
            SECRET_KEY="x" * 32,
            SUPABASE_URL="https://test.supabase.co",
            SUPABASE_ANON_KEY="test-key",
        )
        
        origins = settings.get_cors_origins
        # Count occurrences of app.fynlo.co.uk
        count = origins.count("https://app.fynlo.co.uk")
        assert count == 1, "Duplicate origins should be removed"

    def test_cors_supabase_project_always_included(self):
        """Test that specific Supabase project URL is always included"""
        settings = Settings(
            ENVIRONMENT="production",
            DATABASE_URL="postgresql://test",
            REDIS_URL="redis://test",
            SECRET_KEY="x" * 32,
            SUPABASE_URL="https://test.supabase.co",
            SUPABASE_ANON_KEY="test-key",
        )
        
        origins = settings.get_cors_origins
        assert "https://eweggzpvuqczrrrwszyy.supabase.co" in origins

    def test_cors_vercel_previews_flag(self):
        """Test CORS_ALLOW_VERCEL_PREVIEWS flag parsing"""
        settings = Settings(
            CORS_ALLOW_VERCEL_PREVIEWS="true",
            ENVIRONMENT="development",
            DATABASE_URL="postgresql://test",
            REDIS_URL="redis://test",
            SECRET_KEY="x" * 32,
            SUPABASE_URL="https://test.supabase.co",
            SUPABASE_ANON_KEY="test-key",
        )
        
        assert settings.CORS_ALLOW_VERCEL_PREVIEWS is True

    def test_cors_credentials_flag(self):
        """Test CORS_ALLOW_CREDENTIALS flag parsing"""
        # Test with false
        settings = Settings(
            CORS_ALLOW_CREDENTIALS="false",
            ENVIRONMENT="development",
            DATABASE_URL="postgresql://test",
            REDIS_URL="redis://test",
            SECRET_KEY="x" * 32,
            SUPABASE_URL="https://test.supabase.co",
            SUPABASE_ANON_KEY="test-key",
        )
        
        assert settings.CORS_ALLOW_CREDENTIALS is False
        
        # Test default (should be False for security)
        settings2 = Settings(
            ENVIRONMENT="development",
            DATABASE_URL="postgresql://test",
            REDIS_URL="redis://test",
            SECRET_KEY="x" * 32,
            SUPABASE_URL="https://test.supabase.co",
            SUPABASE_ANON_KEY="test-key",
        )
        
        assert settings2.CORS_ALLOW_CREDENTIALS is False  # Changed to False for security

    def test_cors_empty_allowed_origins(self):
        """Test behavior with empty CORS_ALLOWED_ORIGINS"""
        settings = Settings(
            CORS_ALLOWED_ORIGINS="",
            ENVIRONMENT="production",
            DATABASE_URL="postgresql://test",
            REDIS_URL="redis://test",
            SECRET_KEY="x" * 32,
            SUPABASE_URL="https://test.supabase.co",
            SUPABASE_ANON_KEY="test-key",
        )
        
        origins = settings.get_cors_origins
        # Should still have production defaults
        assert "https://app.fynlo.co.uk" in origins
        assert len(origins) > 0

    def test_cors_whitespace_handling(self):
        """Test that whitespace in origins list is handled correctly"""
        settings = Settings(
            CORS_ALLOWED_ORIGINS="  https://example.com  ,  https://test.com  ",
            ENVIRONMENT="development",
            DATABASE_URL="postgresql://test",
            REDIS_URL="redis://test",
            SECRET_KEY="x" * 32,
            SUPABASE_URL="https://test.supabase.co",
            SUPABASE_ANON_KEY="test-key",
        )
        
        origins = settings.get_cors_origins
        assert "https://example.com" in origins
        assert "https://test.com" in origins
        # Should not have whitespace versions
        assert "  https://example.com  " not in origins

    @patch.dict(os.environ, {"ENVIRONMENT": "production", "CORS_ALLOW_ALL_ORIGINS": "true"})
    def test_cors_env_var_validation(self):
        """Test that environment variable validation works"""
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                DATABASE_URL="postgresql://test",
                REDIS_URL="redis://test",
                SECRET_KEY="x" * 32,
                SUPABASE_URL="https://test.supabase.co",
                SUPABASE_ANON_KEY="test-key",
            )
        
        error_str = str(exc_info.value)
        assert "CRITICAL SECURITY ERROR" in error_str


class TestCORSMainAppIntegration:
    """Test CORS configuration in main app files"""
    
    def test_main_simple_no_wildcard(self):
        """Verify main_simple.py doesn't have wildcard CORS"""
        file_path = BACKEND_DIR / "app" / "main_simple.py"
        if not file_path.exists():
            pytest.skip(f"File not found: {file_path}")
        
        with open(file_path, "r") as f:
            content = f.read()
        
        # Check that wildcard is not present
        assert 'allow_origins=["*"]' not in content
        assert 'allow_origins = ["*"]' not in content
        # Check that secure configuration is present (either settings or hardcoded secure origins)
        assert ("settings.get_cors_origins" in content or 
                "secure_origins" in content or 
                "https://app.fynlo.co.uk" in content)

    def test_main_minimal_no_wildcard(self):
        """Verify main_minimal.py doesn't have wildcard CORS"""
        file_path = BACKEND_DIR / "app" / "main_minimal.py"
        if not file_path.exists():
            pytest.skip(f"File not found: {file_path}")
        
        with open(file_path, "r") as f:
            content = f.read()
        
        # Check that wildcard is not present
        assert 'allow_origins=["*"]' not in content
        assert 'allow_origins = ["*"]' not in content
        # Check that secure origins list is present
        assert "secure_origins" in content
        assert "https://app.fynlo.co.uk" in content

    def test_mobile_middleware_no_wildcard(self):
        """Verify mobile_middleware.py doesn't set wildcard CORS"""
        file_path = BACKEND_DIR / "app" / "core" / "mobile_middleware.py"
        if not file_path.exists():
            pytest.skip(f"File not found: {file_path}")
        
        with open(file_path, "r") as f:
            content = f.read()
        
        # Check that wildcard header is not set
        assert 'Access-Control-Allow-Origin"] = "*"' not in content
        # Check that CORS is deprecated in this middleware
        assert "DEPRECATED" in content or "pass" in content


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])