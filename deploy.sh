#!/bin/bash
# ==============================================================================
# City Futures Storyteller - Google Cloud Run Deployment Script
#
# This script automates the deployment of the Node.js WebSocket backend to
# Google Cloud Run, fulfilling the infrastructure-as-code/automation 
# requirement for the Gemini Live Agent Challenge.
# ==============================================================================

set -e

# Configuration variables
PROJECT_ID="your-google-cloud-project-id"
REGION="us-central1"
SERVICE_NAME="city-futures-backend"
IMAGE_TAG="gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"

echo "🚀 Starting deployment of $SERVICE_NAME to Google Cloud Run..."

# 1. Check if user is logged in to gcloud
if ! gcloud auth print-access-token &> /dev/null; then
  echo "❌ You are not authenticated with Google Cloud. Please run 'gcloud auth login' and try again."
  exit 1
fi

# 2. Set the active project
echo "🛠️  Setting active GCP project to: $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# 3. Build the Docker image using Cloud Build
echo "📦 Building container image..."
cd server
gcloud builds submit --tag $IMAGE_TAG

# 4. Deploy to Cloud Run
# Note: We enable HTTP/2 and WebSockets, and require unauthenticated access
# for the hackathon MVP. We also pass the required GEMINI_API_KEY as a secret.
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_TAG \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"

echo "✅ Deployment complete!"
echo "📡 You can now connect your React frontend to the resulting Cloud Run URL."
