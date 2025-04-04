#!/bin/bash
set -e

# Change to the directory containing the Dockerfile
cd "$(dirname "$0")"

# Configuration
IMAGE_NAME="ghcr.io/garnet-org/action"
TAG=${1:-latest}

echo "Building Docker image: $IMAGE_NAME:$TAG"

# Build the Docker image
docker build -t $IMAGE_NAME:$TAG .

echo "Docker image built successfully"

# Check if already logged in to GitHub Container Registry
if ! docker info | grep -q "ghcr.io"; then
  echo "Please login to GitHub Container Registry first:"
  echo "Run: docker login ghcr.io -u USERNAME -p GITHUB_TOKEN"
  exit 1
fi

# Push the image to GitHub Container Registry
echo "Pushing image to GitHub Container Registry..."
docker push $IMAGE_NAME:$TAG

echo "Image pushed successfully: $IMAGE_NAME:$TAG"