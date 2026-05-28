#!/bin/bash
set -e

# Install frontend dependencies
cd web-frontend && npm install --prefer-offline 2>&1 | tail -5
cd ..

# Install backend dependencies
if [ -f backend/requirements.txt ]; then
  pip install -r backend/requirements.txt -q
fi
