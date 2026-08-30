"""
Master Agent - Layer 3 (Decision Layer)
Per Decision A: Alert-only. NEVER auto-throttles any device.
Sums load, checks vs system_config, fires alerts.
"""
import math
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)


class PowerBudgetStatus:
    """Power budget status snapshot."""
    def __init__(self, total_load_watts: float, limit_watts: float, status: str, per_device: List[Dict]):
        self.total_load_watts = total_load_watts
        self.limit_watts = limit_watts
        self.status = status
        self.per_device = per_device
        self.warning_threshold = 0.80
        self.critical_threshold = 0.95


class Alert:
    """Alert record."""
    def __init__(self, alert_type: str, message: str, total_load_watts: float, limit_watts: float, timestamp=None):
        self.alert_type = alert_type
        self.message = message
        self.total_load_watts = total_load_watts
        self.limit_watts = limit_watts
        self.timestamp = timestamp or datetime.utcnow()


class MasterAgent:
    """
    Master Agent - Alert-only overload detection (Decision A).
    Per MASTER_SPEC.md: Sums load, checks vs system_config, fires alerts.
    NEVER issues throttle commands.
    """
    
    def __init__(self, system_config_manager, db_session_factory, power_factor=0.95):
        self.config_manager = system_config_manager
        self.db_session_factory = db_session_factory
        self.power_factor = power_factor
        self.warning_threshold = 0.80
        self.critical_threshold = 0.95
        self.last_alert_status = 'ok'
    
    def check_power_budget(self, live_states: Dict) -> PowerBudgetStatus:
        """
        Check power budget from live states.
        Returns status without taking any action (Decision A).
        """
        if not self.config_manager.is_setup_complete():
            return PowerBudgetStatus(0, 0, 'setup_incomplete', [])
        
        total_watts = sum(s.power_watts for s in live_states.values())
        kva = self.config_manager.get_contracted_power_kva()
        limit_watts = kva * 1000 if kva else 0
        
        per_device = [{'device_id': did, 'watts': s.power_watts} for did, s in live_states.items()]
        
        ratio = total_watts / limit_watts if limit_watts > 0 else 0
        
        if ratio >= self.critical_threshold:
            status = 'critical'
        elif ratio >= self.warning_threshold:
            status = 'warning'
        else:
            status = 'ok'
        
        return PowerBudgetStatus(total_watts, limit_watts, status, per_device)
    
    def check_and_fire_alerts(self, budget_status: PowerBudgetStatus) -> Optional[Alert]:
        """
        Check status and fire alert if threshold crossed.
        Per Decision A: ALERT ONLY, never throttle.
        """
        if budget_status.status == 'setup_incomplete':
            return None
        
        alert = None
        
        if budget_status.status == 'critical' and self.last_alert_status != 'critical':
            alert = Alert(
                alert_type='overload_trip',
                message=f'CRITICAL: Load {budget_status.total_load_watts:.0f}W exceeds {budget_status.critical_threshold*100:.0f}% of {budget_status.limit_watts:.0f}W limit',
                total_load_watts=budget_status.total_load_watts,
                limit_watts=budget_status.limit_watts
            )
        elif budget_status.status == 'warning' and self.last_alert_status == 'ok':
            alert = Alert(
                alert_type='overload_warning',
                message=f'WARNING: Load {budget_status.total_load_watts:.0f}W exceeds {budget_status.warning_threshold*100:.0f}% of {budget_status.limit_watts:.0f}W limit',
                total_load_watts=budget_status.total_load_watts,
                limit_watts=budget_status.limit_watts
            )
        
        if alert:
            self.fire_alert(alert)
        
        self.last_alert_status = budget_status.status
        return alert
    
    def fire_alert(self, alert: Alert) -> bool:
        """Write alert to database."""
        try:
            db = self.db_session_factory()
            try:
                db.execute(text("""
                    INSERT INTO alerts (timestamp, alert_type, message, total_load_watts, limit_watts)
                    VALUES (:ts, :type, :msg, :load, :limit)
                """), {
                    'ts': alert.timestamp,
                    'type': alert.alert_type,
                    'msg': alert.message,
                    'load': alert.total_load_watts,
                    'limit': alert.limit_watts
                })
                db.commit()
                logger.warning(f'ALERT: {alert.message}')
                return True
            except Exception as e:
                db.rollback()
                logger.error(f'Failed to write alert: {e}')
                return False
            finally:
                db.close()
        except Exception as e:
            logger.error(f'DB session error: {e}')
            return False
