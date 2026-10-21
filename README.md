# n8n-nodes-s3-presigner

A custom n8n node for generating **S3 pre-signed URLs** — temporary, access-controlled URLs for downloading or uploading S3 objects without exposing credentials to the client.

Works with both **AWS S3** and **S3-compatible storage** (MinIO, Wasabi, DigitalOcean Spaces, Tigris, …) using the native n8n credentials.

- **Download (GET)** – URL that lets the holder download a specific object.
- **Upload (PUT)** – URL that lets the holder upload to a specific object key.
- **Configurable expiration** – 1 second up to 604800 seconds (7 days, the AWS maximum).
- **Per-node region override** – use the credential's region or override it on the node.

## Credits

This package is inspired by and built on top of [klardatalabs/n8n-aws-s3-presigner](https://github.com/klardatalabs/n8n-aws-s3-presigner), which served as the base for this implementation.

## Installation

### Option 1 : directly from GitHub 

Install directly from Github:

```bash
npm install github:ia-generative/n8n-nodes-s3-presigner
```

For Docker:

```bash
docker exec n8n npm install github:ia-generative/n8n-nodes-s3-presigner
docker restart n8n
```

## Option 2 : from npmjs registry

```bash
npm install n8n-nodes-s3-presigner
```

For Docker:

```bash
docker exec n8n npm install n8n-nodes-s3-presigner
docker restart n8n
```

Restart n8n afterwards.

## Configuration

The node uses the native n8n credential selector. Choose the authentication type that matches your provider.

### Authentication selector

| Option | Use for |
|--------|---------|
| **AWS (IAM)** | AWS S3 with IAM access keys. |
| **S3** | S3-compatible providers (MinIO, Wasabi, DigitalOcean Spaces, Tigris, …). |

### AWS (IAM) credential

Use the native n8n **AWS** credential. Required fields:

| Field | Description |
|-------|-------------|
| **Region** | Default AWS region, e.g. `us-east-1`. Can be overridden per node. |
| **Access Key ID** | AWS IAM access key. |
| **Secret Access Key** | AWS IAM secret key. |
| **Temporary Security Credentials** | Enable if you use an STS session token. |
| **Session Token** | *(optional, visible when Temporary Security Credentials is on)* STS session token. |
| **Custom Endpoints → S3 Endpoint** | *(optional)* Custom S3 endpoint, e.g. for AWS PrivateLink / VPC endpoint. |

### S3 credential

Use the native n8n **S3** credential. Required fields:

| Field | Description |
|-------|-------------|
| **S3 Endpoint** | Endpoint URL of the S3-compatible provider. |
| **Region** | Region for request signing, e.g. `us-east-1` or `auto`. Can be overridden per node. |
| **Access Key ID** | Access key for the provider. |
| **Secret Access Key** | Secret key for the provider. |
| **Force Path Style** | Use path-style addressing (`https://endpoint/bucket/key`) instead of virtual-hosted style. |
| **Ignore SSL Issues** | Disable SSL certificate validation (insecure, only use for local/test setups). |

### Node (S3 Presigner)

| Field | Description | Example |
|-------|-------------|---------|
| **Authentication** | `AWS (IAM)` or `S3` *(default: `S3`)* | S3 |
| **Operation** | `Download Object (GET)` or `Upload Object (PUT)` | Download Object (GET) |
| **Bucket Name** | Name of the S3 bucket | `my-bucket` |
| **Object Key** | Key (path/filename) of the object | `uploads/document.pdf` |
| **Expires In (Seconds)** | How long the URL stays valid (1–604800) | `3600` |
| **Region** | *(optional)* overrides the credential's region | `eu-central-1` |
| **Content Type** | *(PUT only)* MIME type signed in the URL. The uploading client must send the same `Content-Type` header, otherwise AWS returns 403. Leave empty if the client sends no `Content-Type`. | `application/pdf` |

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

## Required IAM / S3 Permissions

Scope to your bucket and grant only what each operation needs:

- **Download (GET)** – `s3:GetObject`
- **Upload (PUT)** – `s3:PutObject`

### Upload (PUT): client-side upload

A 403 on a pre-signed PUT usually comes from a mismatch between what is signed and what is sent:

- Missing `s3:PutObject` IAM permission on the bucket/prefix.
- `Content-Type` sent by the client differs from the one set in the node (or sent when the field is empty and the client adds one automatically).
- URL used after expiration or with a modified key (different encoding).

Upload example:

```bash
curl -X PUT -H "Content-Type: application/pdf" --data-binary @report.pdf "<presignedUrl>"
```

## Breaking changes

Version 0.2.0 introduces the following breaking changes:

- The node has been renamed from `AWS S3 Pre-signed URL` (`awsS3Presigner`) to **`S3 Presigner`** (`s3Presigner`). Existing workflows using the old node must be recreated or migrated.
- The custom `AWS API` credential has been removed. Use the native n8n **AWS** or **S3** credentials instead.

## Development

```bash
npm install      # install dependencies
npm run dev      # start n8n with the node in watch mode
npm run build    # production build to dist/
```

All commands run through Docker in this project (see `docker-compose.yml`).
