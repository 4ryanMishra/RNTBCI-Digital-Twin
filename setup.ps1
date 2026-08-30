# Setup script for RNTBCI Digital Twin backend (PowerShell version)
# Run this after creating your database and setting up .env

$ErrorActionPreference = "Stop"

Write-Host "=== RNTBCI Digital Twin - Phase 1 Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Host "ERROR: .env file not found" -ForegroundColor Red
    Write-Host "Please copy .env.example to .env and configure DATABASE_URL"
    exit 1
}

# Check if virtual environment exists
if (-not (Test-Path venv)) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt

# Run migrations
Write-Host ""
Write-Host "Running Alembic migrations..." -ForegroundColor Yellow
alembic upgrade head

# Verify schema
Write-Host ""
Write-Host "Verifying schema..." -ForegroundColor Yellow
python verify_schema.py

Write-Host ""
Write-Host "=== Setup complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Review the schema with: alembic history"
Write-Host "2. Check current version: alembic current"
Write-Host "3. Proceed to Phase 2 after approval"
