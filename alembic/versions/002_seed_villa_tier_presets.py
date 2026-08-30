"""Seed villa_tier_presets with real values from SYNC.md

Revision ID: 002
Revises: 001
Create Date: 2026-08-30 02:08:00.000000

Seeds the three villa tiers (Small, Medium, Large) from SYNC.md §5.
These are read ONCE at setup time to populate system_config.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Insert villa tier presets from SYNC.md §5
    op.execute("""
        INSERT INTO villa_tier_presets (tier, phase_config, voltage_v, contracted_power_kva, current_rating_a)
        VALUES
            ('small', 'single_phase', 230, 6, 30),
            ('medium', 'single_phase', 230, 9, 45),
            ('large', 'three_phase', 400, 18, 26)
    """)


def downgrade() -> None:
    # Remove seeded data
    op.execute("DELETE FROM villa_tier_presets WHERE tier IN ('small', 'medium', 'large')")
