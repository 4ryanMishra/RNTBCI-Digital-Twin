"""
Schema verification script - run after migrations to validate database structure.
This checks that all tables, columns, indexes, and views exist as specified in MASTER_SPEC.md Part 4.
"""
import os
import sys
from sqlalchemy import create_engine, inspect, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in .env file")
    sys.exit(1)

engine = create_engine(DATABASE_URL)
inspector = inspect(engine)

def check_table_exists(table_name):
    """Check if a table exists."""
    exists = table_name in inspector.get_table_names()
    status = "✓" if exists else "✗"
    print(f"  {status} Table '{table_name}' {'exists' if exists else 'MISSING'}")
    return exists

def check_columns(table_name, expected_columns):
    """Check if all expected columns exist in a table."""
    if table_name not in inspector.get_table_names():
        return False
    
    actual_columns = {col['name'] for col in inspector.get_columns(table_name)}
    all_present = True
    
    for col in expected_columns:
        exists = col in actual_columns
        status = "✓" if exists else "✗"
        if not exists:
            print(f"    {status} Column '{col}' MISSING")
            all_present = False
    
    return all_present

def check_view_exists(view_name):
    """Check if a view exists."""
    exists = view_name in inspector.get_view_names()
    status = "✓" if exists else "✗"
    print(f"  {status} View '{view_name}' {'exists' if exists else 'MISSING'}")
    return exists

def check_indexes(table_name, expected_indexes):
    """Check if expected indexes exist."""
    if table_name not in inspector.get_table_names():
        return False
    
    actual_indexes = {idx['name'] for idx in inspector.get_indexes(table_name)}
    all_present = True
    
    for idx in expected_indexes:
        exists = idx in actual_indexes
        status = "✓" if exists else "✗"
        if not exists:
            print(f"    {status} Index '{idx}' MISSING")
            all_present = False
    
    return all_present

def main():
    print("\n=== RNTBCI Digital Twin Schema Verification ===\n")
    
    all_checks_passed = True
    
    # Check system_config table
    print("1. system_config table:")
    if check_table_exists('system_config'):
        expected_cols = ['key', 'value', 'updated_at']
        if not check_columns('system_config', expected_cols):
            all_checks_passed = False
        
        # Verify it's empty (Decision C)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM system_config"))
            count = result.scalar()
            if count == 0:
                print("  ✓ Table is empty (Decision C - no defaults)")
            else:
                print(f"  ✗ Table has {count} rows (should be empty per Decision C)")
                all_checks_passed = False
    else:
        all_checks_passed = False
    
    # Check villa_tier_presets table
    print("\n2. villa_tier_presets table:")
    if check_table_exists('villa_tier_presets'):
        expected_cols = ['tier', 'phase_config', 'voltage_v', 'contracted_power_kva', 'current_rating_a']
        if not check_columns('villa_tier_presets', expected_cols):
            all_checks_passed = False
        
        # Verify seeded data
        with engine.connect() as conn:
            result = conn.execute(text("SELECT tier FROM villa_tier_presets ORDER BY tier"))
            tiers = [row[0] for row in result]
            expected_tiers = ['large', 'medium', 'small']
            if tiers == expected_tiers:
                print("  ✓ All 3 tiers seeded correctly")
            else:
                print(f"  ✗ Tiers mismatch. Expected {expected_tiers}, got {tiers}")
                all_checks_passed = False
    else:
        all_checks_passed = False
    
    # Check devices table
    print("\n3. devices table:")
    if check_table_exists('devices'):
        expected_cols = ['device_id', 'device_type', 'matter_cluster_schema', 
                        'power_behavior_type', 'rated_power_config', 'created_at']
        if not check_columns('devices', expected_cols):
            all_checks_passed = False
    else:
        all_checks_passed = False
    
    # Check power_modes table
    print("\n4. power_modes table:")
    if check_table_exists('power_modes'):
        expected_cols = ['mode_id', 'device_id', 'mode_name', 'power_watts', 'is_default']
        if not check_columns('power_modes', expected_cols):
            all_checks_passed = False
    else:
        all_checks_passed = False
    
    # Check power_readings table
    print("\n5. power_readings table:")
    if check_table_exists('power_readings'):
        expected_cols = ['reading_id', 'device_id', 'timestamp', 'power_watts', 
                        'operational_state', 'active_mode_id']
        if not check_columns('power_readings', expected_cols):
            all_checks_passed = False
        
        # Check indexes
        if not check_indexes('power_readings', ['idx_power_readings_device_time']):
            all_checks_passed = False
    else:
        all_checks_passed = False
    
    # Check alerts table
    print("\n6. alerts table:")
    if check_table_exists('alerts'):
        expected_cols = ['alert_id', 'timestamp', 'alert_type', 'message', 
                        'total_load_watts', 'limit_watts']
        if not check_columns('alerts', expected_cols):
            all_checks_passed = False
        
        # Verify no throttle field (Decision A)
        actual_columns = {col['name'] for col in inspector.get_columns('alerts')}
        if 'throttle' not in actual_columns and 'auto_throttle' not in actual_columns:
            print("  ✓ No throttle field present (Decision A - alert-only)")
        else:
            print("  ✗ Throttle field found (violates Decision A)")
            all_checks_passed = False
        
        # Check indexes
        if not check_indexes('alerts', ['idx_alerts_time']):
            all_checks_passed = False
    else:
        all_checks_passed = False
    
    # Check system_setup_status view
    print("\n7. system_setup_status view:")
    if not check_view_exists('system_setup_status'):
        all_checks_passed = False
    
    # Check custom types
    print("\n8. Custom enum types:")
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT typname FROM pg_type 
            WHERE typname IN ('power_behavior_type', 'alert_type', 'operational_state')
            ORDER BY typname
        """))
        types = [row[0] for row in result]
        expected_types = ['alert_type', 'operational_state', 'power_behavior_type']
        if types == expected_types:
            print("  ✓ All 3 enum types exist")
        else:
            print(f"  ✗ Enum types mismatch. Expected {expected_types}, got {types}")
            all_checks_passed = False
        
        # Verify operational_state enum values
        result = conn.execute(text("""
            SELECT e.enumlabel 
            FROM pg_type t 
            JOIN pg_enum e ON t.oid = e.enumtypid 
            WHERE t.typname = 'operational_state'
            ORDER BY e.enumsortorder
        """))
        op_states = [row[0] for row in result]
        expected_op_states = ['off', 'on', 'running', 'idle', 'fault', 'setup_incomplete']
        if op_states == expected_op_states:
            print("  ✓ operational_state enum has correct values (lowercase, includes setup_incomplete)")
        else:
            print(f"  ✗ operational_state values mismatch. Expected {expected_op_states}, got {op_states}")
            all_checks_passed = False
    
    # Final summary
    print("\n" + "="*50)
    if all_checks_passed:
        print("✓ All schema checks PASSED")
        print("\nPhase 1 complete. Ready for review.")
        sys.exit(0)
    else:
        print("✗ Some schema checks FAILED")
        print("\nPlease review the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
