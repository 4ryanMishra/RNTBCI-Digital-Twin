"""
History Store - Layer 2 (Digital Twin Core)
Database-backed storage for power readings history.
Used by REST API for historical queries and CSV/XLSX export.
Per MASTER_SPEC.md Part 2: separate from live store for independent failure resistance.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from device_interface import DeviceState
import logging

logger = logging.getLogger(__name__)


class HistoryStore:
    """
    Database-backed storage for power_readings table.
    Row-per-tick per device (Decision B).
    
    This store is completely independent of the live store.
    If database writes fail, live state continues serving WebSocket clients.
    Failures are logged but do not propagate to break the simulation.
    """
    
    def __init__(self, db_session_factory):
        """
        Initialize history store with a session factory.
        
        Args:
            db_session_factory: Function that returns a new SQLAlchemy Session
        """
        self.db_session_factory = db_session_factory
    
    def record_reading(
        self,
        device_id: str,
        power_watts: float,
        operational_state: str,
        timestamp: Optional[datetime] = None
    ) -> bool:
        """
        Record a power reading to the database.
        
        Per Decision B: row-per-tick, every device.
        
        Args:
            device_id: Device identifier
            power_watts: Instantaneous power draw
            operational_state: off, on, running, idle, fault, or setup_incomplete
            timestamp: Reading timestamp (defaults to now)
        
        Returns:
            True if successful, False if failed (failure is logged but not raised)
        """
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        try:
            db = self.db_session_factory()
            try:
                # Direct SQL insert for performance (bypassing ORM overhead)
                db.execute(
                    text("""
                        INSERT INTO power_readings 
                        (device_id, timestamp, power_watts, operational_state)
                        VALUES (:device_id, :timestamp, :power_watts, :operational_state)
                    """),
                    {
                        "device_id": device_id,
                        "timestamp": timestamp,
                        "power_watts": power_watts,
                        "operational_state": operational_state
                    }
                )
                db.commit()
                return True
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to record reading for {device_id}: {e}")
                return False
            finally:
                db.close()
        except Exception as e:
            # Failure to get a session - log but don't crash
            logger.error(f"Failed to get database session: {e}")
            return False
    
    def record_state(self, state: DeviceState, timestamp: Optional[datetime] = None) -> bool:
        """
        Record a DeviceState to the database.
        Convenience wrapper around record_reading.
        """
        return self.record_reading(
            device_id=state.device_id,
            power_watts=state.power_watts,
            operational_state=state.operational_state,
            timestamp=timestamp
        )
    
    def get_latest_reading(self, device_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the most recent reading for a device.
        
        Returns:
            Dict with keys: device_id, timestamp, power_watts, operational_state
            None if no readings found or database error
        """
        try:
            db = self.db_session_factory()
            try:
                result = db.execute(
                    text("""
                        SELECT device_id, timestamp, power_watts, operational_state
                        FROM power_readings
                        WHERE device_id = :device_id
                        ORDER BY timestamp DESC
                        LIMIT 1
                    """),
                    {"device_id": device_id}
                ).fetchone()
                
                if result:
                    return {
                        "device_id": result[0],
                        "timestamp": result[1],
                        "power_watts": float(result[2]),
                        "operational_state": result[3]
                    }
                return None
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Failed to get latest reading for {device_id}: {e}")
            return None
    
    def get_readings_range(
        self,
        device_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get power readings within a time range.
        Used by export endpoints.
        
        Args:
            device_id: Filter by device (None for all devices)
            start_time: Start of time range (None for no lower bound)
            end_time: End of time range (None for no upper bound)
            limit: Maximum number of rows (None for no limit)
        
        Returns:
            List of reading dicts, ordered by timestamp
        """
        try:
            db = self.db_session_factory()
            try:
                query = """
                    SELECT device_id, timestamp, power_watts, operational_state
                    FROM power_readings
                    WHERE 1=1
                """
                params = {}
                
                if device_id:
                    query += " AND device_id = :device_id"
                    params["device_id"] = device_id
                
                if start_time:
                    query += " AND timestamp >= :start_time"
                    params["start_time"] = start_time
                
                if end_time:
                    query += " AND timestamp <= :end_time"
                    params["end_time"] = end_time
                
                query += " ORDER BY timestamp ASC"
                
                if limit:
                    query += " LIMIT :limit"
                    params["limit"] = limit
                
                results = db.execute(text(query), params).fetchall()
                
                return [
                    {
                        "device_id": row[0],
                        "timestamp": row[1],
                        "power_watts": float(row[2]),
                        "operational_state": row[3]
                    }
                    for row in results
                ]
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Failed to get readings range: {e}")
            return []
    
    def get_reading_count(self, device_id: Optional[str] = None) -> int:
        """
        Get total count of readings.
        
        Args:
            device_id: Filter by device (None for all devices)
        
        Returns:
            Total count, or 0 if error
        """
        try:
            db = self.db_session_factory()
            try:
                if device_id:
                    result = db.execute(
                        text("SELECT COUNT(*) FROM power_readings WHERE device_id = :device_id"),
                        {"device_id": device_id}
                    ).scalar()
                else:
                    result = db.execute(
                        text("SELECT COUNT(*) FROM power_readings")
                    ).scalar()
                
                return result or 0
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Failed to get reading count: {e}")
            return 0
