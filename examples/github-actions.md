# GitHub Actions Example

This example shows how to use the Visual Studio Marketplace Publishing action in a GitHub Actions workflow.

## Basic Usage

```yaml
name: Publish VS Extension

on:
  push:
    tags:
      - "v*"

jobs:
  publish:
    runs-on: windows-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Build Extension
        run: |
          # Your build steps here
          # This should produce a .vsix file

      - name: Publish to Visual Studio Marketplace
        uses: jessehouwing/vs-marketplace@v1
        with:
          auth-type: pat
          token: ${{ secrets.VS_MARKETPLACE_TOKEN }}
          vsix-file: output/MyExtension.vsix
          manifest-file: publishManifest.json
          publisher-id: my-publisher
```

## Using OIDC Authentication

For enhanced security using Workload Identity Federation:

```yaml
name: Publish VS Extension (OIDC)

on:
  push:
    tags:
      - "v*"

permissions:
  id-token: write
  contents: read

jobs:
  publish:
    runs-on: windows-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Azure Login
        uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Build Extension
        run: |
          # Your build steps here

      - name: Publish to Visual Studio Marketplace
        uses: jessehouwing/vs-marketplace@v1
        with:
          auth-type: oidc
          vsix-file: output/MyExtension.vsix
          manifest-file: publishManifest.json
          publisher-id: my-publisher
```

## Ignoring Warnings

If you need to ignore specific warnings during validation:

```yaml
- name: Publish to Visual Studio Marketplace
  uses: jessehouwing/vs-marketplace@v1
  with:
    auth-type: pat
    token: ${{ secrets.VS_MARKETPLACE_TOKEN }}
    vsix-file: output/MyExtension.vsix
    manifest-file: publishManifest.json
    publisher-id: my-publisher
    ignore-warnings: VSIXValidatorWarning01,VSIXValidatorWarning02
```

## Example Publish Manifest

Create a `publishManifest.json` file in your repository:

```json
{
  "$schema": "http://json.schemastore.org/vsix-publish",
  "categories": ["coding", "snippets"],
  "identity": {
    "internalName": "MyExtension"
  },
  "overview": "README.md",
  "priceCategory": "free",
  "publisher": "my-publisher",
  "private": false,
  "qna": true,
  "repo": "https://github.com/my-org/my-extension"
}
```
