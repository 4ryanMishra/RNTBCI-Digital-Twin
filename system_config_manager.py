"""
System Configuration Manager
Manages system_config table and villa tier setup.
Per Decision C: No hardcoded defaults, setup gate enforced.
"""
from typing import Optional, Dict, Any
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)


class SystemConfigManager:
    """Manages system configuration for household power limits."""
    
    def __init__(self, db_session_factory):
        self.db_session_factory = db_session_factory
    
    def is_setup_complete(self) -> bool:
        """Check if both contracted_power_kva and current_rating_a are set."""
        try:
            db = self.db_session_factory()
            try:
                result = db.execute(text("SELECT * FROM system_setup_status")).fetchone()
                return result[0] and result[1] if result else False
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Failed to check setup status: {e}")
            return False
    
    def get_config_value(self, key: str) -> Optional[float]:
        """Get a configuration value."""
        try:
            db = self.db_session_factory()
            try:
                result = db.execute(
                    text("SELECT value FROM system_config WHERE key = :key"),
                    {"key": key}
                ).fetchone()
                return float(result[0]) if result else None
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Failed to get config {key}: {e}")
            return None
    
    def get_contracted_power_kva(self) -> Optional[float]:
        return self.get_config_value('contracted_power_kva')
    
    def get_current_rating_a(self) -> Optional[float]:
        return self.get_config_value('current_rating_a')
    
    def setup_from_villa_tier(self, tier: str) -> bool:
        """Setup system from villa tier (read presets ONCE, write to system_config)."""
        try:
            db = self.db_session_factory()
            try:
                preset = db.execute(
                    text("SELECT contracted_power_kva, current_rating_a FROM villa_tier_presets WHERE tier = :tier"),
                    {"tier": tier}
                ).fetchone()
                
                if not preset:
                    logger.error(f"Villa tier not found: {tier}")
                    return False
                
                kva, amps = float(preset[0]), float(preset[1])
                
                db.execute(text("""
                    INSERT INTO system_config (key, value, updated_at)
                    VALUES ('contracted_power_kva', to_jsonb(:kva::numeric), now())
                    ON CONFLICT (key) DO UPDATE SET value = to_jsonb(:kva::numeric), updated_at = now()
                """), {"kva": kva})
                
                db.execute(text("""
                    INSERT INTO system_config (key, value, updated_at)
                    VALUES ('current_rating_a', to_jsonb(:amps::numeric), now())
                    ON CONFLICT (key) DO UPDATE SET value = to_jsonb(:amps::numeric), updated_at = now()
                """), {"amps": amps})
                
                db.commit()
                logger.info(f"Configured from tier '{tier}': {kva} kVA, {amps}A")
                return True
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to setup: {e}")
                return False
            finally:
                db.close()
        except Exception as e:
            logger.error(f"DB session error: {e}")
            return False
