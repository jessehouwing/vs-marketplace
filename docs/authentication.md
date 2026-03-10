# Authentication Guide

This guide explains the authentication options for publishing to the Visual Studio Marketplace.

## Authentication Methods

### Personal Access Token (PAT)

The simplest method for authentication. You'll need to:

1. Create a Personal Access Token in the Visual Studio Marketplace
2. Grant it the necessary permissions for publishing
3. Store it as a secret in your CI/CD system

**GitHub Actions:**

```yaml
- uses: jessehouwing/vs-marketplace@v6
  with:
    auth-type: pat
    token: ${{ secrets.VS_MARKETPLACE_TOKEN }}
    # ... other inputs
```

**Azure Pipelines:**

Create a service connection of type "Visual Studio Marketplace" and use:

```yaml
- task: vs-marketplace@6
  inputs:
    connectionType: "PAT"
    connectionNamePAT: "Visual Studio Marketplace"
    # ... other inputs
```

### Workload Identity Federation (OIDC)

A more secure method that doesn't require storing long-lived credentials.

#### Prerequisites

1. Azure Active Directory tenant
2. Azure service principal configured with federated credentials
3. Marketplace resource ID: `499b84ac-1321-427f-aa17-267ca6975798`

#### GitHub Actions Setup

1. Configure OIDC in your Azure AD:

   ```bash
   # Create service principal
   az ad sp create-for-rbac --name "vs-marketplace-publisher"

   # Add federated credential
   az ad app federated-credential create \
     --id <app-id> \
     --parameters '{
       "name": "github-oidc",
       "issuer": "https://token.actions.githubusercontent.com",
       "subject": "repo:<org>/<repo>:ref:refs/heads/main",
       "audiences": ["api://AzureADTokenExchange"]
     }'
   ```

2. Grant the service principal access to the Marketplace resource

3. Use in workflow:

   ```yaml
   permissions:
     id-token: write
     contents: read

   steps:
     - uses: azure/login@v1
       with:
         client-id: ${{ secrets.AZURE_CLIENT_ID }}
         tenant-id: ${{ secrets.AZURE_TENANT_ID }}
         subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

     - uses: jessehouwing/vs-marketplace@v1
       with:
         auth-type: oidc
         # ... other inputs
   ```

#### Azure Pipelines Setup

1. Create an Azure Resource Manager service connection with workload identity federation
2. Configure the resource ID in the service connection
3. Use in pipeline:

   ```yaml
   - task: vs-marketplace@6
     inputs:
       connectionType: "AzureRM"
       connectionNameAzureRM: "Visual Studio Marketplace (OIDC)"
       # ... other inputs
   ```

## Required Permissions

Your authentication method (PAT or service principal) needs the following permissions:

- **Visual Studio Marketplace**: Publish permissions
- **Publisher access**: Must be added as a user/contributor to the publisher account

## Troubleshooting

### "Could not authenticate" errors

- Verify your token/credentials are valid
- Check that the token has the correct permissions
- Ensure the token hasn't expired

### "Access denied" errors

- Verify you have publish permissions for the publisher
- Check that your publisher ID is correct
- Ensure the service principal has the right resource access

### OIDC-specific issues

- Verify the federated credential configuration matches your workflow
- Check that the resource ID is correctly set to `499b84ac-1321-427f-aa17-267ca6975798`
- Ensure the Azure login step completes successfully before publishing
