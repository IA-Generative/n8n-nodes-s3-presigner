# n8n-nodes-s3-presigner

A custom n8n node for generating **AWS S3 pre-signed URLs** — temporary, access-controlled URLs for downloading or uploading S3 objects without exposing AWS credentials to the client.

- **Download (GET)** – URL that lets the holder download a specific object.
- **Upload (PUT)** – URL that lets the holder upload to a specific object key.
- **Configurable expiration** – 1 second up to 604800 seconds (7 days, the AWS maximum).
- **Per-node region override** – use the credential's region or override it on the node.
- **Temporary credentials** – optional STS session token support.

## Installation

Install directly from GitHub (the compiled `dist/` is committed, so no build step is needed on the server):

```bash
npm install github:ia-generative/n8n-nodes-s3-presigner
```

For Docker:

```bash
docker exec n8n npm install github:ia-generative/n8n-nodes-s3-presigner
docker restart n8n
```

Restart n8n afterwards.

## Configuration

### AWS credential (AWS API)

| Field | Description |
|-------|-------------|
| **Access Key ID** | AWS IAM access key |
| **Secret Access Key** | AWS IAM secret key |
| **Session Token** | *(optional)* only for temporary STS credentials |
| **Region** | Default AWS region, e.g. `us-east-1`. Can be overridden per node. |

The credential is validated with an STS `GetCallerIdentity` call.

### Node (AWS S3 Pre-signed URL)

| Field | Description | Example |
|-------|-------------|---------|
| **Operation** | `Download Object (GET)` or `Upload Object (PUT)` | Download Object (GET) |
| **Bucket Name** | Name of the S3 bucket | `my-bucket` |
| **Object Key** | Key (path/filename) of the object | `uploads/document.pdf` |
| **Expires In (Seconds)** | How long the URL stays valid (1–604800) | `3600` |
| **Region** | *(optional)* overrides the credential's region | `eu-central-1` |

## Output

The node passes through the incoming item's JSON and adds `presignedUrl` and `presignedUrlDetails`:

```json
{
  "presignedUrl": "https://my-bucket.s3.eu-central-1.amazonaws.com/documents/report.pdf?X-Amz-Algorithm=...",
  "presignedUrlDetails": {
    "operation": "GET",
    "bucket": "my-bucket",
    "key": "documents/report.pdf",
    "region": "eu-central-1",
    "expiresIn": 3600,
    "expiresAt": "2026-07-11T13:00:00.000Z"
  }
}
```

## Required IAM Permissions

Scope to your bucket and grant only what each operation needs:

- **Download (GET)** – `s3:GetObject`
- **Upload (PUT)** – `s3:PutObject`
- **Credential test** – `sts:GetCallerIdentity`

## Development

```bash
npm install      # install dependencies
npm run dev      # start n8n with the node in watch mode
npm run build    # production build to dist/
```
