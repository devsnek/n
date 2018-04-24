#!/bin/bash
set -e

cd $(mktemp -d)

OS_TYPE=$(uname | tr '[:upper:]' '[:lower:]')
OS_ARCH=$(uname -m)
if [ $OS_ARCH = "x86_64" ]; then OS_ARCH="x64"; fi

ACH_NAME="node-{{VERSION}}-$OS_TYPE-$OS_ARCH"
ACH_URL="https://nodejs.org/download/{{CHANNEL}}/{{VERSION}}/$ACH_NAME.tar.gz"

echo "Downloading $ACH_URL"
curl -# -O $ACH_URL

echo "Extracting $ACH_NAME.tar.gz"
if hash pv 2>/dev/null; then
  pv -p -w 80 "$ACH_NAME.tar.gz" | tar -xf -
else
  tar -xzf "$ACH_NAME.tar.gz"
fi

cd $ACH_NAME
find . -maxdepth 1 -type f -delete

cp -r * {{INSTALL_DIR}}

if hash node 2>/dev/null; then
  echo "Node.js $(node -v) has been installed"
else
  echo "Node.js install failed!"
  exit 1
fi
