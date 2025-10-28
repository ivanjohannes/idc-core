#!/bin/bash

# Ensure path exists
mkdir -p src/keys

# Generate RSA private key (2048 bits by default)
echo "Generating RSA key pair..."
openssl genrsa -out "src/keys/private.pem" 2048
echo "Private RSA key saved to src/keys/private.pem"

# Extract the public key from the private key
openssl rsa -in "src/keys/private.pem" -pubout -out "src/keys/public.pem"
echo "Public RSA key saved to src/keys/public.pem"

echo "RSA key pair generation complete!"
