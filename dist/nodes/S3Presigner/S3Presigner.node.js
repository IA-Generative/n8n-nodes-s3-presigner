"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Presigner = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const node_http_handler_1 = require("@smithy/node-http-handler");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const https_1 = __importDefault(require("https"));
const n8n_workflow_1 = require("n8n-workflow");
class S3Presigner {
    constructor() {
        this.description = {
            displayName: 'S3 Presigner',
            name: 's3Presigner',
            icon: 'file:s3.svg',
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["operation"] === "putObject" ? "Upload (PUT)" : "Download (GET)"}}',
            description: 'Generates pre-signed URLs for S3 objects',
            defaults: {
                name: 'S3 Presigner',
            },
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            usableAsTool: true,
            credentials: [
                {
                    name: 's3',
                    required: true,
                    displayOptions: {
                        show: {
                            authentication: ['s3'],
                        },
                    },
                },
                {
                    name: 'aws',
                    required: true,
                    displayOptions: {
                        show: {
                            authentication: ['aws'],
                        },
                    },
                },
            ],
            properties: [
                {
                    displayName: 'Authentication',
                    name: 'authentication',
                    type: 'options',
                    noDataExpression: true,
                    options: [
                        {
                            name: 'S3',
                            value: 's3',
                            description: 'Use native n8n S3 credentials for S3-compatible storage',
                        },
                        {
                            name: 'AWS (IAM)',
                            value: 'aws',
                            description: 'Use native n8n AWS credentials',
                        }
                    ],
                    default: 's3',
                },
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    options: [
                        {
                            name: 'Download Object (GET)',
                            value: 'getObject',
                            description: 'Generate a URL that allows downloading an object',
                            action: 'Generate a presigned download URL',
                        },
                        {
                            name: 'Upload Object (PUT)',
                            value: 'putObject',
                            description: 'Generate a URL that allows uploading an object',
                            action: 'Generate a presigned upload URL',
                        },
                    ],
                    default: 'getObject',
                },
                {
                    displayName: 'Bucket Name',
                    name: 'bucketName',
                    type: 'string',
                    default: '',
                    required: true,
                    placeholder: 'my-bucket',
                    description: 'Name of the S3 bucket',
                },
                {
                    displayName: 'Object Key',
                    name: 'objectKey',
                    type: 'string',
                    default: '',
                    required: true,
                    placeholder: 'path/to/file.pdf',
                    description: 'Key (path/filename) of the object in the bucket',
                },
                {
                    displayName: 'Expires In (Seconds)',
                    name: 'expiresIn',
                    type: 'number',
                    typeOptions: {
                        minValue: 1,
                        maxValue: 604800,
                    },
                    default: 3600,
                    description: 'How long the pre-signed URL stays valid, in seconds. Maximum allowed by AWS is 604800 (7 days).',
                },
                {
                    displayName: 'Region',
                    name: 'region',
                    type: 'string',
                    default: '',
                    placeholder: 'eu-central-1',
                    description: 'AWS/S3 region of the bucket. Leave empty to use the region configured in the credentials.',
                },
            ],
        };
    }
    async execute() {
        var _a;
        const items = this.getInputData();
        const returnData = [];
        const authentication = this.getNodeParameter('authentication', 0);
        const credentials = await this.getCredentials(authentication);
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const operation = this.getNodeParameter('operation', itemIndex);
                const bucketName = this.getNodeParameter('bucketName', itemIndex).trim();
                const objectKey = this.getNodeParameter('objectKey', itemIndex).trim();
                const expiresIn = this.getNodeParameter('expiresIn', itemIndex, 3600);
                const regionOverride = this.getNodeParameter('region', itemIndex, '').trim();
                if (!bucketName) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Bucket Name must not be empty', {
                        itemIndex,
                    });
                }
                if (!objectKey) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Object Key must not be empty', {
                        itemIndex,
                    });
                }
                if (!expiresIn || expiresIn < 1 || expiresIn > 604800) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Expires In must be between 1 and 604800 seconds (7 days)', { itemIndex });
                }
                let region;
                const s3ClientConfig = {};
                if (authentication === 'aws') {
                    region = regionOverride || credentials.region;
                    if (!region) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'No region provided. Set it in the node or in the AWS credentials.', { itemIndex });
                    }
                    s3ClientConfig.region = region;
                    s3ClientConfig.credentials = {
                        accessKeyId: credentials.accessKeyId,
                        secretAccessKey: credentials.secretAccessKey,
                        ...(credentials.temporaryCredentials && credentials.sessionToken
                            ? { sessionToken: credentials.sessionToken }
                            : {}),
                    };
                    if (credentials.customEndpoints &&
                        credentials.s3Endpoint &&
                        credentials.s3Endpoint.trim()) {
                        s3ClientConfig.endpoint = credentials.s3Endpoint.trim();
                    }
                }
                else {
                    const endpoint = (_a = credentials.endpoint) === null || _a === void 0 ? void 0 : _a.trim();
                    if (!endpoint) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'S3 Endpoint must be configured in the S3 credentials.', { itemIndex });
                    }
                    region = regionOverride || credentials.region;
                    if (!region) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'No region provided. Set it in the node or in the S3 credentials.', { itemIndex });
                    }
                    s3ClientConfig.region = region;
                    s3ClientConfig.endpoint = endpoint;
                    s3ClientConfig.forcePathStyle = credentials.forcePathStyle;
                    s3ClientConfig.credentials = {
                        accessKeyId: credentials.accessKeyId,
                        secretAccessKey: credentials.secretAccessKey,
                    };
                    if (credentials.ignoreSSLIssues) {
                        s3ClientConfig.requestHandler = new node_http_handler_1.NodeHttpHandler({
                            httpsAgent: new https_1.default.Agent({ rejectUnauthorized: false }),
                        });
                    }
                }
                const s3Client = new client_s3_1.S3Client(s3ClientConfig);
                const command = operation === 'putObject'
                    ? new client_s3_1.PutObjectCommand({ Bucket: bucketName, Key: objectKey })
                    : new client_s3_1.GetObjectCommand({ Bucket: bucketName, Key: objectKey });
                const presignedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn });
                returnData.push({
                    json: {
                        ...items[itemIndex].json,
                        presignedUrl,
                        presignedUrlDetails: {
                            operation: operation === 'putObject' ? 'PUT' : 'GET',
                            bucket: bucketName,
                            key: objectKey,
                            region,
                            expiresIn,
                            expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
                        },
                    },
                    pairedItem: { item: itemIndex },
                });
            }
            catch (error) {
                const nodeError = error instanceof n8n_workflow_1.NodeOperationError
                    ? error
                    : new n8n_workflow_1.NodeOperationError(this.getNode(), error, {
                        itemIndex,
                        description: 'Failed to generate the pre-signed URL',
                    });
                if (this.continueOnFail()) {
                    returnData.push({
                        json: items[itemIndex].json,
                        error: nodeError,
                        pairedItem: { item: itemIndex },
                    });
                    continue;
                }
                throw nodeError;
            }
        }
        return [returnData];
    }
}
exports.S3Presigner = S3Presigner;
//# sourceMappingURL=S3Presigner.node.js.map