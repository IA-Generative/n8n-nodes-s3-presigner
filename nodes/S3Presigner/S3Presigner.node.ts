import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import https from 'https';
import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class S3Presigner implements INodeType {
	description: INodeTypeDescription = {
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
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
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
				description:
					'How long the pre-signed URL stays valid, in seconds. Maximum allowed is 604800 (7 days - value max on AWS).',
			},
			{
				displayName: 'Region',
				name: 'region',
				type: 'string',
				default: '',
				placeholder: 'eu-central-1',
				description:
					'AWS/S3 region of the bucket. Leave empty to use the region configured in the credentials.',
			},
			{
				displayName: 'Content Type',
				name: 'contentType',
				type: 'string',
				default: '',
				placeholder: 'application/pdf',
				description:
					'MIME type the uploader must send in the Content-Type header. Required when the uploading client sends this header, otherwise AWS returns 403.', 
				displayOptions: {
					show: {
						operation: ['putObject'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const authentication = this.getNodeParameter('authentication', 0) as 'aws' | 's3';
		const credentials = await this.getCredentials(authentication);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const bucketName = (this.getNodeParameter('bucketName', itemIndex) as string).trim();
				const objectKey = (this.getNodeParameter('objectKey', itemIndex) as string).trim();
				const expiresIn = this.getNodeParameter('expiresIn', itemIndex, 3600) as number;
				const regionOverride = (this.getNodeParameter('region', itemIndex, '') as string).trim();

				if (!bucketName) {
					throw new NodeOperationError(this.getNode(), 'Bucket Name must not be empty', {
						itemIndex,
					});
				}
				if (!objectKey) {
					throw new NodeOperationError(this.getNode(), 'Object Key must not be empty', {
						itemIndex,
					});
				}
				if (!expiresIn || expiresIn < 1 || expiresIn > 604800) {
					throw new NodeOperationError(
						this.getNode(),
						'Expires In must be between 1 and 604800 seconds (7 days)',
						{ itemIndex },
					);
				}

				let region: string;
				const s3ClientConfig: ConstructorParameters<typeof S3Client>[0] = {};

				if (authentication === 'aws') {
					region = regionOverride || (credentials.region as string);
					if (!region) {
						throw new NodeOperationError(
							this.getNode(),
							'No region provided. Set it in the node or in the AWS credentials.',
							{ itemIndex },
						);
					}

					s3ClientConfig.region = region;
					s3ClientConfig.credentials = {
						accessKeyId: credentials.accessKeyId as string,
						secretAccessKey: credentials.secretAccessKey as string,
						...(credentials.temporaryCredentials && credentials.sessionToken
							? { sessionToken: credentials.sessionToken as string }
							: {}),
					};

					if (
						credentials.customEndpoints &&
						credentials.s3Endpoint &&
						(credentials.s3Endpoint as string).trim()
					) {
						s3ClientConfig.endpoint = (credentials.s3Endpoint as string).trim();
					}
				} else {
					const endpoint = (credentials.endpoint as string | undefined)?.trim();
					if (!endpoint) {
						throw new NodeOperationError(
							this.getNode(),
							'S3 Endpoint must be configured in the S3 credentials.',
							{ itemIndex },
						);
					}

					region = regionOverride || (credentials.region as string);
					if (!region) {
						throw new NodeOperationError(
							this.getNode(),
							'No region provided. Set it in the node or in the S3 credentials.',
							{ itemIndex },
						);
					}

					s3ClientConfig.region = region;
					s3ClientConfig.endpoint = endpoint;
					s3ClientConfig.forcePathStyle = credentials.forcePathStyle as boolean;
					s3ClientConfig.credentials = {
						accessKeyId: credentials.accessKeyId as string,
						secretAccessKey: credentials.secretAccessKey as string,
					};

					if (credentials.ignoreSSLIssues) {
						s3ClientConfig.requestHandler = new NodeHttpHandler({
							httpsAgent: new https.Agent({ rejectUnauthorized: false }),
						});
					}
				}

				const s3Client = new S3Client(s3ClientConfig);

				const contentType =
					operation === 'putObject'
						? (this.getNodeParameter('contentType', itemIndex, '') as string).trim() 
						: "";

				const command =
					operation === 'putObject'
						? new PutObjectCommand({
								Bucket: bucketName,
								Key: objectKey,
								...(contentType ? { ContentType: contentType } : {}),
							})
						: new GetObjectCommand({ Bucket: bucketName, Key: objectKey });

				const presignedUrl = await getSignedUrl(s3Client, command, {
					expiresIn,
					...(operation === 'putObject' && contentType
						? { signableHeaders: new Set(['content-type']) }
						: {}),
				});

				returnData.push({
					json: {
						...items[itemIndex].json,
						presignedUrl,
						presignedUrlDetails: {
							operation: operation === 'putObject' ? 'PUT' : 'GET',
							bucket: bucketName,
							key: objectKey,
							contentType,
							region,
							expiresIn,
							expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
						},
					},
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				const nodeError =
					error instanceof NodeOperationError
						? error
						: new NodeOperationError(this.getNode(), error as Error, {
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
