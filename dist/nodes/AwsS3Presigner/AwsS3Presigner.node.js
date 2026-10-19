"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsS3Presigner = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const client_sts_1 = require("@aws-sdk/client-sts");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const n8n_workflow_1 = require("n8n-workflow");
class AwsS3Presigner {
    constructor() {
        this.description = {
            displayName: 'AWS S3 Pre-signed URL',
            name: 'awsS3Presigner',
            icon: 'file:s3.svg',
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["operation"] === "putObject" ? "Upload (PUT)" : "Download (GET)"}}',
            description: 'Generates pre-signed URLs for AWS S3 objects',
            defaults: {
                name: 'AWS S3 Pre-signed URL',
            },
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            usableAsTool: true,
            credentials: [
                {
                    name: 'awsApi',
                    required: true,
                    testedBy: 'awsApiTest',
                },
            ],
            properties: [
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
                    description: 'AWS region of the bucket. Leave empty to use the region configured in the credentials.',
                },
            ],
        };
        this.methods = {
            credentialTest: {
                async awsApiTest(credential) {
                    const credentials = credential.data;
                    try {
                        const stsClient = new client_sts_1.STSClient({
                            region: credentials.region || 'us-east-1',
                            credentials: {
                                accessKeyId: credentials.accessKeyId,
                                secretAccessKey: credentials.secretAccessKey,
                                ...(credentials.sessionToken ? { sessionToken: credentials.sessionToken } : {}),
                            },
                        });
                        await stsClient.send(new client_sts_1.GetCallerIdentityCommand({}));
                        return { status: 'OK', message: 'Connection successful' };
                    }
                    catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        return { status: 'Error', message: `Credential test failed: ${message}` };
                    }
                },
            },
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        const credentials = await this.getCredentials('awsApi');
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
                const region = regionOverride || credentials.region;
                if (!region) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'No region provided. Set it in the node or in the credentials.', { itemIndex });
                }
                const s3Client = new client_s3_1.S3Client({
                    region,
                    credentials: {
                        accessKeyId: credentials.accessKeyId,
                        secretAccessKey: credentials.secretAccessKey,
                        ...(credentials.sessionToken
                            ? { sessionToken: credentials.sessionToken }
                            : {}),
                    },
                });
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
exports.AwsS3Presigner = AwsS3Presigner;
//# sourceMappingURL=AwsS3Presigner.node.js.map