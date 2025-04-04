# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy source code
COPY . .

# Build the binary with static linking
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o action .

# Final stage
FROM scratch

LABEL maintainer="GarnetAI <support@garnet.ai>"

# Copy the compiled binary from builder stage
COPY --from=builder /app/action /action

# Copy the event_generator
COPY event_generator /event_generator

# Set the binary as executable
ENTRYPOINT ["/action"]
