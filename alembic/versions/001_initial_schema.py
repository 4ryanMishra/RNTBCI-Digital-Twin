"""Initial schema: system_config, villa_tier_presets, devices, power_modes, power_readings, alerts

Revision ID: 001
Revises: 
Create Date: 2026-08-30 02:07:00.000000

This is the baseline schema from MASTER_SPEC.md Part 4.
All tables, types, indexes, and views are created here.
No defaults are inserted into system_config (Decision C).
Villa tier presets are seeded separately.

Enum types created:
- power_behavior_type: flat, taper, duty_cycle, multi_mode
- alert_type: overload_warning, overload_trip
- operational_state: off, on, running, idle, fault, setup_incomplete
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create custom enum types
    power_behavior_type = postgresql.ENUM(
        'flat', 'taper', 'duty_cycle', 'multi_mode',
        name='power_behavior_type',
        create_type=True
    )
    power_behavior_type.create(op.get_bind())
    
    alert_type_enum = postgresql.ENUM(
        'overload_warning', 'overload_trip',
        name='alert_type',
        create_type=True
    )
    alert_type_enum.create(op.get_bind())
    
    operational_state_enum = postgresql.ENUM(
        'off', 'on', 'running', 'idle', 'fault', 'setup_incomplete',
        name='operational_state',
        create_type=True
    )
    operational_state_enum.create(op.get_bind())
    
    # system_config table
    # No defaults inserted on migration. Empty table = setup_incomplete (Decision C).
    op.create_table(
        'system_config',
        sa.Column('key', sa.Text(), nullable=False),
        sa.Column('value', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('key'),
        comment='System configuration key-value store. No defaults - empty means setup incomplete.'
    )
    
    # villa_tier_presets table
    # Used ONLY to populate system_config when user picks a tier.
    # Never read live by overload calc; system_config is the only live source.
    op.create_table(
        'villa_tier_presets',
        sa.Column('tier', sa.Text(), nullable=False),
        sa.Column('phase_config', sa.Text(), nullable=False),
        sa.Column('voltage_v', sa.Numeric(), nullable=False),
        sa.Column('contracted_power_kva', sa.Numeric(), nullable=False),
        sa.Column('current_rating_a', sa.Numeric(), nullable=False),
        sa.PrimaryKeyConstraint('tier'),
        comment='Villa tier lookup - read once at setup time to populate system_config'
    )
    
    # devices table
    op.create_table(
        'devices',
        sa.Column('device_id', sa.Text(), nullable=False),
        sa.Column('device_type', sa.Text(), nullable=False),
        sa.Column('matter_cluster_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('power_behavior_type', power_behavior_type, nullable=False),
        sa.Column('rated_power_config', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('device_id'),
        comment='Device registry - all 9 devices as rows, not hardcoded'
    )
    
    # power_modes table
    op.create_table(
        'power_modes',
        sa.Column('mode_id', sa.Text(), nullable=False),
        sa.Column('device_id', sa.Text(), nullable=False),
        sa.Column('mode_name', sa.Text(), nullable=False),
        sa.Column('power_watts', sa.Numeric(), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['device_id'], ['devices.device_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('mode_id'),
        sa.UniqueConstraint('device_id', 'mode_name', name='uq_device_mode'),
        comment='Power modes for future multi-mode devices (none of the 9 currently use this)'
    )
    
    # power_readings table
    # Row per tick, every device (Decision B) - export density requirement.
    op.create_table(
        'power_readings',
        sa.Column('reading_id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('device_id', sa.Text(), nullable=False),
        sa.Column('timestamp', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('power_watts', sa.Numeric(), nullable=False),
        sa.Column('operational_state', operational_state_enum, nullable=False),
        sa.Column('active_mode_id', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['devices.device_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['active_mode_id'], ['power_modes.mode_id']),
        sa.PrimaryKeyConstraint('reading_id'),
        comment='Row-per-tick power readings for all devices (Decision B)'
    )
    op.create_index('idx_power_readings_device_time', 'power_readings', ['device_id', 'timestamp'])
    
    # alerts table
    # Alert-only (Decision A) - no throttle field anywhere, intentional.
    op.create_table(
        'alerts',
        sa.Column('alert_id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('timestamp', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('alert_type', alert_type_enum, nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('total_load_watts', sa.Numeric(), nullable=False),
        sa.Column('limit_watts', sa.Numeric(), nullable=False),
        sa.PrimaryKeyConstraint('alert_id'),
        comment='Alert-only system (Decision A) - no throttle field'
    )
    op.create_index('idx_alerts_time', 'alerts', ['timestamp'])
    
    # Create system_setup_status view
    op.execute("""
        CREATE VIEW system_setup_status AS
        SELECT
            EXISTS (SELECT 1 FROM system_config WHERE key = 'contracted_power_kva') AS has_power_limit,
            EXISTS (SELECT 1 FROM system_config WHERE key = 'current_rating_a') AS has_current_rating
    """)


def downgrade() -> None:
    # Drop view
    op.execute('DROP VIEW IF EXISTS system_setup_status')
    
    # Drop tables in reverse order
    op.drop_index('idx_alerts_time', table_name='alerts')
    op.drop_table('alerts')
    
    op.drop_index('idx_power_readings_device_time', table_name='power_readings')
    op.drop_table('power_readings')
    
    op.drop_table('power_modes')
    op.drop_table('devices')
    op.drop_table('villa_tier_presets')
    op.drop_table('system_config')
    
    # Drop enum types
    sa.Enum(name='operational_state').drop(op.get_bind())
    sa.Enum(name='alert_type').drop(op.get_bind())
    sa.Enum(name='power_behavior_type').drop(op.get_bind())
