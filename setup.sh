#!/bin/bash
# Setup script for RNTBCI Digital Twin backend
# Run this after creating your database and setting up .env

set -e

echo "=== RNTBCI Digital Twin - Phase 1 Setup ==="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found"
    echo "Please copy .env.example to .env and configure DATABASE_URL"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Run migrations
echo ""
echo "Running Alembic migrations..."
alembic upgrade head

# Verify schema
echo ""
echo "Verifying schema..."
python verify_schema.py

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "1. Review the schema with: alembic history"
echo "2. Check current version: alembic current"
echo "3. Proceed to Phase 2 after approval"
