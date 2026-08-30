"""
System Configuration Manager - Layer 3/4
Manages system_config table and villa tier setup.
Per Decision C: No hardcoded defaults, setup gate enforced.
"""
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)


class SystemConfigManager:
    """
    Manages system configuration for household power limits.
    
    Per Decision C:
    - No hardcoded defaults
    - System starts setup_incomplete
    - User must select villa tier
    - Villa tier values written to system_config
    - villa_tier_presets read ONCE, never again
    """
    
    def __init__(self, db_session_factory):
        """
        Initialize system config manager.
        
        Args:
            db_session_factory: Function that returns a new SQLAlchemy Session
        """
        self.db_session_factory = db_session_factory
    
    def is_setup_complete(self) -> bool:
        """
        Check if system setup is complete.
        Requires both contracted_power_kva and current_rating_a to be set.
        
        Returns:
            True if both keys exist in system_config, False otherwise
        """
        try:
            db = self.db_session_factory()
            try:
                result = db.execute(
                    text("SELECT * FROM system_setup_status")
                ).fetchone()
                
                if result:
                    return result[0] and result[1]  # has_power_limit AND has_current_rating
                return False
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Failed to check setup status: {e}")
            return False
    
    def get_config_value(self, key: str) -> Optional[float]:
        """
        Get a configuration value.
        
        Args:
            key: 'contracted_power_kva' or 'current_rating_a'
        
        Returns:
            Numeric value, or None if not set or error
        """
        try:
            db = self.db_session_factory()
            try:
                result = db.execute(
                    text("SELECT value FROM system_config WHERE key = :key"),
                    {"key": key}
                ).fetchone()
                
                if result:
                    # Value is stored as JSONB, extract the numeric value
                    return float(result[0])
                return None
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Failed to get config value {key}: {e}")
            return None
    
    def get_contracted_power_kva(self) -> Optional[float]:
        """Get contracted power in kVA."""
        return self.get_config_value('contracted_power_kva')
    
    def get_current_rating_a(self) -> Optional[float]:
        """Get current rating in amperes."""
        return self.get_config_value('current_rating_a')
    
    def setup_from_villa_tier(self, tier: str) -> bool:
        """
        Setup system configuration from a villa tier.
        Reads villa_tier_presets ONCE, writes to system_config.
        
        Per Decision C: villa_tier_presets is read exactly once, at setup time,
        to populate system_config. It is never read again afterward.
        
        Args:
            tier: 'small', 'medium', or 'large'
        
        Returns:
            True if successful, False if failed
        """
        try:
            db = self.db_session_factory()
            try:
                # Read from villa_tier_presets (ONCE, at setup time only)
                preset = db.execute(
                    text("""
                        SELECT contracted_power_kva, current_rating_a
                        FROM villa_tier_presets
                        WHERE tier = :tier
                    """),
                    {"tier": tier}
                ).fetchone()
                
                if not preset:
                    logger.error(f"Villa tier not found: {tier}")
                    return False
                
                contracted_power_kva = float(preset[0])
                current_rating_a = float(preset[1])
                
                # Write to system_config (single source of truth)
                db.execute(
                    text("""
                        INSERT INTO system_config (key, value, updated_at)
                        VALUES ('contracted_power_kva', to_jsonb(:kva::numeric), now())
                        ON CONFLICT (key) DO UPDATE
                        SET value = to_jsonb(:kva::numeric), updated_at = now()
                    """),
                    {"kva": contracted_power_kva}
                )
                
                db.execute(
                    text("""
                        INSERT INTO system_config (key, value, updated_at)
                        VALUES ('current_rating_a', to_jsonb(:amps::numeric), now())
                        ON CONFLICT (key) DO UPDATE
                        SET value = to_jsonb(:amps::numeric), updated_at = now()
                    """),
                    {"amps": current_rating_a}
                )
                
                db.commit()
                
                logger.info(
                    f"System configured from tier '{tier}': "
                    f"{contracted_power_kva} kVA, {current_rating_a}A"
                )
                return True
                
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to setup from villa tier: {e}")
                return False
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Failed to get database session: {e}")
            return False
    
    def get_all_config(self) -> Dict[str, Any]:
        """
        Get all configuration values.
        
        Returns:
            Dict with keys: setup_complete, contracted_power_kva, current_rating_a
        """
        return {
            "setup_complete": self.is_setup_complete(),
            "contracted_power_kva": self.get_contracted_power_kva(),
            "current_rating_a": self.get_current_rating_a()
        }
